const aiService = require("../services/aiService");
const { ok } = require("../utils/responses");

const run = (action) => async (req, res) => ok(res, await aiService.generate(req.user.id, action, req.body));

module.exports = {
  suggest: run("suggest"),
  rewrite: run("rewrite"),
  analyze: run("analyze"),
  opener: run("opener"),
  reactivate: run("reactivate"),
  regenerate: async (req, res) => ok(res, await aiService.generate(req.user.id, req.body.action || "suggest", req.body))
};
