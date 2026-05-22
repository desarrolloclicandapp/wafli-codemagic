const profileService = require("../services/profileService");
const { ok } = require("../utils/responses");
const { getRequestIp } = require("../utils/normalize");

async function onboardingStatus(req, res) {
  return ok(res, await profileService.getOnboardingStatus(req.user.id));
}

async function acceptLegal(req, res) {
  await profileService.acceptLegal(req.user.id, req.body, { ipAddress: getRequestIp(req), userAgent: req.headers["user-agent"] || null });
  return ok(res, await profileService.getOnboardingStatus(req.user.id));
}

async function updateProfile(req, res) {
  return ok(res, { profile: await profileService.updateProfile(req.user.id, req.body) });
}

async function getProfile(req, res) {
  return ok(res, { profile: await profileService.getProfile(req.user.id) });
}

module.exports = { onboardingStatus, acceptLegal, updateProfile, getProfile };
