
const express = require("express");
const { body, validationResult } = require("express-validator");
const router = express.Router();
const Customer = require("../models/Customer");
const auth = require("../middleware/auth");

// Create new customer (authenticated users)
router.post("/",
  auth(),
  body("customer_id").notEmpty(),
  body("name").notEmpty(),
  body("email").optional().isEmail(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const { customer_id, name, phone, email, address } = req.body;
      const customer = await Customer.create({ customer_id, name, phone, email, address, created_by: req.user.id });
      res.json({ message: "Customer created successfully", customer });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Get customers - agents see only assigned/created customers, admins see all
router.get("/", auth(), async (req, res) => {
  try {
    let customers;
    if (req.user.role === "admin") {
      customers = await Customer.findAll();
    } else {
      customers = await Customer.findAll({ where: { created_by: req.user.id } });
    }
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth(), async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    if (req.user.role !== "admin" && customer.created_by !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", auth(), async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    if (req.user.role !== "admin" && customer.created_by !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await customer.update(req.body);
    res.json({ message: "Customer updated successfully", customer });
  } catch (err) {
    res.status(400).json({ error: err.message });
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
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    if (req.user.role !== "admin" && customer.created_by !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await customer.update({ status });
    res.json({ message: "Customer status updated", customer });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Assign agent (admin only)
router.post("/:id/assign-agent", auth("admin"), async (req, res) => {
  try {
    const { agent_id, permission } = req.body;
    const CustomerAgent = require("../models/CustomerAgent");
    // create assignment
    const assignment = await CustomerAgent.create({
      customerId: req.params.id,
      agentId: agent_id,
      permission
    });
    res.json({ message: "Agent assigned successfully", assignment });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
