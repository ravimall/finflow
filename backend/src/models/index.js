// backend/src/models/index.js
const sequelize = require("../config/db");
const User = require("./User");
const Customer = require("./Customer");
const Loan = require("./Loan");
const Document = require("./Document");
const CustomerAgent = require("./CustomerAgent");

// Define associations
User.hasMany(Customer, { foreignKey: "created_by" });
Customer.belongsTo(User, { foreignKey: "created_by" });

Customer.hasMany(Loan, { foreignKey: "customer_id" });
Customer.hasMany(CustomerAgent, { foreignKey: "customerId" });
CustomerAgent.belongsTo(Customer, { foreignKey: "customerId" });
Loan.belongsTo(Customer, { foreignKey: "customer_id" });

Customer.hasMany(Document, { foreignKey: "customer_id" });
Document.belongsTo(Customer, { foreignKey: "customer_id" });

// Sync models (in dev only)
async function syncModels() {
  await sequelize.sync({ alter: false });
}
syncModels();

module.exports = { sequelize, User, Customer, Loan, Document };
