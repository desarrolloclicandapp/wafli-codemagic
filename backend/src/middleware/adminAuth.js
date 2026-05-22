const jwt = require("jsonwebtoken");
const { ApiError } = require("../utils/responses");

function adminSecret() {
  return process.env.ADMIN_SESSION_SECRET || "";
}

function requireAdminAuth(req, _res, next) {
  try {
    const secret = adminSecret();
    if (!secret) throw new ApiError(503, "admin_not_configured", "Admin panel no configurado");
    const header = String(req.headers.authorization || "");
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw new ApiError(401, "admin_unauthorized", "Missing admin token");
    const payload = jwt.verify(token, secret);
    if (payload.scope !== "admin" || !payload.username) {
      throw new ApiError(401, "admin_unauthorized", "Invalid admin token");
    }
    req.admin = { username: payload.username };
    next();
  } catch (error) {
    next(error.statusCode ? error : new ApiError(401, "admin_unauthorized", "Invalid admin token"));
  }
}

module.exports = { requireAdminAuth };
