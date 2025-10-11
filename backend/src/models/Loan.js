// backend/src/models/Loan.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Loan = sequelize.define(
  "Loan",
  {
    customer_id: { type: DataTypes.INTEGER, allowNull: false },
    bank_id: { type: DataTypes.INTEGER, allowNull: true },
    bank_name: { type: DataTypes.STRING, allowNull: false },
    applied_amount: { type: DataTypes.DECIMAL(15, 2) },
    approved_amount: { type: DataTypes.DECIMAL(15, 2) },
    rate_of_interest: { type: DataTypes.DECIMAL(5, 2) },
    status: { type: DataTypes.STRING, defaultValue: "Login" },
    notes: { type: DataTypes.TEXT },
  },
  {
    tableName: "loans",
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = Loan;
