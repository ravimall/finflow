const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const CustomerNote = sequelize.define(
  "CustomerNote",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    customer_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "customer_notes",
    underscored: true,
    timestamps: true,
  }
);

module.exports = CustomerNote;
