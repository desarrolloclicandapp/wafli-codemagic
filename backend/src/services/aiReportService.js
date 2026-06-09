const { pool } = require("../config/db");
const { ApiError } = require("../utils/responses");

const ALLOWED_REASONS = new Set([
  "not_helpful",
  "wrong_context",
  "sounds_ai",
  "wrong_variant",
  "invented",
  "wrong_tone",
  "incorrect",
  "unsafe",
  "privacy",
  "spam",
  "other",
]);

const SAFE_METADATA_KEYS = new Set([
  "source",
  "action",
  "chatId",
  "agent",
  "objective",
  "variant",
  "promptVersion",
  "promptVersionSource",
  "promptVersionRequested",
  "promptVersionFallbackUsed",
  "promptVariant",
  "decisionContextVersion",
  "preferenceAdapterRole",
  "decisionPreventionContract",
  "responseMove",
  "initiativeLevel",
  "turnOwner",
  "questionPolicy",
  "riskLevel",
  "missedOpportunityFlags",
  "qualityFlags",
  "dialectWarnings",
  "spanishNaturalnessFlags",
  "humanReplyScore",
  "humanReplyDimensions",
  "agentFit",
  "nonObviousValue",
  "regenerationSimilarity",
  "model",
  "objectiveSource",
  "intensity",
  "situation",
  "relationshipType",
  "usedConversationProfile",
  "contextCopilotHints",
  "hasQuotedMessage",
  "hasMediaContext",
  "originalLength",
  "selectedIndex",
  "wasEditedBeforeReport",
  "wasEditedBeforeSend",
  "reportedTextLength",
  "noteLength",
]);

function cleanText(value, maxLength) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.slice(0, maxLength);
}

function sanitizeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const safe = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key)) continue;
    if (value === undefined) continue;
    safe[key] = value;
  }
  return safe;
}

function normalizeReportPayload(payload = {}) {
  const generatedText = cleanText(payload.generatedText || payload.generated_text || payload.text, 6000);
  const rawReason = String(payload.reason || "").trim();
  const reason = ALLOWED_REASONS.has(rawReason) ? rawReason : "other";
  const action = cleanText(payload.action || payload.aiAction || payload.ai_action, 60) || "unknown";
  const chatId = cleanText(payload.chatId || payload.chat_id, 255) || null;
  const note = cleanText(payload.note || payload.description, 1200) || null;
  const metadata = sanitizeMetadata(payload.metadata);
  metadata.action = metadata.action || action;
  metadata.chatId = metadata.chatId || chatId;
  metadata.noteLength = note ? note.length : 0;
  metadata.reportedTextLength = generatedText.length;
  return { generatedText, reason, action, chatId, note, metadata };
}

async function createReport(userId, payload = {}) {
  const { generatedText, reason, action, chatId, note, metadata } = normalizeReportPayload(payload);

  if (!generatedText) {
    throw new ApiError(400, "missing_report_content", "Falta el contenido generado a reportar");
  }

  const result = await pool.query(
    `INSERT INTO ai_content_reports (
       user_id, chat_id, ai_action, report_reason, report_note, generated_text, metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING id, status, created_at`,
    [userId, chatId, action, reason, note, generatedText, JSON.stringify(metadata)]
  );

  return {
    report: result.rows[0],
    message: "Reporte recibido. Gracias por ayudarnos a revisar la calidad y seguridad de WaFli.",
  };
}

module.exports = { createReport, normalizeReportPayload };
