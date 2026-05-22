import { request } from "./client.js";
import { trackEvent, setUserProperty } from "./analytics.js";

const unwrapOnboarding = (result) => result?.onboarding || result?.status || result || {};
const unwrapProfile = (result) => result?.profile || result || {};

const onboardingStatus = async () => {
  const status = unwrapOnboarding(await request("/me/onboarding-status"));
  const nextStep = status?.nextStep || status?.next_step || "";
  const completed = Boolean(status?.completed || status?.isComplete || nextStep === "done" || nextStep === "complete");
  setUserProperty("onboarding_step", completed ? "completed" : nextStep || "unknown").catch(() => {});
  setUserProperty("onboarding_completed", completed ? "true" : "false").catch(() => {});
  return status;
};
const acceptLegal = async (payload) => {
  const result = unwrapOnboarding(await request("/me/legal-acceptance", { method: "POST", body: payload }));
  trackEvent("legal_accepted").catch(() => {});
  return result;
};
const updateProfile = async (payload) => {
  const result = await request("/me/profile", { method: "PATCH", body: payload });
  trackEvent("profile_updated", {
    has_spanish_variant: Boolean(payload?.spanishVariant || payload?.spanish_variant),
    has_tone: Boolean(payload?.tone || payload?.toneBase || payload?.tone_base),
  }).catch(() => {});
  return result;
};
const getProfile = async () => unwrapProfile(await request("/me/profile"));

export { onboardingStatus, acceptLegal, updateProfile, getProfile };
