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
const Task = require("./Task");
const TaskTemplate = require("./TaskTemplate");
const TaskTemplateItem = require("./TaskTemplateItem");

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
Document.belongsTo(User, { foreignKey: "uploaded_by", as: "uploader" });
User.hasMany(Document, { foreignKey: "uploaded_by", as: "uploadedDocuments" });

Customer.hasMany(CustomerNote, { foreignKey: "customer_id", as: "notes" });
CustomerNote.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });
CustomerNote.belongsTo(User, { foreignKey: "user_id", as: "author" });
User.hasMany(CustomerNote, { foreignKey: "user_id", as: "customerNotes" });

Customer.hasMany(Task, { foreignKey: "customer_id", as: "tasks" });
Task.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });
Task.belongsTo(User, { foreignKey: "assignee_id", as: "assignee" });
User.hasMany(Task, { foreignKey: "assignee_id", as: "assignedTasks" });

Task.belongsTo(TaskTemplate, { foreignKey: "template_id", as: "template" });
TaskTemplate.hasMany(Task, { foreignKey: "template_id", as: "tasks" });

TaskTemplate.hasMany(TaskTemplateItem, {
  foreignKey: "template_id",
  as: "items",
});
TaskTemplateItem.belongsTo(TaskTemplate, {
  foreignKey: "template_id",
  as: "template",
});

AuditLog.belongsTo(User, { foreignKey: "user_id", as: "user" });
AuditLog.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });

// Sync models (development only)
async function syncModels() {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    return;
  }

  await sequelize.sync({ alter: false });
}

syncModels().catch((error) => {
  console.error("Failed to run Sequelize sync", error);
});

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
  Task,
  TaskTemplate,
  TaskTemplateItem,
};
