const Stripe = require("stripe");
const { pool } = require("../config/db");
const { config } = require("../config/env");
const { ApiError } = require("../utils/responses");
const quotaService = require("./quotaService");

function getStripe() {
  if (!config.stripe.secretKey) return null;
  return new Stripe(config.stripe.secretKey);
}

const priceMap = {};
if (config.stripe.pricePlus) priceMap[config.stripe.pricePlus] = { type: "plan", plan: "plus" };
if (config.stripe.pricePro) priceMap[config.stripe.pricePro] = { type: "plan", plan: "pro" };
if (config.stripe.pricePack50) priceMap[config.stripe.pricePack50] = { type: "pack", amount: config.quota.topUpPackSize };

function resolvePrice(kind, value) {
  if (kind === "plan") {
    if (value === "plus") return config.stripe.pricePlus;
    if (value === "pro") return config.stripe.pricePro;
    throw new ApiError(400, "unsupported_plan", "Este plan no esta disponible");
  }
  if (Number(value || 0) !== Number(config.quota.topUpPackSize || 50)) {
    throw new ApiError(400, "unsupported_pack", "Solo el pack de 50 generaciones esta disponible en V0");
  }
  return config.stripe.pricePack50;
}

async function getOrCreateCustomer(user) {
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const stripe = getStripe();
  if (!stripe) return `cus_dev_${user.id}`;
  const customer = await stripe.customers.create({ email: user.email || undefined, phone: user.phone || undefined, metadata: { userId: String(user.id) } });
  await pool.query(`UPDATE users SET stripe_customer_id = $2 WHERE id = $1`, [user.id, customer.id]);
  return customer.id;
}

async function createCheckout(user, { kind, value }) {
  const safeKind = kind === "plan" ? "plan" : "pack";
  const safeValue = safeKind === "plan"
    ? String(value || "plus").toLowerCase()
    : Number(value || config.quota.topUpPackSize || 50);
  const priceId = resolvePrice(safeKind, safeValue);
  if (!priceId) throw new ApiError(400, "missing_price", "Price ID no configurado");
  const stripe = getStripe();
  if (!stripe) return { url: `${config.appPublicUrl}/?billing=dev-success&kind=${safeKind}&value=${safeValue}`, dev: true };
  const customer = await getOrCreateCustomer(user);
  const mode = safeKind === "plan" ? "subscription" : "payment";
  const session = await stripe.checkout.sessions.create({
    customer,
    mode,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${config.appPublicUrl}/?billing=success`,
    cancel_url: `${config.appPublicUrl}/?billing=cancelled`,
    metadata: { userId: String(user.id), kind: safeKind, value: String(safeValue) }
  });
  return { url: session.url, sessionId: session.id };
}

async function createPortal(user) {
  const stripe = getStripe();
  if (!stripe) return { url: `${config.appPublicUrl}/?billing=portal-dev`, dev: true };
  const customer = await getOrCreateCustomer(user);
  const session = await stripe.billingPortal.sessions.create({ customer, return_url: `${config.appPublicUrl}/?screen=plan` });
  return { url: session.url };
}

function playProducts() {
  const plusProductId = process.env.PLAY_PRODUCT_PLUS_MONTHLY || "wafli_plus_monthly";
  const proProductId = process.env.PLAY_PRODUCT_PRO_MONTHLY || "wafli_pro_monthly";
  const packProductId = process.env.PLAY_PRODUCT_PACK_50 || "wafli_pack_50";
  return {
    enabled: String(process.env.PLAY_BILLING_ENABLED || "false").toLowerCase() === "true",
    packageName: process.env.PLAY_PACKAGE_NAME || "com.wafli.app",
    products: [
      {
        id: plusProductId,
        type: "subscription",
        entitlement: "plus",
        plan: "plus",
      },
      {
        id: proProductId,
        type: "subscription",
        entitlement: "pro",
        plan: "pro",
      },
      {
        id: packProductId,
        type: "inapp",
        entitlement: "pack",
        amount: Number(config.quota.topUpPackSize || 50),
      },
    ],
  };
}

async function recordPlayPurchase(user, payload = {}) {
  if (String(process.env.PLAY_BILLING_ENABLED || "false").toLowerCase() !== "true") {
    throw new ApiError(400, "play_billing_not_enabled", "Google Play Billing no esta habilitado en este entorno");
  }

  const productId = String(payload.productId || payload.product_id || "").trim();
  const purchaseToken = String(payload.purchaseToken || payload.purchase_token || "").trim();
  if (!productId || !purchaseToken) {
    throw new ApiError(400, "invalid_play_purchase", "Faltan datos de la compra de Google Play");
  }

  const catalog = playProducts().products;
  const product = catalog.find((item) => item.id === productId);
  if (!product) throw new ApiError(400, "unsupported_play_product", "Producto de Google Play no soportado");

  const result = await pool.query(
    `INSERT INTO play_purchase_receipts (
       user_id, product_id, product_type, purchase_token, order_id, package_name,
       status, entitlement, amount, raw_payload, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'pending_verification', $7, $8, $9::jsonb, NOW())
     ON CONFLICT (purchase_token) DO NOTHING
     RETURNING id, status, entitlement, amount`,
    [
      user.id,
      productId,
      product.type,
      purchaseToken,
      payload.orderId || payload.order_id || null,
      payload.packageName || payload.package_name || process.env.PLAY_PACKAGE_NAME || "com.wafli.app",
      product.entitlement,
      product.amount || null,
      JSON.stringify(payload),
    ]
  );

  let receipt = result.rows[0];
  if (!receipt) {
    const existing = await pool.query(
      `SELECT id, user_id, status, entitlement, amount FROM play_purchase_receipts WHERE purchase_token = $1`,
      [purchaseToken]
    );
    if (!existing.rows[0] || Number(existing.rows[0].user_id) !== Number(user.id)) {
      throw new ApiError(409, "play_purchase_token_in_use", "Esta compra ya fue registrada");
    }
    receipt = {
      id: existing.rows[0].id,
      status: existing.rows[0].status,
      entitlement: existing.rows[0].entitlement,
      amount: existing.rows[0].amount,
    };
  }

  return {
    receipt,
    verified: false,
    message: "Compra recibida y pendiente de verificacion servidor-servidor.",
  };
}

async function markEventStarted(event) {
  const result = await pool.query(
    `INSERT INTO stripe_events (event_id, event_type, payload)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (event_id) DO NOTHING`,
    [event.id, event.type, JSON.stringify(event)]
  );
  return result.rowCount === 1;
}

async function markEventProcessed(eventId) {
  await pool.query(`UPDATE stripe_events SET processed_at = NOW() WHERE event_id = $1`, [eventId]);
}

async function handleCheckoutCompleted(session) {
  const userId = Number(session.metadata?.userId);
  const kind = session.metadata?.kind;
  const value = session.metadata?.value;
  if (!userId) return;
  if (kind === "pack") {
    const amount = Number(value || 0);
    const inserted = await pool.query(
      `INSERT INTO pack_purchases (user_id, stripe_checkout_session_id, stripe_payment_intent_id, pack_size, amount_total, currency, status, applied_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'paid', NOW())
       ON CONFLICT (stripe_checkout_session_id) DO NOTHING`,
      [userId, session.id, session.payment_intent || null, amount, session.amount_total || null, session.currency || null]
    );
    if (inserted.rowCount > 0) await quotaService.addPack(userId, amount);
  }
  if (kind === "plan") {
    await quotaService.applyPlan(userId, value);
    await pool.query(`UPDATE users SET default_plan = $2, status = 'active', updated_at = NOW() WHERE id = $1`, [userId, value]);
  }
}

async function handleSubscriptionUpdated(subscription) {
  const customer = subscription.customer;
  const userRes = await pool.query(`SELECT id FROM users WHERE stripe_customer_id = $1`, [customer]);
  const userId = userRes.rows[0]?.id;
  if (!userId) return;
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const mapped = priceMap[priceId] || { type: "plan", plan: "plus" };
  await pool.query(
    `INSERT INTO plan_subscriptions (user_id, stripe_subscription_id, stripe_price_id, plan_name, status, current_period_start, current_period_end, cancel_at_period_end, updated_at)
     VALUES ($1, $2, $3, $4, $5, to_timestamp($6), to_timestamp($7), $8, NOW())
     ON CONFLICT (stripe_subscription_id) DO UPDATE SET stripe_price_id = EXCLUDED.stripe_price_id, plan_name = EXCLUDED.plan_name, status = EXCLUDED.status, current_period_start = EXCLUDED.current_period_start, current_period_end = EXCLUDED.current_period_end, cancel_at_period_end = EXCLUDED.cancel_at_period_end, updated_at = NOW()`,
    [userId, subscription.id, priceId, mapped.plan || "plus", subscription.status, subscription.current_period_start || null, subscription.current_period_end || null, !!subscription.cancel_at_period_end]
  );
  if (subscription.status === "active" || subscription.status === "trialing") await quotaService.applyPlan(userId, mapped.plan || "plus");
}

async function processStripeEvent(event) {
  const shouldProcess = await markEventStarted(event);
  if (!shouldProcess) return { duplicate: true };
  if (event.type === "checkout.session.completed") await handleCheckoutCompleted(event.data.object);
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") await handleSubscriptionUpdated(event.data.object);
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    await pool.query(`UPDATE plan_subscriptions SET status = 'canceled', updated_at = NOW() WHERE stripe_subscription_id = $1`, [subscription.id]);
    const userRes = await pool.query(`SELECT id FROM users WHERE stripe_customer_id = $1`, [subscription.customer]);
    if (userRes.rows[0]?.id) {
      await quotaService.applyPlan(userRes.rows[0].id, "free");
      await pool.query(`UPDATE users SET default_plan = 'free', updated_at = NOW() WHERE id = $1`, [userRes.rows[0].id]);
    }
  }
  if (event.type === "invoice.payment_failed") {
    const customer = event.data.object.customer;
    await pool.query(`UPDATE users SET status = 'past_due', updated_at = NOW() WHERE stripe_customer_id = $1`, [customer]);
  }
  await markEventProcessed(event.id);
  return { processed: true };
}

module.exports = { getStripe, createCheckout, createPortal, playProducts, recordPlayPurchase, processStripeEvent };
