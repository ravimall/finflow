const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ConfigBank = sequelize.define(
  "config_banks",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = ConfigBank;
