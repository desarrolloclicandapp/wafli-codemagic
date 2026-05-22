const crypto = require("crypto");

function requestId(req, res, next) {
  const existing = req.headers["x-request-id"];
  req.requestId = existing ? String(existing) : crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
}

module.exports = { requestId };
