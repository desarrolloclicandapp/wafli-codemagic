import { request } from "./client.js";
import { trackEvent, setUserProperty } from "./analytics.js";

const pairingCode = (phone, customPairingCode, forceNew = false) => {
  trackEvent("whatsapp_pairing_requested", { method: "pairing_code", force_new: Boolean(forceNew) }).catch(() => {});
  return request("/whatsapp/pairing-code", { method: "POST", body: { phone, customPairingCode, forceNew } });
};
const qr = (forceNew = false) => {
  trackEvent("whatsapp_pairing_requested", { method: "qr", force_new: Boolean(forceNew) }).catch(() => {});
  return request("/whatsapp/qr", { method: "POST", body: { forceNew } });
};
const status = async () => {
  const result = await request("/whatsapp/status");
  const connected = Boolean(result?.connected || result?.ready || result?.status === "connected" || result?.status === "ready");
  setUserProperty("whatsapp_connected", connected ? "true" : "false").catch(() => {});
  if (connected) trackEvent("whatsapp_connected").catch(() => {});
  return result;
};
const reconnect = () => {
  trackEvent("whatsapp_reconnect_requested").catch(() => {});
  return request("/whatsapp/reconnect", { method: "POST" });
};
const disconnect = (purge = false) => {
  trackEvent("whatsapp_disconnect_requested", { purge: Boolean(purge) }).catch(() => {});
  return request("/whatsapp/disconnect", { method: "POST", body: { purge } });
};

export { pairingCode, qr, status, reconnect, disconnect };
