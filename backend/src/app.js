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

const allowedOrigins = [
  "https://shubhadevelopers.com",
  "http://localhost:5173",
  "http://localhost:3000"
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  optionsSuccessStatus: 204
};

const corsMiddleware = cors(corsOptions);

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

app.locals.logger = logger;

// -----------------------------
// ? Middleware
// -----------------------------
app.use(corsMiddleware);
app.options("*", corsMiddleware);
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
const healthRouter = require("./routes/health");
const userRoutes = require("./routes/userRoutes");
const customerRoutes = require("./routes/customerRoutes");
const loanRoutes = require("./routes/loanRoutes");
const documentRoutes = require("./routes/documentRoutes");
const reportRoutes = require("./routes/reportRoutes");
const adminConfigRoutes = require("./routes/adminConfigRoutes");
const configRoutes = require("./routes/configRoutes");
const taskRoutes = require("./routes/taskRoutes");
const taskTemplateRoutes = require("./routes/taskTemplateRoutes");

app.use(healthRouter);
app.use("/api/users", userRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/config", configRoutes);
app.use("/api/admin/config", adminConfigRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/task-templates", taskTemplateRoutes);

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
  const requestOrigin = req.headers.origin;
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", corsOptions.allowedHeaders.join(", "));
    res.setHeader("Access-Control-Allow-Methods", corsOptions.methods.join(", "));
    res.append("Vary", "Origin");
  }

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "CORS origin denied" });
  }

  res.status(500).json({ error: "Something went wrong!" });
});

// -----------------------------
// ? Start server
// -----------------------------
app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
