const {
  Customer,
  CustomerAgent,
  User,
} = require("../models");
const {
  getOrCreateCustomerFolder,
  ensureMembers,
  resolveFolderPath,
} = require("./dropboxFolders");

const activeJobs = new Set();

function summarizeError(error) {
  if (!error) {
    return "Unknown error";
  }

  if (typeof error === "string") {
    return error.slice(0, 500);
  }

  const summary =
    error?.error?.error_summary ||
    error?.message ||
    error?.description ||
    error?.toString?.() ||
    "Unknown error";

  return String(summary).slice(0, 500);
}

async function setProvisioningStatus(customerId, status, lastError = null) {
  await Customer.update(
    {
      dropboxProvisioningStatus: status,
      dropboxLastError: lastError,
    },
    { where: { id: customerId } }
  );
}

function collectMemberList(customer, admins = []) {
  const desiredMembers = [];
  const seen = new Set();

  const register = (email, accessType = "editor") => {
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    desiredMembers.push({ email: normalized, accessType });
  };

  if (customer?.primaryAgent?.email) {
    register(customer.primaryAgent.email, "editor");
  }

  if (Array.isArray(customer?.assignments)) {
    for (const assignment of customer.assignments) {
      const accessType = assignment?.permission === "view" ? "viewer" : "editor";
      if (assignment?.agent?.email) {
        register(assignment.agent.email, accessType);
      }
    }
  }

  for (const admin of admins) {
    if (admin?.email) {
      register(admin.email, "editor");
    }
  }

  return desiredMembers;
}

async function loadCustomerContext(customerId) {
  const customer = await Customer.findByPk(customerId, {
    include: [
      { model: User, as: "primaryAgent", attributes: ["id", "name", "email"] },
      {
        model: CustomerAgent,
        as: "assignments",
        include: [{ model: User, as: "agent", attributes: ["id", "name", "email"] }],
      },
    ],
  });

  if (!customer) {
    return null;
  }

  const admins = await User.findAll({
    where: { role: "admin" },
    attributes: ["id", "name", "email"],
  });

  return { customer, admins };
}

async function provisionDropboxForCustomer(customerId, options = {}) {
  const { markPending = false, trigger = "manual" } = options;

  if (markPending) {
    await setProvisioningStatus(customerId, "pending", null);
  }

  const context = await loadCustomerContext(customerId);

  if (!context) {
    return null;
  }

  const { customer, admins } = context;
  const desiredMembers = collectMemberList(customer, admins);

  const plainCustomer = customer.get({ plain: true });

  try {
    const folderDetails = await getOrCreateCustomerFolder(plainCustomer);

    const updates = {
      dropboxFolderId: folderDetails.folderId || plainCustomer.dropboxFolderId || null,
      dropboxFolderPath: folderDetails.pathDisplay || plainCustomer.dropboxFolderPath || null,
      dropboxSharedFolderId:
        folderDetails.sharedFolderId || plainCustomer.dropboxSharedFolderId || null,
      dropboxProvisioningStatus: "ok",
      dropboxLastError: null,
    };

    if (!updates.dropboxFolderPath && updates.dropboxFolderId) {
      updates.dropboxFolderPath = await resolveFolderPath(updates.dropboxFolderId);
    }

    const membershipResult = await ensureMembers(
      updates.dropboxFolderId,
      updates.dropboxSharedFolderId,
      desiredMembers
    );

    if (
      membershipResult.sharedFolderId &&
      membershipResult.sharedFolderId !== updates.dropboxSharedFolderId
    ) {
      updates.dropboxSharedFolderId = membershipResult.sharedFolderId;
    }

    await Customer.update(updates, { where: { id: customer.id } });

    console.info(
      `✅ Dropbox provisioning complete for customer ${customer.id} (trigger=${trigger})`
    );
    return updates;
  } catch (error) {
    const summary = summarizeError(error);
    await setProvisioningStatus(customer.id, "failed", summary);
    console.error(
      `❌ Dropbox provisioning failed for customer ${customer.id} (trigger=${trigger}): ${summary}`
    );
    throw error;
  }
}

async function queueDropboxProvisioning(customerId, options = {}) {
  if (!customerId) {
    return;
  }

  const { trigger = "manual" } = options;
  await setProvisioningStatus(customerId, "pending", null);

  if (activeJobs.has(customerId)) {
    console.info(
      `ℹ️ Dropbox provisioning already scheduled for customer ${customerId}; skipping duplicate queue request`
    );
    return;
  }

  activeJobs.add(customerId);

  setImmediate(async () => {
    try {
      await provisionDropboxForCustomer(customerId, { markPending: false, trigger });
    } catch (error) {
      // Error already logged inside provisionDropboxForCustomer.
    } finally {
      activeJobs.delete(customerId);
    }
  });
}

module.exports = {
  provisionDropboxForCustomer,
  queueDropboxProvisioning,
  collectMemberList,
};
