const express = require("express");
const { body, validationResult } = require("express-validator");
const router = express.Router();

const dbx = require("../config/dropbox");
const {
  sequelize,
  Customer,
  CustomerAgent,
  User,
  ConfigStatus,
} = require("../models");
const auth = require("../middleware/auth");

function sanitizeSegment(value, fallback = "unknown") {
  const normalized = (value || fallback)
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-_]/g, "")
    .trim();
  const collapsed = normalized.replace(/\s+/g, "_");
  return collapsed || fallback;
}

async function ensureDropboxFolder(agentName, customerName, customerCode) {
  const segments = [
    "finflow",
    sanitizeSegment(agentName, "admin"),
    `${sanitizeSegment(customerName, "customer")}_${customerCode}`,
  ];

  let currentPath = "";
  for (const segment of segments) {
    currentPath = `${currentPath}/${segment}`;
    try {
      await dbx.filesCreateFolderV2({ path: currentPath, autorename: false });
    } catch (error) {
      const summary = error?.error?.error_summary || "";
      if (error?.status === 409 || summary.includes("path/conflict")) {
        continue;
      }
      throw error;
    }
  }

  return `/${segments.join("/")}`;
}

async function generateCustomerCode(transaction) {
  const lastCustomer = await Customer.findOne({
    attributes: ["customer_id"],
    order: [[sequelize.literal("CAST(SUBSTRING(customer_id, 5) AS INTEGER)"), "DESC"]],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!lastCustomer) {
    return "CUST0001";
  }

  const match = lastCustomer.customer_id.match(/(\d+)$/);
  const lastNumber = match ? parseInt(match[1], 10) : 0;
  const nextNumber = lastNumber + 1;
  return `CUST${String(nextNumber).padStart(4, "0")}`;
}

async function resolveAssignedAgent(agentId, requestingUserId, transaction) {
  if (agentId) {
    const agent = await User.findByPk(agentId, { transaction });
    if (!agent || agent.role !== "agent") {
      throw new Error("Agent not found");
    }
    return agent;
  }

  const admin = await User.findOne({
    where: { role: "admin" },
    order: [["id", "ASC"]],
    transaction,
  });

  if (admin) {
    return admin;
  }

  const fallback = await User.findByPk(requestingUserId, { transaction });
  if (!fallback) {
    throw new Error("Requesting user not found");
  }
  return fallback;
}

async function resolveCustomerStatus(statusName, transaction) {
  if (statusName) {
    const statusRecord = await ConfigStatus.findOne({
      where: { type: "customer", name: statusName },
      transaction,
    });
    if (!statusRecord) {
      throw new Error("Invalid customer status");
    }
    return statusRecord.name;
  }

  const defaultStatus = await ConfigStatus.findOne({
    where: { type: "customer" },
    order: [["id", "ASC"]],
    transaction,
  });

  return defaultStatus ? defaultStatus.name : "Booking";
}

async function ensureAgentAssignment(customerId, agentId, transaction) {
  await CustomerAgent.findOrCreate({
    where: { customer_id: customerId, agent_id: agentId },
    defaults: { permission: "edit" },
    transaction,
  });
}

async function assertCustomerAccess(user, customerId) {
  if (user.role === "admin") {
    return;
  }
  const assignment = await CustomerAgent.findOne({
    where: { customer_id: customerId, agent_id: user.id },
  });
  if (!assignment) {
    const customer = await Customer.findByPk(customerId);
    if (!customer || customer.created_by !== user.id) {
      const error = new Error("Forbidden");
      error.statusCode = 403;
      throw error;
    }
  }
}

// Create new customer (authenticated users)
router.post(
  "/",
  auth(),
  body("name").notEmpty(),
  body("email").optional().isEmail(),
  body("agent_id").optional().isInt({ min: 1 }),
  body("status").optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, email, address, agent_id, status } = req.body;

    try {
      const customer = await sequelize.transaction(async (transaction) => {
        const assignedAgent = await resolveAssignedAgent(
          agent_id,
          req.user.id,
          transaction
        );
        const customerStatus = await resolveCustomerStatus(status, transaction);
        const customerCode = await generateCustomerCode(transaction);

        const createdCustomer = await Customer.create(
          {
            customer_id: customerCode,
            name,
            phone,
            email,
            address,
            status: customerStatus,
            created_by: req.user.id,
            primary_agent_id: assignedAgent.id,
          },
          { transaction }
        );

        await ensureAgentAssignment(createdCustomer.id, assignedAgent.id, transaction);

        const folderPath = await ensureDropboxFolder(
          assignedAgent.name || assignedAgent.email || "admin",
          createdCustomer.name,
          createdCustomer.customer_id
        );

        await createdCustomer.update(
          { dropbox_folder_path: folderPath },
          { transaction }
        );

        return createdCustomer;
      });

      const created = await Customer.findByPk(customer.id, {
        include: [
          { model: User, as: "primaryAgent", attributes: ["id", "name", "email"] },
        ],
      });

      res.json({ message: "Customer created successfully", customer: created });
    } catch (err) {
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }
);

// Get customers - agents see only assigned customers, admins see all
router.get("/", auth(), async (req, res) => {
  try {
    const query = {
      distinct: true,
      include: [
        { model: User, as: "primaryAgent", attributes: ["id", "name", "email"] },
      ],
      order: [["created_at", "DESC"]],
    };

    if (req.user.role !== "admin") {
      query.include.push({
        model: CustomerAgent,
        as: "assignments",
        attributes: [],
        where: { agent_id: req.user.id },
        required: true,
      });
    }

    const customers = await Customer.findAll(query);
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth(), async (req, res) => {
  try {
    await assertCustomerAccess(req.user, req.params.id);
    const customer = await Customer.findByPk(req.params.id, {
      include: [
        { model: User, as: "primaryAgent", attributes: ["id", "name", "email"] },
      ],
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: err.message });
  }
});

router.put("/:id", auth(), async (req, res) => {
  try {
    await assertCustomerAccess(req.user, req.params.id);
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    if (req.body.status) {
      const statusRecord = await ConfigStatus.findOne({
        where: { type: "customer", name: req.body.status },
      });
      if (!statusRecord) {
        return res.status(400).json({ error: "Invalid customer status" });
      }
    }

    await customer.update(req.body);
    res.json({ message: "Customer updated successfully", customer });
  } catch (err) {
    const statusCode = err.statusCode || 400;
    res.status(statusCode).json({ error: err.message });
  }
});

router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    await customer.destroy();
    res.json({ message: "Customer deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id/status", auth(), async (req, res) => {
  try {
    const { status } = req.body;
    await assertCustomerAccess(req.user, req.params.id);
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const statusRecord = await ConfigStatus.findOne({
      where: { type: "customer", name: status },
    });
    if (!statusRecord) {
      return res.status(400).json({ error: "Invalid customer status" });
    }

    await customer.update({ status: statusRecord.name });
    res.json({ message: "Customer status updated", customer });
  } catch (err) {
    const statusCode = err.statusCode || 400;
    res.status(statusCode).json({ error: err.message });
  }
});

// Assign agent (admin only)
router.post("/:id/assign-agent", auth("admin"), async (req, res) => {
  try {
    const { agent_id, permission = "edit" } = req.body;
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const agent = await User.findByPk(agent_id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    const [assignment] = await CustomerAgent.findOrCreate({
      where: { customer_id: customer.id, agent_id: agent.id },
      defaults: { permission },
    });

    if (assignment.permission !== permission) {
      await assignment.update({ permission });
    }

    await customer.update({ primary_agent_id: agent.id });

    res.json({ message: "Agent assigned successfully", assignment });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
