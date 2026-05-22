const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");
const { config } = require("../config/env");
const { ApiError } = require("../utils/responses");
const { randomToken, hashValue } = require("../utils/crypto");
const { normalizeEmail, getRequestIp } = require("../utils/normalize");
const { verifyProviderIdToken } = require("./oidcTokenService");
const quotaService = require("./quotaService");

const REFRESH_TOKEN_COOKIE_NAME = "wafli_rt";
const ONE_YEAR = 60 * 60 * 24 * 365;

function parseRefreshTokenFromCookies(req = {}) {
  const cookieHeader = String(req.headers?.cookie || "");
  if (!cookieHeader) return "";
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [name, ...valueParts] = part.trim().split("=");
    if (!name || name !== REFRESH_TOKEN_COOKIE_NAME) continue;
    const value = valueParts.join("=");
    if (!value) return "";
    return decodeURIComponent(value);
  }
  return "";
}

function buildAccessToken(user) {
  return jwt.sign({ sub: String(user.id), email: user.email || null }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

async function createUserDefaults(client, userId) {
  await client.query(`INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
  await quotaService.startTrialForNewUser(client, userId);
  await client.query(`INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
  await client.query(
    `INSERT INTO whatsapp_connections (user_id, session_id) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
    [userId, `user_${userId}`]
  );
}

async function findOrCreateUserByEmailWithFlag(client, email, options = {}) {
  const safeEmail = normalizeEmail(email);
  let result = await client.query(`SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL`, [safeEmail]);
  if (result.rows[0]) {
    if (result.rows[0].status === "pending_deletion" || result.rows[0].status === "permanently_deleted") {
      if (result.rows[0].status === "pending_deletion" && options.recoverAccount) {
        const recovered = await client.query(
          `UPDATE users
           SET status = 'active', pending_delete_at = NULL, updated_at = NOW()
           WHERE id = $1 AND status = 'pending_deletion'
           RETURNING *`,
          [result.rows[0].id]
        );
        return { user: recovered.rows[0], created: false, recovered: true };
      }
      throw new ApiError(403, "account_pending_deletion", "Esta cuenta tiene una eliminacion pendiente");
    }
    return { user: result.rows[0], created: false, recovered: false };
  }
  result = await client.query(
    `INSERT INTO users (email, onboarding_status) VALUES ($1, 'pending') RETURNING *`,
    [safeEmail]
  );
  await createUserDefaults(client, result.rows[0].id);
  return { user: result.rows[0], created: true, recovered: false };
}

async function issueSession(user, req) {
  const refreshToken = randomToken(48);
  const refreshHash = hashValue(refreshToken);
  const expiresAt = new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO user_sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, refreshHash, req.headers["user-agent"] || null, getRequestIp(req), expiresAt]
  );
  await pool.query(`UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`, [user.id]);
  return { accessToken: buildAccessToken(user), refreshToken, expiresAt };
}

async function findOrCreateUserByIdentity(client, identity, options = {}) {
  const identityRes = await client.query(
    `SELECT u.*
     FROM user_identities i
     JOIN users u ON u.id = i.user_id
     WHERE i.provider = $1
       AND i.provider_subject = $2
       AND u.deleted_at IS NULL
     LIMIT 1`,
    [identity.provider, identity.subject]
  );
  if (identityRes.rows[0]) {
    let recovered = false;
    if (identityRes.rows[0].status === "pending_deletion" || identityRes.rows[0].status === "permanently_deleted") {
      if (identityRes.rows[0].status === "pending_deletion" && options.recoverAccount) {
        const recoveredUserRes = await client.query(
          `UPDATE users
           SET status = 'active', pending_delete_at = NULL, updated_at = NOW()
           WHERE id = $1 AND status = 'pending_deletion'
           RETURNING *`,
          [identityRes.rows[0].id]
        );
        identityRes.rows[0] = recoveredUserRes.rows[0];
        recovered = true;
      } else {
      throw new ApiError(403, "account_pending_deletion", "Esta cuenta tiene una eliminacion pendiente");
      }
    }
    await client.query(
      `UPDATE user_identities
       SET email = COALESCE($3, email),
           email_verified = $4,
           display_name = COALESCE($5, display_name),
           avatar_url = COALESCE($6, avatar_url),
           raw_claims = $7::jsonb,
           last_seen_at = NOW(),
           updated_at = NOW()
       WHERE provider = $1 AND provider_subject = $2`,
      [
        identity.provider,
        identity.subject,
        identity.email || null,
        Boolean(identity.emailVerified),
        identity.displayName || null,
        identity.avatarUrl || null,
        JSON.stringify(identity.claims || {})
      ]
    );
    return { user: identityRes.rows[0], created: false, recovered };
  }

  if (!identity.email || !identity.emailVerified) {
    throw new ApiError(401, "oauth_email_unverified", "El proveedor no confirmo un email valido para crear la cuenta");
  }

  const { user, created, recovered } = await findOrCreateUserByEmailWithFlag(client, identity.email, options);
  await client.query(
    `INSERT INTO user_identities
       (user_id, provider, provider_subject, email, email_verified, display_name, avatar_url, raw_claims, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
     ON CONFLICT (provider, provider_subject) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           email = EXCLUDED.email,
           email_verified = EXCLUDED.email_verified,
           display_name = EXCLUDED.display_name,
           avatar_url = EXCLUDED.avatar_url,
           raw_claims = EXCLUDED.raw_claims,
           last_seen_at = NOW(),
           updated_at = NOW()`,
    [
      user.id,
      identity.provider,
      identity.subject,
      identity.email,
      Boolean(identity.emailVerified),
      identity.displayName || null,
      identity.avatarUrl || null,
      JSON.stringify(identity.claims || {})
    ]
  );
  return { user, created, recovered: Boolean(recovered) };
}

async function socialLogin(req) {
  const provider = String(req.body.provider || "").trim().toLowerCase();
  const idToken = String(req.body.idToken || req.body.credential || "").trim();
  const recoverAccount = req.body.recoverAccount === true;
  if (!idToken) throw new ApiError(400, "missing_oauth_token", "Token de proveedor requerido");

  const identity = await verifyProviderIdToken(provider, idToken, {
    nonce: String(req.body.nonce || "").trim() || undefined
  });

  if (!identity.subject) throw new ApiError(401, "invalid_oauth_token", "Token de proveedor sin sujeto");
  if (provider === "apple" && req.body.profile?.name && !identity.displayName) {
    const firstName = String(req.body.profile.name.firstName || "").trim();
    const lastName = String(req.body.profile.name.lastName || "").trim();
    identity.displayName = [firstName, lastName].filter(Boolean).join(" ");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { user, created, recovered } = await findOrCreateUserByIdentity(client, identity, { recoverAccount });
    await client.query(
      `INSERT INTO audit_logs (user_id, action, metadata, ip_address)
       VALUES ($1, $2, $3::jsonb, $4)`,
      [
        user.id,
        recovered ? "account_recovered_oauth" : "oauth_login",
        JSON.stringify({ provider: identity.provider, email: identity.email || null, created, recovered: Boolean(recovered) }),
        getRequestIp(req)
      ]
    ).catch(() => {});
    await client.query("COMMIT");
    const session = await issueSession(user, req);
    return { user, firstTime: created, recovered: Boolean(recovered), ...session };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function refresh(req) {
  const refreshToken = String(req.body?.refreshToken || "").trim() || parseRefreshTokenFromCookies(req);
  if (!refreshToken) throw new ApiError(400, "missing_refresh", "Refresh token requerido");
  const refreshHash = hashValue(refreshToken);
  const sessionRes = await pool.query(
    `SELECT s.*, u.email, u.phone, u.status, u.onboarding_status, u.default_plan, u.stripe_customer_id
     FROM user_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.refresh_token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > NOW()
       AND u.deleted_at IS NULL
       AND u.status NOT IN ('suspended', 'pending_deletion', 'permanently_deleted')`,
    [refreshHash]
  );
  const row = sessionRes.rows[0];
  if (!row) throw new ApiError(401, "invalid_refresh", "Refresh token invalido");
  const user = { id: row.user_id, email: row.email, phone: row.phone, status: row.status, onboarding_status: row.onboarding_status, default_plan: row.default_plan, stripe_customer_id: row.stripe_customer_id };
  const expiresAt = new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000);
  await pool.query(`UPDATE user_sessions SET expires_at = $2 WHERE id = $1`, [row.id, expiresAt]);
  return { accessToken: buildAccessToken(user), user, refreshToken, expiresAt };
}

async function logout(req) {
  const refreshToken = String(req.body?.refreshToken || "").trim() || parseRefreshTokenFromCookies(req);
  if (refreshToken) await pool.query(`UPDATE user_sessions SET revoked_at = NOW() WHERE refresh_token_hash = $1`, [hashValue(refreshToken)]);
}

function refreshTokenCookieOptions(expiresAt = null) {
  const options = [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax"
  ];
  if (config.env === "production") options.push("Secure");
  if (expiresAt instanceof Date && Number.isFinite(expiresAt.getTime())) {
    options.push(`Expires=${expiresAt.toUTCString()}`);
    options.push(`Max-Age=${Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))}`);
  } else {
    options.push(`Max-Age=${ONE_YEAR}`);
  }
  return options.join("; ");
}

function setRefreshCookie(res, refreshToken, expiresAt) {
  if (!res || typeof res.setHeader !== "function") return;
  const safeToken = encodeURIComponent(String(refreshToken || ""));
  res.setHeader("Set-Cookie", `${REFRESH_TOKEN_COOKIE_NAME}=${safeToken}; ${refreshTokenCookieOptions(expiresAt)}`);
}

function clearRefreshCookie(res) {
  if (!res || typeof res.setHeader !== "function") return;
  const expired = new Date(Date.now() - 86400000);
  const secure = config.env === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${REFRESH_TOKEN_COOKIE_NAME}=; Path=/; HttpOnly${secure}; SameSite=Lax; Expires=${expired.toUTCString()}; Max-Age=0`
  );
}

module.exports = {
  socialLogin,
  refresh,
  logout,
  issueSession,
  createUserDefaults,
  setRefreshCookie,
  clearRefreshCookie,
  refreshTokenCookieOptions
};
