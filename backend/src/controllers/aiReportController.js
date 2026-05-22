const aiReportService = require("../services/aiReportService");
const { ok } = require("../utils/responses");

async function create(req, res) {
  return ok(res, await aiReportService.createReport(req.user.id, req.body || {}), 201);
}

module.exports = { create };
