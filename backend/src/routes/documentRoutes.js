// backend/src/routes/documentRoutes.js
const express = require("express");
const multer = require("multer");
const dbx = require("../config/dropbox");
const {
  Customer,
  CustomerAgent,
  Document,
} = require("../models");
const auth = require("../middleware/auth");

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

async function ensureFolderExists(path) {
  try {
    await dbx.filesCreateFolderV2({ path, autorename: false });
  } catch (error) {
    const summary = error?.error?.error_summary || "";
    if (error?.status === 409 || summary.includes("path/conflict")) {
      return;
    }
    throw error;
  }
}

async function listDropboxFiles(path) {
  try {
    const files = [];
    let cursor = null;
    let response = await dbx.filesListFolder({ path });
    files.push(...(response.result?.entries || []));
    cursor = response.result?.has_more ? response.result.cursor : null;

    while (cursor) {
      response = await dbx.filesListFolderContinue({ cursor });
      files.push(...(response.result?.entries || []));
      cursor = response.result?.has_more ? response.result.cursor : null;
    }

    const fileEntries = files.filter((entry) => entry[".tag"] === "file");
    const enriched = await Promise.all(
      fileEntries.map(async (entry) => {
        try {
          const linkRes = await dbx.filesGetTemporaryLink({
            path: entry.path_lower || entry.path_display,
          });
          return {
            id: entry.id,
            name: entry.name,
            size: entry.size,
            client_modified: entry.client_modified,
            server_modified: entry.server_modified,
            download_url: linkRes.result.link,
          };
        } catch (error) {
          return {
            id: entry.id,
            name: entry.name,
            size: entry.size,
            client_modified: entry.client_modified,
            server_modified: entry.server_modified,
            download_url: null,
          };
        }
      })
    );

    return enriched;
  } catch (error) {
    const summary = error?.error?.error_summary || "";
    if (error?.status === 409 || summary.includes("path/not_found")) {
      return [];
    }
    throw error;
  }
}

// Upload to Dropbox and store metadata
router.post("/upload", auth(), upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const { customer_id } = req.body;
    if (!file) return res.status(400).json({ error: "No file uploaded" });
    if (!customer_id) return res.status(400).json({ error: "Customer is required" });

    const customer = await Customer.findByPk(customer_id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const canAccess = await userCanAccessCustomer(req.user, customer.id);
    if (!canAccess) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const folderPath =
      customer.dropbox_folder_path || `/finflow/unassigned/${customer.name}_${customer.customer_id}`;

    await ensureFolderExists(folderPath);

    const dropboxPath = `${folderPath}/${Date.now()}_${file.originalname}`;

    const response = await dbx.filesUpload({
      path: dropboxPath,
      contents: file.buffer,
      mode: "add",
      autorename: true,
    });

    const linkRes = await dbx.filesGetTemporaryLink({
      path: response.result.path_lower,
    });

    const document = await Document.create({
      customer_id,
      uploaded_by: req.user.id,
      file_name: file.originalname,
      file_path: response.result.path_lower,
      file_url: linkRes.result.link,
      size_bytes: file.size,
      mime_type: file.mimetype,
    });

    res.json({ message: "File uploaded", document });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// List documents for a customer from DB
router.get("/customer/:customer_id", auth(), async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.customer_id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const canAccess = await userCanAccessCustomer(req.user, customer.id);
    if (!canAccess) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const docs = await Document.findAll({ where: { customer_id: customer.id } });
    res.json(docs);
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

    if (!customer.dropbox_folder_path) {
      return res.json([]);
    }

    const files = await listDropboxFiles(customer.dropbox_folder_path);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
