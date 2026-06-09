const { pool } = require("../config/db");
const { config } = require("../config/env");
const { RUNTIME_MODE } = require("./runtimeModeService");
const whatsappTaskService = require("./whatsappTaskService");
const whatsappService = require("./whatsappService");
const chatService = require("./chatService");
const quotaService = require("./quotaService");
const emailService = require("./emailService");
const { getRequestIp } = require("../utils/normalize");

const COUNTRY_PREFIX_OPTIONS = [
  ["+595 PY", "Paraguay (+595)"],
  ["+54 AR", "Argentina (+54)"],
  ["+591 BO", "Bolivia (+591)"],
  ["+55 BR", "Brasil (+55)"],
  ["+56 CL", "Chile (+56)"],
  ["+57 CO", "Colombia (+57)"],
  ["+506 CR", "Costa Rica (+506)"],
  ["+53 CU", "Cuba (+53)"],
  ["+593 EC", "Ecuador (+593)"],
  ["+503 SV", "El Salvador (+503)"],
  ["+34 ES", "España (+34)"],
  ["+502 GT", "Guatemala (+502)"],
  ["+504 HN", "Honduras (+504)"],
  ["+52 MX", "México (+52)"],
  ["+505 NI", "Nicaragua (+505)"],
  ["+507 PA", "Panamá (+507)"],
  ["+51 PE", "Perú (+51)"],
  ["+1 PR", "Puerto Rico (+1)"],
  ["+1 DO", "República Dominicana (+1)"],
  ["+598 UY", "Uruguay (+598)"],
  ["+58 VE", "Venezuela (+58)"],
  ["+1 US", "Estados Unidos (+1)"],
  ["+1 CA", "Canadá (+1)"],
  ["+44 GB", "Reino Unido (+44)"],
  ["+33 FR", "Francia (+33)"],
  ["+49 DE", "Alemania (+49)"],
  ["+39 IT", "Italia (+39)"],
  ["+351 PT", "Portugal (+351)"]
];

const COUNTRY_PREFIX_BY_ISO = COUNTRY_PREFIX_OPTIONS.reduce((acc, [prefixValue]) => {
  const isoCode = String(prefixValue || "").split(" ")[1] || "";
  const safeIso = isoCode.trim().toUpperCase();
  if (safeIso) acc[safeIso] = prefixValue;
  return acc;
}, {});

const COUNTRY_LABEL_BY_PREFIX = COUNTRY_PREFIX_OPTIONS.reduce((acc, [prefixValue, label]) => {
  acc[prefixValue] = label;
  return acc;
}, {});

function normalizeCountryCode(value = "") {
  return String(value).replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
}

function readRequestCountry(req) {
  const rawHeader = String(
    req.headers["cf-ipcountry"] ||
      req.headers["cf-connecting-country"] ||
      req.headers["x-vercel-ip-country"] ||
      req.headers["x-country-code"] ||
      req.headers["x-country"]
  ).trim();
  const normalized = normalizeCountryCode(rawHeader);
  if (COUNTRY_PREFIX_BY_ISO[normalized]) return normalized;

  const acceptLanguage = String(req.headers["accept-language"] || "").split(",")[0];
  const match = acceptLanguage.match(/-([a-zA-Z]{2})/);
  const fromAcceptLanguage = normalizeCountryCode(match?.[1] || "");
  if (COUNTRY_PREFIX_BY_ISO[fromAcceptLanguage]) return fromAcceptLanguage;

  return "";
}

function getCountryPrefixForRequest(req) {
  const countryCode = readRequestCountry(req);
  return COUNTRY_PREFIX_BY_ISO[countryCode] || null;
}

async function getFlags() {
  const result = await pool.query(`SELECT key, value, description, updated_at FROM system_flags ORDER BY key ASC`);
  return result.rows.reduce((acc, row) => {
    acc[row.key] = { value: row.value, description: row.description, updatedAt: row.updated_at };
    return acc;
  }, {});
}

async function getStatus() {
  const flags = await getFlags();
  return {
    ok: true,
    runtimeMode: RUNTIME_MODE,
    corsOrigins: config.corsOrigins,
    appPublicUrl: config.appPublicUrl,
    ai: getAiDiagnostics(),
    flags
  };
}

function getAiDiagnostics() {
  return {
    provider: config.ai.provider,
    openaiConfigured: Boolean(config.openai.apiKey),
    model: config.openai.model,
    models: config.openai.models,
    timeoutMs: config.openai.timeoutMs
  };
}

async function healthExtended() {
  const dbStart = Date.now();
  await pool.query("SELECT 1");
  const dbMs = Date.now() - dbStart;
  const dbInfo = await getDbInfo();
  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM whatsapp_connections WHERE status = 'connected') AS whatsapp_connected,
      (SELECT COUNT(*)::int FROM error_logs WHERE created_at >= NOW() - INTERVAL '1 hour' AND level = 'error') AS recent_errors
  `);
  return {
    ok: true,
    runtimeMode: RUNTIME_MODE,
    corsOrigins: config.corsOrigins,
    appPublicUrl: config.appPublicUrl,
    ai: getAiDiagnostics(),
    dbMs,
    db: dbInfo,
    counts: counts.rows[0],
    whatsappTasks: await whatsappTaskService.countTasksByStatus(),
    chatCache: await chatService.getChatCacheDiagnostics(),
    uptime: process.uptime()
  };
}

async function getDbInfo() {
  const meta = await pool.query(`
    SELECT
      current_database() AS database,
      current_schema() AS schema,
      current_user AS username,
      inet_server_addr()::text AS server_addr,
      inet_server_port() AS server_port
  `);
  const tables = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC
  `);
  return {
    ...meta.rows[0],
    tableCount: tables.rows.length,
    tables: tables.rows.map((row) => row.table_name)
  };
}

async function getSmtpInfo() {
  const status = await emailService.verifySmtp();
  return {
    host: config.smtp.host || null,
    port: config.smtp.port,
    user: config.smtp.user || null,
    from: config.smtp.from || null,
    ...status
  };
}

async function getClientContext(req = {}) {
  const ipAddress = getRequestIp(req);
  const countryPrefix = getCountryPrefixForRequest(req);
  return {
    ip: ipAddress,
    countryCode: countryPrefix ? String(countryPrefix).split(" ")[1] || null : null,
    country: countryPrefix ? COUNTRY_LABEL_BY_PREFIX[countryPrefix] : null,
    countryPrefix: countryPrefix || null,
    detectionSource: countryPrefix ? "header" : "default"
  };
}

async function getEmailDiagnostics(email = "") {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { email: null, recentDeliveries: 0, latestDeliveries: [] };
  }
  const result = await pool.query(
    `SELECT recipient, subject, provider_message_id, status, accepted, rejected, response, error_code, error_message, created_at
     FROM email_delivery_logs
     WHERE recipient = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [normalizedEmail]
  );
  return {
    email: normalizedEmail,
    recentDeliveries: result.rows.length,
    latestDeliveries: result.rows
  };
}

function maskPairingCode(row = {}) {
  if (!row) return null;
  return {
    ...row,
    pairing_code: row.pairing_code ? "***" : null
  };
}

function maskPhone(value = "") {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 6) return value || null;
  return `+${digits.slice(0, 3)}***${digits.slice(-2)}`;
}

function sanitizeConnectivityRow(row = {}) {
  const details = row.details && typeof row.details === "object" ? { ...row.details } : row.details;
  if (details && typeof details === "object") {
    if (details.phone) details.phone = maskPhone(details.phone);
    if (details.proxy) details.proxy = "***";
  }
  return { ...row, details };
}

async function getWhatsappDiagnostics(userId = "") {
  const safeUserId = Number.parseInt(String(userId || ""), 10);
  const runtime = whatsappService.getRuntimeDiagnostics();
  const response = { runtime, userId: Number.isFinite(safeUserId) && safeUserId > 0 ? safeUserId : null };
  if (!response.userId) return { ...response, connection: null, recentTasks: [], recentConnectivity: [], recentErrors: [] };

  const connection = await pool.query(
    `SELECT user_id, session_id, phone, status, pairing_code, pairing_code_expires_at,
            last_heartbeat_at, pause_reason, disconnect_reason, reconnect_attempts,
            created_at, updated_at
     FROM whatsapp_connections
     WHERE user_id = $1`,
    [response.userId]
  );
  const connectivity = await pool.query(
    `SELECT event_type, error_code, error_message, details, created_at
     FROM connectivity_logs
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 25`,
    [response.userId]
  );
  const tasks = await pool.query(
    `SELECT id, task_type, status, attempts, max_attempts, locked_by, error_code, error_message, result, created_at, updated_at, completed_at
     FROM whatsapp_runtime_tasks
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [response.userId]
  );
  const errors = await pool.query(
    `SELECT level, category, message, context, created_at
     FROM error_logs
     WHERE category IN ('whatsapp', 'whatsapp-worker')
     ORDER BY created_at DESC
     LIMIT 15`
  );

  return {
    ...response,
    connection: maskPairingCode(connection.rows[0]),
    recentTasks: tasks.rows.map((row) => ({
      ...row,
      result: row.result && row.result.pairingCode ? { ...row.result, pairingCode: "***" } : row.result
    })),
    recentConnectivity: connectivity.rows.map(sanitizeConnectivityRow),
    recentErrors: errors.rows
  };
}

async function getChatDiagnostics(userId = "") {
  const safeUserId = Number.parseInt(String(userId || ""), 10);
  const resolvedUserId = Number.isFinite(safeUserId) && safeUserId > 0 ? safeUserId : null;
  const cache = await chatService.getChatCacheDiagnostics(resolvedUserId);
  const duplicates = await chatService.getDuplicateChatDiagnostics(resolvedUserId);
  const sync = await chatService.getChatSyncDiagnostics(resolvedUserId);
  return { ...cache, duplicates, sync };
}

async function getAiCostDiagnostics(options = {}) {
  if (!config.ai.costDiagnosticsEnabled) {
    return { enabled: false, rows: [] };
  }
  return {
    enabled: true,
    ...(await quotaService.getAiCostDiagnostics(options))
  };
}

async function purgeExpiredChatMessages(userId = "") {
  const safeUserId = Number.parseInt(String(userId || ""), 10);
  return chatService.purgeExpiredMessages(Number.isFinite(safeUserId) && safeUserId > 0 ? safeUserId : null);
}

module.exports = {
  getFlags,
  getStatus,
  healthExtended,
  getDbInfo,
  getSmtpInfo,
  getEmailDiagnostics,
  getWhatsappDiagnostics,
  getChatDiagnostics,
  getAiCostDiagnostics,
  purgeExpiredChatMessages,
  getClientContext
};
