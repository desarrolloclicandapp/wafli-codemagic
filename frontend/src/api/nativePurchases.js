import { LOG_LEVEL, PRODUCT_CATEGORY, Purchases } from "@revenuecat/purchases-capacitor";
import { APP_ENV, ApiClientError, IS_CAPACITOR_NATIVE, request } from "./client.js";
import { getProfile } from "./me.js";
import { setUserProperty, trackEvent } from "./analytics.js";

const REVENUECAT_ANDROID_API_KEY = import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY || "";
const REVENUECAT_IOS_API_KEY = import.meta.env.VITE_REVENUECAT_IOS_API_KEY || "";
const REVENUECAT_ENTITLEMENT_PLUS = import.meta.env.VITE_REVENUECAT_ENTITLEMENT_PLUS || "plus";
const REVENUECAT_OFFERING_ID = import.meta.env.VITE_REVENUECAT_OFFERING_ID || "";
const REVENUECAT_PLUS_PRODUCT_ID = import.meta.env.VITE_REVENUECAT_PLUS_PRODUCT_ID || "wafli_plus_monthly:monthly";
const REVENUECAT_PACK_50_PRODUCT_ID = import.meta.env.VITE_REVENUECAT_PACK_50_PRODUCT_ID || import.meta.env.VITE_PLAY_PACK_50_PRODUCT_ID || "wafli_pack_50";

let configuredAppUserId = "";
let configurePromise = null;

function getPlatform() {
  try {
    return window.Capacitor?.getPlatform?.() || "";
  } catch (_) {
    return "";
  }
}

function apiKeyForPlatform(platform = getPlatform()) {
  if (platform === "android") return REVENUECAT_ANDROID_API_KEY;
  if (platform === "ios") return REVENUECAT_IOS_API_KEY;
  return "";
}

function isNativePurchasePlatform() {
  const platform = getPlatform();
  return Boolean(IS_CAPACITOR_NATIVE && (platform === "android" || platform === "ios"));
}

function isConfiguredForPlatform() {
  return Boolean(isNativePurchasePlatform() && apiKeyForPlatform());
}

function capabilities() {
  const platform = getPlatform();
  return {
    nativePurchasePlatform: isNativePurchasePlatform(),
    nativePurchasesConfigured: Boolean(isNativePurchasePlatform() && apiKeyForPlatform(platform)),
    platform,
    provider: "revenuecat",
    entitlementPlus: REVENUECAT_ENTITLEMENT_PLUS,
    products: {
      plusMonthly: REVENUECAT_PLUS_PRODUCT_ID,
      pack50: REVENUECAT_PACK_50_PRODUCT_ID,
    },
  };
}

function appUserIdForProfile(profile = {}) {
  if (!profile?.id) throw new ApiClientError(400, "missing_user_profile", "No pudimos identificar tu cuenta para compras nativas.");
  return `wafli_${profile.id}`;
}

async function ensureConfigured() {
  if (!isNativePurchasePlatform()) {
    throw new ApiClientError(400, "native_payments_unavailable", "Las compras nativas solo estan disponibles en Android o iOS.");
  }

  const apiKey = apiKeyForPlatform();
  if (!apiKey) {
    throw new ApiClientError(400, "native_payments_not_configured", "Falta configurar las compras nativas para este entorno.");
  }

  const profile = await getProfile();
  const appUserID = appUserIdForProfile(profile);
  if (configuredAppUserId === appUserID) return { appUserID, profile };
  if (configurePromise) return configurePromise;

  configurePromise = (async () => {
    await Purchases.setLogLevel({ level: APP_ENV === "production" ? LOG_LEVEL.WARN : LOG_LEVEL.DEBUG }).catch(() => {});
    const configured = await Purchases.isConfigured().catch(() => ({ isConfigured: false }));
    if (!configured?.isConfigured) {
      await Purchases.configure({ apiKey, appUserID });
    } else {
      await Purchases.logIn({ appUserID }).catch(() => {});
    }
    configuredAppUserId = appUserID;
    if (profile.email) Purchases.setEmail({ email: profile.email }).catch(() => {});
    if (profile.phone) Purchases.setPhoneNumber({ phoneNumber: profile.phone }).catch(() => {});
    if (profile.alias) Purchases.setDisplayName({ displayName: profile.alias }).catch(() => {});
    return { appUserID, profile };
  })();

  try {
    return await configurePromise;
  } finally {
    configurePromise = null;
  }
}

function activeEntitlements(customerInfo = {}) {
  return Object.keys(customerInfo?.entitlements?.active || {});
}

function hasPlus(customerInfo = {}) {
  return Boolean(customerInfo?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_PLUS]);
}

async function syncCustomerInfo(customerInfo, source) {
  const { appUserID } = await Purchases.getAppUserID();
  const result = await request("/billing/native/sync", {
    method: "POST",
    body: {
      provider: "revenuecat",
      appUserId: appUserID,
      source,
      customerInfo,
    },
  });
  if (hasPlus(customerInfo)) setUserProperty("plan_name", "plus").catch(() => {});
  window.dispatchEvent(new CustomEvent("wafli:quota-refresh"));
  return result;
}

async function getCurrentOffering() {
  await ensureConfigured();
  const offerings = await Purchases.getOfferings();
  if (REVENUECAT_OFFERING_ID && offerings?.all?.[REVENUECAT_OFFERING_ID]) return offerings.all[REVENUECAT_OFFERING_ID];
  return offerings?.current || null;
}

function packageForProduct(offering, productId) {
  const packages = offering?.availablePackages || [];
  return packages.find((item) => item?.product?.identifier === productId) || null;
}

async function getStoreProduct(productId, category) {
  await ensureConfigured();
  const result = await Purchases.getProducts({
    productIdentifiers: [productId],
    type: category,
  });
  return result?.products?.[0] || null;
}

async function purchaseByProduct({ productId, category, source }) {
  await ensureConfigured();
  const canPay = await Purchases.canMakePayments().catch(() => ({ canMakePayments: true }));
  if (canPay?.canMakePayments === false) {
    throw new ApiClientError(400, "native_payments_unavailable", "Google Play o App Store no permiten compras en este dispositivo.");
  }

  try {
    const offering = await getCurrentOffering().catch(() => null);
    const pkg = packageForProduct(offering, productId);
    const product = pkg ? null : await getStoreProduct(productId, category);
    if (!pkg && !product) {
      throw new ApiClientError(400, "native_product_not_found", "El producto no esta activo en la tienda para esta version.");
    }
    const purchase = pkg
      ? await Purchases.purchasePackage({ aPackage: pkg })
      : await Purchases.purchaseStoreProduct({ product });

    const customerInfo = purchase?.customerInfo || {};
    const sync = await syncCustomerInfo(customerInfo, source);
    trackEvent("native_purchase_completed", {
      provider: "revenuecat",
      product_id: purchase?.productIdentifier || productId,
      source,
      has_plus: hasPlus(customerInfo),
      entitlement_count: activeEntitlements(customerInfo).length,
    }).catch(() => {});
    return {
      native: true,
      provider: "revenuecat",
      productIdentifier: purchase?.productIdentifier || productId,
      customerInfo,
      sync,
    };
  } catch (error) {
    if (error?.userCancelled) return { native: true, cancelled: true };
    if (error instanceof ApiClientError) throw error;
    throw new ApiClientError(400, error?.code || "native_purchase_failed", error?.message || "No pudimos completar la compra nativa.");
  }
}

async function purchasePlan(planName = "plus") {
  if (String(planName || "plus").toLowerCase() !== "plus") {
    throw new ApiClientError(400, "unsupported_plan", "Solo Plus esta disponible en este momento.");
  }
  trackEvent("native_purchase_started", { provider: "revenuecat", purchase_type: "plan", plan_name: "plus" }).catch(() => {});
  return purchaseByProduct({
    productId: REVENUECAT_PLUS_PRODUCT_ID,
    category: PRODUCT_CATEGORY.SUBSCRIPTION,
    source: "plan",
  });
}

async function purchasePack(packSize = 50) {
  if (Number(packSize || 0) !== 50) {
    throw new ApiClientError(400, "unsupported_pack", "Solo el pack de 50 generaciones esta disponible en este momento.");
  }
  trackEvent("native_purchase_started", { provider: "revenuecat", purchase_type: "pack", pack_size: 50 }).catch(() => {});
  return purchaseByProduct({
    productId: REVENUECAT_PACK_50_PRODUCT_ID,
    category: PRODUCT_CATEGORY.NON_SUBSCRIPTION,
    source: "pack",
  });
}

async function restorePurchases() {
  await ensureConfigured();
  const result = await Purchases.restorePurchases();
  const sync = await syncCustomerInfo(result?.customerInfo || {}, "restore");
  trackEvent("native_purchases_restored", {
    provider: "revenuecat",
    has_plus: hasPlus(result?.customerInfo || {}),
  }).catch(() => {});
  return { native: true, restored: true, customerInfo: result?.customerInfo || {}, sync };
}

export {
  capabilities,
  ensureConfigured,
  isConfiguredForPlatform,
  isNativePurchasePlatform,
  purchasePack,
  purchasePlan,
  restorePurchases,
};
