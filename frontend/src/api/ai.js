import { request } from "./client.js";
import { trackEvent } from "./analytics.js";

async function trackAiAction(action, promise) {
  trackEvent("ai_action_requested", { action }).catch(() => {});
  try {
    const result = await promise;
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

const suggest = (payload) => trackAiAction("suggest", request("/ai/suggest", { method: "POST", body: payload }));
const rewrite = (payload) => trackAiAction("rewrite", request("/ai/rewrite", { method: "POST", body: payload }));
const analyze = (payload) => trackAiAction("analyze", request("/ai/analyze", { method: "POST", body: payload }));
const opener = (payload) => trackAiAction("opener", request("/ai/opener", { method: "POST", body: payload }));
const reactivate = (payload) => trackAiAction("reactivate", request("/ai/reactivate", { method: "POST", body: payload }));
const regenerate = (payload) => trackAiAction("regenerate", request("/ai/regenerate", { method: "POST", body: payload }));
const toolReply = (payload) => trackAiAction("tool_reply", request("/ai/tools/reply", { method: "POST", body: payload }));
const toolIcebreakers = (payload) => trackAiAction("tool_icebreakers", request("/ai/tools/icebreakers", { method: "POST", body: payload }));
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
