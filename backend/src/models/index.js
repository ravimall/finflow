// backend/src/models/index.js
const sequelize = require("../config/db");
const User = require("./User");
const Customer = require("./Customer");
const Loan = require("./Loan");
const Document = require("./Document");
const CustomerAgent = require("./CustomerAgent");
const ConfigStatus = require("./ConfigStatus");
const ConfigBank = require("./ConfigBank");
const AuditLog = require("./AuditLog");
const CustomerNote = require("./CustomerNote");

// Define associations
User.hasMany(Customer, { foreignKey: "created_by", as: "createdCustomers" });
Customer.belongsTo(User, { foreignKey: "created_by", as: "creator" });

User.hasMany(CustomerAgent, { foreignKey: "agent_id", as: "customerAssignments" });
CustomerAgent.belongsTo(User, { foreignKey: "agent_id", as: "agent" });

Customer.hasMany(CustomerAgent, { foreignKey: "customer_id", as: "assignments" });
CustomerAgent.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });

Customer.belongsTo(User, { foreignKey: "primary_agent_id", as: "primaryAgent" });

Customer.hasMany(Loan, { foreignKey: "customer_id", as: "loans" });
Loan.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });
Loan.belongsTo(ConfigBank, { foreignKey: "bank_id", as: "bank" });

Customer.hasMany(Document, { foreignKey: "customer_id", as: "documents" });
Document.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });

Customer.hasMany(CustomerNote, { foreignKey: "customer_id", as: "notes" });
CustomerNote.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });
CustomerNote.belongsTo(User, { foreignKey: "user_id", as: "author" });
User.hasMany(CustomerNote, { foreignKey: "user_id", as: "customerNotes" });

AuditLog.belongsTo(User, { foreignKey: "user_id", as: "user" });
AuditLog.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });

// Sync models (in dev only)
async function syncModels() {
  await sequelize.sync({ alter: true });
}
syncModels();

module.exports = {
  sequelize,
  User,
  Customer,
  Loan,
  Document,
  CustomerAgent,
  ConfigStatus,
  ConfigBank,
  AuditLog,
  CustomerNote,
};
