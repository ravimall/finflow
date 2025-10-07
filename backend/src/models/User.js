// backend/src/models/User.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const User = sequelize.define("users", {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: "agent" },
  google_sub: { type: DataTypes.STRING }
}, {
  timestamps: true,
  createdAt: "created_at",
  updatedAt: false
});

module.exports = User;
