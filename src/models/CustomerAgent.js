
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const CustomerAgent = sequelize.define("customer_agents", {
  customerId: { type: DataTypes.INTEGER },
  agentId: { type: DataTypes.INTEGER },
  permission: { type: DataTypes.STRING, allowNull: false }
}, {
  timestamps: true,
  createdAt: "created_at",
  updatedAt: false
});

module.exports = CustomerAgent;
