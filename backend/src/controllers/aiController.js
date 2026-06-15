const aiService = require("../services/aiService");
const aiFeedbackService = require("../services/aiFeedbackService");
const { ok } = require("../utils/responses");

const run = (action) => async (req, res) => ok(res, await aiService.generate(req.user.id, action, req.body));

module.exports = {
  suggest: run("suggest"),
  rewrite: run("rewrite"),
  analyze: run("analyze"),
  opener: run("opener"),
  reactivate: run("reactivate"),
  regenerate: async (req, res) => ok(res, await aiService.generate(req.user.id, req.body.action || "suggest", req.body)),
  toolReply: async (req, res) => ok(res, await aiService.generateToolReply(req.user.id, req.body)),
  toolIcebreakers: async (req, res) => ok(res, await aiService.generateToolIcebreakers(req.user.id, req.body)),
  listSavedLines: async (req, res) => ok(res, await aiService.listSavedLines(req.user.id, req.query)),
  saveLine: async (req, res) => ok(res, await aiService.saveLine(req.user.id, req.body)),
  deleteLine: async (req, res) => ok(res, await aiService.deleteLine(req.user.id, req.params.id)),
  recordFeedback: async (req, res) => ok(res, await aiFeedbackService.recordFeedback(req.user.id, req.body), 201),
  feedbackSummary: async (req, res) => ok(res, await aiFeedbackService.feedbackSummary(req.user.id, req.query))
};
