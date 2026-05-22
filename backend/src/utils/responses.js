class ApiError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function ok(res, data = {}, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

function fail(res, error) {
  const statusCode = error?.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    error: error?.code || "internal_error",
    message: error?.message || "Unexpected error",
    details: error?.details
  });
}

module.exports = { ApiError, ok, fail };
