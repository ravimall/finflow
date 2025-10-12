const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const CustomerAgent = sequelize.define(
  "customer_agents",
  {
    customer_id: { type: DataTypes.INTEGER, allowNull: false },
    agent_id: { type: DataTypes.INTEGER, allowNull: false },
    permission: { type: DataTypes.STRING, allowNull: false, defaultValue: "edit" },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = CustomerAgent;
