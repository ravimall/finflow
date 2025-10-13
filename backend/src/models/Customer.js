// backend/src/models/Customer.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Customer = sequelize.define(
  "customers",
  {
    customer_id: { type: DataTypes.STRING, unique: true, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    address: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING, defaultValue: "Booking" },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    primary_agent_id: { type: DataTypes.INTEGER, allowNull: true },
    dropboxFolderPath: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "dropbox_folder_path",
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = Customer;
