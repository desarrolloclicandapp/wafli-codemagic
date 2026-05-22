const crypto = require("crypto");
const { config } = require("../config/env");

const levelRank = { debug: 10, info: 20, warn: 30, error: 40 };
const recentAlerts = new Map();

function normalizeLevel(level = "error") {
  const safe = String(level || "error").toLowerCase();
  return levelRank[safe] ? safe : "error";
}

function shouldAlert(level) {
  if (!config.monitoring.webhookUrl) return false;
  const current = levelRank[normalizeLevel(level)] || levelRank.error;
  const minimum = levelRank[normalizeLevel(config.monitoring.minLevel)] || levelRank.error;
  return current >= minimum;
}

function alertKey(payload = {}) {
  return [
    payload.level || "error",
    payload.category || "system",
    payload.message || "",
    payload.context?.path || "",
    payload.context?.code || ""
  ].join("|").slice(0, 500);
}

function isCoolingDown(payload) {
  const cooldown = Number(config.monitoring.alertCooldownMs || 0);
  if (!cooldown) return false;
  const key = alertKey(payload);
  const now = Date.now();
  const previous = recentAlerts.get(key) || 0;
  if (previous && now - previous < cooldown) return true;
  recentAlerts.set(key, now);
  if (recentAlerts.size > 500) {
    for (const [entryKey, timestamp] of recentAlerts) {
      if (now - timestamp > cooldown * 5) recentAlerts.delete(entryKey);
    }
  }
  return false;
}

function signBody(body) {
  const secret = config.monitoring.webhookSecret;
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

async function sendAlert(payload = {}) {
  if (!shouldAlert(payload.level) || isCoolingDown(payload)) return false;
  if (typeof fetch !== "function") return false;

  const severity = normalizeLevel(payload.level || "error");
  const category = String(payload.category || "system");
  const message = String(payload.message || "Unexpected error");
  const path = payload.context?.path || payload.context?.url || payload.context?.route || "";
  const requestId = payload.context?.requestId || "";
  const body = JSON.stringify({
    source: "wafli",
    environment: config.env,
    domain: "wafli",
    severity,
    category,
    message,
    path,
    requestId,
    name: `[${severity}] ${category}: ${message}`.slice(0, 240),
    appPublicUrl: config.appPublicUrl,
    apiPublicUrl: config.apiPublicUrl,
    occurredAt: new Date().toISOString(),
    ...payload
  });
  const signature = signBody(body);

  try {
    const response = await fetch(config.monitoring.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signature ? { "x-wafli-signature": signature } : {})
      },
      body
    });
    return response.ok;
  } catch (_) {
    return false;
  }
}

module.exports = { sendAlert };
