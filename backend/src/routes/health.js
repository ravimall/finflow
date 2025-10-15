const express = require("express");

const router = express.Router();

router.get("/health", (_req, res) => res.type("text/plain").status(200).send("ok"));

module.exports = router;
