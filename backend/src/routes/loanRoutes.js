
const express = require("express");
const { body, validationResult } = require("express-validator");
const router = express.Router();
const Loan = require("../models/Loan");
const auth = require("../middleware/auth");

router.post("/",
  auth(),
  body("customer_id").notEmpty(),
  body("bank_name").notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const { customer_id, bank_name, applied_amount, approved_amount, rate_of_interest, status, notes } = req.body;
      const loan = await Loan.create({ customer_id, bank_name, applied_amount, approved_amount, rate_of_interest, status, notes });
      res.json({ message: "Loan created", loan });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

router.get("/", auth(), async (req, res) => {
  try {
    if (req.user.role === "admin") {
      const loans = await Loan.findAll();
      res.json(loans);
    } else {
      // agents see loans for their customers only (join)
      const sequelize = require("../config/db");
      const [results] = await sequelize.query(`
        SELECT l.* FROM loans l
        JOIN customers c ON l.customer_id = c.id
        WHERE c.created_by = $1
      `, { bind: [req.user.id] });
      res.json(results);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth(), async (req, res) => {
  try {
    const loan = await Loan.findByPk(req.params.id);
    if (!loan) return res.status(404).json({ error: "Loan not found" });
    // check ownership for agents
    if (req.user.role !== "admin") {
      const customer = require("../models/Customer");
      const cust = await customer.findByPk(loan.customer_id);
      if (cust.created_by !== req.user.id) return res.status(403).json({ error: "Forbidden" });
    }
    res.json(loan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", auth(), async (req, res) => {
  try {
    const loan = await Loan.findByPk(req.params.id);
    if (!loan) return res.status(404).json({ error: "Loan not found" });
    // role check similar to above
    await loan.update(req.body);
    res.json({ message: "Loan updated", loan });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    const loan = await Loan.findByPk(req.params.id);
    if (!loan) return res.status(404).json({ error: "Loan not found" });
    await loan.destroy();
    res.json({ message: "Loan deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
