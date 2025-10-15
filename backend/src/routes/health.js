const express = require("express");

const router = express.Router();

router.get("/health", (req, res) => {
  const logger = req.app?.locals?.logger;
  const message = "Health check ping received";

  if (logger && typeof logger.info === "function") {
    logger.info(message);
  } else {
    // Fallback to console logging if logger isn't available for any reason
    console.info(message);
  }

  res.type("text/plain").status(200).send("ok");
});

module.exports = router;
