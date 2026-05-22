const { pool } = require("../config/db");
const { ApiError } = require("../utils/responses");

const ALLOWED_REASONS = new Set([
  "not_helpful",
  "incorrect",
  "unsafe",
  "privacy",
  "spam",
  "other",
]);

function cleanText(value, maxLength) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.slice(0, maxLength);
}

async function createReport(userId, payload = {}) {
  const generatedText = cleanText(payload.generatedText || payload.generated_text || payload.text, 6000);
  const reason = ALLOWED_REASONS.has(String(payload.reason || "").trim())
    ? String(payload.reason).trim()
    : "other";
  const action = cleanText(payload.action || payload.aiAction || payload.ai_action, 60) || "unknown";
  const chatId = cleanText(payload.chatId || payload.chat_id, 255) || null;
  const note = cleanText(payload.note || payload.description, 1200) || null;
  const metadata = payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};

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

module.exports = { createReport };
