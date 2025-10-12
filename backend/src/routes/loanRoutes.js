const express = require("express");
const { body, validationResult } = require("express-validator");
const router = express.Router();

const {
  sequelize,
  Loan,
  Customer,
  CustomerAgent,
  ConfigStatus,
  ConfigBank,
} = require("../models");
const auth = require("../middleware/auth");

async function userCanAccessCustomer(user, customerId) {
  const customer = await Customer.findByPk(customerId);
  if (!customer) {
    const err = new Error("Customer not found");
    err.statusCode = 404;
    throw err;
  }

  if (user.role === "admin") {
    return true;
  }

  const assignment = await CustomerAgent.findOne({
    where: { customer_id: customerId, agent_id: user.id },
  });

  if (assignment) {
    return true;
  }

  if (customer.created_by === user.id) {
    return true;
  }

  return false;
}

async function assertLoanAccess(user, loan) {
  const hasAccess = await userCanAccessCustomer(user, loan.customer_id);
  if (!hasAccess) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }
}

async function resolveLoanStatus(statusName, transaction) {
  if (!statusName) {
    const defaultStatus = await ConfigStatus.findOne({
      where: { type: "loan" },
      order: [["id", "ASC"]],
      transaction,
    });
    return defaultStatus ? defaultStatus.name : "Login";
  }

  const status = await ConfigStatus.findOne({
    where: { type: "loan", name: statusName },
    transaction,
  });

  if (!status) {
    throw new Error("Invalid loan status");
  }

  return status.name;
}

async function resolveBank(bankId, bankName, transaction) {
  if (bankId) {
    const bank = await ConfigBank.findByPk(bankId, { transaction });
    if (!bank) {
      throw new Error("Invalid bank selected");
    }
    return { bank_id: bank.id, bank_name: bank.name };
  }

  if (!bankName) {
    throw new Error("Bank is required");
  }

  return { bank_id: null, bank_name: bankName };
}

router.post(
  "/",
  auth(),
  body("customer_id").isInt({ min: 1 }),
  body("bank_id").optional().isInt({ min: 1 }),
  body("bank_name").optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      customer_id,
      bank_id,
      bank_name,
      applied_amount,
      approved_amount,
      rate_of_interest,
      status,
      notes,
    } = req.body;

    try {
      const canAccess = await userCanAccessCustomer(req.user, customer_id);
      if (!canAccess) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const loan = await sequelize.transaction(async (transaction) => {
        const { bank_id: resolvedBankId, bank_name: resolvedBankName } =
          await resolveBank(bank_id, bank_name, transaction);
        const loanStatus = await resolveLoanStatus(status, transaction);

        const createdLoan = await Loan.create(
          {
            customer_id,
            bank_id: resolvedBankId,
            bank_name: resolvedBankName,
            applied_amount,
            approved_amount,
            rate_of_interest,
            status: loanStatus,
            notes,
          },
          { transaction }
        );

        return createdLoan;
      });

      const created = await Loan.findByPk(loan.id, {
        include: [
          { model: Customer, as: "customer", attributes: ["id", "name", "customer_id"] },
          { model: ConfigBank, as: "bank", attributes: ["id", "name"] },
        ],
      });

      res.json({ message: "Loan created", loan: created });
    } catch (err) {
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message });
    }
  }
);

router.get("/", auth(), async (req, res) => {
  try {
    const query = {
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name", "customer_id"],
        },
        { model: ConfigBank, as: "bank", attributes: ["id", "name"] },
      ],
      order: [["created_at", "DESC"]],
    };

    if (req.user.role !== "admin") {
      query.include[0].include = [
        {
          model: CustomerAgent,
          as: "assignments",
          attributes: [],
          where: { agent_id: req.user.id },
          required: true,
        },
      ];
      query.distinct = true;
    }

    const loans = await Loan.findAll(query);
    res.json(loans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth(), async (req, res) => {
  try {
    const loan = await Loan.findByPk(req.params.id, {
      include: [
        { model: Customer, as: "customer", attributes: ["id", "name", "customer_id"] },
        { model: ConfigBank, as: "bank", attributes: ["id", "name"] },
      ],
    });
    if (!loan) return res.status(404).json({ error: "Loan not found" });

    await assertLoanAccess(req.user, loan);

    res.json(loan);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: err.message });
  }
});

router.put("/:id", auth(), async (req, res) => {
  try {
    const loan = await Loan.findByPk(req.params.id);
    if (!loan) return res.status(404).json({ error: "Loan not found" });

    await assertLoanAccess(req.user, loan);

    if (req.body.status) {
      const statusRecord = await ConfigStatus.findOne({
        where: { type: "loan", name: req.body.status },
      });
      if (!statusRecord) {
        return res.status(400).json({ error: "Invalid loan status" });
      }
    }

    if (req.body.bank_id || req.body.bank_name) {
      const { bank_id: resolvedBankId, bank_name: resolvedBankName } =
        await resolveBank(req.body.bank_id, req.body.bank_name);
      req.body.bank_id = resolvedBankId;
      req.body.bank_name = resolvedBankName;
    }

    await loan.update(req.body);
    res.json({ message: "Loan updated", loan });
  } catch (err) {
    const statusCode = err.statusCode || 400;
    res.status(statusCode).json({ error: err.message });
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
