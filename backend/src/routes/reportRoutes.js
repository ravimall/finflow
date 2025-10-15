const express = require("express");
const { QueryTypes } = require("sequelize");
const sequelize = require("../config/db");
const auth = require("../middleware/auth");
const router = express.Router();

function buildRoleFilter(userRole) {
  if (userRole === "admin") {
    return { clause: "", replacements: {} };
  }

  return {
    clause: `AND (
      c.created_by = :userId
      OR c.primary_agent_id = :userId
      OR EXISTS (
        SELECT 1 FROM customer_agents ca
        WHERE ca.customer_id = c.id AND ca.agent_id = :userId
      )
    )`,
    replacements: { userId: null },
  };
}

function normalizePagination(query) {
  const page = Math.max(parseInt(query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || "25", 10), 1), 100);
  return { page, limit, offset: (page - 1) * limit };
}

router.get("/customers", auth(), async (req, res) => {
  try {
    const { page, limit, offset } = normalizePagination(req.query);
    const { clause: roleClause, replacements: roleReplacements } = buildRoleFilter(req.user.role);

    const filters = [];
    const replacements = {
      limit,
      offset,
      ...roleReplacements,
    };

    replacements.userId = req.user.id;

    if (req.query.customer_status) {
      filters.push("c.status = :customerStatus");
      replacements.customerStatus = req.query.customer_status;
    }

    if (req.query.loan_status) {
      filters.push("l.status = :loanStatus");
      replacements.loanStatus = req.query.loan_status;
    }

    if (req.query.search) {
      filters.push("(c.name ILIKE :search OR c.customer_id ILIKE :search)");
      replacements.search = `%${req.query.search}%`;
    }

    const whereClause = filters.length ? `AND ${filters.join(" AND ")}` : "";

    const baseQuery = `
      FROM loans l
      JOIN customers c ON c.id = l.customer_id
      LEFT JOIN config_banks b ON b.id = l.bank_id
      WHERE 1=1
      ${roleClause}
      ${whereClause}
    `;

    const rows = await sequelize.query(
      `SELECT
         c.id AS customer_id,
         c.customer_id AS customer_code,
         c.name AS customer_name,
         c.status AS customer_status,
         l.id AS loan_id,
         l.status AS loan_status,
         l.bank_name,
         l.stage_started_at,
         l.updated_at,
         l.created_at,
         GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(l.stage_started_at, l.updated_at, l.created_at))) / 86400))::int AS loan_aging_days
       ${baseQuery}
       ORDER BY l.updated_at DESC
       LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    );

    const [{ count }] = await sequelize.query(
      `SELECT COUNT(*)::int AS count ${baseQuery}`,
      { replacements, type: QueryTypes.SELECT }
    );

    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        total_pages: Math.ceil(count / limit) || 1,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
