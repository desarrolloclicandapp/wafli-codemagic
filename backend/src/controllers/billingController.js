const billing = require("../services/billingService");
const quota = require("../services/quotaService");
const revenueCat = require("../services/revenueCatService");
const { config } = require("../config/env");
const { ok } = require("../utils/responses");
const { ApiError } = require("../utils/responses");

async function plan(req, res) {
  const usage = await quota.getUsage(req.user.id);
  return ok(res, { plan: usage.balance.plan_name, quota: usage });
}

async function usage(req, res) {
  return ok(res, { usage: await quota.getUsage(req.user.id) });
}

async function checkoutPlan(req, res) {
  return ok(res, await billing.createCheckout(req.user, { kind: "plan", value: req.body.plan || "plus" }));
}

async function checkoutPack(req, res) {
  return ok(res, await billing.createCheckout(req.user, { kind: "pack", value: req.body.packSize || req.body.size || 50 }));
}

async function portal(req, res) {
  return ok(res, await billing.createPortal(req.user));
}

async function playProducts(req, res) {
  return ok(res, billing.playProducts());
}

async function recordPlayPurchase(req, res) {
  return ok(res, await billing.recordPlayPurchase(req.user, req.body || {}));
}

async function nativeSync(req, res) {
  return ok(res, await revenueCat.syncFromClient(req.user, req.body || {}));
}

async function revenueCatWebhook(req, res) {
  return ok(res, await revenueCat.processWebhook(req.headers, req.body || {}));
}

async function webhook(req, res) {
  const stripe = billing.getStripe();
  let event;
  if (stripe && config.stripe.webhookSecret) {
    const signature = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(req.body, signature, config.stripe.webhookSecret);
  } else {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body || {});
    event = JSON.parse(raw || "{}");
    if (!event.id || !event.type) throw new ApiError(400, "invalid_stripe_event", "Evento Stripe invalido");
  }
  const result = await billing.processStripeEvent(event);
  return ok(res, result);
}

module.exports = { plan, usage, checkoutPlan, checkoutPack, portal, playProducts, recordPlayPurchase, nativeSync, revenueCatWebhook, webhook };



