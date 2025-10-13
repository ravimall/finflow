const express = require("express");
const { body, validationResult } = require("express-validator");
const { Op, QueryTypes } = require("sequelize");
const router = express.Router();

const {
  sequelize,
  Customer,
  CustomerAgent,
  CustomerNote,
  User,
  Loan,
  ConfigStatus,
  ConfigBank,
} = require("../models");
const auth = require("../middleware/auth");
const {
  ensureCustomerFolder,
  listFolder,
  combineWithinFolder,
  isLegacyDropboxPath,
  logDropboxAction,
} = require("../utils/dropbox");
const { logAudit } = require("../utils/audit");

function handleDropboxError(res, err, fallbackMessage) {
  const rawMessage =
    err?.error?.error_summary || err?.message || fallbackMessage || "Dropbox request failed";
  const normalizedMessage = typeof rawMessage === "string" ? rawMessage : String(rawMessage);
  const lower = normalizedMessage.toLowerCase();
  const connectionFailed =
    err?.status === 401 ||
    lower.includes("invalid_access_token") ||
    lower.includes("expired_access_token") ||
    lower.includes("invalid_client") ||
    lower.includes("cannot_refresh_access_token");

  if (connectionFailed) {
    // eslint-disable-next-line no-console
    console.error(`❌ Dropbox connection failed: ${normalizedMessage}`);
    return res
      .status(500)
      .json({ error: `Dropbox connection failed: ${normalizedMessage}` });
  }

  const statusCode = err?.statusCode || err?.status || 500;
  return res.status(statusCode).json({ error: normalizedMessage });
}

async function cleanupLegacyDropboxReferences() {
  try {
    const [updated] = await Customer.update(
      { dropboxFolderPath: null },
      {
        where: {
          dropboxFolderPath: {
            [Op.or]: [
              { [Op.like]: "/Apps/FinFlow/finflow/%" },
              { [Op.like]: "/finflow/%" },
            ],
          },
        },
      }
    );

    if (updated > 0) {
      // eslint-disable-next-line no-console
      console.info(`🧹 Cleared ${updated} legacy Dropbox folder references`);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`❌ Failed to clear legacy Dropbox folder references: ${error.message}`);
  }
}

cleanupLegacyDropboxReferences();

function logDropboxPathUpdate(customerId, path) {
  const serializedPath = typeof path === "string" ? path : null;
  // eslint-disable-next-line no-console
  console.info(
    `[DropboxPathUpdate] id=${customerId} path=${serializedPath ? JSON.stringify(serializedPath) : "null"}`
  );
}

async function generateCustomerCode(transaction) {
  const lastSequence = await sequelize.query(
    `SELECT COALESCE(NULLIF(REGEXP_REPLACE(customer_id, '\\D', '', 'g'), '')::int, 0) AS seq
       FROM customers
      ORDER BY seq DESC
      LIMIT 1
      FOR UPDATE`,
    {
      transaction,
      plain: true,
      type: QueryTypes.SELECT,
    }
  );

  const lastNumber = lastSequence?.seq ? parseInt(lastSequence.seq, 10) : 0;
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

async function provisionCustomerFolder(customer, agent, transaction, userId) {
  const agentLabel = agent?.name || agent?.email || "admin";

  if (isLegacyDropboxPath(customer.dropboxFolderPath)) {
    logDropboxPathUpdate(customer.id, null);
    customer.set("dropboxFolderPath", null);
    await customer.save({ transaction });
  }

  const { path, created } = await ensureCustomerFolder(
    agentLabel,
    customer.name,
    customer.customer_id
  );

  if (
    typeof path === "string" &&
    path.trim() &&
    (!customer.dropboxFolderPath || customer.dropboxFolderPath !== path)
  ) {
    logDropboxPathUpdate(customer.id, path);
    customer.set("dropboxFolderPath", path);
    await customer.save({ transaction });
  }

  if (created) {
    // eslint-disable-next-line no-console
    console.info(
      `📁 Created Dropbox folder ${path} for customer ${customer.id} (agent ${
        agent?.id || "admin"
      })`
    );
    await logAudit(
      userId,
      customer.id,
      "dropbox.folder.created",
      JSON.stringify({ path }),
      transaction
    );
  } else {
    // eslint-disable-next-line no-console
    console.info(
      `📁 Dropbox folder already present for customer ${customer.id} at ${path}`
    );
  }

  return { path, created };
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

        await provisionCustomerFolder(
          createdCustomer,
          assignedAgent,
          transaction,
          req.user.id
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

    const updatePayload = { ...req.body };
    delete updatePayload.dropboxFolderPath;
    delete updatePayload.dropbox_folder_path;
    delete updatePayload.folderPath;

    if (
      Object.prototype.hasOwnProperty.call(req.body || {}, "dropboxFolderPath") ||
      Object.prototype.hasOwnProperty.call(req.body || {}, "dropbox_folder_path") ||
      Object.prototype.hasOwnProperty.call(req.body || {}, "folderPath")
    ) {
      const rawPath =
        req.body?.dropboxFolderPath ??
        req.body?.dropbox_folder_path ??
        req.body?.folderPath ??
        "";

      const normalizedPath =
        typeof rawPath === "string" ? rawPath.trim() : String(rawPath || "").trim();

      if (!normalizedPath) {
        return res
          .status(400)
          .json({ error: "dropboxFolderPath is required and cannot be empty" });
      }

      logDropboxPathUpdate(customer.id, normalizedPath);
      updatePayload.dropboxFolderPath = normalizedPath;
    }

    await customer.update(updatePayload);
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

async function handleAgentAssignment(req, res) {
  try {
    const { agent_id, permission = "edit" } = req.body;

    if (!["view", "edit"].includes(permission)) {
      return res.status(400).json({ error: "Invalid permission" });
    }

    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const result = await sequelize.transaction(async (transaction) => {
      const customerForUpdate = await Customer.findByPk(customer.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const assignedAgent = await resolveAssignedAgent(
        agent_id,
        req.user.id,
        transaction
      );

      await CustomerAgent.destroy({
        where: {
          customer_id: customer.id,
          agent_id: { [Op.ne]: assignedAgent.id },
        },
        transaction,
      });

      const [assignment] = await CustomerAgent.findOrCreate({
        where: { customer_id: customer.id, agent_id: assignedAgent.id },
        defaults: { permission },
        transaction,
      });

      if (assignment.permission !== permission) {
        await assignment.update({ permission }, { transaction });
      }

      const updatePayload = {
        primary_agent_id: assignedAgent.id,
        created_by: assignedAgent.id,
      };

      await customerForUpdate.update(updatePayload, { transaction });

      await provisionCustomerFolder(
        customerForUpdate,
        assignedAgent,
        transaction,
        req.user.id
      );

      await logAudit(
        req.user.id,
        customer.id,
        "customer.agent.assigned",
        JSON.stringify({ agent_id: assignedAgent.id }),
        transaction
      );

      return assignedAgent;
    });

    const refreshed = await Customer.findByPk(customer.id, {
      include: [
        { model: User, as: "primaryAgent", attributes: ["id", "name", "email"] },
      ],
    });

    res.json({
      message: "Agent assignment updated",
      agent: {
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role,
      },
      customer: refreshed,
    });
  } catch (err) {
    const statusCode = err.statusCode || 400;
    res.status(statusCode).json({ error: err.message });
  }
}

router.get("/:id/notes", auth(), async (req, res) => {
  try {
    await assertCustomerAccess(req.user, req.params.id);
    const notes = await CustomerNote.findAll({
      where: { customer_id: req.params.id },
      include: [
        { model: User, as: "author", attributes: ["id", "name", "email", "role"] },
      ],
      order: [["created_at", "DESC"]],
    });
    res.json(notes);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: err.message });
  }
});

router.post(
  "/:id/notes",
  auth(),
  body("note").isString().isLength({ min: 1 }).withMessage("Note is required"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      await assertCustomerAccess(req.user, req.params.id);
      const customer = await Customer.findByPk(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const note = await CustomerNote.create({
        customer_id: customer.id,
        user_id: req.user.id,
        note: req.body.note,
      });

      const withAuthor = await CustomerNote.findByPk(note.id, {
        include: [
          { model: User, as: "author", attributes: ["id", "name", "email", "role"] },
        ],
      });

      res.status(201).json(withAuthor);
    } catch (err) {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({ error: err.message });
    }
  }
);

router.get("/:id/loans", auth(), async (req, res) => {
  try {
    await assertCustomerAccess(req.user, req.params.id);
    const loans = await Loan.findAll({
      where: { customer_id: req.params.id },
      include: [
        { model: ConfigBank, as: "bank", attributes: ["id", "name"] },
      ],
      order: [["updated_at", "DESC"]],
    });
    res.json(loans);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: err.message });
  }
});

router.post("/:id/assign-agent", auth("admin"), handleAgentAssignment);
router.put("/:id/assign-agent", auth("admin"), handleAgentAssignment);

router.get("/:id/dropbox-link", auth(), async (req, res) => {
  try {
    await assertCustomerAccess(req.user, req.params.id);
    const customer = await Customer.findByPk(req.params.id, {
      attributes: [
        "id",
        "name",
        "customer_id",
        ["dropbox_folder_path", "dropboxFolderPath"],
      ],
      include: [
        { model: User, as: "primaryAgent", attributes: ["id", "name", "email"] },
      ],
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        customer_id: customer.customer_id,
        dropboxFolderPath: customer.dropboxFolderPath,
        primaryAgent: customer.primaryAgent,
      },
      documents_url: `/documents?customer_id=${customer.id}`,
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: err.message });
  }
});

router.post("/:id/create-folder", auth(), async (req, res) => {
  try {
    await assertCustomerAccess(req.user, req.params.id);
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const { path, created } = await sequelize.transaction(async (transaction) => {
      const customerForUpdate = await Customer.findByPk(customer.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const agent = customerForUpdate.primary_agent_id
        ? await User.findByPk(customerForUpdate.primary_agent_id, { transaction })
        : await resolveAssignedAgent(null, req.user.id, transaction);

      const outcome = await provisionCustomerFolder(
        customerForUpdate,
        agent,
        transaction,
        req.user.id
      );

      if (outcome.created) {
        await logAudit(
          req.user.id,
          customer.id,
          "dropbox.folder.created.manual",
          JSON.stringify({ path: outcome.path }),
          transaction
        );
      }

      return outcome;
    });

    logDropboxAction("create-folder", path, req.user?.id);

    if (created) {
      // eslint-disable-next-line no-console
      console.info(
        `📁 Manual Dropbox folder creation succeeded for customer ${customer.id} (agent ${
          customer.primary_agent_id || "admin"
        }) at ${path}`
      );
    } else {
      // eslint-disable-next-line no-console
      console.info(
        `ℹ️ Dropbox folder already exists for customer ${customer.id} at ${path}`
      );
    }

    res.json({
      message: created ? "Dropbox folder created" : "Folder already exists",
      path,
    });
  } catch (err) {
    logDropboxAction("create-folder", req.params?.id || "N/A", req.user?.id);
    handleDropboxError(res, err, "Unable to create Dropbox folder");
  }
});

router.get("/:id/dropbox-list", auth(), async (req, res) => {
  try {
    await assertCustomerAccess(req.user, req.params.id);
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if (!customer.dropboxFolderPath) {
      return res.json({ path: null, entries: [] });
    }

    const targetPath = combineWithinFolder(
      customer.dropboxFolderPath,
      req.query.path
    );

    logDropboxAction("list", targetPath, req.user?.id);

    const entries = await listFolder(targetPath);

    res.json({
      path: targetPath,
      entries,
    });
  } catch (err) {
    logDropboxAction("list", req.query?.path || "N/A", req.user?.id);
    handleDropboxError(res, err, "Unable to list Dropbox entries");
  }
});

module.exports = router;
