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
} = require("../models");
const auth = require("../middleware/auth");
const {
  ensureFolderHierarchy,
  listFolder,
  combineWithinFolder,
  ensureSharedLink,
  isLegacyDropboxPath,
  sanitizeSegment,
  logDropboxAction,
} = require("../utils/dropbox");
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
      if (folderDetails.sharedFolderId) {
        updates.dropboxSharedFolderId = folderDetails.sharedFolderId;
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
            dropboxSharedFolderId: refreshed.sharedFolderId || customer.dropboxSharedFolderId,
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

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function sanitizeFolderName(name) {
  return sanitizeSegment(name, "Folder");
}

async function refreshDocumentLink(document) {
  if (!document.file_path) {
    return document;
  }

  try {
    const linkRes = await dbx.filesGetTemporaryLink({ path: document.file_path });
    if (linkRes?.result?.link && document.file_url !== linkRes.result.link) {
      await document.update({ file_url: linkRes.result.link });
      document.file_url = linkRes.result.link;
    }
  } catch (error) {
    // swallow errors to avoid blocking responses when link refresh fails
  }

  return document;
}

router.get("/", auth(), async (req, res) => {
  try {
    let documents = [];

    if (req.user.role === "admin") {
      documents = await Document.findAll({
        order: [["created_at", "DESC"]],
      });
    } else {
      const [assignments, createdCustomers] = await Promise.all([
        CustomerAgent.findAll({
          where: { agent_id: req.user.id },
          attributes: ["customer_id"],
        }),
        Customer.findAll({
          where: { created_by: req.user.id },
          attributes: ["id"],
        }),
      ]);

      const allowedCustomerIds = new Set();
      assignments.forEach((assignment) => {
        if (assignment.customer_id) {
          allowedCustomerIds.add(assignment.customer_id);
        }
      });
      createdCustomers.forEach((customer) => {
        if (customer.id) {
          allowedCustomerIds.add(customer.id);
        }
      });

      if (!allowedCustomerIds.size) {
        return res.json([]);
      }

      documents = await Document.findAll({
        where: { customer_id: { [Op.in]: Array.from(allowedCustomerIds) } },
        order: [["created_at", "DESC"]],
      });
    }

    const refreshed = await Promise.all(documents.map((doc) => refreshDocumentLink(doc)));

    res.json(Array.isArray(refreshed) ? refreshed : []);
  } catch (err) {
    res.status(500).json({ error: err.message || "Unable to fetch documents" });
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
        const dropboxPath = `${destinationFolder}/${Date.now()}_${sanitizeFileName(
          file.originalname
        )}`;

        logDropboxAction("upload", dropboxPath, req.user?.id);

        const uploadResponse = await dbx.filesUpload({
          path: dropboxPath,
          contents: file.buffer,
          mode: { ".tag": "add" },
          autorename: true,
        });

        const uploadPath = uploadResponse.result.path_lower;
        const sharedLink = await ensureSharedLink(uploadPath);

        const document = await Document.create({
          customer_id: customer.id,
          uploaded_by: req.user.id,
          file_name: file.originalname,
          file_path: uploadPath,
          file_url: sharedLink,
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

        uploaded.push({
          id: document.id,
          name: document.file_name,
          path: document.file_path,
          size: document.size_bytes,
          url: sharedLink,
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
      url: entry.is_folder ? null : entry.download_url,
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
    const sharedLink = await ensureSharedLink(newPathLower);

    const existingDoc = await Document.findOne({ where: { file_path: oldPath.toLowerCase() } });
    if (existingDoc) {
      await existingDoc.update({
        file_name: finalName,
        file_path: newPathLower,
        file_url: sharedLink,
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
        name: metadata?.name || finalName,
        path: metadata?.path_display || metadata?.path_lower || newPath,
        size: metadata?.size || null,
        client_modified: metadata?.client_modified || null,
        url: sharedLink,
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
