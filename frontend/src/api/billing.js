import { ApiClientError, IS_CAPACITOR_NATIVE, request } from "./client.js";
import { trackEvent, setUserProperty } from "./analytics.js";
import * as nativePurchases from "./nativePurchases.js";

const ANDROID_BILLING_MODE = String(import.meta.env.VITE_ANDROID_BILLING_MODE || "disabled").toLowerCase();
const PLAY_BILLING_ENABLED = String(import.meta.env.VITE_PLAY_BILLING_ENABLED || "false").toLowerCase() === "true";
const PLAY_PLUS_PRODUCT_ID = import.meta.env.VITE_PLAY_PLUS_PRODUCT_ID || "wafli_plus_monthly";
const PLAY_PACK_50_PRODUCT_ID = import.meta.env.VITE_PLAY_PACK_50_PRODUCT_ID || "wafli_pack_50";

function getNativePlatform() {
  try {
    return window.Capacitor?.getPlatform?.() || "";
  } catch (_) {
    return "";
  }
}

function isAndroidNative() {
  return Boolean(IS_CAPACITOR_NATIVE && getNativePlatform() === "android");
}

function isPlayBillingReady() {
  return Boolean(isAndroidNative() && (nativePurchases.isConfiguredForPlatform() || (PLAY_BILLING_ENABLED && ANDROID_BILLING_MODE === "play")));
}

function isExternalCheckoutAllowed() {
  return !nativePurchases.isNativePurchasePlatform() || ANDROID_BILLING_MODE === "web-debug";
}

function assertCheckoutAllowed() {
  if (nativePurchases.isConfiguredForPlatform() || isExternalCheckoutAllowed()) return;
  throw new ApiClientError(
    400,
    "native_payments_not_configured",
    "Las compras dentro de la app deben usar pagos nativos. Falta configurar RevenueCat para este entorno."
  );
}

function capabilities() {
  return {
    androidNative: isAndroidNative(),
    playBillingReady: isPlayBillingReady(),
    externalCheckoutAllowed: isExternalCheckoutAllowed(),
    androidBillingMode: ANDROID_BILLING_MODE,
    nativePurchases: nativePurchases.capabilities(),
    products: {
      plusMonthly: PLAY_PLUS_PRODUCT_ID,
      pack50: PLAY_PACK_50_PRODUCT_ID,
    },
  };
}

const plan = async () => {
  const result = await request("/billing/plan");
  const planName = result?.plan?.name || result?.plan_name || result?.balance?.plan_name || "";
  if (planName) setUserProperty("plan_name", planName).catch(() => {});
  return result;
};
const usage = () => request("/billing/usage");
const checkoutPlan = async (planName) => {
  assertCheckoutAllowed();
  if (nativePurchases.isNativePurchasePlatform()) return nativePurchases.purchasePlan(planName);
  trackEvent("checkout_started", { checkout_type: "plan", plan_name: planName || "" }).catch(() => {});
  return request("/billing/checkout/plan", { method: "POST", body: { plan: planName } });
};
const checkoutPack = async (packSize) => {
  assertCheckoutAllowed();
  if (nativePurchases.isNativePurchasePlatform()) return nativePurchases.purchasePack(packSize);
  trackEvent("checkout_started", { checkout_type: "pack", pack_size: Number(packSize || 0) }).catch(() => {});
  return request("/billing/checkout/pack", { method: "POST", body: { packSize } });
};
const customerPortal = async () => {
  if (nativePurchases.isNativePurchasePlatform()) return nativePurchases.restorePurchases();
  trackEvent("customer_portal_opened").catch(() => {});
  return request("/billing/customer-portal", { method: "POST" });
};
const playProducts = () => request("/billing/play/products");
const submitPlayPurchase = (purchase) => request("/billing/play/purchase", { method: "POST", body: purchase });

export {
  capabilities,
  checkoutPack,
  checkoutPlan,
  customerPortal,
  isAndroidNative,
  isExternalCheckoutAllowed,
  isPlayBillingReady,
  plan,
  playProducts,
  submitPlayPurchase,
  usage,
};
