const { fail } = require("../utils/responses");
const { logger } = require("../services/loggerService");

function notFound(req, res) {
  return res.status(404).json({ success: false, error: "not_found", message: "Route not found" });
}

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const context = { requestId: req.requestId, path: req.path, method: req.method, details: err.details || null, code: err.code || null, statusCode };
  const expectedWhatsappRequired = statusCode === 403
    && err.code === "whatsapp_required"
    && ["/chats", "/chats/events"].includes(req.path);
  if (statusCode >= 500) {
    logger.error("http", err.message || err, { stack: err.stack, context }).catch(() => {});
  } else if (!expectedWhatsappRequired && statusCode !== 404 && (statusCode !== 401 || String(err.code || "").startsWith("invalid_oauth_") || err.code === "expired_oauth_token" || err.code === "oauth_provider_not_configured")) {
    logger.warn("http", err.message || err, { context }).catch(() => {});
  }
  return fail(res, err);
}

module.exports = { notFound, errorHandler };
