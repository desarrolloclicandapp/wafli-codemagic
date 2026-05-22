const privacy = require("../services/privacyService");
const whatsappTaskService = require("../services/whatsappTaskService");
const { isApiOnly } = require("../services/runtimeModeService");
const { ok } = require("../utils/responses");

async function exportData(req, res) { return ok(res, { data: await privacy.exportData(req.user.id) }); }
async function deleteHistory(req, res) { await privacy.deleteHistory(req.user.id); return ok(res); }
async function requestDelete(req, res) {
  if (isApiOnly()) {
    await whatsappTaskService.enqueueWhatsappTask(req.user.id, "disconnect", { purge: true }, { priority: 30, maxAttempts: 1, dedupe: false });
  }
  await privacy.requestDelete(req.user.id);
  return ok(res);
}
async function cancelDelete(req, res) { await privacy.cancelDelete(req.user.id); return ok(res); }
module.exports = { exportData, deleteHistory, requestDelete, cancelDelete };
