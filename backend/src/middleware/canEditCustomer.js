const { Customer } = require("../models");

async function canEditCustomer(req, res, next) {
  try {
    const customerId = req.params.id;

    if (!customerId) {
      return res.status(400).json({ error: "Customer ID is required" });
    }

    const customer = await Customer.findByPk(customerId);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if (req.user?.role === "admin" || customer.primary_agent_id === req.user?.id) {
      req.customer = customer;
      return next();
    }

    return res.status(403).json({ error: "Forbidden" });
  } catch (error) {
    return next(error);
  }
}

module.exports = canEditCustomer;
