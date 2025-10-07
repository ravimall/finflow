// backend/src/routes/documentRoutes.js
const express = require("express");
const multer = require("multer");
const dbx = require("../config/dropbox");
const Document = require("../models/Document");
// const User = require("../models/User");
// const Customer = require("../models/Customer");
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Upload to Dropbox and store metadata
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const { customer_id, uploaded_by } = req.body;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const dropboxPath = `/finflow/${Date.now()}_${file.originalname}`;
    // Upload
    const response = await dbx.filesUpload({ path: dropboxPath, contents: file.buffer, mode: "add", autorename: true });
    // Create shared link
    const linkRes = await dbx.sharingCreateSharedLinkWithSettings({ path: response.result.path_lower });
    const fileUrl = linkRes.result && linkRes.result.url ? linkRes.result.url.replace("?dl=0", "?dl=1") : null;

    const document = await Document.create({
      customer_id,
      uploaded_by,
      file_name: file.originalname,
      file_path: response.result.path_lower,
      file_url: fileUrl,
      size_bytes: file.size,
      mime_type: file.mimetype
    });

    res.json({ message: "File uploaded", document });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// List documents for a customer
router.get("/customer/:customer_id", async (req, res) => {
  try {
    const docs = await Document.findAll({ where: { customer_id: req.params.customer_id } });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;