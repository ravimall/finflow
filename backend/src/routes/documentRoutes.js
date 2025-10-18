// backend/src/routes/documentRoutes.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const { Op } = require("sequelize");
const dbx = require("../config/dropbox");
const {
  sequelize,
  Customer,
  CustomerAgent,
  Document,
  User,
} = require("../models");
const auth = require("../middleware/auth");
const {
  ensureFolderHierarchy,
  listFolder,
  combineWithinFolder,
  isLegacyDropboxPath,
  sanitizeSegment,
  logDropboxAction,
} = require("../utils/dropbox");
const { sanitizeFileName, buildUploadPath } = require("../utils/dropboxUpload");
const {
  shouldUseFolderId,
  getOrCreateCustomerFolder,
  resolveFolderPath,
} = require("../services/dropboxFolders");
const { logAudit } = require("../utils/audit");

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

function handleDropboxError(res, err, fallbackMessage) {
  const rawMessage =
    err?.error?.error_summary || err?.message || fallbackMessage || "Dropbox request failed";
  const normalizedMessage = typeof rawMessage === "string" ? rawMessage : String(rawMessage);
  const lower = normalizedMessage.toLowerCase();
  const connectionFailed =
    err?.status === 401 ||
    lower.includes("invalid_access_token") ||
    lower.includes("expired_access_token") ||
    lower.includes("invalid_client") ||
    lower.includes("cannot_refresh_access_token");

  if (connectionFailed) {
    // eslint-disable-next-line no-console
    console.error(`❌ Dropbox connection failed: ${normalizedMessage}`);
    return res
      .status(500)
      .json({ error: `Dropbox connection failed: ${normalizedMessage}` });
  }

  const statusCode = err?.statusCode || err?.status || 500;
  return res.status(statusCode).json({ error: normalizedMessage });
}

async function userCanAccessCustomer(user, customerId) {
  if (user.role === "admin") {
    return true;
  }

  const assignment = await CustomerAgent.findOne({
    where: { customer_id: customerId, agent_id: user.id },
  });

  if (assignment) {
    return true;
  }

  const customer = await Customer.findByPk(customerId);
  if (customer && customer.created_by === user.id) {
    return true;
  }

  return false;
}

function logDropboxPathUpdate(customerId, path) {
  const serializedPath = typeof path === "string" && path.trim() ? path : null;
  // eslint-disable-next-line no-console
  console.info(
    `[DropboxPathUpdate] id=${customerId} path=${serializedPath ? JSON.stringify(serializedPath) : "null"}`
  );
}

async function findCustomerForDropboxPath(user, dropboxPath) {
  if (!dropboxPath) {
    return null;
  }

  const normalized = dropboxPath.toLowerCase();
  const doc = await Document.findOne({
    where: { file_path: normalized },
    attributes: ["customer_id"],
  });

  if (doc) {
    const customer = await Customer.findByPk(doc.customer_id);
    if (customer) {
      const allowed = await userCanAccessCustomer(user, customer.id);
      if (allowed) {
        return customer;
      }
      const err = new Error("Forbidden");
      err.statusCode = 403;
      throw err;
    }
  }

  const customers = await Customer.findAll({
    where: { dropboxFolderPath: { [Op.ne]: null } },
    attributes: ["id", ["dropbox_folder_path", "dropboxFolderPath"]],
  });

  for (const customer of customers) {
    if (!customer.dropboxFolderPath) {
      continue;
    }

    if (normalized.startsWith(customer.dropboxFolderPath.toLowerCase())) {
      const allowed = await userCanAccessCustomer(user, customer.id);
      if (allowed) {
        return customer;
      }
      const err = new Error("Forbidden");
      err.statusCode = 403;
      throw err;
    }
  }

  return null;
}

async function ensureCustomerFolderPath(customer, actingUserId, transaction) {
  if (customer.dropboxFolderPath && !isLegacyDropboxPath(customer.dropboxFolderPath)) {
    return { path: customer.dropboxFolderPath, created: false };
  }

  if (customer.dropboxFolderPath && isLegacyDropboxPath(customer.dropboxFolderPath)) {
    logDropboxPathUpdate(customer.id, null);
    await customer.update({ dropboxFolderPath: null }, { transaction });
  }

  if (shouldUseFolderId()) {
    if (!customer.dropboxFolderId) {
      const folderDetails = await getOrCreateCustomerFolder(customer);
      const updates = {};
      if (folderDetails.folderId) {
        updates.dropboxFolderId = folderDetails.folderId;
      }
      if (folderDetails.pathDisplay) {
        logDropboxPathUpdate(customer.id, folderDetails.pathDisplay);
        updates.dropboxFolderPath = folderDetails.pathDisplay;
      }

      if (Object.keys(updates).length) {
        await customer.update(updates, { transaction });
      }

      if (folderDetails.created) {
        await logAudit(
          actingUserId,
          customer.id,
          "dropbox.folder.created",
          JSON.stringify({ path: folderDetails.pathDisplay, id: folderDetails.folderId }),
          transaction
        );
      }

      return { path: folderDetails.pathDisplay, created: folderDetails.created };
    }

    const resolvedPath = await resolveFolderPath(customer.dropboxFolderId);
    if (resolvedPath && resolvedPath !== customer.dropboxFolderPath) {
      logDropboxPathUpdate(customer.id, resolvedPath);
      await customer.update({ dropboxFolderPath: resolvedPath }, { transaction });
      return { path: resolvedPath, created: false };
    }

    if (!resolvedPath) {
      const refreshed = await getOrCreateCustomerFolder(customer);
      if (refreshed.pathDisplay) {
        logDropboxPathUpdate(customer.id, refreshed.pathDisplay);
        await customer.update(
          {
            dropboxFolderPath: refreshed.pathDisplay,
            dropboxFolderId: refreshed.folderId || customer.dropboxFolderId,
          },
          { transaction }
        );
      }

      if (refreshed.created) {
        await logAudit(
          actingUserId,
          customer.id,
          "dropbox.folder.created",
          JSON.stringify({ path: refreshed.pathDisplay, id: refreshed.folderId }),
          transaction
        );
      }

      return { path: refreshed.pathDisplay, created: refreshed.created };
    }

    return { path: customer.dropboxFolderPath, created: false };
  }

  const outcome = await ensureFolderHierarchy(
    `/FinFlow/customers/${sanitizeSegment(customer.customer_id, "customer")}-${sanitizeSegment(
      customer.name,
      "customer"
    ).toLowerCase()}`
  );

  if (
    typeof outcome.path === "string" &&
    outcome.path.trim() &&
    (!customer.dropboxFolderPath || customer.dropboxFolderPath !== outcome.path)
  ) {
    logDropboxPathUpdate(customer.id, outcome.path);
    await customer.update({ dropboxFolderPath: outcome.path }, { transaction });
  }

  if (outcome.created) {
    await logAudit(
      actingUserId,
      customer.id,
      "dropbox.folder.created",
      JSON.stringify({ path: outcome.path }),
      transaction
    );
  }

  return outcome;
}

function sanitizeFolderName(name) {
  return sanitizeSegment(name, "Folder");
}

async function refreshDocumentLink(document) {
  if (!document.file_path) {
    return document;
  }

  try {
    if (document.file_url) {
      await document.update({ file_url: null });
      document.file_url = null;
    }
  } catch (error) {
    // swallow errors to avoid blocking responses when link refresh fails
  }

  return document;
}

function buildTypeClause(type) {
  if (!type || type === "all") {
    return null;
  }

  const normalized = String(type).toLowerCase();

  switch (normalized) {
    case "pdf":
      return { mime_type: { [Op.iLike]: "%pdf%" } };
    case "image":
      return { mime_type: { [Op.iLike]: "image/%" } };
    case "word": {
      const candidates = [
        { mime_type: { [Op.iLike]: "%msword%" } },
        { mime_type: { [Op.iLike]: "%wordprocessingml%" } },
        { mime_type: { [Op.iLike]: "%opendocument.text%" } },
      ];
      return { [Op.or]: candidates };
    }
    default:
      return null;
  }
}

function buildOrder(sort, order) {
  const direction = String(order || "desc").toUpperCase() === "ASC" ? "ASC" : "DESC";
  const normalized = String(sort || "date").toLowerCase();

  switch (normalized) {
    case "name":
      return [["file_name", direction]];
    case "type":
      return [["mime_type", direction], ["file_name", "ASC"]];
    case "modifiedby":
    case "modified_by":
      return [
        [{ model: User, as: "uploader" }, "name", direction],
        ["file_name", "ASC"],
      ];
    case "date":
    default:
      return [["created_at", direction]];
  }
}

async function fetchDocumentForUser(documentId, user) {
  const document = await Document.findByPk(documentId, {
    include: [{ model: User, as: "uploader", attributes: ["id", "name", "email"] }],
  });
  if (!document) {
    return null;
  }

  const allowed = await userCanAccessCustomer(user, document.customer_id);
  if (!allowed) {
    const err = new Error("Access denied");
    err.statusCode = 403;
    throw err;
  }

  return document;
}

function serializeDocument(document) {
  const payload = document.get ? document.get({ plain: true }) : document;
  const uploader = payload.uploader
    ? {
        id: payload.uploader.id,
        name: payload.uploader.name,
        email: payload.uploader.email,
      }
    : null;

  return {
    id: payload.id,
    customer_id: payload.customer_id,
    file_name: payload.file_name,
    file_path: payload.file_path,
    file_url: payload.file_url || null,
    size_bytes: payload.size_bytes,
    mime_type: payload.mime_type,
    uploaded_by: payload.uploaded_by,
    created_at: payload.created_at,
    updated_at: payload.updated_at || payload.created_at,
    uploader,
  };
}

async function renameDocumentForUser(document, newName, user) {
  const oldPath = document.file_path;
  if (!oldPath) {
    const err = new Error("File path missing");
    err.statusCode = 400;
    throw err;
  }

  const customer = await Customer.findByPk(document.customer_id);
  if (!customer) {
    const err = new Error("Customer not found");
    err.statusCode = 404;
    throw err;
  }

  const allowed = await userCanAccessCustomer(user, customer.id);
  if (!allowed) {
    const err = new Error("Access denied");
    err.statusCode = 403;
    throw err;
  }

  const baseDir = path.posix.dirname(oldPath);
  const extension = path.posix.extname(oldPath);
  const sanitized = sanitizeFileName(newName);
  const finalName = sanitized.includes(".") ? sanitized : `${sanitized}${extension}`;

  if (!finalName || finalName.includes("/")) {
    const err = new Error("Invalid file name");
    err.statusCode = 400;
    throw err;
  }

  const newPath = `${baseDir}/${finalName}`;

  logDropboxAction("rename", oldPath, user?.id);

  const moveRes = await dbx.filesMoveV2({
    from_path: oldPath,
    to_path: newPath,
    autorename: false,
  });

  const metadata = moveRes?.result?.metadata || {};
  const newPathLower = metadata.path_lower || newPath.toLowerCase();

  await document.update({
    file_name: metadata.name || finalName,
    file_path: newPathLower,
    file_url: null,
  });

  await document.reload({
    include: [{ model: User, as: "uploader", attributes: ["id", "name", "email"] }],
  });

  await logAudit(
    user.id,
    customer.id,
    "document.renamed",
    JSON.stringify({ from: oldPath, to: newPathLower })
  );

  return serializeDocument(document);
}

async function deleteDocumentForUser(document, user) {
  const pathLower = document.file_path;
  if (!pathLower) {
    await document.destroy();
    return;
  }

  const customer = await Customer.findByPk(document.customer_id);
  if (!customer) {
    await document.destroy();
    return;
  }

  const allowed = await userCanAccessCustomer(user, customer.id);
  if (!allowed) {
    const err = new Error("Access denied");
    err.statusCode = 403;
    throw err;
  }

  logDropboxAction("delete", pathLower, user?.id);

  await dbx.filesDeleteV2({ path: pathLower });
  await Document.destroy({ where: { file_path: pathLower.toLowerCase() } });

  await logAudit(
    user.id,
    customer.id,
    "document.deleted",
    JSON.stringify({ path: pathLower })
  );
}

async function createTemporaryLink(pathValue, action, userId) {
  if (!pathValue) {
    const err = new Error("Path is required");
    err.statusCode = 400;
    throw err;
  }

  logDropboxAction(action, pathValue, userId);

  const linkRes = await dbx.filesGetTemporaryLink({ path: pathValue });
  const url = linkRes?.result?.link;

  if (!url) {
    const err = new Error(`Unable to generate ${action} link`);
    err.statusCode = 500;
    throw err;
  }

  return url;
}

async function uploadFilesForCustomer(customer, files, user, { path: relativePath } = {}) {
  if (!files.length) {
    const err = new Error("No files uploaded");
    err.statusCode = 400;
    throw err;
  }

  const { path: baseFolder } = await sequelize.transaction(async (transaction) => {
    const customerForUpdate = await Customer.findByPk(customer.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const outcome = await ensureCustomerFolderPath(customerForUpdate, user.id, transaction);

    return { path: outcome.path };
  });

  const destinationFolder = combineWithinFolder(baseFolder, relativePath);
  await ensureFolderHierarchy(destinationFolder);

  logDropboxAction("upload", destinationFolder, user?.id);

  const uploaded = [];

  for (const file of files) {
    const dropboxPath = buildUploadPath(destinationFolder, file.originalname);
    logDropboxAction("upload", dropboxPath, user?.id);

    const uploadResponse = await dbx.filesUpload({
      path: dropboxPath,
      contents: file.buffer,
      mode: { ".tag": "add" },
      autorename: true,
    });

    const uploadResult = uploadResponse.result || {};
    const uploadPathLower = uploadResult.path_lower || dropboxPath.toLowerCase();
    const storedName = uploadResult.name || sanitizeFileName(file.originalname);

    const document = await Document.create({
      customer_id: customer.id,
      uploaded_by: user.id,
      file_name: storedName,
      file_path: uploadPathLower,
      file_url: null,
      size_bytes: file.size,
      mime_type: file.mimetype,
    });

    await document.reload({
      include: [{ model: User, as: "uploader", attributes: ["id", "name", "email"] }],
    });

    await logAudit(
      user.id,
      customer.id,
      "document.uploaded",
      JSON.stringify({
        file_name: document.file_name,
        file_path: document.file_path,
        size_bytes: document.size_bytes,
      })
    );

    uploaded.push(serializeDocument(document));
  }

  return { uploaded, destinationFolder };
}

router.get("/", auth(), async (req, res) => {
  try {
    const { customerId, type, uploadedBy, sort, order } = req.query;

    if (!customerId) {
      return res.status(400).json({ error: "Customer ID required" });
    }

    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const allowed = await userCanAccessCustomer(req.user, customer.id);
    if (!allowed) {
      return res.status(403).json({ error: "Access denied" });
    }

    const where = { customer_id: customer.id };
    const typeClause = buildTypeClause(type);

    if (typeClause) {
      if (typeClause[Op.or]) {
        where[Op.and] = where[Op.and] || [];
        where[Op.and].push({ [Op.or]: typeClause[Op.or] });
      } else {
        Object.assign(where, typeClause);
      }
    }

    if (uploadedBy && req.user.role === "admin") {
      where.uploaded_by = uploadedBy;
    }

    const orderBy = buildOrder(sort, order);

    const documents = await Document.findAll({
      where,
      include: [{ model: User, as: "uploader", attributes: ["id", "name", "email"] }],
      order: orderBy,
    });

    const payload = documents.map((doc) => serializeDocument(doc));

    res.json({
      items: payload,
      meta: {
        count: payload.length,
        sort: sort || "date",
        order: (order || "desc").toLowerCase(),
      },
    });
  } catch (err) {
    const statusCode = err.statusCode || err.status || 500;
    res.status(statusCode).json({ error: err.message || "Unable to fetch documents" });
  }
});

router.post("/upload", auth(), upload.array("files"), async (req, res) => {
  try {
    const { customerId, path: relativePath } = req.body || {};
    const files = Array.isArray(req.files) ? req.files : [];

    if (!customerId) {
      return res.status(400).json({ error: "Customer ID required" });
    }

    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const allowed = await userCanAccessCustomer(req.user, customer.id);
    if (!allowed) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { uploaded, destinationFolder } = await uploadFilesForCustomer(
      customer,
      files,
      req.user,
      { path: relativePath }
    );

    res.json({
      message: uploaded.length > 1 ? "Files uploaded" : "File uploaded",
      files: uploaded,
      folder: destinationFolder,
    });
  } catch (err) {
    handleDropboxError(res, err, "Dropbox upload failed");
  }
});

router.put("/:id/rename", auth(), async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "New file name required" });
    }

    const document = await fetchDocumentForUser(id, req.user);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const renamed = await renameDocumentForUser(document, name, req.user);

    res.json({ message: "File renamed", file: renamed });
  } catch (err) {
    if (err.statusCode && err.statusCode < 500) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return handleDropboxError(res, err, "Dropbox rename failed");
  }
});

router.delete("/:id", auth(), async (req, res) => {
  try {
    const document = await fetchDocumentForUser(req.params.id, req.user);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    await deleteDocumentForUser(document, req.user);

    res.json({ message: "Document deleted" });
  } catch (err) {
    if (err.statusCode && err.statusCode < 500) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return handleDropboxError(res, err, "Dropbox delete failed");
  }
});

router.delete("/", auth(), async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) {
      return res.status(400).json({ error: "ids array is required" });
    }

    const documents = await Document.findAll({ where: { id: ids } });
    const docsById = new Map(documents.map((doc) => [String(doc.id), doc]));

    let deleted = 0;
    const failures = [];

    for (const id of ids) {
      const document = docsById.get(String(id));
      if (!document) {
        failures.push({ id, error: "Not found" });
        continue;
      }

      try {
        const allowed = await userCanAccessCustomer(req.user, document.customer_id);
        if (!allowed) {
          failures.push({ id, error: "Access denied" });
          continue;
        }

        await deleteDocumentForUser(document, req.user);
        deleted += 1;
      } catch (error) {
        failures.push({ id, error: error.message });
      }
    }

    res.json({
      message: deleted ? "Documents deleted" : "No documents deleted",
      deleted,
      failures,
    });
  } catch (err) {
    if (err.statusCode && err.statusCode < 500) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return handleDropboxError(res, err, "Dropbox delete failed");
  }
});

router.get("/:id/download", auth(), async (req, res) => {
  try {
    const document = await fetchDocumentForUser(req.params.id, req.user);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const url = await createTemporaryLink(document.file_path, "download", req.user?.id);

    res.json({ url, file: serializeDocument(document) });
  } catch (err) {
    if (err.statusCode && err.statusCode < 500) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return handleDropboxError(res, err, "Dropbox download failed");
  }
});

router.get("/:id/preview", auth(), async (req, res) => {
  try {
    const document = await fetchDocumentForUser(req.params.id, req.user);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const url = await createTemporaryLink(document.file_path, "preview", req.user?.id);

    res.json({ preview_url: url });
  } catch (err) {
    if (err.statusCode && err.statusCode < 500) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return handleDropboxError(res, err, "Dropbox preview failed");
  }
});

router.post("/batch-download", auth(), async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) {
      return res.status(400).json({ error: "ids array is required" });
    }

    const documents = await Document.findAll({ where: { id: ids } });
    const docsById = new Map(documents.map((doc) => [String(doc.id), doc]));

    const links = [];
    const failures = [];

    for (const id of ids) {
      const document = docsById.get(String(id));
      if (!document) {
        failures.push({ id, error: "Not found" });
        continue;
      }

      try {
        const allowed = await userCanAccessCustomer(req.user, document.customer_id);
        if (!allowed) {
          failures.push({ id, error: "Access denied" });
          continue;
        }

        const url = await createTemporaryLink(document.file_path, "download", req.user?.id);
        links.push({ id: document.id, url, file: serializeDocument(document) });
      } catch (error) {
        failures.push({ id, error: error.message });
      }
    }

    res.json({
      message: links.length ? "Download links generated" : "No download links generated",
      links,
      failures,
    });
  } catch (err) {
    if (err.statusCode && err.statusCode < 500) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return handleDropboxError(res, err, "Dropbox download failed");
  }
});

// Multi-file upload with automatic folder provisioning
router.post(
  "/customer/:customer_id/upload",
  auth(),
  upload.array("files"),
  async (req, res) => {
    try {
      const files = req.files || [];
      if (!files.length) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const customer = await Customer.findByPk(req.params.customer_id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const canAccess = await userCanAccessCustomer(req.user, customer.id);
      if (!canAccess) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { path: baseFolder } = await sequelize.transaction(async (transaction) => {
        const customerForUpdate = await Customer.findByPk(customer.id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        const outcome = await ensureCustomerFolderPath(
          customerForUpdate,
          req.user.id,
          transaction
        );

        return { path: outcome.path };
      });

      const destinationFolder = combineWithinFolder(baseFolder, req.body.path);
      await ensureFolderHierarchy(destinationFolder);

      logDropboxAction("upload", destinationFolder, req.user?.id);

      const uploaded = [];
      for (const file of files) {
        const dropboxPath = buildUploadPath(destinationFolder, file.originalname);
        logDropboxAction("upload", dropboxPath, req.user?.id);

        const uploadResponse = await dbx.filesUpload({
          path: dropboxPath,
          contents: file.buffer,
          mode: { ".tag": "add" },
          autorename: true,
        });

        const uploadResult = uploadResponse.result || {};
        const uploadPathLower = uploadResult.path_lower || dropboxPath.toLowerCase();
        const uploadPathDisplay = uploadResult.path_display || dropboxPath;
        const storedName = uploadResult.name || sanitizeFileName(file.originalname);

        const document = await Document.create({
          customer_id: customer.id,
          uploaded_by: req.user.id,
          file_name: storedName,
          file_path: uploadPathLower,
          file_url: null,
          size_bytes: file.size,
          mime_type: file.mimetype,
        });

        await logAudit(
          req.user.id,
          customer.id,
          "document.uploaded",
          JSON.stringify({
            file_name: document.file_name,
            file_path: document.file_path,
            size_bytes: document.size_bytes,
          })
        );

        // eslint-disable-next-line no-console
        console.info(
          `[DropboxUploadSuccess] customer=${customer.id} path=${uploadPathDisplay} bytes=${file.size}`
        );

        uploaded.push({
          id: document.id,
          file_name: document.file_name,
          name: document.file_name,
          dropbox_path: uploadPathDisplay,
          path: document.file_path,
          size: document.size_bytes,
          mime_type: document.mime_type,
        });
      }

      res.json({
        message: "Files uploaded",
        files: uploaded,
        folder: destinationFolder,
      });
    } catch (err) {
      logDropboxAction("upload", req.body?.path || "N/A", req.user?.id);
      handleDropboxError(res, err, "Dropbox upload failed");
    }
  }
);

// List documents for a customer from DB
router.get("/customer/:customer_id", auth(), async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.customer_id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const canAccess = await userCanAccessCustomer(req.user, customer.id);
    if (!canAccess) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const docs = await Document.findAll({
      where: { customer_id: customer.id },
      order: [["created_at", "DESC"]],
    });

    const refreshed = await Promise.all(docs.map((doc) => refreshDocumentLink(doc)));

    res.json(refreshed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dropbox browser endpoint
router.get("/customer/:customer_id/dropbox", auth(), async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.customer_id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const canAccess = await userCanAccessCustomer(req.user, customer.id);
    if (!canAccess) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (shouldUseFolderId() && customer.dropboxFolderId) {
      const latestPath = await resolveFolderPath(customer.dropboxFolderId);
      if (latestPath && latestPath !== customer.dropboxFolderPath) {
        logDropboxPathUpdate(customer.id, latestPath);
        await customer.update({ dropboxFolderPath: latestPath });
      }
    }

    if (customer.dropboxFolderPath && isLegacyDropboxPath(customer.dropboxFolderPath)) {
      logDropboxPathUpdate(customer.id, null);
      await customer.update({ dropboxFolderPath: null });
    }

    if (!customer.dropboxFolderPath) {
      // eslint-disable-next-line no-console
      console.warn(
        `ℹ️ Dropbox folder missing for customer ${customer.id} when listing files`
      );
      return res.json({ exists: false, path: null, files: [] });
    }

    const targetPath = combineWithinFolder(
      customer.dropboxFolderPath,
      req.query.path
    );

    logDropboxAction("list", targetPath, req.user?.id);

    const entries = await listFolder(targetPath);

    const files = entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      path: entry.path_display || entry.path_lower,
      size: entry.is_folder ? null : entry.size,
      client_modified: entry.client_modified,
      server_modified: entry.server_modified,
      is_folder: entry.is_folder,
    }));

    res.json({
      exists: true,
      path: targetPath,
      files,
    });
  } catch (err) {
    logDropboxAction("list", req.query?.path || "N/A", req.user?.id);
    handleDropboxError(res, err, "Unable to list Dropbox files");
  }
});

router.get("/download", auth(), async (req, res) => {
  try {
    const { path: dropboxPath } = req.query;
    if (!dropboxPath) {
      return res.status(400).json({ error: "Path is required" });
    }

    const customer = await findCustomerForDropboxPath(req.user, dropboxPath);
    if (!customer) {
      return res.status(404).json({ error: "File not found" });
    }

    logDropboxAction("download", dropboxPath, req.user?.id);

    const linkRes = await dbx.filesGetTemporaryLink({ path: dropboxPath });
    const url = linkRes?.result?.link;

    if (!url) {
      return res.status(500).json({ error: "Unable to generate download link" });
    }

    res.json({ url });
  } catch (err) {
    logDropboxAction("download", req.query?.path || "N/A", req.user?.id);
    handleDropboxError(res, err, "Dropbox download failed");
  }
});

router.get("/preview", auth(), async (req, res) => {
  try {
    const { path: dropboxPath } = req.query;
    if (!dropboxPath) {
      return res.status(400).json({ error: "Path is required" });
    }

    const customer = await findCustomerForDropboxPath(req.user, dropboxPath);
    if (!customer) {
      return res.status(404).json({ error: "File not found" });
    }

    logDropboxAction("preview", dropboxPath, req.user?.id);

    const linkRes = await dbx.filesGetTemporaryLink({ path: dropboxPath });
    const url = linkRes?.result?.link;

    if (!url) {
      return res.status(500).json({ error: "Unable to generate preview link" });
    }

    res.json({ preview_url: url });
  } catch (err) {
    logDropboxAction("preview", req.query?.path || "N/A", req.user?.id);
    handleDropboxError(res, err, "Dropbox preview failed");
  }
});

router.post("/rename", auth(), async (req, res) => {
  try {
    const { old_path: oldPath, new_name: providedName } = req.body;
    if (!oldPath || !providedName) {
      return res.status(400).json({ error: "old_path and new_name are required" });
    }

    const customer = await findCustomerForDropboxPath(req.user, oldPath);
    if (!customer) {
      return res.status(404).json({ error: "File not found" });
    }

    const baseDir = path.posix.dirname(oldPath);
    const ext = path.posix.extname(oldPath);
    const sanitized = sanitizeFileName(providedName);
    const finalName = sanitized.includes(".") ? sanitized : `${sanitized}${ext}`;

    if (!finalName || finalName.includes("/")) {
      return res.status(400).json({ error: "Invalid new file name" });
    }

    const newPath = `${baseDir}/${finalName}`;

    logDropboxAction("rename", oldPath, req.user?.id);

    const moveRes = await dbx.filesMoveV2({
      from_path: oldPath,
      to_path: newPath,
      autorename: false,
    });

    const metadata = moveRes?.result?.metadata;
    const newPathLower = metadata?.path_lower || newPath.toLowerCase();
    const existingDoc = await Document.findOne({ where: { file_path: oldPath.toLowerCase() } });
    if (existingDoc) {
      await existingDoc.update({
        file_name: finalName,
        file_path: newPathLower,
        file_url: null,
      });
    }

    await logAudit(
      req.user.id,
      customer.id,
      "document.renamed",
      JSON.stringify({ from: oldPath, to: newPathLower })
    );

    res.json({
      message: "File renamed",
      file: {
        id: metadata?.id,
        file_name: metadata?.name || finalName,
        name: metadata?.name || finalName,
        dropbox_path: metadata?.path_display || metadata?.path_lower || newPath,
        path: metadata?.path_display || metadata?.path_lower || newPath,
        size: metadata?.size || null,
        client_modified: metadata?.client_modified || null,
      },
    });
  } catch (err) {
    logDropboxAction("rename", req.body?.old_path || "N/A", req.user?.id);
    handleDropboxError(res, err, "Dropbox rename failed");
  }
});

router.delete("/delete", auth(), async (req, res) => {
  try {
    const paths = Array.isArray(req.body?.paths) ? req.body.paths : [];
    if (!paths.length) {
      return res.status(400).json({ error: "paths array is required" });
    }

    let deleted = 0;
    const failures = [];

    for (const candidate of paths) {
      try {
        const customer = await findCustomerForDropboxPath(req.user, candidate);
        if (!customer) {
          failures.push({ path: candidate, error: "Not found" });
          continue;
        }

        logDropboxAction("delete", candidate, req.user?.id);

        await dbx.filesDeleteV2({ path: candidate });
        await Document.destroy({ where: { file_path: candidate.toLowerCase() } });
        await logAudit(
          req.user.id,
          customer.id,
          "document.deleted",
          JSON.stringify({ path: candidate })
        );

        deleted += 1;
      } catch (error) {
        failures.push({ path: candidate, error: error.message });
        logDropboxAction("delete", candidate, req.user?.id);
      }
    }

    res.json({
      message: `Deleted ${deleted} item(s)`,
      deleted,
      failures,
    });
  } catch (err) {
    logDropboxAction("delete", req.body?.paths?.join?.(",") || "N/A", req.user?.id);
    handleDropboxError(res, err, "Dropbox delete failed");
  }
});

router.post("/folder", auth(), async (req, res) => {
  try {
    const { customer_id: customerId, folder_name: folderName, parent_path: parentPath } =
      req.body || {};

    if (!customerId || !folderName) {
      return res.status(400).json({ error: "customer_id and folder_name are required" });
    }

    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const allowed = await userCanAccessCustomer(req.user, customer.id);
    if (!allowed) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { path: baseFolder } = await sequelize.transaction(async (transaction) => {
      const customerForUpdate = await Customer.findByPk(customer.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const outcome = await ensureCustomerFolderPath(
        customerForUpdate,
        req.user.id,
        transaction
      );

      return { path: outcome.path };
    });

    const resolvedParent = combineWithinFolder(baseFolder, parentPath);
    const folderSegment = sanitizeFolderName(folderName);
    const newFolderPath = `${resolvedParent}/${folderSegment}`;

    logDropboxAction("create-folder", newFolderPath, req.user?.id);

    await ensureFolderHierarchy(newFolderPath);

    await logAudit(
      req.user.id,
      customer.id,
      "dropbox.folder.created.manual",
      JSON.stringify({ path: newFolderPath })
    );

    res.json({
      message: "Folder created",
      path: newFolderPath,
    });
  } catch (err) {
    logDropboxAction("create-folder", req.body?.folder_name || "N/A", req.user?.id);
    handleDropboxError(res, err, "Dropbox folder creation failed");
  }
});

module.exports = router;
