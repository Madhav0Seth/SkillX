const express = require("express");
const cors = require("cors");
const profileRoutes = require("./routes/profileRoutes");
const jobRoutes = require("./routes/jobRoutes");
const submissionRoutes = require("./routes/submissionRoutes");

const { corsOrigin } = require("./config/env");

const app = express();

app.use(
  cors({
    origin: corsOrigin === "*" ? "*" : corsOrigin.split(",").map((o) => o.trim()),
    credentials: true
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(profileRoutes);
app.use(jobRoutes);
app.use(submissionRoutes);

module.exports = { app };
