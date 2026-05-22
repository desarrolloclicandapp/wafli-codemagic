import { FirebaseAnalytics } from "@capacitor-firebase/analytics";
import { initializeApp, getApps } from "firebase/app";
import { getAnalytics, isSupported, logEvent, setUserId as setWebUserId, setUserProperties } from "firebase/analytics";
import { FIREBASE_WEB_CONFIG, IS_CAPACITOR_NATIVE, APP_ENV } from "./client.js";

let initialized = false;
let webAnalytics = null;
let nativeReady = false;
let webReady = false;

const EVENT_NAME_RE = /[^a-zA-Z0-9_]/g;

function normalizeName(name = "event") {
  const value = String(name || "event").replace(EVENT_NAME_RE, "_").slice(0, 40);
  return /^[a-zA-Z]/.test(value) ? value : `wafli_${value}`.slice(0, 40);
}

function cleanParams(params = {}) {
  return Object.entries(params || {}).reduce((acc, [key, value]) => {
    if (value === undefined || typeof value === "function") return acc;
    const cleanKey = normalizeName(key);
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      acc[cleanKey] = value;
    } else {
      acc[cleanKey] = JSON.stringify(value).slice(0, 100);
    }
    return acc;
  }, {});
}

function hasWebConfig() {
  return Boolean(
    FIREBASE_WEB_CONFIG.apiKey &&
    FIREBASE_WEB_CONFIG.projectId &&
    FIREBASE_WEB_CONFIG.appId &&
    FIREBASE_WEB_CONFIG.measurementId
  );
}

async function initializeAnalytics() {
  if (initialized) return { nativeReady, webReady };
  initialized = true;

  if (IS_CAPACITOR_NATIVE) {
    try {
      await FirebaseAnalytics.setEnabled({ enabled: true });
      nativeReady = true;
      await FirebaseAnalytics.logEvent({
        name: "app_open",
        params: { app_env: APP_ENV, platform: window.Capacitor?.getPlatform?.() || "native" },
      });
    } catch (_) {
      nativeReady = false;
    }
    return { nativeReady, webReady };
  }

  if (!hasWebConfig()) return { nativeReady, webReady };

  try {
    if (!(await isSupported())) return { nativeReady, webReady };
    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_WEB_CONFIG);
    webAnalytics = getAnalytics(app);
    webReady = true;
  } catch (_) {
    webReady = false;
  }

  return { nativeReady, webReady };
}

async function trackEvent(name, params = {}) {
  const eventName = normalizeName(name);
  const eventParams = cleanParams({ app_env: APP_ENV, ...params });
  await initializeAnalytics();

  if (nativeReady) {
    await FirebaseAnalytics.logEvent({ name: eventName, params: eventParams }).catch(() => {});
    return;
  }

  if (webReady && webAnalytics) {
    logEvent(webAnalytics, eventName, eventParams);
  }
}

async function trackScreen(screenName, params = {}) {
  const screen = normalizeName(screenName || "unknown_screen");
  await initializeAnalytics();

  if (nativeReady) {
    await FirebaseAnalytics.setCurrentScreen({
      screenName: screen,
      screenClassOverride: "WaFliScreen",
    }).catch(() => {});
    await FirebaseAnalytics.logEvent({
      name: "screen_view",
      params: cleanParams({ screen_name: screen, screen_class: "WaFliScreen", ...params }),
    }).catch(() => {});
    return;
  }

  if (webReady && webAnalytics) {
    logEvent(webAnalytics, "screen_view", cleanParams({
      screen_name: screen,
      screen_class: "WaFliScreen",
      ...params,
    }));
  }
}

async function setUser(userId, properties = {}) {
  const shouldSetUserId = userId !== undefined;
  const id = userId ? String(userId) : null;
  await initializeAnalytics();

  if (nativeReady) {
    if (shouldSetUserId) await FirebaseAnalytics.setUserId({ userId: id }).catch(() => {});
    await Promise.all(Object.entries(cleanParams(properties)).map(([key, value]) => (
      FirebaseAnalytics.setUserProperty({ key, value: value == null ? null : String(value) }).catch(() => {})
    )));
    return;
  }

  if (webReady && webAnalytics) {
    if (shouldSetUserId) setWebUserId(webAnalytics, id);
    if (properties && Object.keys(properties).length) setUserProperties(webAnalytics, cleanParams(properties));
  }
}

async function setUserProperty(key, value) {
  await setUser(undefined, { [key]: value });
}

async function resetUser() {
  await setUser(null);
}

export {
  initializeAnalytics,
  trackEvent,
  trackScreen,
  setUser,
  setUserProperty,
  resetUser,
};
