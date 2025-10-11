const express = require("express");
const { body, validationResult } = require("express-validator");
const router = express.Router();

const auth = require("../middleware/auth");
const { ConfigStatus, ConfigBank } = require("../models");

router.use(auth("admin"));

// ----- Statuses -----
router.get("/statuses", async (req, res) => {
  try {
    const where = {};
    if (req.query.type) {
      where.type = req.query.type;
    }
    const statuses = await ConfigStatus.findAll({ where, order: [["name", "ASC"]] });
    res.json(statuses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  "/statuses",
  body("type").isIn(["customer", "loan"]),
  body("name").notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const status = await ConfigStatus.create({
        type: req.body.type,
        name: req.body.name,
      });
      res.status(201).json(status);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

router.put(
  "/statuses/:id",
  body("name").optional().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const status = await ConfigStatus.findByPk(req.params.id);
      if (!status) return res.status(404).json({ error: "Status not found" });
      await status.update(req.body);
      res.json(status);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

router.delete("/statuses/:id", async (req, res) => {
  try {
    const status = await ConfigStatus.findByPk(req.params.id);
    if (!status) return res.status(404).json({ error: "Status not found" });
    await status.destroy();
    res.json({ message: "Status removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----- Banks -----
router.get("/banks", async (req, res) => {
  try {
    const banks = await ConfigBank.findAll({ order: [["name", "ASC"]] });
    res.json(banks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  "/banks",
  body("name").notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const bank = await ConfigBank.create({ name: req.body.name });
      res.status(201).json(bank);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

router.put(
  "/banks/:id",
  body("name").notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const bank = await ConfigBank.findByPk(req.params.id);
      if (!bank) return res.status(404).json({ error: "Bank not found" });
      await bank.update({ name: req.body.name });
      res.json(bank);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

router.delete("/banks/:id", async (req, res) => {
  try {
    const bank = await ConfigBank.findByPk(req.params.id);
    if (!bank) return res.status(404).json({ error: "Bank not found" });
    await bank.destroy();
    res.json({ message: "Bank removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
