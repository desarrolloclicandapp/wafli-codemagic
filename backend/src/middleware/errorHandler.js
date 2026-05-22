const { fail } = require("../utils/responses");
const { logger } = require("../services/loggerService");

function notFound(req, res) {
  return res.status(404).json({ success: false, error: "not_found", message: "Route not found" });
}

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const context = { requestId: req.requestId, path: req.path, method: req.method, details: err.details || null, code: err.code || null, statusCode };
  if (statusCode >= 500) {
    logger.error("http", err.message || err, { stack: err.stack, context }).catch(() => {});
  } else if (statusCode !== 401 && statusCode !== 404) {
    logger.warn("http", err.message || err, { context }).catch(() => {});
  }
  return fail(res, err);
}

module.exports = { notFound, errorHandler };
