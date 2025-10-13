/* eslint-disable no-console */
const { sequelize, Customer } = require("../models");
const { provisionDropboxForCustomer } = require("../services/dropboxProvisioning");

async function repair() {
  const customers = await Customer.findAll({ order: [["id", "ASC"]] });
  console.info(`🔧 Starting Dropbox repair for ${customers.length} customers`);

  let successCount = 0;
  let failureCount = 0;

  for (const customer of customers) {
    try {
      await provisionDropboxForCustomer(customer.id, {
        markPending: true,
        trigger: "repair-script",
      });
      successCount += 1;
      console.info(`✅ Reconciled customer ${customer.id}`);
    } catch (error) {
      failureCount += 1;
      const message = error?.message || error?.error?.error_summary || "Unknown error";
      console.error(`❌ Failed to reconcile customer ${customer.id}: ${message}`);
    }
  }

  console.info(
    `🏁 Dropbox repair complete. Success: ${successCount}, Failures: ${failureCount}`
  );
}

repair()
  .catch((error) => {
    console.error("Unexpected error running Dropbox repair", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
