const { pool } = require("../config/db");

const SHORT_MESSAGE_CHARS = 45;
const LONG_MESSAGE_CHARS = 160;

function cleanText(value = "") {
  return String(value || "").trim();
}

function messageText(message = {}) {
  return cleanText(message.body || message.text || "");
}

function messageSender(message = {}) {
  return message.sender === "me" ? "me" : "contact";
}

function countMatches(text, regex) {
  return (String(text || "").match(regex) || []).length;
}

function detectTreatment(texts = []) {
  const joined = texts.join(" ").toLowerCase();
  const voseo = countMatches(joined, /\b(vos|sos|ten[eé]s|pod[eé]s|quer[eé]s|ven[ií]s|hac[eé]s|dec[ií]s)\b/g);
  const tuteo = countMatches(joined, /\b(tú|tu|eres|tienes|puedes|quieres|vienes|haces|dices)\b/g);
  const usted = countMatches(joined, /\b(usted|tiene|puede|quiere|viene|hace|dice)\b/g);
  if (voseo >= 2 && voseo >= tuteo && voseo >= usted) return "voseo";
  if (usted >= 2 && usted > voseo && usted >= tuteo) return "usted";
  if (tuteo >= 2 && tuteo > voseo && tuteo >= usted) return "tuteo";
  return "mixto_o_no_claro";
}

function inferStyle(messages = []) {
  const usable = messages
    .filter((message) => message && !message.deleted_at && message.message_type !== "reaction")
    .map((message) => ({ ...message, text: messageText(message) }))
    .filter((message) => message.text || message.has_media || message.media_type);
  const contact = usable.filter((message) => messageSender(message) === "contact");
  const me = usable.filter((message) => messageSender(message) === "me");
  const texts = usable.map((message) => message.text).filter(Boolean);
  const contactTexts = contact.map((message) => message.text).filter(Boolean);
  const avgChars = texts.length ? Math.round(texts.reduce((sum, text) => sum + text.length, 0) / texts.length) : 0;
  const questionRatio = texts.length ? texts.filter((text) => text.includes("?") || text.includes("¿")).length / texts.length : 0;
  const emojiRatio = texts.length ? texts.filter((text) => /[\u{1F300}-\u{1FAFF}]/u.test(text)).length / texts.length : 0;
  const laughterCount = texts.reduce((sum, text) => sum + countMatches(text.toLowerCase(), /\b(jaja+|jeje+|haha+|lol)\b/g), 0);
  const hasMedia = usable.some((message) => message.has_media || message.media_type);
  const messageLength = avgChars <= SHORT_MESSAGE_CHARS ? "corto" : avgChars >= LONG_MESSAGE_CHARS ? "largo" : "medio";
  const cadence = questionRatio > 0.35 ? "preguntón" : questionRatio < 0.12 ? "directo" : "balanceado";
  const humor = laughterCount >= 2 || emojiRatio > 0.25 ? "ligero_humoristico" : "neutral";
  const treatment = detectTreatment(contactTexts.length ? contactTexts : texts);
  const formality = treatment === "usted" ? "formal" : "informal";
  const guidance = [
    `preferir mensajes ${messageLength}s`,
    cadence === "preguntón" ? "puede cerrar con pregunta si aporta, pero no por defecto" : "no cerrar siempre con pregunta",
    humor === "ligero_humoristico" ? "permitir humor sutil si el contexto acompaña" : "mantener naturalidad sin forzar humor",
    treatment !== "mixto_o_no_claro" ? `respetar ${treatment}` : "mantener trato natural segun variante del usuario",
    hasMedia ? "usar media solo como contexto si aporta" : ""
  ].filter(Boolean);

  return {
    version: "conversation-style-v1",
    messageLength,
    avgChars,
    cadence,
    humor,
    formality,
    treatment,
    sampleSize: usable.length,
    contactMessages: contact.length,
    userMessages: me.length,
    hasMedia,
    guidance
  };
}

function formatProfileForPrompt(profile = {}) {
  if (!profile || typeof profile !== "object" || !profile.sampleSize) return "";
  const parts = [
    `perfil_conversacional_seguro: mensajes_analizados=${profile.sampleSize}; longitud=${profile.messageLength}; cadencia=${profile.cadence}; humor=${profile.humor}; formalidad=${profile.formality}; trato=${profile.treatment}.`,
    Array.isArray(profile.guidance) && profile.guidance.length
      ? `guia_estilo_chat: ${profile.guidance.join("; ")}.`
      : ""
  ].filter(Boolean);
  return parts.join("\n");
}

async function getProfile(userId, chatId) {
  const result = await pool.query(
    `SELECT profile, message_count, last_message_at, updated_at
     FROM conversation_ai_profiles
     WHERE user_id = $1 AND external_chat_id = $2`,
    [userId, chatId]
  );
  return result.rows[0] || null;
}

async function refreshProfile(userId, chatId, messages = []) {
  if (!userId || !chatId || !Array.isArray(messages) || messages.length < 3) {
    const existing = chatId ? await getProfile(userId, chatId).catch(() => null) : null;
    return existing?.profile || null;
  }
  const profile = inferStyle(messages.slice(-30));
  const lastMessageAt = messages
    .map((message) => message.sent_at || message.sentAt)
    .filter(Boolean)
    .slice(-1)[0] || null;
  await pool.query(
    `INSERT INTO conversation_ai_profiles (user_id, external_chat_id, profile, message_count, last_message_at, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, $5::timestamptz, NOW())
     ON CONFLICT (user_id, external_chat_id) DO UPDATE SET
       profile = EXCLUDED.profile,
       message_count = EXCLUDED.message_count,
       last_message_at = COALESCE(EXCLUDED.last_message_at, conversation_ai_profiles.last_message_at),
       updated_at = NOW()`,
    [userId, chatId, JSON.stringify(profile), profile.sampleSize, lastMessageAt]
  );
  return profile;
}

module.exports = {
  inferStyle,
  formatProfileForPrompt,
  getProfile,
  refreshProfile
};
