const express = require("express");
const { body, validationResult } = require("express-validator");
const router = express.Router();
const Sequelize = require("sequelize");

const {
  Task,
  Customer,
  CustomerAgent,
  User,
} = require("../models");
const sequelize = require("../config/db");
const auth = require("../middleware/auth");
const ensureModernTaskSchema = require("../utils/ensureModernTaskSchema");

const { Op, fn, col, literal, cast } = Sequelize;

const ALLOWED_STATUSES = [
  "pending",
  "waiting",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
];

const ALLOWED_PRIORITIES = ["low", "medium", "high", "urgent"];

const listIncludes = [
  {
    model: Customer,
    as: "customer",
    attributes: [
      "id",
      "name",
      "customer_id",
      "status",
      "primary_agent_id",
    ],
    include: [
      {
        model: User,
        as: "primaryAgent",
        attributes: ["id", "name", "email"],
        required: false,
      },
    ],
    required: false,
  },
  {
    model: User,
    as: "assignee",
    attributes: ["id", "name", "email"],
    required: false,
  },
];

const aggregationIncludes = [
  {
    model: Customer,
    as: "customer",
    attributes: [],
    required: false,
  },
  {
    model: User,
    as: "assignee",
    attributes: [],
    required: false,
  },
];

function parseArrayParam(query, key) {
  const value = query[key] ?? query[`${key}[]`];
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    return value.split(",").map((entry) => entry.trim());
  }

  return [];
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  }
  return false;
}

function parseDateOnly(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function sanitizeTextForArray(values) {
  return values.map((value) =>
    value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/'/g, "''")
  );
}

function buildJsonbExistsAnyCondition(column, values) {
  if (!values.length) {
    return null;
  }
  const sanitized = sanitizeTextForArray(values);
  const arrayLiteral = `{${sanitized.map((v) => `"${v}"`).join(",")}}`;

  return Sequelize.where(
    fn(
      "jsonb_exists_any",
      col(column),
      cast(Sequelize.literal(`'${arrayLiteral}'`), "text[]")
    ),
    true
  );
}

function formatDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value);
}

function isOverdue(status, dueDate) {
  if (!dueDate || status === "completed") {
    return false;
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return new Date(`${dueDate}T00:00:00Z`) < today;
}

function computeGroupKey(task, groupBy) {
  switch (groupBy) {
    case "customer": {
      const id = task.customer ? task.customer.id : null;
      return id ? `customer:${id}` : "customer:null";
    }
    case "agent": {
      const id = task.assignee ? task.assignee.id : null;
      return id ? `agent:${id}` : "agent:null";
    }
    case "status":
      return `status:${task.status}`;
    case "due_week": {
      const dueDate = formatDate(task.due_on);
      if (!dueDate) {
        return "due_week:unscheduled";
      }
      const date = new Date(`${dueDate}T00:00:00Z`);
      const tempDate = new Date(date.valueOf());
      tempDate.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
      const week = Math.ceil(((tempDate - yearStart) / 86400000 + 1) / 7);
      const weekString = String(week).padStart(2, "0");
      return `due_week:${tempDate.getUTCFullYear()}-W${weekString}`;
    }
    default:
      return null;
  }
}

function formatTask(task, groupBy) {
  const dueDate = formatDate(task.due_on);
  const updatedAt = task.updated_at instanceof Date ? task.updated_at.toISOString() : null;
  const completedAt = task.completed_at instanceof Date ? task.completed_at.toISOString() : null;
  const tags = Array.isArray(task.tags) ? task.tags : [];
  const riskFlags = Array.isArray(task.risk_flags) ? task.risk_flags : [];

  const groupKey = groupBy && groupBy !== "none" ? computeGroupKey(task, groupBy) : null;

  return {
    id: task.id,
    title: task.title,
    status: task.status,
    due_date: dueDate,
    priority: task.priority || "medium",
    assignee_id: task.assignee ? task.assignee.id : task.assignee_id,
    assignee_name: task.assignee ? task.assignee.name : null,
    assignee_email: task.assignee ? task.assignee.email : null,
    customer_id: task.customer ? task.customer.id : task.customer_id,
    customer_code: task.customer ? task.customer.customer_id : null,
    customer_name: task.customer ? task.customer.name : null,
    customer_status: task.customer ? task.customer.status : null,
    customer_primary_agent_id: task.customer ? task.customer.primary_agent_id : null,
    customer_primary_agent_name: task.customer && task.customer.primaryAgent
      ? task.customer.primaryAgent.name
      : null,
    risk_flags: riskFlags,
    tags,
    updated_at: updatedAt,
    type: "task",
    overdue: isOverdue(task.status, dueDate),
    completed_at: completedAt,
    group_key: groupKey,
    notes: task.notes || null,
  };
}

async function buildGroups(groupBy, whereClause) {
  if (!groupBy || groupBy === "none") {
    return [];
  }

  if (groupBy === "customer") {
    const rows = await Task.findAll({
      where: whereClause,
      attributes: [
        "customer_id",
        [col("customer.id"), "customer_db_id"],
        [col("customer.name"), "customer_name"],
        [fn("COUNT", col("Task.id")), "count"],
      ],
      include: aggregationIncludes,
      group: ["Task.customer_id", "customer.id", "customer.name"],
      raw: true,
    });

    return rows.map((row) => {
      const id = row.customer_db_id;
      return {
        key: id ? `customer:${id}` : "customer:null",
        label: row.customer_name || "Unassigned Customer",
        count: Number(row.count) || 0,
      };
    });
  }

  if (groupBy === "agent") {
    const rows = await Task.findAll({
      where: whereClause,
      attributes: [
        "assignee_id",
        [col("assignee.id"), "assignee_db_id"],
        [col("assignee.name"), "assignee_name"],
        [fn("COUNT", col("Task.id")), "count"],
      ],
      include: aggregationIncludes,
      group: ["Task.assignee_id", "assignee.id", "assignee.name"],
      raw: true,
    });

    return rows.map((row) => {
      const id = row.assignee_db_id;
      return {
        key: id ? `agent:${id}` : "agent:null",
        label: row.assignee_name || "Unassigned",
        count: Number(row.count) || 0,
      };
    });
  }

  if (groupBy === "status") {
    const rows = await Task.findAll({
      where: whereClause,
      attributes: [
        "status",
        [fn("COUNT", col("Task.id")), "count"],
      ],
      include: aggregationIncludes,
      group: ["Task.status"],
      raw: true,
    });

    return rows.map((row) => ({
      key: `status:${row.status}`,
      label: row.status,
      count: Number(row.count) || 0,
    }));
  }

  if (groupBy === "due_week") {
    const weekLabelSql =
      "CASE WHEN \"Task\".\"due_on\" IS NULL THEN 'unscheduled' ELSE to_char(\"Task\".\"due_on\", 'IYYY-\"W\"IW') END";
    const rows = await Task.findAll({
      where: whereClause,
      attributes: [
        [literal(weekLabelSql), "label"],
        [fn("COUNT", col("Task.id")), "count"],
      ],
      include: aggregationIncludes,
      group: [literal(weekLabelSql)],
      raw: true,
    });

    return rows.map((row) => {
      const label = row.label || "unscheduled";
      return {
        key: `due_week:${label === "unscheduled" ? "unscheduled" : label}`,
        label,
        count: Number(row.count) || 0,
      };
    });
  }

  return [];
}

async function userCanAccessCustomer(user, customer) {
  if (!customer) {
    const err = new Error("Customer not found");
    err.statusCode = 404;
    throw err;
  }

  if (user.role === "admin") {
    return true;
  }

  if (customer.created_by === user.id || customer.primary_agent_id === user.id) {
    return true;
  }

  const assignment = await CustomerAgent.findOne({
    where: { customer_id: customer.id, agent_id: user.id },
  });

  if (assignment) {
    return true;
  }

  const err = new Error("Forbidden");
  err.statusCode = 403;
  throw err;
}

router.get("/", auth(), async (req, res) => {
  try {
    await ensureModernTaskSchema();

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const rawPageSize = parseInt(req.query.page_size, 10);
    let pageSize = Number.isNaN(rawPageSize) ? 50 : rawPageSize;
    pageSize = Math.min(Math.max(pageSize, 1), 200);

    const statusFilters = parseArrayParam(req.query, "status");
    const invalidStatuses = statusFilters.filter((status) => !ALLOWED_STATUSES.includes(status));
    if (invalidStatuses.length) {
      return res.status(400).json({ error: `Invalid status values: ${invalidStatuses.join(", ")}` });
    }

    const priorityFilters = parseArrayParam(req.query, "priority");
    const invalidPriorities = priorityFilters.filter((priority) => !ALLOWED_PRIORITIES.includes(priority));
    if (invalidPriorities.length) {
      return res.status(400).json({ error: `Invalid priority values: ${invalidPriorities.join(", ")}` });
    }

    const dueFromRaw = req.query.due_from;
    const dueToRaw = req.query.due_to;
    const dueFrom = dueFromRaw ? parseDateOnly(dueFromRaw) : null;
    const dueTo = dueToRaw ? parseDateOnly(dueToRaw) : null;
    if (dueFromRaw && !dueFrom) {
      return res.status(400).json({ error: "Invalid due_from date format" });
    }
    if (dueToRaw && !dueTo) {
      return res.status(400).json({ error: "Invalid due_to date format" });
    }

    const overdueOnly = parseBoolean(req.query.overdue_only);
    const unassigned = parseBoolean(req.query.unassigned);
    const riskOnly = parseBoolean(req.query.risk_only);

    const tagFilters = parseArrayParam(req.query, "tags").filter((tag) => tag.length > 0);
    const riskFlagFilters = parseArrayParam(req.query, "risk_flags").filter((flag) => flag.length > 0);
    const customerFilters = parseArrayParam(req.query, "customer_id")
      .map((value) => parseInt(value, 10))
      .filter((value) => !Number.isNaN(value));
    const agentFilters = parseArrayParam(req.query, "agent_id")
      .map((value) => parseInt(value, 10))
      .filter((value) => !Number.isNaN(value));

    const scopeMode = typeof req.query.scope_mode === "string" && req.query.scope_mode.trim() !== ""
      ? req.query.scope_mode.trim()
      : "all";
    const allowedScopes = new Set(["all", "agent", "customer"]);
    if (!allowedScopes.has(scopeMode)) {
      return res.status(400).json({ error: "Invalid scope_mode" });
    }

    const groupBy = typeof req.query.group_by === "string" && req.query.group_by.trim() !== ""
      ? req.query.group_by.trim()
      : "none";
    const allowedGroups = new Set(["none", "customer", "agent", "status", "due_week"]);
    if (!allowedGroups.has(groupBy)) {
      return res.status(400).json({ error: "Invalid group_by value" });
    }

    const sortParam = typeof req.query.sort === "string" ? req.query.sort : "";
    const sortTokens = sortParam
      .split(",")
      .map((token) => token.trim())
      .filter((token) => token.length > 0);

    const filters = [];

    if (statusFilters.length) {
      filters.push({ status: { [Op.in]: statusFilters } });
    }

    if (priorityFilters.length) {
      filters.push({ priority: { [Op.in]: priorityFilters } });
    }

    const dueFilter = {};
    if (dueFrom) {
      dueFilter[Op.gte] = dueFrom;
    }
    if (dueTo) {
      dueFilter[Op.lte] = dueTo;
    }

    if (overdueOnly) {
      const today = new Date();
      const todayString = today.toISOString().slice(0, 10);
      dueFilter[Op.lt] = todayString;
      dueFilter[Op.ne] = null;
      filters.push({ status: { [Op.ne]: "completed" } });
    }

    if (Object.keys(dueFilter).length) {
      filters.push({ due_on: dueFilter });
    }

    if (unassigned) {
      filters.push({ assignee_id: { [Op.is]: null } });
    }

    if (customerFilters.length) {
      filters.push({ customer_id: { [Op.in]: customerFilters } });
    }

    if (agentFilters.length && !unassigned) {
      filters.push({ assignee_id: { [Op.in]: agentFilters } });
    }

    if (tagFilters.length) {
      const condition = buildJsonbExistsAnyCondition("Task.tags", tagFilters);
      if (condition) {
        filters.push(condition);
      }
    }

    if (riskFlagFilters.length) {
      const condition = buildJsonbExistsAnyCondition("Task.risk_flags", riskFlagFilters);
      if (condition) {
        filters.push(condition);
      }
    }

    if (riskOnly) {
      filters.push(
        Sequelize.where(fn("jsonb_array_length", col("Task.risk_flags")), {
          [Op.gt]: 0,
        })
      );
    }

    if (scopeMode === "agent") {
      const scopeId = req.query.scope_id ? parseInt(req.query.scope_id, 10) : req.user?.id;
      if (!scopeId || Number.isNaN(scopeId)) {
        return res.status(400).json({ error: "Invalid scope_id for agent scope" });
      }
      filters.push({ assignee_id: scopeId });
    }

    if (scopeMode === "customer") {
      const scopeId = req.query.scope_id ? parseInt(req.query.scope_id, 10) : null;
      if (!scopeId || Number.isNaN(scopeId)) {
        return res.status(400).json({ error: "Invalid scope_id for customer scope" });
      }
      filters.push({ customer_id: scopeId });
    }

    const searchTerm = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (searchTerm) {
      const likeTerm = `%${escapeLike(searchTerm)}%`;
      filters.push({
        [Op.or]: [
          { title: { [Op.iLike]: likeTerm } },
          { "$customer.name$": { [Op.iLike]: likeTerm } },
          { "$customer.customer_id$": { [Op.iLike]: likeTerm } },
          Sequelize.where(cast(col("Task.tags"), "text"), { [Op.iLike]: likeTerm }),
        ],
      });
    }

    const whereClause = filters.length ? { [Op.and]: filters } : {};

    const sortFields = {
      due_date: { column: "due_on" },
      priority: { column: "priority" },
      status: { column: "status" },
      updated_at: { column: "updated_at" },
      customer: { association: { model: Customer, as: "customer" }, column: "name" },
      agent: { association: { model: User, as: "assignee" }, column: "name" },
    };

    const order = [];
    sortTokens.forEach((token) => {
      const [field, dirRaw] = token.split(":");
      const direction = dirRaw && dirRaw.toLowerCase() === "asc" ? "ASC" : "DESC";
      const config = sortFields[field];
      if (!config) {
        return;
      }

      if (config.association) {
        order.push([config.association, config.column, direction]);
      } else {
        order.push([config.column, direction]);
      }
    });

    if (!order.length) {
      order.push(["updated_at", "DESC"]);
    }

    const tasksResult = await Task.findAndCountAll({
      where: whereClause,
      include: listIncludes,
      order,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      distinct: true,
    });

    const total = typeof tasksResult.count === "number"
      ? tasksResult.count
      : tasksResult.count.length;

    const items = tasksResult.rows.map((task) => formatTask(task, groupBy));
    const groups = await buildGroups(groupBy, whereClause);

    return res.json({
      items,
      groups,
      total,
      page,
      page_size: pageSize,
    });
  } catch (error) {
    req.app?.locals?.logger?.error?.(error.message);
    return res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

router.get("/my", auth(), async (req, res) => {
  const status = req.query.status || "pending";
  const groupBy = req.query.group_by;

  if (!["pending", "completed"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  if (!req.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const tasks = await Task.findAll({
      where: { status, assignee_id: req.user.id },
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: [
            "id",
            "name",
            "primary_agent_id",
            "created_by",
          ],
        },
      ],
      order: [["due_on", "ASC"], ["created_at", "ASC"]],
    });

    if (groupBy === "customer") {
      const groups = new Map();
      tasks.forEach((task) => {
        if (!task.customer) {
          return;
        }
        const current = groups.get(task.customer.id) || {
          customer_id: String(task.customer.id),
          customer_name: task.customer.name,
          owner_id: task.customer.primary_agent_id
            ? String(task.customer.primary_agent_id)
            : task.customer.created_by
            ? String(task.customer.created_by)
            : null,
          tasks: [],
          earliestDueOn: null,
        };

        current.tasks.push({
          id: task.id,
          title: task.title,
          due_on: task.due_on,
          remind_on: task.remind_on,
          notes: task.notes,
        });

        const dueDate = task.due_on ? new Date(task.due_on) : null;
        if (!current.earliestDueOn || (dueDate && dueDate < current.earliestDueOn)) {
          current.earliestDueOn = dueDate;
        }

        groups.set(task.customer.id, current);
      });

      const result = Array.from(groups.values())
        .map((group) => ({
          customer_id: group.customer_id,
          customer_name: group.customer_name,
          owner_id: group.owner_id,
          tasks: group.tasks.sort((a, b) => {
            if (a.due_on && b.due_on) {
              if (a.due_on < b.due_on) return -1;
              if (a.due_on > b.due_on) return 1;
            } else if (a.due_on && !b.due_on) {
              return -1;
            } else if (!a.due_on && b.due_on) {
              return 1;
            }
            return 0;
          }),
          earliestDueOn: group.earliestDueOn,
        }))
        .sort((a, b) => {
          if (!a.earliestDueOn && !b.earliestDueOn) return 0;
          if (!a.earliestDueOn) return 1;
          if (!b.earliestDueOn) return -1;
          return a.earliestDueOn - b.earliestDueOn;
        })
        .map(({ earliestDueOn, ...rest }) => rest);

      return res.json(result);
    }

    return res.json(
      tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        due_on: task.due_on,
        remind_on: task.remind_on,
        notes: task.notes,
        customer: task.customer
          ? { id: task.customer.id, name: task.customer.name }
          : null,
      }))
    );
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ error: err.message });
  }
});

router.patch(
  "/:id",
  auth(),
  body("title").optional().isString().isLength({ min: 1 }).withMessage("Title is required"),
  body("notes").optional().isString(),
  body("status")
    .optional()
    .isIn(ALLOWED_STATUSES)
    .withMessage("Invalid status value"),
  body("due_date")
    .optional({ nullable: true })
    .custom((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value))
    .withMessage("due_date must be null or YYYY-MM-DD"),
  body("priority")
    .optional()
    .isIn(ALLOWED_PRIORITIES)
    .withMessage("Invalid priority value"),
  body("assignee_id")
    .optional({ nullable: true })
    .custom((value) => value === null || Number.isInteger(Number(value)))
    .withMessage("assignee_id must be an integer or null"),
  body("tags")
    .optional()
    .isArray()
    .withMessage("tags must be an array of strings"),
  body("tags.*").optional().isString().withMessage("Each tag must be a string"),
  body("risk_flags")
    .optional()
    .isArray()
    .withMessage("risk_flags must be an array of strings"),
  body("risk_flags.*")
    .optional()
    .isString()
    .withMessage("Each risk flag must be a string"),
  body("due_on").optional().isISO8601().toDate(),
  body("remind_on").optional().isISO8601().toDate(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      await ensureModernTaskSchema();

      const task = await Task.findByPk(req.params.id, {
        include: [{
          model: Customer,
          as: "customer",
        }],
      });

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      await userCanAccessCustomer(req.user, task.customer);

      if (req.user.role !== "admin" && task.assignee_id && task.assignee_id !== req.user.id) {
        const err = new Error("Forbidden");
        err.statusCode = 403;
        throw err;
      }

      const payload = {};
      if (typeof req.body.title === "string") {
        payload.title = req.body.title.trim();
      }
      if (typeof req.body.notes === "string") {
        payload.notes = req.body.notes;
      }
      if (req.body.status) {
        payload.status = req.body.status;
        payload.completed_at =
          req.body.status === "completed" ? new Date() : null;
        if (req.body.status === "completed") {
          payload.remind_on = null;
        }
      }
      const dueDateInput =
        typeof req.body.due_date === "string"
          ? req.body.due_date
          : req.body.due_date === null
          ? null
          : req.body.due_on instanceof Date && !Number.isNaN(req.body.due_on.getTime())
          ? req.body.due_on.toISOString().slice(0, 10)
          : undefined;

      if (typeof dueDateInput === "string") {
        payload.due_on = dueDateInput;
      } else if (dueDateInput === null) {
        payload.due_on = null;
      }
      if (
        req.body.remind_on instanceof Date &&
        !Number.isNaN(req.body.remind_on.getTime())
      ) {
        payload.remind_on = req.body.remind_on;
      } else if (req.body.remind_on === null) {
        payload.remind_on = null;
      }

      if (req.body.priority) {
        payload.priority = req.body.priority;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "assignee_id")) {
        if (req.body.assignee_id === null || req.body.assignee_id === "") {
          payload.assignee_id = null;
        } else {
          payload.assignee_id = Number(req.body.assignee_id);
        }
      }

      if (Array.isArray(req.body.tags)) {
        payload.tags = req.body.tags
          .filter((tag) => typeof tag === "string")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0);
      }

      if (Array.isArray(req.body.risk_flags)) {
        payload.risk_flags = req.body.risk_flags
          .filter((flag) => typeof flag === "string")
          .map((flag) => flag.trim())
          .filter((flag) => flag.length > 0);
      }

      await task.update(payload);

      const refreshed = await Task.findByPk(task.id, {
        include: listIncludes,
      });

      return res.json(formatTask(refreshed, "none"));
    } catch (err) {
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({ error: err.message });
    }
  }
);

router.post("/bulk-actions", auth(), async (req, res) => {
  const { ids, action, payload = {} } = req.body || {};

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids must be a non-empty array" });
  }

  if (typeof action !== "string") {
    return res.status(400).json({ error: "action is required" });
  }

  const allowedActions = new Set([
    "mark_done",
    "reassign",
    "set_due",
    "set_status",
    "add_tag",
    "remove_tag",
    "delete",
  ]);

  if (!allowedActions.has(action)) {
    return res.status(400).json({ error: "Unsupported action" });
  }

  try {
    await ensureModernTaskSchema();
  } catch (error) {
    req.app?.locals?.logger?.error?.(error.message);
    return res.status(500).json({ error: "Failed to prepare task schema" });
  }

  const transaction = await sequelize.transaction();

  try {
    const tasks = await Task.findAll({
      where: { id: { [Op.in]: ids } },
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name", "primary_agent_id", "created_by"],
        },
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!tasks.length) {
      await transaction.commit();
      return res.json({ updated: 0 });
    }

    for (const task of tasks) {
      await userCanAccessCustomer(req.user, task.customer);
    }

    let updatedCount = 0;

    if (action === "delete") {
      const deleted = await Task.destroy({
        where: { id: { [Op.in]: ids } },
        transaction,
      });
      await transaction.commit();
      return res.json({ updated: deleted });
    }

    for (const task of tasks) {
      const updatePayload = {};

      if (action === "mark_done") {
        updatePayload.status = "completed";
        updatePayload.completed_at = new Date();
        updatePayload.remind_on = null;
      }

      if (action === "reassign") {
        const assigneeId =
          payload.assignee_id === null || payload.assignee_id === ""
            ? null
            : Number(payload.assignee_id);
        if (assigneeId !== null && Number.isNaN(assigneeId)) {
          await transaction.rollback();
          return res.status(400).json({ error: "Invalid assignee_id" });
        }
        updatePayload.assignee_id = assigneeId;
      }

      if (action === "set_due") {
        if (payload.due_date === null) {
          updatePayload.due_on = null;
        } else if (typeof payload.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.due_date)) {
          updatePayload.due_on = payload.due_date;
        } else {
          await transaction.rollback();
          return res.status(400).json({ error: "Invalid due_date" });
        }
      }

      if (action === "set_status") {
        if (!payload.status || !ALLOWED_STATUSES.includes(payload.status)) {
          await transaction.rollback();
          return res.status(400).json({ error: "Invalid status" });
        }
        updatePayload.status = payload.status;
        updatePayload.completed_at =
          payload.status === "completed" ? new Date() : null;
        if (payload.status === "completed") {
          updatePayload.remind_on = null;
        }
      }

      if (action === "add_tag") {
        if (typeof payload.tag !== "string" || !payload.tag.trim()) {
          await transaction.rollback();
          return res.status(400).json({ error: "tag is required" });
        }
        const currentTags = Array.isArray(task.tags) ? task.tags : [];
        const nextTags = new Set(currentTags.map((tag) => String(tag)));
        nextTags.add(payload.tag.trim());
        updatePayload.tags = Array.from(nextTags);
      }

      if (action === "remove_tag") {
        if (typeof payload.tag !== "string" || !payload.tag.trim()) {
          await transaction.rollback();
          return res.status(400).json({ error: "tag is required" });
        }
        const currentTags = Array.isArray(task.tags) ? task.tags : [];
        updatePayload.tags = currentTags.filter((tag) => tag !== payload.tag.trim());
      }

      await task.update(updatePayload, { transaction });
      updatedCount += 1;
    }

    await transaction.commit();
    return res.json({ updated: updatedCount });
  } catch (error) {
    await transaction.rollback();
    req.app?.locals?.logger?.error?.(error.message);
    return res.status(500).json({ error: "Failed to apply bulk action" });
  }
});

module.exports = router;
