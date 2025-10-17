const express = require("express");
const { body, validationResult } = require("express-validator");
const router = express.Router();

const { TaskTemplate, TaskTemplateItem } = require("../models");
const auth = require("../middleware/auth");

router.get("/", auth(), async (req, res) => {
  const includeItems = req.query.include_items === "true";
  const where = {};
  if (req.query.is_active === "true") {
    where.is_active = true;
  } else if (req.query.is_active === "false") {
    where.is_active = false;
  }

  try {
    const templates = await TaskTemplate.findAll({
      where,
      order: [["name", "ASC"]],
      include: includeItems
        ? [{ model: TaskTemplateItem, as: "items" }]
        : [],
    });

    if (includeItems) {
      templates.forEach((template) => {
        if (Array.isArray(template.items)) {
          template.items.sort((a, b) => a.sort_order - b.sort_order);
        }
      });
    }

    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  "/",
  auth("admin"),
  body("name").isString().isLength({ min: 1 }).withMessage("Name is required"),
  body("is_active").optional().isBoolean().toBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const template = await TaskTemplate.create({
        name: req.body.name,
        description: req.body.description ?? null,
        is_active: req.body.is_active ?? true,
      });
      res.status(201).json(template);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.post(
  "/:id/items",
  auth("admin"),
  body("title").isString().isLength({ min: 1 }).withMessage("Title is required"),
  body("offset_days").optional().isInt().toInt(),
  body("notes").optional({ nullable: true }).isString(),
  body("default_assignee_role")
    .optional({ nullable: true })
    .isIn(["admin", "agent"])
    .withMessage("default_assignee_role must be admin or agent"),
  body("sort_order").optional().isInt().toInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const template = await TaskTemplate.findByPk(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      const existingMax = await TaskTemplateItem.max("sort_order", {
        where: { template_id: template.id },
      });

      const item = await TaskTemplateItem.create({
        template_id: template.id,
        title: req.body.title,
        notes: req.body.notes ?? null,
        offset_days: typeof req.body.offset_days === "number" ? req.body.offset_days : 0,
        default_assignee_role:
          req.body.default_assignee_role === null ? null : req.body.default_assignee_role ?? null,
        sort_order:
          typeof req.body.sort_order === "number"
            ? req.body.sort_order
            : Number.isFinite(existingMax)
            ? existingMax + 1
            : 0,
      });

      res.status(201).json(item);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.patch(
  "/:id",
  auth("admin"),
  body("name").optional().isString().isLength({ min: 1 }),
  body("is_active").optional().isBoolean().toBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const template = await TaskTemplate.findByPk(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      await template.update({
        name: req.body.name ?? template.name,
        description: req.body.description ?? template.description,
        is_active:
          typeof req.body.is_active === "boolean"
            ? req.body.is_active
            : template.is_active,
      });

      const refreshed = await TaskTemplate.findByPk(template.id, {
        include: [{ model: TaskTemplateItem, as: "items" }],
      });

      if (refreshed && Array.isArray(refreshed.items)) {
        refreshed.items.sort((a, b) => a.sort_order - b.sort_order);
      }

      res.json(refreshed);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.patch(
  "/:templateId/items/:itemId",
  auth("admin"),
  body("title").optional().isString().isLength({ min: 1 }),
  body("offset_days").optional().isInt().toInt(),
  body("notes").optional({ nullable: true }).isString(),
  body("default_assignee_role")
    .optional({ nullable: true })
    .isIn(["admin", "agent"])
    .withMessage("default_assignee_role must be admin or agent"),
  body("sort_order").optional().isInt().toInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const template = await TaskTemplate.findByPk(req.params.templateId);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      const item = await TaskTemplateItem.findOne({
        where: { id: req.params.itemId, template_id: template.id },
      });

      if (!item) {
        return res.status(404).json({ error: "Template item not found" });
      }

      await item.update({
        title: req.body.title ?? item.title,
        notes: req.body.notes ?? item.notes,
        offset_days:
          typeof req.body.offset_days === "number" ? req.body.offset_days : item.offset_days,
        default_assignee_role:
          req.body.default_assignee_role === undefined
            ? item.default_assignee_role
            : req.body.default_assignee_role,
        sort_order:
          typeof req.body.sort_order === "number" ? req.body.sort_order : item.sort_order,
      });

      res.json(item);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    const template = await TaskTemplate.findByPk(req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    await template.destroy();
    res.json({ message: "Template deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:templateId/items/:itemId", auth("admin"), async (req, res) => {
  try {
    const template = await TaskTemplate.findByPk(req.params.templateId);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    const item = await TaskTemplateItem.findOne({
      where: { id: req.params.itemId, template_id: template.id },
    });

    if (!item) {
      return res.status(404).json({ error: "Template item not found" });
    }

    await item.destroy();
    res.json({ message: "Template item deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
