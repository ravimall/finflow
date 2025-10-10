const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const { ConfigStatus, ConfigBank } = require("../models");

router.use(auth());

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

router.get("/banks", async (req, res) => {
  try {
    const banks = await ConfigBank.findAll({ order: [["name", "ASC"]] });
    res.json(banks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
