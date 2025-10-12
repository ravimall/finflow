const { AuditLog } = require("../models");

async function logAudit(userId, customerId, action, details, transaction) {
  try {
    await AuditLog.create(
      {
        user_id: userId || null,
        customer_id: customerId || null,
        action,
        details,
      },
      transaction ? { transaction } : undefined
    );
  } catch (error) {
    console.warn("Failed to write audit log", error);
  }
}

module.exports = {
  logAudit,
};
