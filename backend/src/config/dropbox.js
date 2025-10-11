// backend/src/config/dropbox.js
const { Dropbox } = require("dropbox");
const fetch = require("isomorphic-fetch");
require("dotenv").config();

const REQUIRED_VARS = [
  "DROPBOX_CLIENT_ID",
  "DROPBOX_CLIENT_SECRET",
  "DROPBOX_REFRESH_TOKEN",
];

const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
if (missing.length) {
  // eslint-disable-next-line no-console
  console.error(
    `❌ Dropbox configuration missing environment variables: ${missing.join(", ")}`
  );
}

const dbx = new Dropbox({
  clientId: process.env.DROPBOX_CLIENT_ID,
  clientSecret: process.env.DROPBOX_CLIENT_SECRET,
  refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
  fetch,
});

dbx
  .usersGetCurrentAccount()
  .then((account) => {
    const displayName =
      account?.result?.name?.display_name || account?.result?.name?.familiar_name || "unknown account";
    // eslint-disable-next-line no-console
    console.log(`✅ Dropbox connected as ${displayName}`);
  })
  .catch((error) => {
    const message = error?.error?.error_summary || error?.message || "Unknown error";
    // eslint-disable-next-line no-console
    console.error(`❌ Dropbox connection failed: ${message}`);
  });

module.exports = dbx;
