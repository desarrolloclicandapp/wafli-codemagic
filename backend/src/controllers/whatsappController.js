const whatsappService = require("../services/whatsappService");
const whatsappTaskService = require("../services/whatsappTaskService");
const privacyService = require("../services/privacyService");
const { isApiOnly } = require("../services/runtimeModeService");
const { pool } = require("../config/db");
const { ok } = require("../utils/responses");

async function pairingCode(req, res) {
  if (isApiOnly()) {
    const task = await whatsappTaskService.enqueueWhatsappTask(req.user.id, "pairing_code", {
      phone: req.body.phone,
      customPairingCode: req.body.customPairingCode,
      forceNew: req.body.forceNew === true
    }, {
      priority: 10,
      maxAttempts: 1,
      dedupe: req.body.forceNew === true ? false : true,
      cancelExisting: req.body.forceNew === true
    });
    const status = await whatsappService.getStatus(req.user.id);
    return ok(res, { queued: true, task, status }, 202);
  }
  const status = await whatsappService.requestPairingCode(req.user.id, req.body.phone, {
    customPairingCode: req.body.customPairingCode,
    forceNew: req.body.forceNew === true
  });
  return ok(res, { status });
}

async function qr(req, res) {
  const forceNew = req.body?.forceNew === true;
  if (isApiOnly()) {
    const task = await whatsappTaskService.enqueueWhatsappTask(req.user.id, "qr", { forceNew }, {
      priority: 10,
      maxAttempts: 1,
      dedupe: forceNew ? false : true,
      cancelExisting: forceNew
    });
    const status = await whatsappService.getStatus(req.user.id);
    return ok(res, { queued: true, task, status }, 202);
  }
  const status = await whatsappService.requestQr(req.user.id, { forceNew });
  return ok(res, { status });
}

async function status(req, res) {
  return ok(res, { status: await whatsappService.getStatus(req.user.id), tasks: await whatsappTaskService.getRecentTasks(req.user.id, 5) });
}

async function reconnect(req, res) {
  if (isApiOnly()) {
    const task = await whatsappTaskService.enqueueWhatsappTask(req.user.id, "reconnect", {}, { priority: 8 });
    const status = await whatsappService.getStatus(req.user.id);
    return ok(res, { queued: true, task, status }, 202);
  }
  return ok(res, { status: await whatsappService.reconnect(req.user.id) });
}

async function disconnect(req, res) {
  if (isApiOnly()) {
    const purge = req.body.purge === true;
    const task = await whatsappTaskService.enqueueWhatsappTask(req.user.id, "disconnect", { purge }, { priority: 20, maxAttempts: 1 });
    if (purge) await privacyService.purgeWhatsappCache(req.user.id);
    await pool.query(
      `UPDATE whatsapp_connections
       SET status = 'disconnected',
           pairing_code = NULL,
           pairing_code_expires_at = NULL,
           qr = NULL,
           qr_updated_at = NULL,
           disconnect_reason = $2,
           updated_at = NOW()
       WHERE user_id = $1`,
      [req.user.id, purge ? "purge_requested" : "manual_disconnect_requested"]
    );
    const status = await whatsappService.getStatus(req.user.id);
    return ok(res, { queued: true, task, status }, 202);
  }
  return ok(res, { status: await whatsappService.disconnect(req.user.id, req.body.purge === true) });
}

module.exports = { pairingCode, qr, status, reconnect, disconnect };
