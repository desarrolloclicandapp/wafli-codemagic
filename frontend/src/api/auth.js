import { request, setSession, clearSession, getRefreshToken, refreshSession } from "./client.js";
import { trackEvent, setUser, resetUser } from "./analytics.js";

async function socialLogin(provider, payload = {}) {
  const result = await request("/auth/oauth/verify", {
    method: "POST",
    body: { provider, ...payload }
  });
  setSession(result);
  const user = result?.user || result?.account || {};
  await setUser(user?.id || user?.email || null, {
    auth_provider: provider || "social",
    auth_state: "authenticated",
  }).catch(() => {});
  trackEvent("login_success", { method: provider || "social" }).catch(() => {});
  return result;
}

async function refresh() {
  return refreshSession();
}

async function logout() {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) await request("/auth/logout", { method: "POST", body: { refreshToken } });
  } finally {
    trackEvent("logout").catch(() => {});
    resetUser().catch(() => {});
    clearSession();
  }
}

async function me() {
  return request("/auth/me");
}

export { socialLogin, refresh, logout, me };
