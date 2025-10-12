const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const AuditLog = sequelize.define(
  "audit_logs",
  {
    user_id: { type: DataTypes.INTEGER, allowNull: true },
    customer_id: { type: DataTypes.INTEGER, allowNull: true },
    action: { type: DataTypes.STRING, allowNull: false },
    details: { type: DataTypes.TEXT },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = AuditLog;
