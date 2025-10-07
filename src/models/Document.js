// backend/src/models/Document.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Document = sequelize.define("documents", {
  file_name: { type: DataTypes.STRING },
  file_path: { type: DataTypes.STRING },
  file_url: { type: DataTypes.TEXT },
  size_bytes: { type: DataTypes.BIGINT },
  mime_type: { type: DataTypes.STRING }
}, {
  timestamps: true,
  createdAt: "created_at",
  updatedAt: false
});

module.exports = Document;
