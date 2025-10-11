// backend/src/routes/documentRoutes.js
const express = require("express");
const multer = require("multer");
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
  ensureCustomerFolder,
  ensureFolderHierarchy,
  listFolder,
  combineWithinFolder,
  ensureSharedLink,
  isLegacyDropboxPath,
} = require("../utils/dropbox");
const { logAudit } = require("../utils/audit");

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

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

async function resolveFolderAgent(customer, transaction) {
  if (customer.primary_agent_id) {
    const agent = await User.findByPk(customer.primary_agent_id, { transaction });
    if (agent) {
      return agent;
    }
  }

  const admin = await User.findOne({
    where: { role: "admin" },
    order: [["id", "ASC"]],
    transaction,
  });
  if (admin) {
    return admin;
  }

  if (customer.created_by) {
    const creator = await User.findByPk(customer.created_by, { transaction });
    if (creator) {
      return creator;
    }
  }

  return null;
}

async function ensureCustomerFolderPath(customer, actingUserId, transaction) {
  if (customer.dropbox_folder_path && !isLegacyDropboxPath(customer.dropbox_folder_path)) {
    return { path: customer.dropbox_folder_path, created: false };
  }

  if (customer.dropbox_folder_path && isLegacyDropboxPath(customer.dropbox_folder_path)) {
    await customer.update({ dropbox_folder_path: null }, { transaction });
  }

  const agent = await resolveFolderAgent(customer, transaction);
  const agentLabel = agent?.name || agent?.email || "admin";

  const outcome = await ensureCustomerFolder(
    agentLabel,
    customer.name,
    customer.customer_id
  );

  if (!customer.dropbox_folder_path || customer.dropbox_folder_path !== outcome.path) {
    await customer.update({ dropbox_folder_path: outcome.path }, { transaction });
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

      const uploaded = [];
      for (const file of files) {
        const dropboxPath = `${destinationFolder}/${Date.now()}_${sanitizeFileName(
          file.originalname
        )}`;

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

        // eslint-disable-next-line no-console
        console.info(
          `⬆️ Uploaded ${document.file_name} (${document.size_bytes} bytes) for customer ${customer.id} by user ${req.user.id} to ${uploadPath}`
        );

        uploaded.push({
          document,
          download_url: sharedLink,
        });
      }

      res.json({
        message: "Files uploaded",
        files: uploaded,
        folder: destinationFolder,
      });
    } catch (err) {
      const statusCode = err.statusCode || 500;
      // eslint-disable-next-line no-console
      console.error(
        `❌ Dropbox upload failed for customer ${req.params.customer_id} by user ${req.user?.id}: ${
          err.message
        }`
      );
      res.status(statusCode).json({ error: err.message });
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

    if (customer.dropbox_folder_path && isLegacyDropboxPath(customer.dropbox_folder_path)) {
      await customer.update({ dropbox_folder_path: null });
    }

    if (!customer.dropbox_folder_path) {
      // eslint-disable-next-line no-console
      console.warn(
        `ℹ️ Dropbox folder missing for customer ${customer.id} when listing files`
      );
      return res.json({ exists: false, path: null, files: [] });
    }

    const targetPath = combineWithinFolder(
      customer.dropbox_folder_path,
      req.query.path
    );

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

    // eslint-disable-next-line no-console
    console.info(
      `📄 Listed ${files.length} Dropbox entries for customer ${customer.id} at ${targetPath}`
    );

    res.json({
      exists: true,
      path: targetPath,
      files,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `❌ Failed to list Dropbox files for customer ${req.params.customer_id}: ${
        err.message
      }`
    );
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
