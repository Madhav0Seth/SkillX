function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

/**
 * Sanitise error details before sending to the client.
 * Strips HTML (e.g. Cloudflare 5xx pages), truncates long messages,
 * and maps common failure scenarios to friendly strings.
 */
function sanitizeErrorMessage(raw) {
  if (!raw || typeof raw !== "string") return "An unexpected error occurred.";

  // Cloudflare / HTML error pages
  if (raw.includes("<!DOCTYPE") || raw.includes("<html")) {
    return "Database service is temporarily unavailable. Please try again in a few minutes.";
  }

  // Network-level fetch failures
  if (raw.includes("ECONNREFUSED") || raw.includes("ENOTFOUND") || raw.includes("fetch failed")) {
    return "Could not connect to the database. The service may be paused or unreachable.";
  }

  // Supabase specific
  if (raw.includes("PGRST")) {
    return "A database query error occurred. Please check your request.";
  }

  // Truncate anything too long (likely a stack trace or dump)
  if (raw.length > 200) {
    return raw.slice(0, 200) + "...";
  }

  return raw;
}

function internalError(res, error) {
  // Log the full error server-side for debugging
  console.error("[SkillX Backend Error]", error);

  return res.status(500).json({
    error: "Internal server error",
    details: sanitizeErrorMessage(error.message)
  });
}

module.exports = { badRequest, internalError };
