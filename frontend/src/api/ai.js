import { request } from "./client.js";
import { trackEvent } from "./analytics.js";

const AI_PRIVACY_PROVIDER = "OpenAI";
const AI_PERMANENT_CONSENT_KEY = "wafli:aiDataSharingConsent:permanent";
const AI_SESSION_CONSENT_KEY = "wafli:aiDataSharingConsent:session";

function hasPermanentAiDataSharingConsent() {
  try {
    return window.localStorage?.getItem(AI_PERMANENT_CONSENT_KEY) === "allowed";
  } catch (error) {
    return false;
  }
}

function hasSessionAiDataSharingConsent() {
  try {
    return window.sessionStorage?.getItem(AI_SESSION_CONSENT_KEY) === "allowed";
  } catch (error) {
    return false;
  }
}

function rememberPermanentAiDataSharingConsent() {
  try {
    window.localStorage?.setItem(AI_PERMANENT_CONSENT_KEY, "allowed");
  } catch (error) {}
}

function rememberSessionAiDataSharingConsent() {
  try {
    window.sessionStorage?.setItem(AI_SESSION_CONSENT_KEY, "allowed");
  } catch (error) {}
}

class AiDataSharingConsentError extends Error {
  constructor() {
    super("Cancelaste el envío de datos a la IA. No compartimos nada con el proveedor externo.");
    this.code = "ai_data_sharing_consent_required";
    this.status = 0;
  }
}

function requestAiDataSharingPermission(action = "ai") {
  if (typeof window === "undefined") return Promise.resolve(true);
  if (hasPermanentAiDataSharingConsent() || hasSessionAiDataSharingConsent()) return Promise.resolve(true);
  return new Promise((resolve) => {
    let handled = false;
    let settled = false;
    const finish = (allowed) => {
      if (settled) return;
      settled = true;
      const scope = allowed === "always" ? "always" : allowed === "session" || allowed === true ? "session" : "none";
      const decision = scope !== "none";
      if (scope === "always") rememberPermanentAiDataSharingConsent();
      if (scope === "session") rememberSessionAiDataSharingConsent();
      trackEvent(decision ? "ai_data_sharing_consent_allowed" : "ai_data_sharing_consent_declined", { action, scope }).catch(() => {});
      resolve(decision);
    };

    try {
      window.dispatchEvent(new CustomEvent("wafli:ai-data-sharing-consent", {
        detail: {
          action,
          provider: AI_PRIVACY_PROVIDER,
          markHandled: () => { handled = true; },
          onDecision: finish,
        },
      }));
    } catch (error) {
      handled = false;
    }

    if (handled) return;
    if (typeof window.confirm !== "function") {
      finish(false);
      return;
    }
    const message = [
      "Antes de usar la IA",
      "",
      `WaFli enviará a ${AI_PRIVACY_PROVIDER}, proveedor externo de IA, solo los datos necesarios para esta acción: el mensaje o conversación que pegues o selecciones, contexto reciente relevante, instrucciones/objetivo y cualquier captura que adjuntes.`,
      "",
      `${AI_PRIVACY_PROVIDER} procesa esos datos para generar la respuesta solicitada. WaFli no envía mensajes automáticamente y no comparte tus chats con IA en segundo plano.`,
      "",
      "¿Autorizas este envío para generar la respuesta?"
    ].join("\n");
    finish(window.confirm(message) ? "session" : false);
  });
}

function withAiDataSharingConsent(payload) {
  if (typeof FormData !== "undefined" && payload instanceof FormData) {
    const next = new FormData();
    payload.forEach((value, key) => next.append(key, value));
    next.append("aiDataSharingConsent", "true");
    return next;
  }
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return { ...payload, aiDataSharingConsent: true };
  }
  return { aiDataSharingConsent: true };
}

async function trackAiAction(action, payload, requestFactory) {
  trackEvent("ai_action_requested", { action }).catch(() => {});
  if (!(await requestAiDataSharingPermission(action))) {
    throw new AiDataSharingConsentError();
  }
  try {
    const result = await requestFactory(withAiDataSharingConsent(payload));
    const meta = result?.meta || {};
    trackEvent("ai_action_completed", {
      action,
      agent: meta.agent || result?.agent || "",
      objective: meta.objective || result?.objective || "",
      variant: meta.variant || result?.variant || "",
      model: meta.model || result?.model || "",
      context_copilot_hints: Number(meta.contextCopilotHints || 0),
      quota_exhausted: Boolean(result?.quota?.exhausted || result?.usage?.summary?.exhausted),
      quota_warning: Boolean(result?.quota?.warning80 || result?.usage?.summary?.warning80),
    }).catch(() => {});
    return result;
  } catch (error) {
    trackEvent("ai_action_failed", {
      action,
      error_code: error?.code || "unknown",
      status: error?.status || 0,
    }).catch(() => {});
    throw error;
  }
}

const suggest = (payload) => trackAiAction("suggest", payload, (body) => request("/ai/suggest", { method: "POST", body }));
const rewrite = (payload) => trackAiAction("rewrite", payload, (body) => request("/ai/rewrite", { method: "POST", body }));
const analyze = (payload) => trackAiAction("analyze", payload, (body) => request("/ai/analyze", { method: "POST", body }));
const opener = (payload) => trackAiAction("opener", payload, (body) => request("/ai/opener", { method: "POST", body }));
const reactivate = (payload) => trackAiAction("reactivate", payload, (body) => request("/ai/reactivate", { method: "POST", body }));
const regenerate = (payload) => trackAiAction("regenerate", payload, (body) => request("/ai/regenerate", { method: "POST", body }));
const toolReply = (payload) => trackAiAction("tool_reply", payload, (body) => request("/ai/tools/reply", { method: "POST", body }));
const toolIcebreakers = (payload) => trackAiAction("tool_icebreakers", payload, (body) => request("/ai/tools/icebreakers", { method: "POST", body }));
const savedLines = (params = {}) => {
  const search = String(params.q || params.search || "").trim();
  const qs = search ? `?q=${encodeURIComponent(search)}` : "";
  return request(`/ai/tools/saved-lines${qs}`);
};
const saveLine = (payload) => request("/ai/tools/saved-lines", { method: "POST", body: payload });
const deleteLine = (id) => request(`/ai/tools/saved-lines/${encodeURIComponent(id)}`, { method: "DELETE" });
const reportGeneratedContent = async (payload) => {
  trackEvent("ai_content_report_started", {
    action: payload?.action || "unknown",
    reason: payload?.reason || "other",
    note_length: String(payload?.note || "").trim().length,
  }).catch(() => {});
  const result = await request("/ai/reports", { method: "POST", body: payload });
  trackEvent("ai_content_report_submitted", {
    action: payload?.action || "unknown",
    reason: payload?.reason || "other",
    note_length: String(payload?.note || "").trim().length,
  }).catch(() => {});
  return result;
};

export {
  suggest,
  rewrite,
  analyze,
  opener,
  reactivate,
  regenerate,
  toolReply,
  toolIcebreakers,
  savedLines,
  saveLine,
  deleteLine,
  reportGeneratedContent
};
