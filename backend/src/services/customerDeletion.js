const dbx = require("../config/dropbox");
const {
  sequelize,
  Customer,
  Loan,
  Document,
  CustomerAgent,
  CustomerNote,
  Task,
} = require("../models");
const { logAudit } = require("../utils/audit");
const { logDropboxAction } = require("../utils/dropbox");
const { summarizeError, isDropboxNotFound } = require("./customerDeletionHelpers");

async function attemptDropboxDeletion(path, actorId) {
  if (!path) {
    return { deleted: false, skipped: true };
  }

  try {
    logDropboxAction("delete-folder", path, actorId);
    await dbx.filesDeleteV2({ path });
    return { deleted: true, skipped: false };
  } catch (error) {
    if (isDropboxNotFound(error)) {
      // Treat missing folders as already deleted so we can continue with DB cleanup.
      return { deleted: false, skipped: false, notFound: true };
    }

    throw error;
  }
}

async function collectDeletionCounts(customerId, transaction = null) {
  const baseOptions = transaction ? { transaction } : {};
  const [
    loanCount,
    documentCount,
    noteCount,
    taskCount,
    assignmentCount,
  ] = await Promise.all([
    Loan.count({ where: { customer_id: customerId }, ...baseOptions }),
    Document.count({ where: { customer_id: customerId }, ...baseOptions }),
    CustomerNote.count({ where: { customer_id: customerId }, ...baseOptions }),
    Task.count({ where: { customer_id: customerId }, ...baseOptions }),
    CustomerAgent.count({ where: { customer_id: customerId }, ...baseOptions }),
  ]);

  return {
    loans: loanCount,
    documents: documentCount,
    notes: noteCount,
    tasks: taskCount,
    assignments: assignmentCount,
  };
}

async function getCustomerDeletionPreview(customerId) {
  if (!customerId) {
    return null;
  }

  const customer = await Customer.findByPk(customerId);
  if (!customer) {
    return null;
  }

  const counts = await collectDeletionCounts(customer.id);

  return {
    customer: {
      id: customer.id,
      code: customer.customer_id,
      name: customer.name,
    },
    counts,
    dropbox: {
      hasFolder: Boolean(customer.dropboxFolderPath),
      folderPath: customer.dropboxFolderPath || null,
    },
  };
}

async function deleteCustomer(customerId, options = {}) {
  const { actorId = null, deleteDropboxFolder = false } = options;

  if (!customerId) {
    const error = new Error("Customer not found");
    error.statusCode = 404;
    throw error;
  }

  const customer = await Customer.findByPk(customerId);
  if (!customer) {
    const error = new Error("Customer not found");
    error.statusCode = 404;
    throw error;
  }

  const dropboxRequested = Boolean(deleteDropboxFolder);
  const dropboxPath = customer.dropboxFolderPath || null;
  let dropboxOutcome = { deleted: false, skipped: true };

  if (dropboxRequested && dropboxPath) {
    try {
      dropboxOutcome = await attemptDropboxDeletion(dropboxPath, actorId);
    } catch (error) {
      const message = "Dropbox folder could not be deleted; aborting DB deletion.";
      const details = {
        status: "failed",
        reason: summarizeError(error),
        dropboxDeleteRequested: dropboxRequested,
        dropboxDeleted: false,
      };
      await logAudit(actorId, customer.id, "customer.delete", JSON.stringify(details));
      const dropboxError = new Error(message);
      dropboxError.statusCode = 409;
      throw dropboxError;
    }
  }

  let resultCounts = null;

  try {
    await sequelize.transaction(async (transaction) => {
      resultCounts = await collectDeletionCounts(customer.id, transaction);

      await Task.destroy({ where: { customer_id: customer.id }, transaction });
      await CustomerNote.destroy({ where: { customer_id: customer.id }, transaction });
      await Document.destroy({ where: { customer_id: customer.id }, transaction });
      await Loan.destroy({ where: { customer_id: customer.id }, transaction });
      await CustomerAgent.destroy({ where: { customer_id: customer.id }, transaction });

      const auditDetails = {
        status: "success",
        dropboxDeleteRequested: dropboxRequested,
        dropboxDeleted: Boolean(dropboxOutcome.deleted),
        dropboxNotFound: Boolean(dropboxOutcome.notFound),
        counts: resultCounts,
        customerId: customer.id,
      };
      await logAudit(
        actorId,
        customer.id,
        "customer.delete",
        JSON.stringify(auditDetails),
        transaction
      );

      await Customer.destroy({ where: { id: customer.id }, transaction });
    });
  } catch (error) {
    const details = {
      status: "failed",
      dropboxDeleteRequested: dropboxRequested,
      dropboxDeleted: Boolean(dropboxOutcome.deleted),
      reason: summarizeError(error),
      customerId: customer.id,
    };
    await logAudit(actorId, customer.id, "customer.delete", JSON.stringify(details));
    throw error;
  }

  return {
    ok: true,
    dropboxDeleted: Boolean(dropboxOutcome.deleted),
    dropboxNotFound: Boolean(dropboxOutcome.notFound),
    counts: resultCounts,
  };
}

module.exports = {
  getCustomerDeletionPreview,
  deleteCustomer,
  _internal: {
    summarizeError,
    isDropboxNotFound,
  },
};
