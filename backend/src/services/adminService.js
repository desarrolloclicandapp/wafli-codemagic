const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");
const { config } = require("../config/env");
const { ApiError } = require("../utils/responses");
const { buildReportEvalCase, summarizeEvalCases } = require("./aiEvalDatasetService");
const { qualityEventFromGeneration, summarizeQualityEvents } = require("./aiQualityMetricsService");

function requireAdminConfig() {
  const username = process.env.ADMIN_USERNAME || "";
  const password = process.env.ADMIN_PASSWORD || "";
  const secret = process.env.ADMIN_SESSION_SECRET || "";
  if (!username || !password || !secret) {
    throw new ApiError(503, "admin_not_configured", "Admin panel no configurado");
  }
  return { username, password, secret };
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parsePositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function adminMeta(req) {
  return {
    ipAddress: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || null,
    userAgent: req.headers["user-agent"] || null,
  };
}

async function login(username, password) {
  const admin = requireAdminConfig();
  if (!safeEqual(username, admin.username) || !safeEqual(password, admin.password)) {
    throw new ApiError(401, "invalid_admin_credentials", "Usuario o contraseña incorrectos");
  }
  const ttlMin = parsePositiveInt(process.env.ADMIN_SESSION_TTL_MIN, 60, 24 * 60);
  const token = jwt.sign(
    { sub: "admin", username: admin.username, scope: "admin" },
    admin.secret,
    { expiresIn: `${ttlMin}m` }
  );
  return {
    token,
    username: admin.username,
    expiresInMinutes: ttlMin,
  };
}

function mapUserRow(row) {
  const included = Number(row.included_limit || 0);
  const used = Number(row.used_in_period || 0);
  const pack = Number(row.pack_balance || 0);
  const remainingIncluded = Math.max(0, included - used);
  const currentGenerations = remainingIncluded + pack;
  const periodEnd = row.period_type === "trial"
    ? row.next_reset_at
    : row.subscription_current_period_end || row.native_expires_at || row.next_reset_at;
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    status: row.status,
    onboardingStatus: row.onboarding_status,
    defaultPlan: row.default_plan,
    suspendedUntil: row.suspended_until,
    suspensionReason: row.suspension_reason,
    plan: {
      name: row.plan_name || row.default_plan || "free",
      periodType: row.period_type || "day",
      includedLimit: included,
      usedInPeriod: used,
      packBalance: pack,
      currentGenerations,
      nextResetAt: row.next_reset_at,
      expiresAt: periodEnd,
      subscriptionStatus: row.subscription_status,
      subscriptionPlan: row.subscription_plan,
      nativeEntitlement: row.native_entitlement_id,
    },
    whatsapp: {
      status: row.whatsapp_status || "disconnected",
      phone: row.whatsapp_phone,
    },
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAiReportRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    chatId: row.chat_id,
    action: row.ai_action,
    reason: row.report_reason,
    note: row.report_note,
    generatedText: row.generated_text,
    metadata: row.metadata || {},
    status: row.status,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

function topEntries(map = {}, limit = 8) {
  return Object.entries(map || {})
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function qualityFromReportRow(row = {}) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    score: metadata.humanReplyScore ?? null,
    flags: Array.isArray(metadata.qualityFlags) ? metadata.qualityFlags : [],
    dialectWarnings: Array.isArray(metadata.dialectWarnings) ? metadata.dialectWarnings : [],
    spanishNaturalnessFlags: Array.isArray(metadata.spanishNaturalnessFlags) ? metadata.spanishNaturalnessFlags : []
  };
}

async function listUsers({ q = "", page = 1, limit = 50 } = {}) {
  const safePage = parsePositiveInt(page, 1, 100000);
  const safeLimit = parsePositiveInt(limit, 50, 100);
  const offset = (safePage - 1) * safeLimit;
  const search = String(q || "").trim();
  const params = [];
  let where = "WHERE u.deleted_at IS NULL";
  if (search) {
    params.push(`%${search}%`);
    params.push(search);
    where += ` AND (
      u.email ILIKE $${params.length - 1}
      OR u.phone ILIKE $${params.length - 1}
      OR u.status ILIKE $${params.length - 1}
      OR u.default_plan ILIKE $${params.length - 1}
      OR CAST(u.id AS TEXT) = $${params.length}
    )`;
  }

  const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM users u ${where}`, params);
  params.push(safeLimit, offset);
  const rows = await pool.query(
    `SELECT
       u.id, u.email, u.phone, u.status, u.onboarding_status, u.default_plan,
       u.last_login_at, u.created_at, u.updated_at, u.suspended_until, u.suspension_reason,
       qb.plan_name, qb.included_limit, qb.used_in_period, qb.pack_balance, qb.period_type, qb.next_reset_at,
       ps.plan_name AS subscription_plan, ps.status AS subscription_status, ps.current_period_end AS subscription_current_period_end,
       ne.entitlement_id AS native_entitlement_id, ne.expires_at AS native_expires_at,
       wc.status AS whatsapp_status, wc.phone AS whatsapp_phone
     FROM users u
     LEFT JOIN quota_balances qb ON qb.user_id = u.id
     LEFT JOIN LATERAL (
       SELECT plan_name, status, current_period_end
       FROM plan_subscriptions
       WHERE user_id = u.id
       ORDER BY current_period_end DESC NULLS LAST, created_at DESC
       LIMIT 1
     ) ps ON TRUE
     LEFT JOIN LATERAL (
       SELECT entitlement_id, expires_at
       FROM native_entitlements
       WHERE user_id = u.id AND active = TRUE
       ORDER BY expires_at DESC NULLS LAST, updated_at DESC
       LIMIT 1
     ) ne ON TRUE
     LEFT JOIN whatsapp_connections wc ON wc.user_id = u.id
     ${where}
     ORDER BY u.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return {
    users: rows.rows.map(mapUserRow),
    total: countResult.rows[0]?.total || 0,
    page: safePage,
    limit: safeLimit,
  };
}

async function listAiReports({ status = "new", page = 1, limit = 50 } = {}) {
  const safePage = parsePositiveInt(page, 1, 100000);
  const safeLimit = parsePositiveInt(limit, 50, 100);
  const safeStatus = String(status || "new").trim().toLowerCase();
  const offset = (safePage - 1) * safeLimit;
  const params = [];
  let where = "";
  if (safeStatus && safeStatus !== "all") {
    params.push(safeStatus);
    where = `WHERE r.status = $${params.length}`;
  }
  const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM ai_content_reports r ${where}`, params);
  params.push(safeLimit, offset);
  const result = await pool.query(
    `SELECT
       r.id, r.user_id, u.email AS user_email, r.chat_id, r.ai_action, r.report_reason,
       r.report_note, r.generated_text, r.metadata, r.status, r.reviewed_at, r.created_at
     FROM ai_content_reports r
     LEFT JOIN users u ON u.id = r.user_id
     ${where}
     ORDER BY r.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return {
    reports: result.rows.map(mapAiReportRow),
    total: countResult.rows[0]?.total || 0,
    page: safePage,
    limit: safeLimit,
  };
}

async function aiQuality({ status = "all", days = 30, limit = 20 } = {}) {
  const safeDays = parsePositiveInt(days, 30, 365);
  const safeLimit = parsePositiveInt(limit, 20, 100);
  const safeStatus = String(status || "all").trim().toLowerCase();
  const params = [safeDays];
  let where = `WHERE r.created_at >= NOW() - ($1 * INTERVAL '1 day')`;
  if (safeStatus && safeStatus !== "all") {
    params.push(safeStatus);
    where += ` AND r.status = $${params.length}`;
  }

  params.push(500);
  const result = await pool.query(
    `SELECT
       r.id, r.user_id, u.email AS user_email, r.chat_id, r.ai_action, r.report_reason,
       r.report_note, r.generated_text, r.metadata, r.status, r.reviewed_at, r.created_at
     FROM ai_content_reports r
     LEFT JOIN users u ON u.id = r.user_id
     ${where}
     ORDER BY r.created_at DESC
     LIMIT $${params.length}`,
    params
  );

  const events = result.rows.map((row) => qualityEventFromGeneration({
    action: row.ai_action,
    metadata: row.metadata || {},
    quality: qualityFromReportRow(row),
    reportReason: row.report_reason
  }));
  const summary = summarizeQualityEvents(events);
  const evalCases = result.rows.map((row, index) => buildReportEvalCase({
    ...mapAiReportRow(row),
    fromDb: true
  }, index));
  const dataset = summarizeEvalCases(evalCases);
  const recentReports = result.rows.slice(0, safeLimit).map(mapAiReportRow);

  return {
    filters: {
      status: safeStatus,
      days: safeDays,
      limit: safeLimit,
      sampledReports: result.rows.length
    },
    summary,
    dataset,
    top: {
      flags: topEntries(summary.byFlag),
      reasons: topEntries(summary.byReportReason),
      agents: topEntries(summary.byAgent),
      variants: topEntries(summary.byVariant),
      responseMoves: topEntries(summary.byResponseMove),
      situations: topEntries(summary.bySituation),
      initiativeLevels: topEntries(summary.byInitiativeLevel),
      scoreBuckets: topEntries(summary.byScoreBucket)
    },
    recentReports
  };
}

async function updateAiReportStatus(reportId, status, admin) {
  const safeId = Number.parseInt(reportId, 10);
  const safeStatus = String(status || "").trim().toLowerCase();
  if (!Number.isFinite(safeId) || safeId <= 0) throw new ApiError(400, "invalid_report_id", "Reporte invalido");
  if (!["new", "reviewing", "resolved", "ignored"].includes(safeStatus)) {
    throw new ApiError(400, "invalid_report_status", "Estado de reporte invalido");
  }
  const before = await pool.query(`SELECT * FROM ai_content_reports WHERE id = $1`, [safeId]);
  if (!before.rows[0]) throw new ApiError(404, "report_not_found", "Reporte no encontrado");
  const result = await pool.query(
    `UPDATE ai_content_reports
     SET status = $2::varchar, reviewed_at = CASE WHEN $2::varchar IN ('resolved', 'ignored') THEN NOW() ELSE reviewed_at END
     WHERE id = $1
     RETURNING *`,
    [safeId, safeStatus]
  );
  await writeAudit(pool, admin, "update_ai_report_status", { id: before.rows[0].user_id }, before.rows[0], result.rows[0], { reportId: safeId, status: safeStatus }).catch(() => {});
  return { report: mapAiReportRow({ ...result.rows[0], user_email: null }) };
}

async function snapshotUser(client, userId) {
  const result = await client.query(
    `SELECT u.*, qb.plan_name, qb.included_limit, qb.used_in_period, qb.pack_balance, qb.period_type, qb.next_reset_at
     FROM users u
     LEFT JOIN quota_balances qb ON qb.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function writeAudit(client, admin, action, targetUser, beforeState, afterState, metadata = {}) {
  await client.query(
    `INSERT INTO admin_audit_logs (
       admin_username, action, target_user_id, target_email, before_state, after_state, metadata, ip_address, user_agent
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9)`,
    [
      admin.username,
      action,
      targetUser?.id || beforeState?.id || null,
      targetUser?.email || beforeState?.email || null,
      JSON.stringify(beforeState || {}),
      JSON.stringify(afterState || {}),
      JSON.stringify(metadata || {}),
      admin.ipAddress || null,
      admin.userAgent || null,
    ]
  );
}

async function extendTrial(userId, days, admin) {
  const safeDays = parsePositiveInt(days, 7, 365);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const before = await snapshotUser(client, userId);
    if (!before) throw new ApiError(404, "user_not_found", "Usuario no encontrado");
    if (before.default_plan === "plus" || before.plan_name === "plus") {
      throw new ApiError(400, "paid_plan_trial_blocked", "No se puede extender trial sobre un plan Plus activo");
    }
    await client.query(
      `INSERT INTO quota_balances (user_id, plan_name, included_limit, used_in_period, pack_balance, period_type, period_started_at, next_reset_at)
       VALUES ($1, 'plus_trial', $2, 0, 0, 'trial', NOW(), NOW() + ($3 * INTERVAL '1 day'))
       ON CONFLICT (user_id) DO UPDATE SET
         plan_name = 'plus_trial',
         included_limit = $2,
         used_in_period = CASE WHEN quota_balances.plan_name = 'plus_trial' THEN quota_balances.used_in_period ELSE 0 END,
         period_type = 'trial',
         period_started_at = CASE WHEN quota_balances.plan_name = 'plus_trial' THEN quota_balances.period_started_at ELSE NOW() END,
         next_reset_at = CASE
           WHEN quota_balances.plan_name = 'plus_trial' THEN GREATEST(COALESCE(quota_balances.next_reset_at, NOW()), NOW())
           ELSE NOW()
         END + ($3 * INTERVAL '1 day'),
         updated_at = NOW()`,
      [userId, config.quota.plusMonthlyMessages, safeDays]
    );
    await client.query(
      `INSERT INTO plan_subscriptions (user_id, plan_name, status, current_period_start, current_period_end)
       VALUES ($1, 'plus_trial', 'trialing', NOW(), (SELECT next_reset_at FROM quota_balances WHERE user_id = $1))`,
      [userId]
    );
    await client.query(
      `UPDATE users SET default_plan = 'plus_trial', status = 'active', suspended_until = NULL, suspension_reason = NULL, updated_at = NOW() WHERE id = $1`,
      [userId]
    );
    const after = await snapshotUser(client, userId);
    await writeAudit(client, admin, "extend_trial", before, before, after, { days: safeDays });
    await client.query("COMMIT");
    return { user: mapUserRow({ ...after, subscription_status: "trialing" }) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function addGenerations(userId, amount, admin) {
  const safeAmount = parsePositiveInt(amount, 50, 100000);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const before = await snapshotUser(client, userId);
    if (!before) throw new ApiError(404, "user_not_found", "Usuario no encontrado");
    const included = ["plus", "plus_trial"].includes(String(before.default_plan || before.plan_name || "").toLowerCase())
      ? config.quota.plusMonthlyMessages
      : config.quota.freeDailyMessages;
    await client.query(
      `INSERT INTO quota_balances (user_id, plan_name, included_limit, used_in_period, pack_balance, period_type, period_started_at, next_reset_at)
       VALUES ($1, COALESCE($2, 'free'), $3, 0, $4, 'day', NOW(), date_trunc('day', NOW()) + INTERVAL '1 day')
       ON CONFLICT (user_id) DO UPDATE SET pack_balance = quota_balances.pack_balance + $4, updated_at = NOW()`,
      [userId, before.default_plan || "free", included, safeAmount]
    );
    const after = await snapshotUser(client, userId);
    await writeAudit(client, admin, "add_generations", before, before, after, { amount: safeAmount });
    await client.query("COMMIT");
    return { user: mapUserRow(after) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function suspendUser(userId, days, reason, admin) {
  const safeDays = parsePositiveInt(days, 7, 365);
  const cleanReason = String(reason || "").trim().slice(0, 500) || null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const before = await snapshotUser(client, userId);
    if (!before) throw new ApiError(404, "user_not_found", "Usuario no encontrado");
    await client.query(
      `UPDATE users
       SET status = 'suspended', suspended_until = NOW() + ($2 * INTERVAL '1 day'), suspension_reason = $3, updated_at = NOW()
       WHERE id = $1`,
      [userId, safeDays, cleanReason]
    );
    const after = await snapshotUser(client, userId);
    await writeAudit(client, admin, "suspend_user", before, before, after, { days: safeDays, reason: cleanReason });
    await client.query("COMMIT");
    return { user: mapUserRow(after) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function deleteUser(userId, confirmation, admin) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const before = await snapshotUser(client, userId);
    if (!before) throw new ApiError(404, "user_not_found", "Usuario no encontrado");
    const confirm = String(confirmation || "").trim().toLowerCase();
    const email = String(before.email || "").trim().toLowerCase();
    if (confirm !== String(before.id) && (!email || confirm !== email)) {
      throw new ApiError(400, "delete_confirmation_mismatch", "La confirmacion debe coincidir con el ID o email del usuario");
    }
    const sessions = await client.query(`SELECT session_id FROM whatsapp_connections WHERE user_id = $1`, [userId]);
    const sessionIds = sessions.rows.map((row) => row.session_id).filter(Boolean);
    if (sessionIds.length) await client.query(`DELETE FROM baileys_auth WHERE session_id = ANY($1::varchar[])`, [sessionIds]);
    await client.query(`DELETE FROM ai_content_reports WHERE user_id = $1`, [userId]).catch(() => {});
    await client.query(`DELETE FROM audit_logs WHERE user_id = $1`, [userId]).catch(() => {});
    await client.query(`DELETE FROM connectivity_logs WHERE user_id = $1`, [userId]).catch(() => {});
    await writeAudit(client, admin, "delete_user", before, before, {}, { confirmation: String(confirmation || "").trim() });
    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await client.query("COMMIT");
    return { deleted: true, userId };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  addGenerations,
  adminMeta,
  aiQuality,
  deleteUser,
  extendTrial,
  listAiReports,
  listUsers,
  login,
  suspendUser,
  updateAiReportStatus,
};
