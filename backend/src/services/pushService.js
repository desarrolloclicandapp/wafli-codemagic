const webpush = require("web-push");
const admin = require("firebase-admin");
const { pool } = require("../config/db");
const { config } = require("../config/env");

if (config.webPush.publicKey && config.webPush.privateKey) {
  webpush.setVapidDetails(config.webPush.subject, config.webPush.publicKey, config.webPush.privateKey);
}

let firebaseReady = false;
function firebaseCredential() {
  if (config.firebase.serviceAccountJson) return admin.credential.cert(JSON.parse(config.firebase.serviceAccountJson));
  if (config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey) {
    return admin.credential.cert({
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey
    });
  }
  return null;
}

try {
  const credential = firebaseCredential();
  if (credential && !admin.apps.length) {
    admin.initializeApp({ credential, projectId: config.firebase.projectId || undefined });
    firebaseReady = true;
  } else if (admin.apps.length) {
    firebaseReady = true;
  }
} catch (_) {
  firebaseReady = false;
}

function publicKey() {
  return config.webPush.publicKey || "";
}

async function subscribe(userId, subscription, userAgent) {
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) throw new Error("Invalid push subscription");
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, active, updated_at)
     VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent, active = TRUE, updated_at = NOW()`,
    [userId, endpoint, p256dh, auth, userAgent || null]
  );
}

async function subscribeNative(userId, payload = {}) {
  const token = String(payload.token || "").trim();
  const platform = String(payload.platform || "android").trim().toLowerCase().slice(0, 40) || "android";
  if (!token) throw new Error("Invalid native push token");
  await pool.query(
    `INSERT INTO native_push_tokens (user_id, token, platform, active, updated_at)
     VALUES ($1, $2, $3, TRUE, NOW())
     ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, active = TRUE, updated_at = NOW()`,
    [userId, token, platform]
  );
}

async function unsubscribe(userId, endpoint) {
  await pool.query(`UPDATE push_subscriptions SET active = FALSE, updated_at = NOW() WHERE user_id = $1 AND endpoint = $2`, [userId, endpoint]);
}

async function getPreferences(userId) {
  await pool.query(`INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
  const result = await pool.query(`SELECT * FROM notification_preferences WHERE user_id = $1`, [userId]);
  return result.rows[0];
}

async function updatePreferences(userId, patch = {}) {
  const allowed = ["global_enabled", "new_message", "stalled", "quota", "product", "whatsapp_status", "payments"];
  const params = [userId];
  const sets = [];
  for (const key of allowed) {
    if (patch[key] !== undefined) {
      params.push(!!patch[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }
  await getPreferences(userId);
  if (sets.length > 0) await pool.query(`UPDATE notification_preferences SET ${sets.join(", ")}, updated_at = NOW() WHERE user_id = $1`, params);
  return getPreferences(userId);
}

function stringData(payload = {}) {
  return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, String(value ?? "")]));
}

async function sendToWeb(userId, payload) {
  if (!config.webPush.publicKey || !config.webPush.privateKey) return 0;
  const subs = await pool.query(`SELECT * FROM push_subscriptions WHERE user_id = $1 AND active = TRUE`, [userId]);
  let sent = 0;
  for (const row of subs.rows) {
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify(payload));
      sent += 1;
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) await pool.query(`UPDATE push_subscriptions SET active = FALSE WHERE id = $1`, [row.id]);
    }
  }
  return sent;
}

async function sendToNative(userId, payload) {
  if (!firebaseReady) return 0;
  const tokens = await pool.query(`SELECT id, token FROM native_push_tokens WHERE user_id = $1 AND active = TRUE`, [userId]);
  let sent = 0;
  for (const row of tokens.rows) {
    try {
      await admin.messaging().send({
        token: row.token,
        notification: {
          title: payload.title || "WaFli",
          body: payload.body || payload.message || "Tienes una novedad en WaFli."
        },
        data: stringData(payload),
        android: {
          priority: "high",
          notification: {
            channelId: "wafli_default",
            sound: "default"
          }
        }
      });
      sent += 1;
    } catch (error) {
      const code = String(error?.code || "");
      if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) {
        await pool.query(`UPDATE native_push_tokens SET active = FALSE, updated_at = NOW() WHERE id = $1`, [row.id]);
      }
    }
  }
  return sent;
}

async function sendToUser(userId, payload) {
  const [web, native] = await Promise.all([
    sendToWeb(userId, payload),
    sendToNative(userId, payload)
  ]);
  if (!web && !native && !config.webPush.publicKey && !firebaseReady) return { skipped: "push_not_configured" };
  return { sent: web + native, web, native };
}

function preferenceKeyForType(notificationType = "") {
  const type = String(notificationType || "").trim();
  if (type === "new_message") return "new_message";
  if (type === "stalled") return "stalled";
  if (type === "quota_low" || type === "quota_exhausted") return "quota";
  if (type === "whatsapp_status") return "whatsapp_status";
  if (type === "payment" || type === "payments") return "payments";
  if (type === "product") return "product";
  return "product";
}

async function notify(userId, notificationType, payload = {}) {
  const preferences = await getPreferences(userId);
  const key = preferenceKeyForType(notificationType);
  if (!preferences.global_enabled || preferences[key] === false) {
    return { skipped: "preference_disabled", notificationType, preference: key };
  }
  return sendToUser(userId, {
    notificationType,
    ...payload
  });
}

module.exports = { publicKey, subscribe, subscribeNative, unsubscribe, getPreferences, updatePreferences, sendToUser, notify };
