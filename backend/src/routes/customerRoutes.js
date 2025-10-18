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
  Task,
  TaskTemplate,
  TaskTemplateItem,
} = require("../models");
const auth = require("../middleware/auth");
const canEditCustomer = require("../middleware/canEditCustomer");
const { listFolder, combineWithinFolder, logDropboxAction } = require("../utils/dropbox");
const { shouldUseFolderId, resolveFolderPath } = require("../services/dropboxFolders");
const {
  queueDropboxProvisioning,
  provisionDropboxForCustomer,
} = require("../services/dropboxProvisioning");
const { createCustomerNotesHandler } = require("../controllers/customerNotes");
const { logAudit } = require("../utils/audit");
const {
  getCustomerDeletionPreview,
  deleteCustomer,
} = require("../services/customerDeletion");

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
  const effectiveStatus = statusCode >= 400 && statusCode < 500 ? 502 : statusCode;
  return res.status(effectiveStatus).json({ error: normalizedMessage });
}

function logDropboxPathUpdate(customerId, path) {
  const serializedPath = typeof path === "string" ? path : null;
  // eslint-disable-next-line no-console
  console.info(
    `[DropboxPathUpdate] id=${customerId} path=${serializedPath ? JSON.stringify(serializedPath) : "null"}`
  );
}

function calculateAgingDays(stageStartedAt, updatedAt, createdAt) {
  const reference = stageStartedAt || updatedAt || createdAt;
  if (!reference) {
    return 0;
  }
  const timestamp = new Date(reference).getTime();
  if (Number.isNaN(timestamp)) {
    return 0;
  }
  const diffMs = Date.now() - timestamp;
  if (Number.isNaN(diffMs) || diffMs <= 0) {
    return 0;
  }
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

function resolveErrorStatus(err, defaultStatus = 500) {
  if (!err) {
    return defaultStatus;
  }
  const statusCode = err.statusCode || err.status;
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return statusCode;
  }
  return defaultStatus;
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

function normalizeFlatNumber(rawValue) {
  if (typeof rawValue === "undefined" || rawValue === null) {
    return null;
  }

  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    return trimmed === "" ? null : trimmed;
  }

  const stringified = String(rawValue).trim();
  return stringified === "" ? null : stringified;
}

async function normalizePrimaryAgentId(rawValue, transaction) {
  if (typeof rawValue === "undefined" || rawValue === null || rawValue === "") {
    return null;
  }

  const parsed = Number(rawValue);
  if (Number.isNaN(parsed)) {
    const error = new Error("Invalid primary agent");
    error.statusCode = 400;
    throw error;
  }

  const agent = await User.findByPk(parsed, { transaction });

  if (!agent || agent.role !== "agent") {
    const error = new Error("Agent not found");
    error.statusCode = 404;
    throw error;
  }

  return agent.id;
}

const customerUpdateValidators = [
  body("name").optional().isString().trim().isLength({ min: 1 }).withMessage("Name cannot be empty"),
  body("email").optional().isEmail().withMessage("Invalid email address"),
  body("phone").optional().isString().isLength({ max: 100 }).withMessage("Phone is too long"),
  body("address").optional().isString(),
  body("status").optional().isString(),
  body("flat_no").optional().isLength({ max: 50 }).withMessage("Flat number is too long"),
  body("primary_agent_id").optional().isInt({ min: 1 }).withMessage("Invalid primary agent"),
  body("dropboxFolderPath").optional().isString().isLength({ max: 255 }),
  body("dropbox_folder_path").optional().isString().isLength({ max: 255 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    return next();
  },
];

async function resolveTaskAssignee(customer, requestedAssigneeId, defaultRole, transaction) {
  if (requestedAssigneeId) {
    const parsed = Number(requestedAssigneeId);
    if (Number.isNaN(parsed)) {
      const err = new Error("Invalid assignee");
      err.statusCode = 400;
      throw err;
    }
    const user = await User.findByPk(parsed, { transaction });
    if (!user) {
      const err = new Error("Assignee not found");
      err.statusCode = 404;
      throw err;
    }
    return user.id;
  }

  const ownerId = customer?.primary_agent_id || customer?.created_by || null;

  if (defaultRole === "agent" && ownerId) {
    return ownerId;
  }

  if (defaultRole === "admin") {
    const admin = await User.findOne({
      where: { role: "admin" },
      order: [["id", "ASC"]],
      transaction,
    });
    if (admin) {
      return admin.id;
    }
  }

  return ownerId;
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
  body("primary_agent_id").optional().isInt({ min: 1 }),
  body("status").optional().isString(),
  body("flat_no").optional().isLength({ max: 50 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, email, address, status } = req.body;
    const rawFlatNo = req.body?.flat_no;

    try {
      let createdCustomerId = null;

      await sequelize.transaction(async (transaction) => {
        const isAdmin = req.user.role === "admin";
        let primaryAgentId = null;

        if (isAdmin) {
          if (Object.prototype.hasOwnProperty.call(req.body || {}, "primary_agent_id")) {
            primaryAgentId = await normalizePrimaryAgentId(
              req.body.primary_agent_id,
              transaction
            );
          }
        } else {
          primaryAgentId = req.user.id;
        }

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
            primary_agent_id: primaryAgentId,
            flat_no: normalizeFlatNumber(rawFlatNo),
          },
          { transaction }
        );

        if (primaryAgentId) {
          await ensureAgentAssignment(createdCustomer.id, primaryAgentId, transaction);
        }
        createdCustomerId = createdCustomer.id;
      });

      if (createdCustomerId) {
        await queueDropboxProvisioning(createdCustomerId, {
          trigger: "customer-create",
        });
      }

      if (!createdCustomerId) {
        throw new Error("Customer creation failed before provisioning");
      }

      const created = await Customer.findByPk(createdCustomerId, {
        include: [
          { model: User, as: "primaryAgent", attributes: ["id", "name", "email"] },
        ],
      });

      res.status(201).json({
        message: "Customer created successfully",
        customer: created,
      });
    } catch (err) {
      const statusCode = resolveErrorStatus(err);
      res.status(statusCode).json({ error: err.message });
    }
  }
);

// Get customers - admins see all, agents see their assignments/primary records
router.get("/", auth(), async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";

    const query = {
      distinct: true,
      include: [
        { model: User, as: "primaryAgent", attributes: ["id", "name", "email"] },
      ],
      order: [["created_at", "DESC"]],
    };

    if (!isAdmin) {
      query.include.push({
        model: CustomerAgent,
        as: "assignments",
        attributes: [],
        where: { agent_id: req.user.id },
        required: false,
      });

      query.where = {
        [Op.or]: [{ created_by: req.user.id }, { "$assignments.agent_id$": req.user.id }],
      };
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
        {
          model: Loan,
          as: "loans",
          include: [{ model: ConfigBank, as: "bank", attributes: ["id", "name"] }],
        },
      ],
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    if (Array.isArray(customer.loans)) {
      customer.loans = customer.loans
        .map((loan) => {
          const aging = calculateAgingDays(
            loan.stage_started_at,
            loan.updated_at,
            loan.created_at
          );
          loan.setDataValue("aging_days", aging);
          return loan;
        })
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    }

    res.json(customer);
  } catch (err) {
    const statusCode = resolveErrorStatus(err);
    res.status(statusCode).json({ error: err.message });
  }
});

async function handleCustomerUpdate(req, res) {
  try {
    const customer = req.customer;
    const isAdmin = req.user.role === "admin";
    const allowedFields = new Set(["name", "phone", "email", "address", "status", "flat_no"]);

    if (isAdmin) {
      allowedFields.add("primary_agent_id");
    }

    const updatePayload = {};

    Object.entries(req.body || {}).forEach(([key, value]) => {
      if (allowedFields.has(key)) {
        updatePayload[key] = value;
      }
    });

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

    if (Object.prototype.hasOwnProperty.call(updatePayload, "status")) {
      const statusRecord = await ConfigStatus.findOne({
        where: { type: "customer", name: updatePayload.status },
      });
      if (!statusRecord) {
        return res.status(400).json({ error: "Invalid customer status" });
      }
      updatePayload.status = statusRecord.name;
    }

    if (Object.prototype.hasOwnProperty.call(updatePayload, "flat_no")) {
      updatePayload.flat_no = normalizeFlatNumber(updatePayload.flat_no);
    }

    let nextPrimaryAgentId = customer.primary_agent_id;

    if (Object.prototype.hasOwnProperty.call(updatePayload, "primary_agent_id")) {
      if (!isAdmin) {
        delete updatePayload.primary_agent_id;
      } else {
        nextPrimaryAgentId = await normalizePrimaryAgentId(updatePayload.primary_agent_id);
        updatePayload.primary_agent_id = nextPrimaryAgentId;
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return res.json({ message: "Customer updated successfully", customer });
    }

    await customer.update(updatePayload);

    if (
      isAdmin &&
      Object.prototype.hasOwnProperty.call(updatePayload, "primary_agent_id") &&
      nextPrimaryAgentId
    ) {
      await ensureAgentAssignment(customer.id, nextPrimaryAgentId);
    }

    res.json({ message: "Customer updated successfully", customer });
  } catch (err) {
    const statusCode = resolveErrorStatus(err);
    res.status(statusCode).json({ error: err.message });
  }
}

router.put("/:id", auth(), canEditCustomer, customerUpdateValidators, handleCustomerUpdate);
router.patch("/:id", auth(), canEditCustomer, customerUpdateValidators, handleCustomerUpdate);

router.get("/:id/deletion-preview", auth("admin"), async (req, res) => {
  try {
    const preview = await getCustomerDeletionPreview(req.params.id);
    if (!preview) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(preview);
  } catch (err) {
    const statusCode = resolveErrorStatus(err);
    res.status(statusCode).json({ error: err.message || "Unable to load deletion preview" });
  }
});

router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    const { deleteDropboxFolder = false } = req.body || {};
    const result = await deleteCustomer(req.params.id, {
      actorId: req.user?.id || null,
      deleteDropboxFolder,
    });
    res.json({ ok: true, dropboxDeleted: result.dropboxDeleted, counts: result.counts });
  } catch (err) {
    const statusCode = resolveErrorStatus(err);
    res.status(statusCode).json({ error: err.message || "Failed to delete customer" });
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
    const statusCode = resolveErrorStatus(err);
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

      await logAudit(
        req.user.id,
        customer.id,
        "customer.agent.assigned",
        JSON.stringify({ agent_id: assignedAgent.id }),
        transaction
      );

      return assignedAgent;
    });

    await queueDropboxProvisioning(customer.id, {
      trigger: "agent-assignment",
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
    const statusCode = resolveErrorStatus(err);
    res.status(statusCode).json({ error: err.message });
  }
}

const handleGetCustomerNotes = createCustomerNotesHandler({
  CustomerModel: Customer,
  CustomerNoteModel: CustomerNote,
  UserModel: User,
  assertCustomerAccess,
  logger: console,
});

router.get("/:id/notes", auth(), handleGetCustomerNotes);

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
      const statusCode = resolveErrorStatus(err);
      res.status(statusCode).json({ error: err.message });
    }
  }
);

router.get("/:id/tasks", auth(), async (req, res) => {
  try {
    await assertCustomerAccess(req.user, req.params.id);
    const tasks = await Task.findAll({
      where: { customer_id: req.params.id },
      include: [
        { model: User, as: "assignee", attributes: ["id", "name", "email", "role"] },
      ],
    });

    const sorted = tasks
      .map((task) => {
        const json = task.toJSON();
        return json;
      })
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "pending" ? -1 : 1;
        }
        if (a.due_on && b.due_on) {
          if (a.due_on < b.due_on) return -1;
          if (a.due_on > b.due_on) return 1;
        } else if (a.due_on && !b.due_on) {
          return -1;
        } else if (!a.due_on && b.due_on) {
          return 1;
        }
        const createdA = new Date(a.created_at);
        const createdB = new Date(b.created_at);
        return createdA - createdB;
      });

    res.json(sorted);
  } catch (err) {
    const statusCode = resolveErrorStatus(err);
    res.status(statusCode).json({ error: err.message });
  }
});

router.post(
  "/:id/tasks",
  auth(),
  body("title").isString().isLength({ min: 1 }).withMessage("Title is required"),
  body("due_on").optional().isISO8601().toDate(),
  body("remind_on").optional().isISO8601().toDate(),
  body("assignee_id").optional().isInt({ min: 1 }),
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

      const task = await sequelize.transaction(async (transaction) => {
        const assigneeId = await resolveTaskAssignee(
          customer,
          req.body.assignee_id,
          null,
          transaction
        );

        const payload = {
          customer_id: customer.id,
          title: req.body.title.trim(),
          notes: req.body.notes ?? null,
          assignee_id: assigneeId ?? null,
          status: "pending",
          template_id: null,
        };

        if (req.body.due_on instanceof Date && !Number.isNaN(req.body.due_on.getTime())) {
          payload.due_on = req.body.due_on;
        }

        if (
          req.body.remind_on instanceof Date &&
          !Number.isNaN(req.body.remind_on.getTime())
        ) {
          payload.remind_on = req.body.remind_on;
        }

        const createdTask = await Task.create(payload, { transaction });
        return createdTask;
      });

      const hydrated = await Task.findByPk(task.id, {
        include: [
          { model: User, as: "assignee", attributes: ["id", "name", "email", "role"] },
        ],
      });

      res.status(201).json(hydrated);
    } catch (err) {
      const statusCode = resolveErrorStatus(err);
      res.status(statusCode).json({ error: err.message });
    }
  }
);

router.post(
  "/:id/tasks/templates/apply",
  auth(),
  body("template_id").isUUID().withMessage("template_id is required"),
  body("assignee_id").optional().isInt({ min: 1 }),
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

      const template = await TaskTemplate.findOne({
        where: { id: req.body.template_id, is_active: true },
        include: [{ model: TaskTemplateItem, as: "items" }],
      });

      if (!template) {
        return res.status(404).json({ error: "Template not found or inactive" });
      }

      const items = Array.isArray(template.items)
        ? [...template.items].sort((a, b) => a.sort_order - b.sort_order)
        : [];

      if (items.length === 0) {
        return res.json({ created_task_ids: [], skipped_titles: [] });
      }

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 3);

      const existing = await Task.findAll({
        where: {
          customer_id: customer.id,
          status: "pending",
          created_at: { [Op.gte]: cutoff },
        },
      });

      const existingTitles = new Set(existing.map((task) => task.title));
      const createdTaskIds = [];
      const skippedTitles = [];

      await sequelize.transaction(async (transaction) => {
        for (const item of items) {
          if (!item.title || existingTitles.has(item.title)) {
            if (item.title) {
              skippedTitles.push(item.title);
            }
            continue;
          }

          const assigneeId = await resolveTaskAssignee(
            customer,
            req.body.assignee_id,
            item.default_assignee_role,
            transaction
          );

          const dueDate = new Date();
          dueDate.setUTCHours(0, 0, 0, 0);
          dueDate.setUTCDate(dueDate.getUTCDate() + (item.offset_days || 0));

          const createdTask = await Task.create(
            {
              customer_id: customer.id,
              title: item.title,
              notes: item.notes ?? null,
              assignee_id: assigneeId ?? null,
              due_on: dueDate,
              template_id: template.id,
              status: "pending",
            },
            { transaction }
          );

          createdTaskIds.push(createdTask.id);
          existingTitles.add(item.title);
        }
      });

      res.json({ created_task_ids: createdTaskIds, skipped_titles: skippedTitles });
    } catch (err) {
      const statusCode = resolveErrorStatus(err);
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
    const enriched = loans.map((loan) => {
      loan.setDataValue(
        "aging_days",
        calculateAgingDays(loan.stage_started_at, loan.updated_at, loan.created_at)
      );
      return loan;
    });
    res.json(enriched);
  } catch (err) {
    const statusCode = resolveErrorStatus(err);
    res.status(statusCode).json({ error: err.message });
  }
});

router.post("/:id/assign-agent", auth("admin"), handleAgentAssignment);
router.put("/:id/assign-agent", auth("admin"), handleAgentAssignment);

router.post("/:id/provision-dropbox", auth(), async (req, res) => {
  try {
    await assertCustomerAccess(req.user, req.params.id);
    const customer = await Customer.findByPk(req.params.id, {
      include: [
        { model: User, as: "primaryAgent", attributes: ["id", "name", "email"] },
      ],
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    await queueDropboxProvisioning(customer.id, { trigger: "manual-retry" });

    const refreshed = await Customer.findByPk(customer.id, {
      include: [
        { model: User, as: "primaryAgent", attributes: ["id", "name", "email"] },
      ],
    });

    return res.status(202).json({
      message: "Dropbox provisioning enqueued",
      customer: refreshed,
    });
  } catch (err) {
    const statusCode = resolveErrorStatus(err);
    return res.status(statusCode).json({ error: err.message });
  }
});

router.get("/:id/dropbox-link", auth(), async (req, res) => {
  try {
    await assertCustomerAccess(req.user, req.params.id);
    const customer = await Customer.findByPk(req.params.id, {
      attributes: [
        "id",
        "name",
        "customer_id",
        ["dropbox_folder_id", "dropboxFolderId"],
        ["dropbox_folder_path", "dropboxFolderPath"],
        ["dropbox_provisioning_status", "dropboxProvisioningStatus"],
        ["dropbox_last_error", "dropboxLastError"],
      ],
      include: [
        { model: User, as: "primaryAgent", attributes: ["id", "name", "email"] },
      ],
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    let resolvedPath = customer.dropboxFolderPath;

    if (shouldUseFolderId() && customer.dropboxFolderId) {
      const latestPath = await resolveFolderPath(customer.dropboxFolderId);
      if (latestPath && latestPath !== customer.dropboxFolderPath) {
        resolvedPath = latestPath;
        await customer.update({ dropboxFolderPath: latestPath });
      }
    }

    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        customer_id: customer.customer_id,
        dropboxFolderId: customer.dropboxFolderId,
        dropboxFolderPath: resolvedPath,
        dropboxProvisioningStatus: customer.dropboxProvisioningStatus,
        dropboxLastError: customer.dropboxLastError,
        primaryAgent: customer.primaryAgent,
      },
      documents_url: `/documents?customer_id=${customer.id}`,
    });
  } catch (err) {
    const statusCode = resolveErrorStatus(err);
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

    const result = await provisionDropboxForCustomer(customer.id, {
      markPending: true,
      trigger: "manual-create",
    });

    const refreshed = await Customer.findByPk(customer.id);
    const path = result?.dropboxFolderPath || refreshed?.dropboxFolderPath || null;

    logDropboxAction("create-folder", path || "N/A", req.user?.id);

    res.json({
      message: path ? "Dropbox folder provisioned" : "Dropbox provisioning triggered",
      path,
      customer: refreshed,
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
module.exports.handleGetCustomerNotes = handleGetCustomerNotes;
