import { API_BASE_URL, getAccessToken } from "./client.js";

let installed = false;
let lastSentAt = 0;

function compactStack(stack = "") {
  return String(stack || "").slice(0, 8000);
}

function errorPayload(source, error, extra = {}) {
  const value = error?.reason || error?.error || error;
  const message = value?.message || error?.message || String(value || "Client error");
  return {
    source,
    level: "error",
    message: String(message).slice(0, 1000),
    stack: compactStack(value?.stack || error?.stack),
    url: window.location.href,
    route: window.location.pathname + window.location.search,
    userAgent: navigator.userAgent,
    appVersión: import.meta.env.VITE_APP_ENV || "",
    extra
  };
}

function reportClientError(source, error, extra = {}) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastSentAt < 1500) return;
  lastSentAt = now;

  const token = getAccessToken();
  const body = JSON.stringify(errorPayload(source, error, extra));
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(`${API_BASE_URL}/system/client-error`, blob)) return;
  }

  fetch(`${API_BASE_URL}/system/client-error`, {
    method: "POST",
    headers,
    body,
    keepalive: true,
    credentials: "include"
  }).catch(() => {});
}

function installClientMonitoring() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    reportClientError("window.error", event.error || event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportClientError("window.unhandledrejection", event.reason);
  });
}

export { installClientMonitoring, reportClientError };
