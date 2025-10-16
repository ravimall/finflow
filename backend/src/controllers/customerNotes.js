function createCustomerNotesHandler({
  CustomerModel,
  CustomerNoteModel,
  UserModel,
  assertCustomerAccess,
  logger = console,
}) {
  if (typeof assertCustomerAccess !== "function") {
    throw new Error("assertCustomerAccess is required");
  }
  if (!CustomerModel || !CustomerNoteModel || !UserModel) {
    throw new Error("Customer, CustomerNote, and User models are required");
  }

  return async function handleGetCustomerNotes(req, res) {
    const rawId = req.params?.id;
    const customerId = Number.parseInt(rawId, 10);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({ code: "BAD_REQUEST", message: "Invalid customer id" });
    }

    try {
      const customer = await CustomerModel.findByPk(customerId, {
        attributes: ["id"],
      });

      if (!customer) {
        return res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      }

      await assertCustomerAccess(req.user, customerId);

      const notes = await CustomerNoteModel.findAll({
        where: { customer_id: customerId },
        include: [
          { model: UserModel, as: "author", attributes: ["id", "name", "email", "role"] },
        ],
        order: [["created_at", "DESC"]],
        limit: 200,
      });

      return res.json(Array.isArray(notes) ? notes : []);
    } catch (err) {
      if (err?.statusCode === 403) {
        return res
          .status(403)
          .json({ code: "FORBIDDEN", message: "You do not have access to this customer" });
      }

      if (err?.original?.code === "42P01" || err?.parent?.code === "42P01") {
        if (typeof logger?.warn === "function") {
          logger.warn(
            `[CustomerNotes] customerId=${customerId} relation missing; returning empty list until migration runs`
          );
        }

        return res.json([]);
      }

      const requestId = req.id || req.requestId || req.headers?.["x-request-id"] || "unknown";
      const userId = req.user?.id ?? "unknown";
      if (typeof logger?.error === "function") {
        logger.error(
          `[CustomerNotes] requestId=${requestId} customerId=${customerId} userId=${userId} failed: ${err?.message}`,
          err
        );
      }

      return res.status(500).json({ code: "INTERNAL", message: "Unable to fetch notes" });
    }
  };
}

module.exports = { createCustomerNotesHandler };
