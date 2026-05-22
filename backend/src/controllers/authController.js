const {
  socialLogin: doSocialLogin,
  refresh: doRefresh,
  logout: doLogout,
  setRefreshCookie,
  clearRefreshCookie
} = require("../services/authService");
const { ok } = require("../utils/responses");

async function socialLogin(req, res) {
  const result = await doSocialLogin(req);
  setRefreshCookie(res, result.refreshToken, result.expiresAt);
  return ok(res, {
    user: result.user,
    firstTime: result.firstTime,
    recovered: result.recovered,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    refreshExpiresAt: result.expiresAt
  });
}

async function refresh(req, res) {
  const result = await doRefresh(req);
  setRefreshCookie(res, result.refreshToken, result.expiresAt);
  return ok(res, result);
}

async function logout(req, res) {
  await doLogout(req);
  clearRefreshCookie(res);
  return ok(res);
}

async function me(req, res) {
  return ok(res, { user: req.user });
}

module.exports = { socialLogin, refresh, logout, me };
