const express = require("express");
const { body, validationResult } = require("express-validator");
const router = express.Router();

const {
  Task,
  Customer,
  CustomerAgent,
  User,
} = require("../models");
const auth = require("../middleware/auth");

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
    .isIn(["pending", "completed"])
    .withMessage("Status must be pending or completed"),
  body("due_on").optional().isISO8601().toDate(),
  body("remind_on").optional().isISO8601().toDate(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
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
      if (req.body.due_on instanceof Date && !Number.isNaN(req.body.due_on.getTime())) {
        payload.due_on = req.body.due_on;
      } else if (req.body.due_on === null) {
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

      await task.update(payload);

      const refreshed = await Task.findByPk(task.id, {
        include: [
          { model: Customer, as: "customer", attributes: ["id", "name"] },
          { model: User, as: "assignee", attributes: ["id", "name", "email"] },
        ],
      });

      return res.json(refreshed);
    } catch (err) {
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({ error: err.message });
    }
  }
);

module.exports = router;
