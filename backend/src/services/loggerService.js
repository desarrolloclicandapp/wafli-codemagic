const { pool } = require("../config/db");
const monitoringService = require("./monitoringService");

const levels = new Set(["debug", "info", "warn", "error"]);

function normalizeLevel(level) {
  const safe = String(level || "error").toLowerCase();
  return levels.has(safe) ? safe : "error";
}

function safeJson(value) {
  if (!value) return {};
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return { raw: String(value) };
  }
}

async function log(level, category, message, options = {}) {
  const safeLevel = normalizeLevel(level);
  const safeCategory = String(category || "system").slice(0, 50);
  const safeMessage = message instanceof Error ? message.message : String(message || "");
  const safeStack = options.stack ? String(options.stack).slice(0, 30000) : null;
  const context = safeJson(options.context);

  const line = `[${safeCategory}] ${safeMessage}`;
  if (safeLevel === "error") console.error(line, safeStack || "");
  else if (safeLevel === "warn") console.warn(line);
  else if (safeLevel === "info") console.info(line);
  else console.debug(line);

  try {
    await pool.query(
      `INSERT INTO error_logs (level, category, message, stack, context)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [safeLevel, safeCategory, safeMessage.slice(0, 10000), safeStack, JSON.stringify(context)]
    );
  } catch (_) {
    // DB logging is best-effort. Never fail the request because observability failed.
  }

  if (safeLevel === "warn" || safeLevel === "error") {
    monitoringService.sendAlert({
      level: safeLevel,
      category: safeCategory,
      message: safeMessage.slice(0, 1000),
      stack: safeStack ? safeStack.slice(0, 4000) : null,
      context
    }).catch(() => {});
  }
}

async function cleanupErrorLogs(days = 15) {
  const safeDays = Math.max(1, Math.min(Number(days) || 15, 365));
  const result = await pool.query(
    `DELETE FROM error_logs WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')`,
    [safeDays]
  );
  return result.rowCount || 0;
}

const logger = {
  debug: (category, message, options) => log("debug", category, message, options),
  info: (category, message, options) => log("info", category, message, options),
  warn: (category, message, options) => log("warn", category, message, options),
  error: (category, message, options) => log("error", category, message, options)
};

module.exports = { logger, cleanupErrorLogs };
