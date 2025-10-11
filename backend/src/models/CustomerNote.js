const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const CustomerNote = sequelize.define(
  "customer_notes",
  {
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    underscored: true,
    timestamps: true,
  }
);

module.exports = CustomerNote;
