const adminService = require("../services/adminService");
const { ok } = require("../utils/responses");

async function login(req, res) {
  return ok(res, await adminService.login(req.body?.username, req.body?.password));
}

async function users(req, res) {
  return ok(res, await adminService.listUsers(req.query || {}));
}

async function aiReports(req, res) {
  return ok(res, await adminService.listAiReports(req.query || {}));
}

async function aiQuality(req, res) {
  return ok(res, await adminService.aiQuality(req.query || {}));
}

async function updateAiReport(req, res) {
  return ok(res, await adminService.updateAiReportStatus(req.params.id, req.body?.status, {
    ...req.admin,
    ...adminService.adminMeta(req),
  }));
}

async function extendTrial(req, res) {
  return ok(res, await adminService.extendTrial(req.params.id, req.body?.days, {
    ...req.admin,
    ...adminService.adminMeta(req),
  }));
}

async function addGenerations(req, res) {
  return ok(res, await adminService.addGenerations(req.params.id, req.body?.amount, {
    ...req.admin,
    ...adminService.adminMeta(req),
  }));
}

async function suspendUser(req, res) {
  return ok(res, await adminService.suspendUser(req.params.id, req.body?.days, req.body?.reason, {
    ...req.admin,
    ...adminService.adminMeta(req),
  }));
}

async function deleteUser(req, res) {
  return ok(res, await adminService.deleteUser(req.params.id, req.body?.confirmation, {
    ...req.admin,
    ...adminService.adminMeta(req),
  }));
}

module.exports = { addGenerations, aiQuality, aiReports, deleteUser, extendTrial, login, suspendUser, updateAiReport, users };
