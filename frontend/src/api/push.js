import { request } from "./client.js";
import { trackEvent, setUserProperty } from "./analytics.js";

let cachedPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";
const publicKey = async () => {
  if (cachedPublicKey) return cachedPublicKey;
  const result = await request("/push/public-key").catch(() => ({}));
  cachedPublicKey = result.publicKey || "";
  return cachedPublicKey;
};
const subscribe = async (subscription) => {
  const result = await request("/push/subscribe", { method: "POST", body: { subscription } });
  setUserProperty("notification_enabled", "true").catch(() => {});
  trackEvent("notification_permission_granted", { platform: "web" }).catch(() => {});
  return result;
};
const subscribeNative = async (payload) => {
  const result = await request("/push/native-token", { method: "POST", body: payload });
  setUserProperty("notification_enabled", "true").catch(() => {});
  trackEvent("notification_permission_granted", { platform: payload?.platform || "native" }).catch(() => {});
  return result;
};
const unsubscribe = async (endpoint) => {
  const result = await request("/push/unsubscribe", { method: "POST", body: { endpoint } });
  setUserProperty("notification_enabled", "false").catch(() => {});
  trackEvent("notification_disabled").catch(() => {});
  return result;
};
const preferences = () => request("/notifications/preferences");
const updatePreferences = async (payload) => {
  const result = await request("/notifications/preferences", { method: "PATCH", body: payload });
  if (Object.prototype.hasOwnProperty.call(payload || {}, "global_enabled")) {
    const enabled = Boolean(payload.global_enabled);
    setUserProperty("notification_enabled", enabled ? "true" : "false").catch(() => {});
    trackEvent(enabled ? "notification_enabled" : "notification_disabled").catch(() => {});
  }
  return result;
};

export { publicKey, subscribe, subscribeNative, unsubscribe, preferences, updatePreferences };
