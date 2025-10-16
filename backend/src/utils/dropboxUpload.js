// backend/src/utils/dropboxUpload.js
const ILLEGAL_CHARACTERS = /[\\/:?*"<>\r\n]/g;

function sanitizeFileName(name) {
  if (typeof name !== "string" || name.length === 0) {
    return "untitled";
  }

  const sanitized = name.replace(ILLEGAL_CHARACTERS, "_");
  return sanitized.length > 0 ? sanitized : "untitled";
}

function buildUploadPath(destinationFolder, originalName) {
  if (typeof destinationFolder !== "string" || destinationFolder.trim().length === 0) {
    throw new Error("Destination folder is required");
  }

  const base = destinationFolder.replace(/\/+$/, "");
  const fileName = sanitizeFileName(originalName);
  return `${base}/${fileName}`;
}

module.exports = {
  sanitizeFileName,
  buildUploadPath,
};
