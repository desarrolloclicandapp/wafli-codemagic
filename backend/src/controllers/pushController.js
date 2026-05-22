const push = require("../services/pushService");
const { ok } = require("../utils/responses");


async function publicKey(_req, res) {
  return ok(res, { publicKey: push.publicKey() });
}
async function subscribe(req, res) {
  await push.subscribe(req.user.id, req.body.subscription || req.body, req.headers["user-agent"] || null);
  return ok(res);
}
async function subscribeNative(req, res) {
  await push.subscribeNative(req.user.id, req.body || {});
  return ok(res);
}
async function unsubscribe(req, res) {
  await push.unsubscribe(req.user.id, req.body.endpoint);
  return ok(res);
}
async function preferences(req, res) {
  return ok(res, { preferences: await push.getPreferences(req.user.id) });
}
async function updatePreferences(req, res) {
  return ok(res, { preferences: await push.updatePreferences(req.user.id, req.body) });
}
module.exports = { publicKey, subscribe, subscribeNative, unsubscribe, preferences, updatePreferences };
