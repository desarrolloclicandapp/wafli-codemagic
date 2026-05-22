const jwt = require("jsonwebtoken");
const { config } = require("../config/env");
const { pool } = require("../config/db");
const { ApiError } = require("../utils/responses");

async function requireAuth(req, _res, next) {
  try {
    const header = String(req.headers.authorization || "");
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw new ApiError(401, "unauthorized", "Missing access token");
    const payload = jwt.verify(token, config.jwtSecret);
    const result = await pool.query(
      `SELECT id, email, phone, status, onboarding_status, stripe_customer_id, default_plan, suspended_until, suspension_reason
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [payload.sub]
    );
    const user = result.rows[0];
    if (!user || user.status === "pending_deletion" || user.status === "permanently_deleted") {
      throw new ApiError(401, "unauthorized", "Invalid session");
    }
    if (user.status === "suspended") {
      const until = user.suspended_until ? new Date(user.suspended_until).getTime() : 0;
      if (!until || until > Date.now()) throw new ApiError(403, "account_suspended", "Cuenta suspendida temporalmente");
      await pool.query(
        `UPDATE users SET status = 'active', suspended_until = NULL, suspension_reason = NULL, updated_at = NOW() WHERE id = $1`,
        [user.id]
      ).catch(() => {});
      user.status = "active";
      user.suspended_until = null;
      user.suspension_reason = null;
    }
    req.user = user;
    next();
  } catch (error) {
    next(error.statusCode ? error : new ApiError(401, "unauthorized", "Invalid access token"));
  }
}

async function requireWhatsappConnected(req, _res, next) {
  try {
    const result = await pool.query(
      `SELECT status
       FROM whatsapp_connections
       WHERE user_id = $1
       LIMIT 1`,
      [req.user.id]
    );
    if (result.rows[0]?.status !== "connected") {
      throw new ApiError(403, "whatsapp_required", "Conecta tu WhatsApp para continuar");
    }
    next();
  } catch (error) {
    next(error.statusCode ? error : new ApiError(403, "whatsapp_required", "Conecta tu WhatsApp para continuar"));
  }
}

module.exports = { requireAuth, requireWhatsappConnected };
