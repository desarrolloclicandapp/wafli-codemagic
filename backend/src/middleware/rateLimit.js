const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "rate_limited", message: "Too many auth requests" }
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "rate_limited", message: "Too many refresh requests" }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "rate_limited", message: "Too many AI requests" }
});

module.exports = { authLimiter, refreshLimiter, aiLimiter };
