function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

function notFound(res, message = "Resource not found") {
  return res.status(404).json({ error: message });
}

function internalError(res, error) {
  const code = error?.code;
  const message = typeof error?.message === "string" ? error.message : "";
  console.error("[SkillX Backend Error]", { code, message });

  // Supabase/PostgREST reports a missing RPC as PGRST202. This is a deployment
  // prerequisite, not a transient outage, so make it actionable without
  // returning database details or credentials to the browser.
  if (
    code === "PGRST202" ||
    code === "JOB_CREATION_RPC_INVALID_RESULT" ||
    (/create_job_with_milestones/i.test(message) && /function|schema cache/i.test(message))
  ) {
    return res.status(503).json({
      error: "Job creation is not configured on the backend. Apply the current Supabase schema, then retry.",
      code: "JOB_CREATION_SCHEMA_MISSING",
    });
  }

  return res.status(500).json({
    error: "Service temporarily unavailable. Please try again later.",
  });
}

function errorHandler(error, _req, res, _next) {
  if (error?.type === "entity.parse.failed") {
    return badRequest(res, "Request body must be valid JSON");
  }
  return internalError(res, error);
}

module.exports = { badRequest, errorHandler, internalError, notFound };
