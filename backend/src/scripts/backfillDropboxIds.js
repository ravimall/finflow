#!/usr/bin/env node

require("dotenv").config();

const {
  sequelize,
  Customer,
  CustomerAgent,
  User,
} = require("../models");
const dbx = require("../config/dropbox");
const {
  getOrCreateCustomerFolder,
  ensureMembers,
  resolveFolderPath,
} = require("../services/dropboxFolders");

async function fetchAdmins(transaction) {
  const admins = await User.findAll({ where: { role: "admin" }, transaction });
  return admins.map((admin) => admin.email).filter(Boolean);
}

async function fetchCustomerAgents(customerId, transaction) {
  const assignments = await CustomerAgent.findAll({
    where: { customer_id: customerId },
    transaction,
  });
  const agentIds = assignments.map((assignment) => assignment.agent_id);
  if (!agentIds.length) {
    return [];
  }

  const agents = await User.findAll({ where: { id: agentIds }, transaction });
  return agents.map((agent) => agent.email).filter(Boolean);
}

async function processCustomer(customer, transaction) {
  let folderId = customer.dropboxFolderId;
  let sharedFolderId = customer.dropboxSharedFolderId;
  let folderPath = customer.dropboxFolderPath;

  if (!folderId && folderPath) {
    try {
      const metadata = await dbx.filesGetMetadata({ path: folderPath });
      folderId = metadata?.result?.id || metadata?.id || folderId;
      if (metadata?.result?.path_display) {
        folderPath = metadata.result.path_display;
      }
      if (metadata?.result?.sharing_info?.shared_folder_id) {
        sharedFolderId = metadata.result.sharing_info.shared_folder_id;
      }
    } catch (error) {
      const summary = error?.error?.error_summary || error?.message || "unknown";
      console.warn(`⚠️ Failed to look up metadata for ${folderPath}: ${summary}`);
    }
  }

  if (!folderId) {
    const created = await getOrCreateCustomerFolder(customer);
    folderId = created.folderId || folderId;
    folderPath = created.pathDisplay || folderPath;
    sharedFolderId = created.sharedFolderId || sharedFolderId;
  }

  if (folderId) {
    const resolved = await resolveFolderPath(folderId);
    if (resolved) {
      folderPath = resolved;
    }
  }

  const updates = {
    dropboxProvisioningStatus: "ok",
    dropboxLastError: null,
  };
  if (folderId && folderId !== customer.dropboxFolderId) {
    updates.dropboxFolderId = folderId;
  }
  if (sharedFolderId && sharedFolderId !== customer.dropboxSharedFolderId) {
    updates.dropboxSharedFolderId = sharedFolderId;
  }
  if (folderPath && folderPath !== customer.dropboxFolderPath) {
    updates.dropboxFolderPath = folderPath;
  }

  await customer.update(updates, { transaction });

  if (folderId) {
    const admins = await fetchAdmins(transaction);
    const agents = await fetchCustomerAgents(customer.id, transaction);
    const adminSet = new Set(admins.map((email) => (email || "").toLowerCase()));
    const agentSet = new Set(agents.map((email) => (email || "").toLowerCase()));

    const desiredMembers = [...new Set([...adminSet, ...agentSet])]
      .filter((email) => email)
      .map((email) => ({
        email,
        accessType: "editor",
      }));

    const membership = await ensureMembers(folderId, sharedFolderId, desiredMembers);
    if (
      membership.sharedFolderId &&
      membership.sharedFolderId !== sharedFolderId
    ) {
      await customer.update(
        { dropboxSharedFolderId: membership.sharedFolderId },
        { transaction }
      );
    }
  }
}

async function main() {
  const customers = await Customer.findAll();
  console.log(`Processing ${customers.length} customers…`);

  for (const customer of customers) {
    await sequelize.transaction(async (transaction) => {
      const fresh = await Customer.findByPk(customer.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!fresh) {
        return;
      }
      await processCustomer(fresh, transaction);
    });
  }

  console.log("Backfill complete");
  await sequelize.close();
}

main().catch((error) => {
  console.error("Backfill failed", error);
  process.exitCode = 1;
});
