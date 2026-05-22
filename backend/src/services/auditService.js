const { pool } = require("../config/db");
const { getRequestIp } = require("../utils/normalize");

async function audit(req, action, metadata = {}, actor = "user") {
  const userId = req.user?.id || metadata.userId || null;
  await pool.query(
    `INSERT INTO audit_logs (user_id, action, actor, metadata, ip_address)
     VALUES ($1, $2, $3, $4::jsonb, $5)`,
    [userId, action, actor, JSON.stringify(metadata), getRequestIp(req)]
  );
}

module.exports = { audit };
