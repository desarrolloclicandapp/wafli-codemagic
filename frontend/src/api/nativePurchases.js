import { LOG_LEVEL, PRODUCT_CATEGORY, Purchases } from "@revenuecat/purchases-capacitor";
import { APP_ENV, ApiClientError, IS_CAPACITOR_NATIVE, request } from "./client.js";
import { getProfile } from "./me.js";
import { setUserProperty, trackEvent } from "./analytics.js";

const REVENUECAT_ANDROID_API_KEY = import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY || "";
const REVENUECAT_IOS_API_KEY = import.meta.env.VITE_REVENUECAT_IOS_API_KEY || "";
const REVENUECAT_ENTITLEMENT_PLUS = import.meta.env.VITE_REVENUECAT_ENTITLEMENT_PLUS || "plus";
const REVENUECAT_ENTITLEMENT_PRO = import.meta.env.VITE_REVENUECAT_ENTITLEMENT_PRO || "pro";
const REVENUECAT_OFFERING_ID = import.meta.env.VITE_REVENUECAT_OFFERING_ID || "";
const REVENUECAT_PLUS_PRODUCT_ID = import.meta.env.VITE_REVENUECAT_PLUS_PRODUCT_ID || "wafli_plus_monthly:monthly";
const REVENUECAT_PRO_PRODUCT_ID = import.meta.env.VITE_REVENUECAT_PRO_PRODUCT_ID || "wafli_pro_monthly:monthly";
const REVENUECAT_PACK_50_PRODUCT_ID = import.meta.env.VITE_REVENUECAT_PACK_50_PRODUCT_ID || "wafli_pack_50";

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
      proMonthly: REVENUECAT_PRO_PRODUCT_ID,
      pack50: REVENUECAT_PACK_50_PRODUCT_ID,
    },
  };
}

function appUserIdForProfile(profile = {}) {
  if (!profile?.id) throw new ApiClientError(400, "missing_user_profile", "No hemos podido identificar tu cuenta para compras nativas.");
  return `wafli_${profile.id}`;
}

async function ensureConfigured() {
  if (!isNativePurchasePlatform()) {
    throw new ApiClientError(400, "native_payments_unavailable", "Las compras nativas solo están disponibles en Android o iOS.");
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

function hasPro(customerInfo = {}) {
  return Boolean(customerInfo?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_PRO]);
}

function unwrapCustomerInfo(result = {}) {
  return result?.customerInfo || result || {};
}

function storeProductIdForPlatform(productId) {
  const value = String(productId || "").trim();
  if (getPlatform() === "ios" && value.includes(":")) return value.split(":")[0];
  return value;
}

function managementFallbackUrl() {
  const platform = getPlatform();
  if (platform === "ios") return "https://apps.apple.com/account/subscriptions";
  if (platform === "android") return "https://play.google.com/store/account/subscriptions";
  return "";
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
  if (hasPro(customerInfo)) setUserProperty("plan_name", "pro").catch(() => {});
  else if (hasPlus(customerInfo)) setUserProperty("plan_name", "plus").catch(() => {});
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
  const expected = String(productId || "").trim();
  if (!expected) return null;
  const expectedSubscription = expected.split(":")[0];
  return packages.find((item) => {
    const identifiers = [
      item?.product?.identifier,
      item?.product?.defaultOption?.storeProductId,
      item?.product?.defaultOption?.productId,
    ].filter(Boolean).map(String);
    return identifiers.some((identifier) => {
      if (identifier === expected) return true;
      return expected.includes(":") && identifier === expectedSubscription;
    });
  }) || null;
}

function publicProductInfo(pkg = null) {
  const product = pkg?.product || {};
  return {
    available: Boolean(pkg && product?.identifier),
    packageIdentifier: pkg?.identifier || "",
    productIdentifier: product?.identifier || "",
    price: product?.priceString || "",
    pricePerMonth: product?.pricePerMonthString || "",
    title: product?.title || "",
    description: product?.description || "",
  };
}

async function purchaseOptions() {
  if (!isConfiguredForPlatform()) {
    return {
      native: isNativePurchasePlatform(),
      configured: false,
      plus: { available: false, price: "", productIdentifier: REVENUECAT_PLUS_PRODUCT_ID },
      pro: { available: false, price: "", productIdentifier: REVENUECAT_PRO_PRODUCT_ID },
      pack50: { available: false, price: "", productIdentifier: REVENUECAT_PACK_50_PRODUCT_ID },
    };
  }
  const offering = await getCurrentOffering();
  return {
    native: true,
    configured: true,
    offeringIdentifier: offering?.identifier || "",
    plus: publicProductInfo(packageForProduct(offering, REVENUECAT_PLUS_PRODUCT_ID)),
    pro: publicProductInfo(packageForProduct(offering, REVENUECAT_PRO_PRODUCT_ID)),
    pack50: REVENUECAT_PACK_50_PRODUCT_ID
      ? publicProductInfo(packageForProduct(offering, REVENUECAT_PACK_50_PRODUCT_ID))
      : { available: false, price: "", productIdentifier: "" },
  };
}

async function getStoreProduct(productId, category) {
  await ensureConfigured();
  const storeProductId = storeProductIdForPlatform(productId);
  const result = await Purchases.getProducts({
    productIdentifiers: [storeProductId],
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
      throw new ApiClientError(400, "native_product_not_found", "El producto no está activo en la tienda para esta versión.");
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
      has_pro: hasPro(customerInfo),
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
    throw new ApiClientError(400, error?.code || "native_purchase_failed", error?.message || "No hemos podido completar la compra nativa.");
  }
}

async function purchasePlan(planName = "plus") {
  const safePlan = String(planName || "plus").toLowerCase();
  const productId = safePlan === "pro" ? REVENUECAT_PRO_PRODUCT_ID : safePlan === "plus" ? REVENUECAT_PLUS_PRODUCT_ID : "";
  if (!productId) throw new ApiClientError(400, "unsupported_plan", "Este plan no está disponible en este momento.");
  trackEvent("native_purchase_started", { provider: "revenuecat", purchase_type: "plan", plan_name: safePlan }).catch(() => {});
  return purchaseByProduct({
    productId,
    category: PRODUCT_CATEGORY.SUBSCRIPTION,
    source: `plan:${safePlan}`,
  });
}

async function purchasePack(packSize = 50) {
  if (Number(packSize || 0) !== 50) {
    throw new ApiClientError(400, "unsupported_pack", "Solo el pack de 50 generaciones está disponible en este momento.");
  }
  if (!REVENUECAT_PACK_50_PRODUCT_ID) {
    throw new ApiClientError(400, "native_product_not_configured", "No hemos podido cargar este producto de tienda.");
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
  const customerInfo = unwrapCustomerInfo(result);
  const sync = await syncCustomerInfo(customerInfo, "restore");
  trackEvent("native_purchases_restored", {
    provider: "revenuecat",
    has_plus: hasPlus(customerInfo),
    has_pro: hasPro(customerInfo),
  }).catch(() => {});
  return { native: true, restored: true, customerInfo, sync };
}

async function manageSubscription() {
  await ensureConfigured();
  const result = await Purchases.getCustomerInfo();
  const customerInfo = unwrapCustomerInfo(result);
  const sync = await syncCustomerInfo(customerInfo, "manage");
  const managementUrl = customerInfo.managementURL || customerInfo.managementUrl || managementFallbackUrl();
  trackEvent("native_subscription_management_opened", {
    provider: "revenuecat",
    has_plus: hasPlus(customerInfo),
    has_pro: hasPro(customerInfo),
    has_management_url: Boolean(managementUrl),
  }).catch(() => {});
  return { native: true, managementUrl, url: managementUrl, customerInfo, sync };
}

export {
  capabilities,
  ensureConfigured,
  isConfiguredForPlatform,
  isNativePurchasePlatform,
  manageSubscription,
  purchaseOptions,
  purchasePack,
  purchasePlan,
  restorePurchases,
};
