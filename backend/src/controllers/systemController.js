const system = require("../services/systemService");
const { config } = require("../config/env");
const { logger } = require("../services/loggerService");
const { ok } = require("../utils/responses");

async function health(_req, res) { return ok(res, { status: "ok" }); }
async function extended(_req, res) { return ok(res, await system.healthExtended()); }
async function status(_req, res) { return ok(res, await system.getStatus()); }
async function flags(_req, res) { return ok(res, { flags: await system.getFlags() }); }
async function dbInfo(_req, res) { return ok(res, { db: await system.getDbInfo() }); }
async function smtpInfo(_req, res) { return ok(res, { smtp: await system.getSmtpInfo() }); }
async function emailDiagnostics(req, res) { return ok(res, { email: await system.getEmailDiagnostics(req.query.email) }); }
async function whatsappDiagnostics(req, res) { return ok(res, { whatsapp: await system.getWhatsappDiagnostics(req.query.userId) }); }
async function chatDiagnostics(req, res) { return ok(res, { chat: await system.getChatDiagnostics(req.user.id) }); }
async function aiCostDiagnostics(req, res) { return ok(res, { aiCost: await system.getAiCostDiagnostics(req.query) }); }
async function purgeExpiredChatMessages(req, res) { return ok(res, { chat: await system.purgeExpiredChatMessages(req.user.id) }); }
async function clientContext(req, res) { return ok(res, { client: await system.getClientContext(req) }); }
async function clientError(req, res) {
  if (!config.monitoring.clientEnabled) return ok(res, { stored: false });
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const message = String(body.message || body.reason || "Client error").slice(0, 1000);
  const stack = body.stack ? String(body.stack).slice(0, 8000) : null;
  const context = {
    userId: req.user?.id || null,
    requestId: req.requestId,
    url: String(body.url || "").slice(0, 1000),
    route: String(body.route || "").slice(0, 300),
    source: String(body.source || "frontend").slice(0, 80),
    level: String(body.level || "error").slice(0, 20),
    userAgent: String(req.headers["user-agent"] || body.userAgent || "").slice(0, 500),
    appVersion: String(body.appVersion || "").slice(0, 120),
    extra: body.extra && typeof body.extra === "object" ? body.extra : null
  };
  await logger.error("client-error", message, { stack, context });
  return ok(res, { stored: true });
}

module.exports = {
  health,
  extended,
  status,
  flags,
  dbInfo,
  smtpInfo,
  emailDiagnostics,
  whatsappDiagnostics,
  chatDiagnostics,
  aiCostDiagnostics,
  purgeExpiredChatMessages,
  clientContext,
  clientError
};
