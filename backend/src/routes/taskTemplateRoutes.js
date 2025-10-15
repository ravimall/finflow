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

module.exports = router;
