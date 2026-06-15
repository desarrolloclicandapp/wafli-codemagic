const { pool } = require("../config/db");
const { ApiError } = require("../utils/responses");

const VALID_OUTCOMES = ["sent_as_is", "sent_edited", "discarded", "regenerated"];

function clean(value, max = 120) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max) || null;
}

function toInt(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeFeedbackPayload(payload = {}) {
  const outcome = String(payload.outcome || "").trim().toLowerCase();
  if (!VALID_OUTCOMES.includes(outcome)) {
    throw new ApiError(400, "invalid_feedback_outcome", "Outcome de feedback no valido.");
  }
  const meta = payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};
  return {
    chatId: clean(payload.chatId, 255),
    action: clean(payload.action, 60) || "suggest",
    agent: clean(payload.agent, 80),
    objective: clean(payload.objective, 120),
    variant: clean(payload.variant, 80),
    responseMove: clean(payload.responseMove || meta.responseMove, 120),
    outcome,
    optionIndex: toInt(payload.optionIndex),
    optionCount: toInt(payload.optionCount),
    wasEdited: Boolean(payload.wasEdited),
    metadata: meta
  };
}

// Registra el desenlace de una sugerencia (#3 bucle de feedback): si el usuario la
// envio tal cual, la edito antes de enviar, la descarto o pidio regenerar. Es la
// senal mas valiosa para saber que agente/movimiento funciona.
async function recordFeedback(userId, payload = {}) {
  const data = normalizeFeedbackPayload(payload);
  const result = await pool.query(
    `INSERT INTO ai_generation_feedback (
       user_id, chat_id, ai_action, agent, objective, variant, response_move,
       outcome, option_index, option_count, was_edited, metadata
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
     RETURNING id, created_at`,
    [
      userId, data.chatId, data.action, data.agent, data.objective, data.variant,
      data.responseMove, data.outcome, data.optionIndex, data.optionCount,
      data.wasEdited, JSON.stringify(data.metadata)
    ]
  );
  return { feedback: result.rows[0], recorded: true };
}

// Resumen agregado para saber que combinaciones funcionan mejor (tasa de "enviada
// tal cual" por agente). Base del aprendizaje / futuras few-shots.
async function feedbackSummary(userId, { days = 30 } = {}) {
  const result = await pool.query(
    `SELECT agent,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE outcome = 'sent_as_is')::int AS sent_as_is,
            COUNT(*) FILTER (WHERE outcome = 'sent_edited')::int AS sent_edited,
            COUNT(*) FILTER (WHERE outcome = 'discarded')::int AS discarded,
            COUNT(*) FILTER (WHERE outcome = 'regenerated')::int AS regenerated
       FROM ai_generation_feedback
      WHERE user_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval
      GROUP BY agent
      ORDER BY total DESC`,
    [userId, String(Math.max(1, Math.min(365, Number(days) || 30)))]
  );
  return { byAgent: result.rows };
}

module.exports = { recordFeedback, feedbackSummary, normalizeFeedbackPayload, VALID_OUTCOMES };
