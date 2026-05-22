const { pool } = require("../config/db");
const { config } = require("../config/env");
const { ApiError } = require("../utils/responses");
const quotaService = require("./quotaService");

const REVENUECAT_API_BASE = "https://api.revenuecat.com/v1";
const PLUS_ENTITLEMENT = process.env.REVENUECAT_ENTITLEMENT_PLUS || "plus";
const PLUS_PRODUCTS = new Set([
  process.env.REVENUECAT_PLUS_PRODUCT_ID,
  process.env.PLAY_PRODUCT_PLUS_MONTHLY,
  "wafli_plus_monthly",
].filter(Boolean));
const PACK_PRODUCT_AMOUNTS = new Map([
  [process.env.REVENUECAT_PACK_50_PRODUCT_ID || process.env.PLAY_PRODUCT_PACK_50 || "wafli_pack_50", Number(config.quota.topUpPackSize || 50)],
]);

function expectedAppUserId(userId) {
  return `wafli_${userId}`;
}

function userIdFromAppUserId(appUserId = "") {
  const match = String(appUserId || "").match(/^wafli_(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function assertExpectedAppUser(user, appUserId) {
  const expected = expectedAppUserId(user.id);
  if (String(appUserId || "") !== expected) {
    throw new ApiError(403, "native_payment_user_mismatch", "La compra no corresponde a esta cuenta");
  }
}

function isRevenueCatServerConfigured() {
  return Boolean(process.env.REVENUECAT_SECRET_API_KEY);
}

async function fetchSubscriber(appUserId) {
  if (!process.env.REVENUECAT_SECRET_API_KEY) {
    throw new ApiError(400, "native_payments_server_not_configured", "Falta REVENUECAT_SECRET_API_KEY en el backend");
  }

  const response = await fetch(`${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: {
      Authorization: `Bearer ${process.env.REVENUECAT_SECRET_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (_) {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, "revenuecat_api_error", payload.message || "RevenueCat no pudo verificar la compra", payload);
  }
  return payload.subscriber || payload;
}

function parseDate(value) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time) : null;
}

function isActiveExpiration(expiresDate) {
  const expires = parseDate(expiresDate);
  return !expires || expires.getTime() > Date.now();
}

function activePlusFromSubscriber(subscriber = {}) {
  const entitlements = subscriber.entitlements || {};
  const plus = entitlements[PLUS_ENTITLEMENT];
  if (plus && isActiveExpiration(plus.expires_date)) {
    return {
      entitlementId: PLUS_ENTITLEMENT,
      productId: plus.product_identifier || null,
      expiresAt: parseDate(plus.expires_date),
      purchasedAt: parseDate(plus.purchase_date),
      store: plus.store || null,
      raw: plus,
    };
  }

  const subscriptions = subscriber.subscriptions || {};
  for (const [productId, subscription] of Object.entries(subscriptions)) {
    if (PLUS_PRODUCTS.has(productId) && isActiveExpiration(subscription.expires_date)) {
      return {
        entitlementId: PLUS_ENTITLEMENT,
        productId,
        expiresAt: parseDate(subscription.expires_date),
        purchasedAt: parseDate(subscription.purchase_date),
        store: subscription.store || null,
        raw: subscription,
      };
    }
  }
  return null;
}

function packTransactionsFromSubscriber(subscriber = {}) {
  const rows = [];
  const nonSubscriptions = subscriber.non_subscriptions || {};
  for (const [productId, amount] of PACK_PRODUCT_AMOUNTS.entries()) {
    const transactions = Array.isArray(nonSubscriptions[productId]) ? nonSubscriptions[productId] : [];
    for (const tx of transactions) {
      const transactionId = tx.id || tx.transaction_id || tx.store_transaction_id || `${productId}:${tx.purchase_date || tx.purchased_at_ms || ""}`;
      if (!transactionId) continue;
      rows.push({
        transactionId,
        productId,
        amount,
        store: tx.store || null,
        purchasedAt: parseDate(tx.purchase_date),
        raw: tx,
      });
    }
  }
  return rows;
}

async function upsertNativeEntitlement(userId, appUserId, entitlement) {
  await pool.query(
    `INSERT INTO native_entitlements (
       user_id, provider, app_user_id, entitlement_id, product_id, store,
       active, purchased_at, expires_at, raw_payload, updated_at
     )
     VALUES ($1, 'revenuecat', $2, $3, $4, $5, TRUE, $6, $7, $8::jsonb, NOW())
     ON CONFLICT (provider, app_user_id, entitlement_id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       product_id = EXCLUDED.product_id,
       store = EXCLUDED.store,
       active = TRUE,
       purchased_at = EXCLUDED.purchased_at,
       expires_at = EXCLUDED.expires_at,
       raw_payload = EXCLUDED.raw_payload,
       updated_at = NOW()`,
    [
      userId,
      appUserId,
      entitlement.entitlementId,
      entitlement.productId,
      entitlement.store,
      entitlement.purchasedAt,
      entitlement.expiresAt,
      JSON.stringify(entitlement.raw || {}),
    ]
  );
}

async function insertPackTransaction(userId, tx) {
  const result = await pool.query(
    `INSERT INTO native_store_transactions (
       user_id, provider, transaction_id, product_id, product_type, store,
       amount, purchased_at, raw_payload, processed_at
     )
     VALUES ($1, 'revenuecat', $2, $3, 'pack', $4, $5, $6, $7::jsonb, NOW())
     ON CONFLICT (provider, transaction_id) DO NOTHING`,
    [userId, tx.transactionId, tx.productId, tx.store, tx.amount, tx.purchasedAt, JSON.stringify(tx.raw || {})]
  );
  if (result.rowCount > 0) {
    await quotaService.addPack(userId, tx.amount);
    return true;
  }
  return false;
}

async function hasActiveStripePlan(userId) {
  const result = await pool.query(
    `SELECT 1
     FROM plan_subscriptions
     WHERE user_id = $1
       AND status IN ('active', 'trialing')
       AND plan_name = 'plus'
     LIMIT 1`,
    [userId]
  );
  return Boolean(result.rows[0]);
}

async function applySubscriber(user, appUserId, subscriber = {}) {
  const plus = activePlusFromSubscriber(subscriber);
  const packTransactions = packTransactionsFromSubscriber(subscriber);
  const packsApplied = [];

  if (plus) {
    await upsertNativeEntitlement(user.id, appUserId, plus);
    await quotaService.applyPlan(user.id, "plus");
    await pool.query(`UPDATE users SET default_plan = 'plus', status = 'active', updated_at = NOW() WHERE id = $1`, [user.id]);
  }

  for (const tx of packTransactions) {
    if (await insertPackTransaction(user.id, tx)) packsApplied.push({ productId: tx.productId, amount: tx.amount });
  }

  return {
    provider: "revenuecat",
    verified: true,
    appUserId,
    plusActive: Boolean(plus),
    packsApplied,
  };
}

async function syncFromClient(user, payload = {}) {
  const appUserId = String(payload.appUserId || payload.app_user_id || "").trim();
  assertExpectedAppUser(user, appUserId);

  const subscriber = await fetchSubscriber(appUserId);
  const result = await applySubscriber(user, appUserId, subscriber);
  await pool.query(
    `INSERT INTO native_purchase_syncs (user_id, provider, app_user_id, source, raw_payload)
     VALUES ($1, 'revenuecat', $2, $3, $4::jsonb)`,
    [user.id, appUserId, payload.source || "client", JSON.stringify(payload.customerInfo || {})]
  );
  return result;
}

function validateWebhookAuth(headers = {}) {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH_HEADER || "";
  if (!expected) return;
  const actual = headers.authorization || headers.Authorization || "";
  if (actual !== expected) throw new ApiError(401, "invalid_revenuecat_webhook", "Webhook RevenueCat no autorizado");
}

async function recordWebhookEvent(event, body) {
  const eventId = String(event.id || event.event_id || event.transaction_id || `${event.type || "unknown"}:${event.event_timestamp_ms || Date.now()}`);
  const result = await pool.query(
    `INSERT INTO revenuecat_events (event_id, event_type, app_user_id, product_id, payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, event.type || "unknown", event.app_user_id || null, event.product_id || null, JSON.stringify(body || event)]
  );
  return result.rowCount === 1;
}

async function processWebhook(headers, body = {}) {
  validateWebhookAuth(headers);
  const event = body.event || body;
  const shouldProcess = await recordWebhookEvent(event, body);
  if (!shouldProcess) return { duplicate: true };

  const appUserId = event.app_user_id || event.original_app_user_id || "";
  const userId = userIdFromAppUserId(appUserId);
  if (!userId) return { ignored: true, reason: "unknown_app_user_id" };

  const user = { id: userId };
  if (!isRevenueCatServerConfigured()) {
    throw new ApiError(400, "native_payments_server_not_configured", "Falta REVENUECAT_SECRET_API_KEY en el backend");
  }

  const subscriber = await fetchSubscriber(appUserId);
  const applied = await applySubscriber(user, appUserId, subscriber);
  if (event.type === "EXPIRATION" && (event.entitlement_ids || []).includes(PLUS_ENTITLEMENT)) {
    const activeStripe = await hasActiveStripePlan(userId);
    if (!applied.plusActive && !activeStripe) {
      await quotaService.applyPlan(userId, "free");
      await pool.query(`UPDATE users SET default_plan = 'free', updated_at = NOW() WHERE id = $1`, [userId]);
      await pool.query(
        `UPDATE native_entitlements SET active = FALSE, updated_at = NOW()
         WHERE provider = 'revenuecat' AND app_user_id = $1 AND entitlement_id = $2`,
        [appUserId, PLUS_ENTITLEMENT]
      );
    }
  }
  return applied;
}

module.exports = {
  applySubscriber,
  expectedAppUserId,
  processWebhook,
  syncFromClient,
};
