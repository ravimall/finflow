const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ConfigStatus = sequelize.define(
  "config_statuses",
  {
    type: {
      type: DataTypes.ENUM("customer", "loan"),
      allowNull: false,
    },
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

module.exports = ConfigStatus;
