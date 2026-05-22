require("dotenv").config();

function readBool(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") return fallback;
  return ["true", "1", "yes", "on"].includes(String(raw).toLowerCase());
}

function readInt(name, fallback) {
  const parsed = Number.parseInt(String(process.env[name] || ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
}

function readList(...names) {
  return firstEnv(...names)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function readTrustProxy(name = "TRUST_PROXY", fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === "") return fallback;
  const value = String(raw).trim();
  const lowered = value.toLowerCase();
  if (["false", "0", "no", "off"].includes(lowered)) return false;
  if (["true", "yes", "on"].includes(lowered)) return true;
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return value;
}

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

const appPublicUrl = normalizeOrigin(process.env.APP_PUBLIC_URL || "http://localhost:5173");
const apiPublicUrl = normalizeOrigin(process.env.API_PUBLIC_URL || "http://localhost:3001");
const corsOrigins = Array.from(new Set([
  ...String(process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean),
  appPublicUrl
]));

const config = {
  env: process.env.NODE_ENV || "development",
  port: readInt("PORT", 3001),
  databaseUrl: process.env.DATABASE_URL || "",
  pgSslMode: process.env.PGSSLMODE || "disable",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  refreshTokenDays: readInt("REFRESH_TOKEN_DAYS", 30),
  appPublicUrl,
  apiPublicUrl,
  corsOrigins,
  trustProxy: readTrustProxy("TRUST_PROXY", false),
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: readInt("SMTP_PORT", 587),
    name: process.env.SMTP_NAME || "waflow.ai",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "",
    tlsRejectUnauthorized: readBool("SMTP_TLS_REJECT_UNAUTHORIZED", true)
  },
  oauth: {
    googleClientIds: readList("GOOGLE_CLIENT_IDS", "GOOGLE_CLIENT_ID"),
    appleClientIds: readList("APPLE_CLIENT_IDS", "APPLE_CLIENT_ID")
  },
  whatsapp: {
    runtimeMode: process.env.WA_RUNTIME_MODE || "combined",
    workerId: process.env.WA_WORKER_ID || `worker_${process.pid}`,
    taskPollIntervalMs: readInt("WA_TASK_POLL_INTERVAL_MS", 1000),
    browserName: process.env.WA_BROWSER_NAME || "WaFli",
    browserPlatform: process.env.WA_BROWSER_PLATFORM || "macos",
    initTimeoutMs: readInt("WA_INIT_TIMEOUT_MS", 240000),
    socketConnectTimeoutMs: readInt("WA_SOCKET_CONNECT_TIMEOUT_MS", 45000),
    proxySocketConnectTimeoutMs: readInt("WA_PROXY_SOCKET_CONNECT_TIMEOUT_MS", 90000),
    runtimeOpenTimeoutMs: Math.max(10000, readInt("WA_RUNTIME_OPEN_TIMEOUT_MS", 60000)),
    sendReadyTimeoutMs: Math.max(10000, readInt("WA_SEND_READY_TIMEOUT_MS", 60000)),
    defaultQueryTimeoutMs: readInt("WA_DEFAULT_QUERY_TIMEOUT_MS", 30000),
    keepAliveIntervalMs: readInt("WA_KEEP_ALIVE_INTERVAL_MS", 20000),
    retryRequestDelayMs: readInt("WA_RETRY_REQUEST_DELAY_MS", 750),
    pairingSocketReadyTimeoutMs: readInt("WA_PAIRING_SOCKET_READY_TIMEOUT_MS", 15000),
    pairingProxySocketReadyTimeoutMs: readInt("WA_PAIRING_PROXY_SOCKET_READY_TIMEOUT_MS", 90000),
    pairingRequireQrReady: readBool("WA_PAIRING_REQUIRE_QR_READY", true),
    pairingRequestDelayMs: readInt("WA_PAIRING_REQUEST_DELAY_MS", 1000),
    pairingReadyFallbackMs: readInt("WA_PAIRING_READY_FALLBACK_MS", 2500),
    pairingQrTimeoutMs: Math.max(60000, readInt("WA_QR_TIMEOUT_MS", 120000)),
    pairingCodeTtlMs: Math.max(30 * 1000, readInt("WA_PAIRING_CODE_TTL_MS", 3 * 60 * 1000)),
    pairingResumeBaseDelayMs: readInt("WA_PAIRING_RESUME_BASE_DELAY_MS", 2500),
    pairingResumeMaxAttempts: readInt("WA_PAIRING_RESUME_MAX_ATTEMPTS", 4),
    pairingGuardEnabled: readBool("WA_PAIRING_GUARD_ENABLED", true),
    pairingGuardWindowMinutes: readInt("WA_PAIRING_GUARD_WINDOW_MINUTES", 15),
    pairingGuardMaxAttempts: readInt("WA_PAIRING_GUARD_MAX_ATTEMPTS", 4),
    pairingGuardCooldownMinutes: readInt("WA_PAIRING_GUARD_COOLDOWN_MINUTES", 30),
    reconnectBaseDelayMs: readInt("WA_RECONNECT_BASE_DELAY_MS", 5000),
    reconnectMaxAttempts: readInt("WA_RECONNECT_MAX_ATTEMPTS", 6),
    restoreConnectedSessions: readBool("WA_RESTORE_CONNECTED_SESSIONS", true),
    contentCachePolicy: process.env.WA_CONTENT_CACHE_POLICY || "ephemeral_ttl",
    messageCacheRetentionDays: Math.max(1, readInt("WA_MESSAGE_CACHE_RETENTION_DAYS", 7)),
    messageBodyMaxChars: Math.max(280, readInt("WA_MESSAGE_BODY_MAX_CHARS", 4000)),
    mediaCacheMaxBytes: Math.max(0, readInt("WA_MEDIA_CACHE_MAX_BYTES", 5 * 1024 * 1024)),
    mediaDownloadTimeoutMs: Math.max(5000, readInt("WA_MEDIA_DOWNLOAD_TIMEOUT_MS", 45000)),
    fetchLatestVersion: readBool("WA_FETCH_LATEST_VERSION", true),
    forceBaileysVersion: process.env.WA_FORCE_BAILEYS_VERSION || "",
    pairingCodeEnabled: readBool("WA_PAIRING_CODE_ENABLED", true),
    dnsResultOrder: process.env.WA_DNS_RESULT_ORDER || "",
    useProxy: readBool("WA_USE_PROXY", readBool("USE_PROXY", false)),
    proxyUrl: firstEnv("WA_PROXY_URL", "WA_PROXY_HTTPS_URL", "WA_PROXY_SEED_PRIMARY_URL", "HTTPS_PROXY", "PROXY_URL"),
    proxyConnectTimeoutMs: readInt("WA_PROXY_CONNECT_TIMEOUT_MS", 60000),
    proxyKeepAlive: readBool("WA_PROXY_KEEPALIVE", true),
    proxyKeepAliveMs: readInt("WA_PROXY_KEEPALIVE_MS", 30000),
    proxyStickySession: readBool("WA_PROXY_STICKY_SESSION", true),
    workerHealthEnabled: readBool("WA_WORKER_HEALTH_ENABLED", true)
  },
  ai: {
    provider: process.env.AI_PROVIDER || "openai",
    promptVersion: process.env.AI_PROMPT_VERSION || "wafli-es-v0.9.4",
    costDiagnosticsEnabled: readBool("AI_COST_DIAGNOSTICS_ENABLED", false)
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    models: {
      suggest: process.env.OPENAI_MODEL_SUGGEST || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      rewrite: process.env.OPENAI_MODEL_REWRITE || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      opener: process.env.OPENAI_MODEL_OPENER || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      reactivate: process.env.OPENAI_MODEL_REACTIVATE || "gpt-4.1-mini",
      analyze: process.env.OPENAI_MODEL_ANALYZE || "gpt-4.1-mini",
      recommend: process.env.OPENAI_MODEL_RECOMMEND || "gpt-4.1-mini"
    },
    contextMessageLimit: readInt("AI_CONTEXT_MESSAGE_LIMIT", 20),
    contextLimits: {
      suggest: readInt("AI_CONTEXT_LIMIT_SUGGEST", 12),
      rewrite: readInt("AI_CONTEXT_LIMIT_REWRITE", 8),
      opener: readInt("AI_CONTEXT_LIMIT_OPENER", 6),
      reactivate: readInt("AI_CONTEXT_LIMIT_REACTIVATE", 20),
      analyze: readInt("AI_CONTEXT_LIMIT_ANALYZE", 10),
      recommend: readInt("AI_CONTEXT_LIMIT_RECOMMEND", 14)
    },
    mediaContextLimit: readInt("AI_MEDIA_CONTEXT_LIMIT", 3),
    attachImagesToContext: readBool("AI_ATTACH_IMAGES_TO_CONTEXT", false),
    imageContextMaxFiles: Math.max(0, readInt("AI_IMAGE_CONTEXT_MAX_FILES", 1)),
    imageContextMaxBytes: Math.max(0, readInt("AI_IMAGE_CONTEXT_MAX_BYTES", 120000)),
    transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe"
  },
  quota: {
    freeDailyMessages: readInt("WFL_FREE_DAILY_MESSAGES", 5),
    plusMonthlyMessages: readInt("WFL_PLUS_MONTHLY_MESSAGES", 150),
    trialDays: readInt("WFL_PLUS_TRIAL_DAYS", 7),
    topUpPackSize: readInt("WFL_TOPUP_PACK_SIZE", 50),
    proMonthlyMessages: readInt("WFL_PRO_MONTHLY_MESSAGES", 0)
  },
  features: {},
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    pricePlus: process.env.STRIPE_PRICE_PLUS || "",
    pricePro: process.env.STRIPE_PRICE_PRO || "",
    pricePack50: process.env.STRIPE_PRICE_PACK_50 || "",
    pricePack200: process.env.STRIPE_PRICE_PACK_200 || "",
    pricePack500: process.env.STRIPE_PRICE_PACK_500 || ""
  },
  webPush: {
    publicKey: process.env.VAPID_PUBLIC_KEY || "",
    privateKey: process.env.VAPID_PRIVATE_KEY || "",
    subject: process.env.VAPID_SUBJECT || "mailto:soporte@wafli.app"
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
    privateKey: String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || ""
  },
  monitoring: {
    webhookUrl: process.env.MONITORING_WEBHOOK_URL || process.env.ERROR_ALERT_WEBHOOK_URL || "",
    webhookSecret: process.env.MONITORING_WEBHOOK_SECRET || process.env.ERROR_ALERT_WEBHOOK_SECRET || "",
    minLevel: process.env.MONITORING_MIN_LEVEL || "error",
    clientEnabled: readBool("MONITORING_CLIENT_ENABLED", true),
    alertCooldownMs: Math.max(0, readInt("MONITORING_ALERT_COOLDOWN_MS", 60000))
  }
};

module.exports = { config, readBool, readInt, firstEnv, readList };
