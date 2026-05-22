const { pool } = require("../config/db");
const { config } = require("../config/env");

const HISTORY_LIMIT = Math.max(Number(config.whatsapp.pairingGuardMaxAttempts || 4) * 4, 24);

function parseAttemptTimestamps(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry) && entry > 0)
    .sort((left, right) => left - right);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(1, Math.ceil(Math.max(0, Number(ms) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function limits() {
  return {
    enabled: config.whatsapp.pairingGuardEnabled !== false,
    windowMs: Math.max(5, Number(config.whatsapp.pairingGuardWindowMinutes || 15)) * 60 * 1000,
    maxAttempts: Math.max(2, Number(config.whatsapp.pairingGuardMaxAttempts || 4)),
    cooldownMs: Math.max(5, Number(config.whatsapp.pairingGuardCooldownMinutes || 30)) * 60 * 1000
  };
}

async function ensureRow(client, userId, phone) {
  const existing = await client.query(
    `SELECT attempt_timestamps, blocked_until
     FROM whatsapp_pairing_guards
     WHERE user_id = $1
     FOR UPDATE`,
    [userId]
  );
  if (existing.rows[0]) return existing.rows[0];
  await client.query(
    `INSERT INTO whatsapp_pairing_guards (user_id, attempt_timestamps, blocked_until, last_phone, updated_at)
     VALUES ($1, '[]'::jsonb, NULL, $2, NOW())
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, phone || null]
  );
  const created = await client.query(
    `SELECT attempt_timestamps, blocked_until
     FROM whatsapp_pairing_guards
     WHERE user_id = $1
     FOR UPDATE`,
    [userId]
  );
  return created.rows[0] || {};
}

async function checkAllowed(userId, options = {}) {
  const safeUserId = Number(userId);
  if (!Number.isFinite(safeUserId) || safeUserId <= 0) {
    return { allowed: true, attemptsInWindow: 0, cooldownMsRemaining: 0, blockedUntil: null };
  }

  const guardLimits = limits();
  if (!guardLimits.enabled) return { allowed: true, attemptsInWindow: 0, cooldownMsRemaining: 0, blockedUntil: null };

  const phone = String(options.phone || "").slice(0, 50) || null;
  const now = Date.now();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const row = await ensureRow(client, safeUserId, phone);
    const attempts = parseAttemptTimestamps(row.attempt_timestamps);
    const prunedAttempts = attempts.filter((entry) => now - entry <= guardLimits.windowMs);
    const blockedUntilMs = row.blocked_until ? new Date(row.blocked_until).getTime() : 0;

    if (blockedUntilMs > now) {
      await client.query(
        `UPDATE whatsapp_pairing_guards
         SET attempt_timestamps = $2::jsonb,
             last_phone = $3,
             updated_at = NOW()
         WHERE user_id = $1`,
        [safeUserId, JSON.stringify(prunedAttempts), phone]
      );
      await client.query("COMMIT");
      return {
        allowed: false,
        attemptsInWindow: prunedAttempts.length,
        cooldownMsRemaining: blockedUntilMs - now,
        blockedUntil: new Date(blockedUntilMs).toISOString(),
        retryAfter: Math.max(1, Math.ceil((blockedUntilMs - now) / 1000)),
        message: `Demasiados intentos de vinculacion. Espera ${formatDuration(blockedUntilMs - now)} antes de generar otro codigo.`
      };
    }

    if (prunedAttempts.length >= guardLimits.maxAttempts) {
      const blockedUntil = new Date(now + guardLimits.cooldownMs);
      await client.query(
        `UPDATE whatsapp_pairing_guards
         SET attempt_timestamps = $2::jsonb,
             blocked_until = $3,
             last_phone = $4,
             updated_at = NOW()
         WHERE user_id = $1`,
        [safeUserId, JSON.stringify(prunedAttempts), blockedUntil.toISOString(), phone]
      );
      await client.query("COMMIT");

      return {
        allowed: false,
        attemptsInWindow: prunedAttempts.length,
        cooldownMsRemaining: guardLimits.cooldownMs,
        blockedUntil: blockedUntil.toISOString(),
        retryAfter: Math.max(1, Math.ceil(guardLimits.cooldownMs / 1000)),
        message: `Demasiados intentos de vinculacion. Espera ${formatDuration(guardLimits.cooldownMs)} antes de generar otro codigo.`
      };
    }

    await client.query(
      `UPDATE whatsapp_pairing_guards
       SET attempt_timestamps = $2::jsonb,
           blocked_until = NULL,
           last_phone = $3,
           updated_at = NOW()
       WHERE user_id = $1`,
      [safeUserId, JSON.stringify(prunedAttempts), phone]
    );
    await client.query("COMMIT");

    return {
      allowed: true,
      attemptsInWindow: prunedAttempts.length,
      cooldownMsRemaining: 0,
      blockedUntil: null,
      retryAfter: 0,
      message: null
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return { allowed: true, attemptsInWindow: 0, cooldownMsRemaining: 0, blockedUntil: null };
  } finally {
    client.release();
  }
}

async function recordGeneratedCode(userId, options = {}) {
  const safeUserId = Number(userId);
  if (!Number.isFinite(safeUserId) || safeUserId <= 0) {
    return { allowed: true, attemptsInWindow: 0, cooldownMsRemaining: 0, blockedUntil: null };
  }

  const guardLimits = limits();
  if (!guardLimits.enabled) return { allowed: true, attemptsInWindow: 0, cooldownMsRemaining: 0, blockedUntil: null };

  const phone = String(options.phone || "").slice(0, 50) || null;
  const now = Date.now();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const row = await ensureRow(client, safeUserId, phone);
    const attempts = parseAttemptTimestamps(row.attempt_timestamps);
    const prunedAttempts = attempts.filter((entry) => now - entry <= guardLimits.windowMs);
    const nextAttempts = [...prunedAttempts, now].slice(-HISTORY_LIMIT);
    await client.query(
      `UPDATE whatsapp_pairing_guards
       SET attempt_timestamps = $2::jsonb,
           blocked_until = NULL,
           last_phone = $3,
           updated_at = NOW()
       WHERE user_id = $1`,
      [safeUserId, JSON.stringify(nextAttempts), phone]
    );
    await client.query("COMMIT");
    return {
      allowed: true,
      attemptsInWindow: nextAttempts.length,
      cooldownMsRemaining: 0,
      blockedUntil: null,
      retryAfter: 0,
      message: null
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return { allowed: true, attemptsInWindow: 0, cooldownMsRemaining: 0, blockedUntil: null };
  } finally {
    client.release();
  }
}

async function consumeAttempt(userId, options = {}) {
  const allowed = await checkAllowed(userId, options);
  if (!allowed.allowed) return allowed;
  return recordGeneratedCode(userId, options);
}

async function resetUser(userId) {
  const safeUserId = Number(userId);
  if (!Number.isFinite(safeUserId) || safeUserId <= 0) return;
  await pool.query(`DELETE FROM whatsapp_pairing_guards WHERE user_id = $1`, [safeUserId]).catch(() => {});
}

module.exports = { checkAllowed, recordGeneratedCode, consumeAttempt, resetUser, parseAttemptTimestamps };
