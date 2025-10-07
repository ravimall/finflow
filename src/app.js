// backend/src/app.js
const express = require("express");
const bodyParser = require("body-parser");
const passport = require("passport");
const cors = require("cors");
const dotenv = require("dotenv");
const winston = require("winston");
const cookieSession = require("cookie-session");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// -----------------------------
// ? Logger setup
// -----------------------------
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `[${timestamp}] ${level}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

// -----------------------------
// ? Middleware
// -----------------------------
app.use(cors({ origin: "*", credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// -----------------------------
// ? Cookie-based session (Render safe)
// -----------------------------
app.use(
  cookieSession({
    name: "session",
    keys: [process.env.SESSION_SECRET || "finflow_secure_key"],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" // Render sets NODE_ENV=production
  })
);

app.use(passport.initialize());
app.use(passport.session());

// -----------------------------
// ? Routes
// -----------------------------
const userRoutes = require("./routes/userRoutes");
const customerRoutes = require("./routes/customerRoutes");
const loanRoutes = require("./routes/loanRoutes");
const documentRoutes = require("./routes/documentRoutes");
const reportRoutes = require("./routes/reportRoutes");

app.use("/api/users", userRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/reports", reportRoutes);

// -----------------------------
// ? Root route
// -----------------------------
app.get("/", (req, res) => {
  res.send({ message: "FinFlow Backend is running ??" });
});

// -----------------------------
// ? Error handling
// -----------------------------
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// -----------------------------
// ? Start server
// -----------------------------
app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
