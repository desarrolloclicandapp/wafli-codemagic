const quotaService = require("../services/quotaService");
const privacyService = require("../services/privacyService");
const { cleanupErrorLogs } = require("../services/loggerService");
const { pool } = require("../config/db");
const { startWhatsAppWorker, stopWhatsAppWorker } = require("../services/whatsappWorkerService");

let timers = [];

function startJobs() {
  startWhatsAppWorker();
  timers.push(setInterval(() => quotaService.resetDueBalances().catch(() => {}), 60 * 1000));
  timers.push(setInterval(() => privacyService.purgeDueAccounts().catch(() => {}), 60 * 60 * 1000));
  timers.push(setInterval(() => cleanupErrorLogs(15).catch(() => {}), 6 * 60 * 60 * 1000));
  timers.push(setInterval(() => pool.query(`DELETE FROM message_cache WHERE expires_at < NOW()`).catch(() => {}), 60 * 60 * 1000));
}

function stopJobs() {
  stopWhatsAppWorker();
  timers.forEach(clearInterval);
  timers = [];
}

module.exports = { startJobs, stopJobs };
