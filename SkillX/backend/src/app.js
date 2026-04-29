const express = require("express");
const profileRoutes = require("./routes/profileRoutes");
const jobRoutes = require("./routes/jobRoutes");
const submissionRoutes = require("./routes/submissionRoutes");

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(profileRoutes);
app.use(jobRoutes);
app.use(submissionRoutes);

module.exports = { app };
