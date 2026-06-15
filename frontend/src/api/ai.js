import { request } from "./client.js";
import { trackEvent } from "./analytics.js";

const AI_PRIVACY_PROVIDER = "OpenAI";

class AiDataSharingConsentError extends Error {
  constructor() {
    super("Cancelaste el envío de datos a la IA. No compartimos nada con el proveedor externo.");
    this.code = "ai_data_sharing_consent_required";
    this.status = 0;
  }
}

function requestAiDataSharingPermission(action = "ai") {
  if (typeof window === "undefined" || typeof window.confirm !== "function") return true;
  const message = [
    "Antes de usar la IA",
    "",
    `WaFli enviará a ${AI_PRIVACY_PROVIDER}, proveedor externo de IA, solo los datos necesarios para esta acción: el mensaje o conversación que pegues o selecciones, contexto reciente relevante, instrucciones/objetivo y cualquier captura que adjuntes.`,
    "",
    `${AI_PRIVACY_PROVIDER} procesa esos datos para generar la respuesta solicitada. WaFli no envía mensajes automáticamente y no comparte tus chats con IA en segundo plano.`,
    "",
    "¿Autorizas este envío para generar la respuesta?"
  ].join("\n");
  const allowed = window.confirm(message);
  trackEvent(allowed ? "ai_data_sharing_consent_allowed" : "ai_data_sharing_consent_declined", { action }).catch(() => {});
  return allowed;
}

async function trackAiAction(action, payload, requestFactory) {
  trackEvent("ai_action_requested", { action }).catch(() => {});
  if (!requestAiDataSharingPermission(action)) {
    throw new AiDataSharingConsentError();
  }
  try {
    const result = await requestFactory();
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

const suggest = (payload) => trackAiAction("suggest", payload, () => request("/ai/suggest", { method: "POST", body: payload }));
const rewrite = (payload) => trackAiAction("rewrite", payload, () => request("/ai/rewrite", { method: "POST", body: payload }));
const analyze = (payload) => trackAiAction("analyze", payload, () => request("/ai/analyze", { method: "POST", body: payload }));
const opener = (payload) => trackAiAction("opener", payload, () => request("/ai/opener", { method: "POST", body: payload }));
const reactivate = (payload) => trackAiAction("reactivate", payload, () => request("/ai/reactivate", { method: "POST", body: payload }));
const regenerate = (payload) => trackAiAction("regenerate", payload, () => request("/ai/regenerate", { method: "POST", body: payload }));
const toolReply = (payload) => trackAiAction("tool_reply", payload, () => request("/ai/tools/reply", { method: "POST", body: payload }));
const toolIcebreakers = (payload) => trackAiAction("tool_icebreakers", payload, () => request("/ai/tools/icebreakers", { method: "POST", body: payload }));
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
