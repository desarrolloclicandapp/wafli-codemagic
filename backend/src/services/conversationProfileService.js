const { pool } = require("../config/db");

const SHORT_MESSAGE_CHARS = 45;
const LONG_MESSAGE_CHARS = 160;
const PROFILE_VERSION = "conversation-ai-profile-v2";
const DEFAULT_MANUAL_PROFILE = Object.freeze({
  relationshipType: "auto",
  preferredAgent: "auto",
  preferredObjective: "Auto",
  intensity: "auto",
  responseLength: "auto",
  addressMode: "auto",
  initiativeLevel: "auto",
  notes: ""
});
const RELATIONSHIP_TYPES = new Set(["auto", "professional", "flirt", "friend", "family", "client", "boss", "group", "unknown"]);
const AGENTS = new Set(["auto", "Profesional", "Ligoteo", "Amistoso"]);
const INTENSITIES = new Set(["auto", "suave", "media", "directa"]);
const RESPONSE_LENGTHS = new Set(["auto", "corta", "media", "larga"]);
const ADDRESS_MODES = new Set(["auto", "tu", "vos", "usted"]);
const INITIATIVE_LEVELS = new Set(["auto", "prudente", "equilibrada", "proactiva"]);

function cleanText(value = "") {
  return String(value || "").trim();
}

function cleanLimited(value = "", max = 600) {
  return cleanText(value).replace(/\s+/g, " ").slice(0, max);
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
  const voseo = countMatches(joined, /\b(vos|sos|ten[e\u00e9]s|pod[e\u00e9]s|quer[e\u00e9]s|ven[i\u00ed]s|hac[e\u00e9]s|dec[i\u00ed]s)\b/g);
  const tuteo = countMatches(joined, /\b(t[u\u00fa]|eres|tienes|puedes|quieres|vienes|haces|dices)\b/g);
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
  const questionRatio = texts.length ? texts.filter((text) => text.includes("?") || text.includes("\u00bf")).length / texts.length : 0;
  const emojiRatio = texts.length ? texts.filter((text) => /[\u{1F300}-\u{1FAFF}]/u.test(text)).length / texts.length : 0;
  const laughterCount = texts.reduce((sum, text) => sum + countMatches(text.toLowerCase(), /\b(jaja+|jeje+|haha+|lol)\b/g), 0);
  const hasMedia = usable.some((message) => message.has_media || message.media_type);
  const messageLength = avgChars <= SHORT_MESSAGE_CHARS ? "corto" : avgChars >= LONG_MESSAGE_CHARS ? "largo" : "medio";
  const cadence = questionRatio > 0.35 ? "pregunton" : questionRatio < 0.12 ? "directo" : "balanceado";
  const humor = laughterCount >= 2 || emojiRatio > 0.25 ? "ligero_humoristico" : "neutral";
  const treatment = detectTreatment(contactTexts.length ? contactTexts : texts);
  const formality = treatment === "usted" ? "formal" : "informal";
  const guidance = [
    `preferir mensajes ${messageLength}s`,
    cadence === "pregunton" ? "puede cerrar con pregunta si aporta, pero no por defecto" : "no cerrar siempre con pregunta",
    humor === "ligero_humoristico" ? "permitir humor sutil si el contexto acompana" : "mantener naturalidad sin forzar humor",
    treatment !== "mixto_o_no_claro" ? `respetar ${treatment}` : "mantener trato natural segun variante del usuario",
    hasMedia ? "usar multimedia solo como contexto si aporta" : ""
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

function choice(value, allowed, fallback) {
  const raw = cleanText(value);
  return allowed.has(raw) ? raw : fallback;
}

function normalizeManualProfile(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    relationshipType: choice(source.relationshipType, RELATIONSHIP_TYPES, DEFAULT_MANUAL_PROFILE.relationshipType),
    preferredAgent: choice(source.preferredAgent, AGENTS, DEFAULT_MANUAL_PROFILE.preferredAgent),
    preferredObjective: cleanLimited(source.preferredObjective || DEFAULT_MANUAL_PROFILE.preferredObjective, 80) || DEFAULT_MANUAL_PROFILE.preferredObjective,
    intensity: choice(source.intensity, INTENSITIES, DEFAULT_MANUAL_PROFILE.intensity),
    responseLength: choice(source.responseLength, RESPONSE_LENGTHS, DEFAULT_MANUAL_PROFILE.responseLength),
    addressMode: choice(source.addressMode || source.treatment || source.treatAs, ADDRESS_MODES, DEFAULT_MANUAL_PROFILE.addressMode),
    initiativeLevel: choice(source.initiativeLevel || source.initiative, INITIATIVE_LEVELS, DEFAULT_MANUAL_PROFILE.initiativeLevel),
    notes: cleanLimited(source.notes, 600)
  };
}

function normalizeProfile(profile = {}) {
  if (!profile || typeof profile !== "object") {
    return { version: PROFILE_VERSION, style: null, manual: normalizeManualProfile(), signals: {} };
  }
  if (profile.version === PROFILE_VERSION) {
    return {
      version: PROFILE_VERSION,
      style: profile.style && typeof profile.style === "object" ? profile.style : null,
      manual: normalizeManualProfile(profile.manual || {}),
      signals: profile.signals && typeof profile.signals === "object" ? profile.signals : {},
      updatedBy: profile.updatedBy || "heuristic"
    };
  }
  if (profile.version === "conversation-style-v1" || profile.sampleSize) {
    return { version: PROFILE_VERSION, style: profile, manual: normalizeManualProfile(), signals: {}, updatedBy: "migration" };
  }
  return {
    version: PROFILE_VERSION,
    style: profile.style && typeof profile.style === "object" ? profile.style : null,
    manual: normalizeManualProfile(profile.manual || profile),
    signals: profile.signals && typeof profile.signals === "object" ? profile.signals : {},
    updatedBy: profile.updatedBy || "heuristic"
  };
}

function mergeProfile(current = {}, inferredStyle = null, manualPatch = null) {
  const normalized = normalizeProfile(current);
  const manual = manualPatch ? { ...normalized.manual, ...normalizeManualProfile({ ...normalized.manual, ...manualPatch }) } : normalized.manual;
  return {
    version: PROFILE_VERSION,
    style: inferredStyle || normalized.style || null,
    manual,
    signals: normalized.signals || {},
    updatedBy: manualPatch ? "manual" : "heuristic"
  };
}

function formatProfileForPrompt(profile = {}) {
  const normalized = normalizeProfile(profile);
  const style = normalized.style;
  const manual = normalized.manual;
  const parts = [];
  if (style?.sampleSize) {
    parts.push(`perfil_conversacional_seguro: mensajes_analizados=${style.sampleSize}; longitud=${style.messageLength}; cadencia=${style.cadence}; humor=${style.humor}; formalidad=${style.formality}; trato=${style.treatment}.`);
    if (Array.isArray(style.guidance) && style.guidance.length) {
      parts.push(`guia_estilo_chat: ${style.guidance.join("; ")}.`);
    }
  }
  const manualBits = [
    manual.relationshipType !== "auto" ? `relacion=${manual.relationshipType}` : "",
    manual.preferredAgent !== "auto" ? `agente_preferido=${manual.preferredAgent}` : "",
    manual.preferredObjective && manual.preferredObjective !== "Auto" ? `objetivo_preferido=${manual.preferredObjective}` : "",
    manual.intensity !== "auto" ? `intensidad=${manual.intensity}` : "",
    manual.responseLength !== "auto" ? `longitud=${manual.responseLength}` : "",
    manual.addressMode !== "auto" ? `trato=${manual.addressMode}` : "",
    manual.initiativeLevel !== "auto" ? `iniciativa=${manual.initiativeLevel}` : ""
  ].filter(Boolean);
  if (manualBits.length) parts.push(`ajustes_ia_chat: ${manualBits.join("; ")}.`);
  if (manual.notes) parts.push(`notas_persistentes_usuario: ${manual.notes}`);
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

async function getPublicProfile(userId, chatId) {
  const existing = userId && chatId ? await getProfile(userId, chatId).catch(() => null) : null;
  return normalizeProfile(existing?.profile || {});
}

async function refreshProfile(userId, chatId, messages = []) {
  const existing = chatId ? await getProfile(userId, chatId).catch(() => null) : null;
  if (!userId || !chatId || !Array.isArray(messages) || messages.length < 3) {
    return existing?.profile ? normalizeProfile(existing.profile) : null;
  }
  const style = inferStyle(messages.slice(-30));
  const profile = mergeProfile(existing?.profile || {}, style);
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
    [userId, chatId, JSON.stringify(profile), style.sampleSize, lastMessageAt]
  );
  return profile;
}

async function updateProfile(userId, chatId, patch = {}) {
  if (!userId || !chatId) return normalizeProfile();
  const existing = await getProfile(userId, chatId).catch(() => null);
  const profile = mergeProfile(existing?.profile || {}, null, patch);
  await pool.query(
    `INSERT INTO conversation_ai_profiles (user_id, external_chat_id, profile, message_count, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, NOW())
     ON CONFLICT (user_id, external_chat_id) DO UPDATE SET
       profile = EXCLUDED.profile,
       updated_at = NOW()`,
    [userId, chatId, JSON.stringify(profile), Number(existing?.message_count || profile.style?.sampleSize || 0)]
  );
  return profile;
}

async function resetProfile(userId, chatId) {
  if (userId && chatId) {
    await pool.query(
      `DELETE FROM conversation_ai_profiles WHERE user_id = $1 AND external_chat_id = $2`,
      [userId, chatId]
    );
  }
  return normalizeProfile();
}

module.exports = {
  PROFILE_VERSION,
  inferStyle,
  normalizeManualProfile,
  normalizeProfile,
  formatProfileForPrompt,
  getProfile,
  getPublicProfile,
  refreshProfile,
  updateProfile,
  resetProfile
};
