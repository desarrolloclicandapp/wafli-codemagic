const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");
const APP_ENV = import.meta.env.VITE_APP_ENV || "local";
const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const GOOGLE_IOS_CLIENT_ID = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID || "";
const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID || "";
const APPLE_IOS_CLIENT_ID = import.meta.env.VITE_APPLE_IOS_CLIENT_ID || "com.wafli.app";
const APPLE_REDIRECT_URI = import.meta.env.VITE_APPLE_REDIRECT_URI || PUBLIC_URL || (typeof window !== "undefined" ? window.location.origin : "");
const ALLOW_PREVIEW_FALLBACK = import.meta.env.VITE_ALLOW_PREVIEW_FALLBACK === "true";
const FIREBASE_WEB_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
};
const IS_CAPACITOR_NATIVE = Boolean(
  typeof window !== "undefined" && (
    window.Capacitor?.isNativePlatform?.() ||
    ["android", "ios"].includes(window.Capacitor?.getPlatform?.()) ||
    window.location.protocol === "capacitor:"
  )
);
const TOKEN_KEY = "wafli:accessToken";
const REFRESH_KEY = "wafli:refreshToken";
const REFRESH_COOLDOWN_KEY = "wafli:refreshCooldownUntil";
let refreshPromise = null;

class ApiClientError extends Error {
  constructor(status, code, message, details) {
    super(message || code || "Error de API");
    this.name = "ApiClientError";
    this.status = status;
    this.code = code || "api_error";
    this.details = details;
  }
}

function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY) || "";
}

function setSession(session = {}) {
  if (session.accessToken) localStorage.setItem(TOKEN_KEY, session.accessToken);
  if (session.refreshToken) localStorage.setItem(REFRESH_KEY, session.refreshToken);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("wafli:session-updated"));
}

function clearSession() {
  const hadSession = Boolean(localStorage.getItem(TOKEN_KEY) || localStorage.getItem(REFRESH_KEY));
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(REFRESH_COOLDOWN_KEY);
  if (hadSession && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("wafli:session-cleared"));
}

function getRefreshCooldownUntil() {
  return Number(localStorage.getItem(REFRESH_COOLDOWN_KEY) || 0);
}

function setRefreshCooldown(ms) {
  const until = Date.now() + Number(ms || 0);
  localStorage.setItem(REFRESH_COOLDOWN_KEY, String(until));
  return until;
}

async function refreshSession() {
  const cooldownUntil = getRefreshCooldownUntil();
  if (cooldownUntil > Date.now()) {
    throw new ApiClientError(429, "refresh_rate_limited", "Estamos renovando tu sesión. Espera unos segundos y vuelve a intentarlo.");
  }

  if (refreshPromise) return refreshPromise;

  const token = getRefreshToken();
  if (!token) {
    throw new ApiClientError(400, "missing_refresh", "No hay una sesión para renovar.");
  }

  refreshPromise = (async () => {
    try {
      const refreshed = await request("/auth/refresh", { method: "POST", body: { refreshToken: token } }, false);
      if (refreshed.accessToken) setSession(refreshed);
      localStorage.removeItem(REFRESH_COOLDOWN_KEY);
      return refreshed;
    } catch (error) {
      if (error?.status === 429) setRefreshCooldown(60 * 1000);
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function parseResponse(response) {
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { message: text };
    }
  }
  if (!response.ok || data.success === false) {
    const error = new ApiClientError(response.status, data.error, data.message || response.statusText, data.details);
    if (response.status === 403 && error.code === "whatsapp_required" && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wafli:whatsapp-required", { detail: { path: response.url } }));
    }
    throw error;
  }
  return data;
}

async function apiFetch(path, options = {}, retry = true) {
  const headers = new Headers(options.headers || {});
  const fetchOptions = {
    ...options,
    headers,
    credentials: "include"
  };
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAccessToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...fetchOptions });
    if (response.status === 401 && retry && getRefreshToken()) {
      try {
        await refreshSession();
        return apiFetch(path, options, false);
      } catch (refreshError) {
        if (refreshError?.status !== 429) clearSession();
        throw refreshError;
      }
    }
    if (response.status === 401) clearSession();
    return parseResponse(response);
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    throw new ApiClientError(0, "network_error", "No hemos podido conectar con el servidor. Revisa tu conexión.");
  }
}

async function request(path, options = {}, retry = true) {
  const body = options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body;
  return apiFetch(path, { ...options, body }, retry);
}

function toUserMessage(error) {
  if (!error) return "No hemos podido completar la acción.";
  if (error.code === "quota_exhausted") return "No quedan mensajes IA disponibles.";
  if (error.code === "native_payments_not_configured") return "Falta configurar pagos nativos para esta versión de la app.";
  if (error.code === "native_payments_server_not_configured") return "Falta configurar la verificación de pagos en el servidor.";
  if (error.code === "native_product_not_configured") return "Ese producto todavía no está configurado en la tienda de esta versión.";
  if (error.code === "native_product_not_found") return "Ese producto todavía no está activo para esta versión de la app.";
  if (error.code === "native_purchase_failed") return "No hemos podido completar la compra nativa.";
  if (error.code === "whatsapp_required") return "Puedes usar WaFli AI sin conectar WhatsApp. Conecta WhatsApp solo si quieres traer tus chats reales.";
  if (error.code === "account_pending_deletion") return "Esta cuenta tiene una eliminacion pendiente.";
  if (error.code === "whatsapp_phone_already_registered") return "Este número de WhatsApp ya está asociado a otra cuenta. Inicia sesión con el correo original o usa otro número.";
  if (error.code === "network_error") return error.message;
  if (String(error.code || "").includes("oauth")) return error.message || "No pudimos validar este inicio de sesión.";
  if (error.status === 401) return "Tu sesión expiró. Vuelve a iniciar sesión.";
  if (error.status === 409) return error.message || "La conexión no está lista todavía.";
  if (error.status === 429) return "Demasiados intentos. Prueba de nuevo en unos minutos.";
  if (error.status === 503) return error.message || "Servicio temporalmente no disponible. Inténtalo de nuevo en un momento.";
  return error.message || "No hemos podido completar la acción.";
}

function isAuthenticated() {
  return Boolean(getAccessToken() || getRefreshToken());
}

export {
  API_BASE_URL,
  APP_ENV,
  PUBLIC_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  APPLE_CLIENT_ID,
  APPLE_IOS_CLIENT_ID,
  APPLE_REDIRECT_URI,
  ALLOW_PREVIEW_FALLBACK,
  FIREBASE_WEB_CONFIG,
  IS_CAPACITOR_NATIVE,
  ApiClientError,
  request,
  getAccessToken,
  getRefreshToken,
  setSession,
  refreshSession,
  clearSession,
  toUserMessage,
  isAuthenticated
};

