// backend/src/config/dropbox.js
const { Dropbox } = require("dropbox");
const fetch = require("isomorphic-fetch");
require("dotenv").config();

if (!process.env.DROPBOX_CLIENT_ID || !process.env.DROPBOX_CLIENT_SECRET || !process.env.DROPBOX_REFRESH_TOKEN) {
  throw new Error("❌ Dropbox credentials missing. Please set DROPBOX_CLIENT_ID, DROPBOX_CLIENT_SECRET, and DROPBOX_REFRESH_TOKEN in environment.");
}

const dbx = new Dropbox({
  clientId: process.env.DROPBOX_CLIENT_ID,
  clientSecret: process.env.DROPBOX_CLIENT_SECRET,
  refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
  fetch
});

module.exports = dbx;
