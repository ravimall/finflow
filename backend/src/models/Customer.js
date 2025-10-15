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
    flat_no: {
      type: DataTypes.STRING(50),
      allowNull: true,
      set(value) {
        if (typeof value === "undefined" || value === null) {
          this.setDataValue("flat_no", null);
          return;
        }

        const trimmed = typeof value === "string" ? value.trim() : String(value).trim();
        this.setDataValue("flat_no", trimmed === "" ? null : trimmed);
      },
    },
    dropboxFolderId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "dropbox_folder_id",
    },
    dropboxFolderPath: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "dropbox_folder_path",
    },
    dropboxProvisioningStatus: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
      field: "dropbox_provisioning_status",
    },
    dropboxLastError: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "dropbox_last_error",
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = Customer;
