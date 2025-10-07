
const express = require("express");
const sequelize = require("../config/db");
const auth = require("../middleware/auth");
const router = express.Router();

// Customers by status (Admin only)
router.get("/customers-by-status", auth("admin"), async (req, res) => {
  try {
    const [results] = await sequelize.query(`
      SELECT status, COUNT(*) as total
      FROM customers
      GROUP BY status
    `);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Loans by status (Admin only)
router.get("/loans-by-status", auth("admin"), async (req, res) => {
  try {
    const [results] = await sequelize.query(`
      SELECT status, COUNT(*) as total
      FROM loans
      GROUP BY status
    `);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Agent performance (Admin only)
router.get("/agent-performance", auth("admin"), async (req, res) => {
  try {
    const [results] = await sequelize.query(`
      SELECT u.id as agent_id, u.name, COUNT(c.id) as customers_handled
      FROM users u
      LEFT JOIN customers c ON c.created_by = u.id
      WHERE u.role = 'agent'
      GROUP BY u.id, u.name
    `);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Documents per customer (Admin only)
router.get("/documents-per-customer", auth("admin"), async (req, res) => {
  try {
    const [results] = await sequelize.query(`
      SELECT d.customer_id, COUNT(d.id) as total_docs
      FROM documents d
      GROUP BY d.customer_id
    `);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Audit logs (Admin only) - paginated
router.get("/audit-logs", auth("admin"), async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1");
    const limit = parseInt(req.query.limit || "50");
    const offset = (page - 1) * limit;
    const [results] = await sequelize.query(`
      SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2
    `, { bind: [limit, offset] });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
