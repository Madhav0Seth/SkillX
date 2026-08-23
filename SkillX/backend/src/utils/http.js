function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

function notFound(res, message = "Resource not found") {
  return res.status(404).json({ error: message });
}

function internalError(res, error) {
  console.error("[SkillX Backend Error]", error);
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
