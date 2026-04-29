function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

function internalError(res, error) {
  return res.status(500).json({
    error: "Internal server error",
    details: error.message
  });
}

module.exports = { badRequest, internalError };
