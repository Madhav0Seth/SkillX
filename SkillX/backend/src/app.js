const express = require("express");
const cors = require("cors");
const profileRoutes = require("./routes/profileRoutes");
const jobRoutes = require("./routes/jobRoutes");
const submissionRoutes = require("./routes/submissionRoutes");

const { corsOrigin } = require("./config/env");
const { errorHandler, notFound } = require("./utils/http");

const app = express();

const allowedOrigins = corsOrigin.split(",").map((origin) => origin.trim()).filter(Boolean);
app.disable("x-powered-by");
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(profileRoutes);
app.use(jobRoutes);
app.use(submissionRoutes);
app.use((_req, res) => notFound(res, "Route not found"));
app.use(errorHandler);

module.exports = { app };
