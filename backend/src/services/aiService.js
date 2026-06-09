const { config } = require("../config/env");
const { ApiError } = require("../utils/responses");
const chatService = require("./chatService");
const conversationProfileService = require("./conversationProfileService");
const quotaService = require("./quotaService");
const { anonymize, cleanGeneratedText } = require("./aiAnonymizer");
const { actionPrompt, normalizeTone, normalizeVariant, postprocessAiText, turnGuardPrompt } = require("./aiPromptRegistry");
const { getTextProvider } = require("./aiProviders");
const { calculateAiCost, combineAiCosts } = require("./aiCostService");
const { qualityPolicyPrompt, applyQualityPostprocess, evaluateAiResponse } = require("./aiQualityService");
const { detectResponseMove, previousGeneratedTextFromPayload } = require("./aiResponseMoveService");
const { buildAiDecisionContext, aiDecisionContextPrompt } = require("./aiDecisionContextService");
const { PROMPT_PROFILE_VERSION, detectConversationIntent, formatIntentForPrompt, ownerForMessage } = require("./aiConversationIntentService");
const { ACTIVE_PROMPT_VERSION_META } = require("./aiPromptVersionService");

const COOLED_THREAD_HOURS = 24;
const ANONYMIZED_PLACEHOLDER_RE = /\[(?:persona_\d+|telefono|email|url|documento)\]/gi;
const MANUAL_AI_CHAT_ID = "wafli-ai-manual";
const PROMPT_RIGIDITY_PROFILE = "freeform-v1";
const CONTEXT_LIMIT_ENV_BY_ACTION = {
  suggest: "AI_CONTEXT_LIMIT_SUGGEST",
  rewrite: "AI_CONTEXT_LIMIT_REWRITE",
  opener: "AI_CONTEXT_LIMIT_OPENER",
  reactivate: "AI_CONTEXT_LIMIT_REACTIVATE",
  analyze: "AI_CONTEXT_LIMIT_ANALYZE",
  recommend: "AI_CONTEXT_LIMIT_RECOMMEND"
};

function normalizeManualContext(source = {}) {
  const context = source && typeof source === "object" ? source : {};
  return {
    message: String(context.message || context.messageToReply || "").trim(),
    additionalContext: String(context.additionalContext || context.context || "").trim(),
    captureName: String(context.captureName || "").trim(),
    updatedAt: context.updatedAt || null
  };
}

function normalizeStandaloneToolImage(source = {}) {
  const image = source && typeof source === "object" ? source : {};
  const dataUrl = String(image.dataUrl || image.url || "").trim();
  if (!/^data:image\/(?:png|jpe?g|webp);base64,/i.test(dataUrl)) return null;
  return {
    dataUrl,
    fileName: String(image.fileName || image.name || "captura").slice(0, 120),
    mimeType: String(image.mimeType || image.type || "").slice(0, 80),
    sizeBytes: Number(image.sizeBytes || image.size || 0) || null
  };
}

function toolAgentFromTone(tone = "") {
  const value = String(tone || "").trim().toLowerCase();
  if (/picante|ligoteo|juguet|coquet/i.test(value)) return "Ligoteo";
  if (/intelectual|profesional|formal/i.test(value)) return "Profesional";
  return "Amistoso";
}

function toolVariant(value, fallback = "") {
  return normalizeVariant(value || fallback || "Neutro");
}

function requireToolContext({ text = "", image = null, message = "Añade una captura o pega el texto para continuar." } = {}) {
  if (String(text || "").trim() || image) return;
  throw new ApiError(400, "tool_context_required", message);
}

function savedLineSource(value = "") {
  const source = String(value || "icebreaker").trim().toLowerCase();
  return source ? source.slice(0, 80) : "icebreaker";
}

function isManualAiContext(chatId = "", extra = {}) {
  const manualContext = normalizeManualContext(extra.manualContext);
  return String(chatId || "").trim() === MANUAL_AI_CHAT_ID && Boolean(manualContext.message);
}

function buildManualAiMessages(extra = {}) {
  const manualContext = normalizeManualContext(extra.manualContext);
  if (!manualContext.message) return [];
  return [{
    id: "manual-ai-message",
    external_message_id: "manual-ai-message",
    chat_id: MANUAL_AI_CHAT_ID,
    sender: "match",
    message_type: "text",
    body: manualContext.message,
    sent_at: manualContext.updatedAt || new Date().toISOString(),
    metadata: {
      manualContext: true,
      source: "manual_ai_context",
      captureName: manualContext.captureName || "",
      additionalContext: manualContext.additionalContext || ""
    }
  }];
}

async function loadProfile(userId) {
  const { pool } = require("../config/db");
  const result = await pool.query(`SELECT * FROM user_profiles WHERE user_id = $1`, [userId]);
  return result.rows[0] || {};
}

function asMessage(message) {
  return message && typeof message === "object" ? message : {};
}

function compactMessages(messages = []) {
  return Array.isArray(messages)
    ? messages.filter((message) => message && typeof message === "object")
    : [];
}

function asAiContext(context) {
  if (!context || typeof context !== "object") {
    return { content: "Sin contexto adicional.", metadata: {} };
  }
  return {
    content: context.content || "Sin contexto adicional.",
    metadata: context.metadata && typeof context.metadata === "object" ? context.metadata : {}
  };
}

function messageSpeaker(message = {}) {
  message = asMessage(message);
  if (message.sender === "me") return "yo";
  const participantName = message.metadata?.participantName || message.metadata?.senderName || message.metadata?.pushName || "";
  if (participantName) return `contacto (${participantName})`;
  return "contacto";
}

function quotedSpeaker(quotedMessage = {}) {
  if (!quotedMessage) return "";
  if (quotedMessage.sender === "me" || quotedMessage.fromMe === true) return "yo";
  return quotedMessage.authorName || quotedMessage.senderName || quotedMessage.participantName || "contacto";
}

function quotedMessageFromUser(quotedMessage = {}) {
  return Boolean(quotedMessage && typeof quotedMessage === "object" && (quotedMessage.sender === "me" || quotedMessage.fromMe === true));
}

function quotedMessageFromContact(quotedMessage = {}) {
  return Boolean(quotedMessage && typeof quotedMessage === "object" && !quotedMessageFromUser(quotedMessage));
}

function formatQuotedMessage(quotedMessage = {}) {
  if (!quotedMessage || typeof quotedMessage !== "object") return "";
  const speaker = quotedSpeaker(quotedMessage) || "contacto";
  const origin = quotedMessageFromUser(quotedMessage) ? "usuario" : "contacto";
  const type = quotedMessage.messageType || quotedMessage.type || "text";
  const text = String(quotedMessage.text || quotedMessage.body || type || "").trim();
  const instruction = origin === "usuario"
    ? "no responder como contacto; reescribir, reforzar o continuar esta idea propia"
    : "responder a este mensaje desde la voz de la persona usuaria";
  return `mensaje_citado_para_responder: origen=${origin}; autor=${speaker}; tipo=${type}; instruccion=${instruction}; texto=${text || "sin texto"}`;
}

function mediaKind(message = {}) {
  message = asMessage(message);
  return message.media_type || message.metadata?.mediaType || message.message_type || "archivo";
}

function sentAtMs(message = {}) {
  message = asMessage(message);
  const value = message.sent_at || message.sentAt || message.timestamp || message.created_at;
  const parsed = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractConversationFacts(messages = []) {
  const facts = [];
  const seen = new Set();
  const recent = [...messages]
    .sort((a, b) => sentAtMs(a) - sentAtMs(b))
    .slice(-20);
  const timePatterns = [
    /\b(?:a\s+las?|para\s+las?|sobre\s+las?|tipo(?:\s+las)?|tipo)\s+([01]?\d|2[0-3])(?::([0-5]\d))?\s*(?:hs?|hrs?)?\b/gi,
    /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g,
  ];
  const dayPattern = /\b(hoy|mañana|pasado mañana|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|finde|fin de semana)\b/gi;
  const planPattern = /\b(vernos|vernos|verme|verte|quedar|juntarnos|encontrarnos|cenar|almorzar|tomar algo|café|cafe|llamada|llamar|videollamada|ir|pasar|venir)\b/gi;

  const pushFact = (fact) => {
    const safeFact = String(fact || "").replace(/\s+/g, " ").trim();
    const key = safeFact.toLowerCase();
    if (!safeFact || seen.has(key)) return;
    seen.add(key);
    facts.push(safeFact);
  };

  for (const message of recent) {
    const body = String(message.body || "").trim();
    if (!body) continue;
    const speaker = message.sender === "me" ? "usuario" : "contacto";
    for (const pattern of timePatterns) {
      pattern.lastIndex = 0;
      for (const match of body.matchAll(pattern)) {
        pushFact(`${speaker} mencionó hora: "${match[0]}"`);
      }
    }
    dayPattern.lastIndex = 0;
    for (const match of body.matchAll(dayPattern)) {
      pushFact(`${speaker} mencionó día/momento: "${match[0]}"`);
    }
    planPattern.lastIndex = 0;
    for (const match of body.matchAll(planPattern)) {
      pushFact(`${speaker} mencionó plan/acción: "${match[0]}"`);
    }
  }

  return facts.slice(-10);
}

function compactText(value = "", maxLength = 240) {
  const text = String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function recentOwnTextsForQuality(messages = []) {
  return [...messages]
    .filter((message) => asMessage(message).sender === "me")
    .map((message) => compactText(messageTextForSignals(message) || asMessage(message).body || "", 220))
    .filter(Boolean)
    .slice(-5);
}

function repetitionRetryNeeded(qualityMeta = {}) {
  const flags = Array.isArray(qualityMeta.flags) ? qualityMeta.flags : [];
  return flags.some((flag) => [
    "same_as_previous",
    "same_as_recent_generation",
    "same_structure_as_previous",
    "phrase_recycling",
    "same_as_recent_user_message",
    "same_as_previous_generated",
    "patterned_reply",
    "canned_date_plan",
    "passive_reply",
    "missed_opportunity",
    "generic_question_tail",
    "wrong_turn_owner",
    "no_actionable_value",
    "low_human_rhythm",
    "awkward_duplicate",
    "repeated_phrase",
    "rewrite_drift",
    "wrong_rewrite_focus",
    "rewrite_canned_reply"
  ].includes(flag));
}

function noRepeatReferenceBlock(metadata = {}) {
  const refs = [
    metadata.previousGeneratedText,
    metadata.lastGeneratedText,
    ...(Array.isArray(metadata.previousGeneratedTexts) ? metadata.previousGeneratedTexts : []),
    ...(Array.isArray(metadata.recentOwnTextsForQuality) ? metadata.recentOwnTextsForQuality : [])
  ]
    .map((value) => compactText(value, 220))
    .filter(Boolean);
  return [...new Set(refs)].slice(-8).join("\n");
}

async function loadRecentGeneratedTexts(userId, chatId, action = "") {
  if (!userId || !chatId) return [];
  const safeAction = String(action || "").trim();
  try {
    const { pool } = require("../config/db");
    const result = await pool.query(
      `SELECT metadata->>'generatedTextForAntiRepeat' AS generated_text
       FROM usage_ledger
       WHERE user_id = $1
         AND status = 'completed'
         AND metadata->>'chatId' = $2
         AND COALESCE(metadata->>'generatedTextForAntiRepeat', '') <> ''
         AND ($3::text = '' OR action = $3::text)
       ORDER BY created_at DESC
       LIMIT 6`,
      [userId, String(chatId), safeAction]
    );
    return result.rows
      .map((row) => compactText(row.generated_text, 260))
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function messageTextForSignals(message = {}) {
  message = asMessage(message);
  const metadata = message.metadata || {};
  return [
    message.body,
    metadata.caption,
    metadata.pollName,
    Array.isArray(metadata.contactNames) ? metadata.contactNames.join(" ") : "",
    metadata.location?.name,
    metadata.location?.address
  ].filter(Boolean).join(" ");
}

function detectFirstSignal(text = "", rules = []) {
  for (const rule of rules) {
    if (rule.regex.test(text)) return rule.label;
  }
  return "";
}

function buildContextCopilot({
  action = "suggest",
  extra = {},
  profile = {},
  orderedRecent = [],
  lastInbound = null,
  lastOutbound = null,
  targetMessage = null,
  targetMessageSource = "none",
  hasQuotedMessage = false,
  quotedFromUser = false,
  quotedFromContact = false,
  threadState = {},
  conversationFacts = [],
  mediaNotes = [],
  requestedAgent = "",
  tone = ""
} = {}) {
  const manualContext = [
    extra.userContext,
    extra.notes,
    extra.intent,
    extra.draft,
    extra.message,
    extra.customObjective
  ].filter(Boolean).join(" ");
  const recentText = orderedRecent
    .slice(-8)
    .map((message) => `${message.sender === "me" ? "usuario" : "contacto"}: ${messageTextForSignals(message)}`)
    .join(" ");
  const signalText = stripAccentsForSignals([
    manualContext,
    recentText,
    messageTextForSignals(lastInbound),
    messageTextForSignals(lastOutbound),
    messageTextForSignals(targetMessage),
    requestedAgent,
    tone,
    profile.base_tone,
    profile.tone
  ].filter(Boolean).join(" ").toLowerCase());

  const relationship = detectFirstSignal(signalText, [
    { label: "laboral/profesional probable", regex: /\b(jefe|jefa|cliente|proveedor|empresa|trabajo|reunion|presupuesto|factura|informe|proyecto|entrega|version final|datos|archivo|documento|deadline|tarea|equipo)\b/i },
    { label: "ligue o interes romantico probable", regex: /\b(ligue|cita|match|tinder|bumble|gustas|me gusta|quimica|verte|vernos|tomar algo|beso|coquete|flirte|salir juntos|ganas de verte)\b/i },
    { label: "amistad/cercania cotidiana probable", regex: /\b(amig|colega|bro|hermano|hermana|compa|parce|che|jaja|tranqui|mal dia|cansad|molida|agotad|cumple|familia)\b/i },
    { label: "familia o vinculo cercano probable", regex: /\b(mama|mam[aá]|papa|pap[aá]|hijo|hija|pareja|novi[oa]|espos[ao]|familia|primo|prima|tio|tia|abuelo|abuela)\b/i }
  ]);
  const emotionalState = detectFirstSignal(signalText, [
    { label: "la otra persona parece cansada o saturada", regex: /\b(cansad|agotad|molida|molido|sal[ií] tarde|dia largo|d[ií]a largo|no fue mi mejor dia|no fue mi mejor d[ií]a|estres|estresad)\b/i },
    { label: "hay risa o complicidad reciente", regex: /\b(jaja|jeje|risa|reir|re[ií]r|me hiciste reir|sonrisa)\b/i },
    { label: "hay disculpa, demora o posible sensibilidad", regex: /\b(perdon|perd[oó]n|disculpa|lo siento|se me fue|tarde en responder|colgado|ocupad|no pude)\b/i },
    { label: "hay entusiasmo o plan avanzado", regex: /\b(reserv|confirmad|planazo|ganas|listo|hecho|perfecto|viernes|sabado|s[aá]bado|domingo|21|20:|19:)\b/i }
  ]);
  const intentSignal = detectFirstSignal(signalText, [
    { label: "necesita cerrar un siguiente paso concreto", regex: /\b(confirm|cerrar|dejamos|quedamos|envio|env[ií]o|paso|mando|ma[nñ]ana|viernes|hora|reunion|reuni[oó]n)\b/i },
    { label: "necesita pedir informacion sin sonar pesado", regex: /\b(pedir|necesito|falta|archivo|datos|info|informacion|informaci[oó]n|actualizado|actualizada)\b/i },
    { label: "necesita retomar sin reprochar", regex: /\b(retomar|reactivar|pendiente|seguimos|hilo frio|frio|esperando respuesta|sin reprochar)\b/i },
    { label: "necesita acompanar y bajar intensidad", regex: /\b(apoyar|acompa[nñ]ar|mal dia|sin serm[oó]n|sin terapia|tranqui|estoy)\b/i },
    { label: "necesita avanzar con quimica y baja presion", regex: /\b(concretar|cita|quimica|conexi[oó]n|tomar algo|sin sonar intenso|baja presion)\b/i }
  ]);
  const riskSignal = detectFirstSignal(signalText, [
    { label: "riesgo profesional o economico: responder claro, sobrio y verificable", regex: /\b(cliente|jefe|jefa|proveedor|contrato|presupuesto|factura|pago|cobro|precio|legal|clausula|reclamo|soporte|incidencia|urgente|deadline)\b/i },
    { label: "riesgo emocional o sensible: bajar intensidad y no diagnosticar", regex: /\b(ansiedad|triste|llor|duelo|deprim|mal|pelea|discusion|discusi[oó]n|cortar|ruptura|enfermo|hospital|miedo|vulnerable)\b/i },
    { label: "riesgo romantico ambiguo: no sexualizar ni presionar", regex: /\b(no se|no s[eé]|quizas|quiz[aá]s|tal vez|duda|intenso|incomoda|inc[oó]moda|raro|demasiado|espacio)\b/i }
  ]);
  const actionableMessage = hasQuotedMessage
    ? extra.quotedMessage
    : targetMessage || lastInbound || lastOutbound || null;
  const actionableText = messageTextForSignals(actionableMessage);
  const actionableSignal = actionableText
    ? `ultimo foco util: ${compactText(actionableText, 180)}`
    : "";
  const effortSignal = manualContext
    ? "hay contexto manual: tratarlo como prioridad sin repetirlo literal"
    : "sin contexto manual: inferir con cuidado desde historial, agente, objetivo, turno y datos recientes";
  const mediaSignal = mediaNotes.length
    ? "hay multimedia en contexto; usar solo caption, metadata, transcripcion o descripcion disponible, sin inventar contenido visual/no visible"
    : "";
  const quotedSignal = hasQuotedMessage
    ? quotedFromContact
      ? "mensaje marcado de la otra persona: responder ese mensaje por encima del ultimo mensaje general"
      : quotedFromUser
        ? "mensaje marcado propio: reescribir, reforzar o continuar la idea propia; no responder como contacto"
        : "hay mensaje marcado: tratarlo como centro de la accion"
    : "";
  const turnSignal = targetMessageSource === "last_outbound" || targetMessage?.sender === "me"
    ? "ultimo objetivo es un mensaje propio: no responder con entusiasmo como si fueras la otra persona"
    : targetMessageSource === "last_inbound" || targetMessage?.sender
      ? "ultimo objetivo viene del contacto: responder desde la voz del usuario"
      : "";
  const coldSignal = threadState.cooledThread
    ? threadState.waitingForReply
      ? "hilo frio y el usuario fue quien escribio ultimo: retomar con suavidad, sin reclamo ni insistencia"
      : "hilo frio: reentrada breve usando el ultimo gancho claro, sin mirar demasiado atras"
    : "";
  const factsSignal = conversationFacts.length
    ? `datos ya detectados: ${conversationFacts.slice(-5).map((fact) => compactText(fact, 120)).join(" | ")}`
    : "";
  const actionSignal = normalizeAction(action) === "rewrite"
    ? "accion reescribir: conservar intencion del borrador y mejorar claridad/naturalidad"
    : normalizeAction(action) === "reactivate"
      ? "accion reactivar: no fuerces una reapertura si el ultimo foco ya tiene una pregunta o hilo activo; responde ese foco como persona y abre continuidad breve. Si el hilo esta realmente frio y sin pregunta pendiente, reentra con un gancho nuevo. No saludes de nuevo ni recicles propuestas recientes"
      : normalizeAction(action) === "suggest"
        ? "accion sugerir: entregar una respuesta lista para enviar, no consejos"
        : "";

  return [
    "pistas, no verdades absolutas; si contradicen el contexto manual, manda el contexto manual",
    relationship ? `relacion inferida: ${relationship}` : "",
    intentSignal ? `intencion probable: ${intentSignal}` : "",
    emotionalState ? `energia emocional: ${emotionalState}` : "",
    riskSignal ? `nivel de cuidado: ${riskSignal}` : "",
    turnSignal ? `turno y foco: ${turnSignal}` : "",
    actionableSignal,
    quotedSignal,
    coldSignal,
    mediaSignal,
    factsSignal,
    actionSignal,
    effortSignal,
    manualContext ? `contexto manual comprimido: ${compactText(manualContext, 320)}` : ""
  ].filter(Boolean).join("\n");
}

function stripAccentsForSignals(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectThreadState(messages = []) {
  const ordered = [...messages].sort((a, b) => sentAtMs(a) - sentAtMs(b));
  const lastMessage = ordered[ordered.length - 1] || null;
  const lastInbound = [...ordered].reverse().find((message) => message.sender !== "me") || null;
  const lastOutbound = [...ordered].reverse().find((message) => message.sender === "me") || null;
  const lastActivityAt = sentAtMs(lastMessage);
  const inactiveHours = lastActivityAt ? (Date.now() - lastActivityAt) / 36e5 : null;
  const cooledThread = Boolean(inactiveHours !== null && inactiveHours >= COOLED_THREAD_HOURS);
  const waitingForReply = Boolean(lastMessage?.sender === "me" && lastOutbound && (!lastInbound || sentAtMs(lastOutbound) > sentAtMs(lastInbound)));

  return {
    cooledThread,
    inactiveHours: inactiveHours === null ? null : Math.round(inactiveHours * 10) / 10,
    waitingForReply,
    lastSender: lastMessage?.sender || null,
    lastInboundAt: lastInbound?.sent_at || lastInbound?.sentAt || null,
    lastOutboundAt: lastOutbound?.sent_at || lastOutbound?.sentAt || null
  };
}

function formatMessage(message = {}) {
  message = asMessage(message);
  const metadata = message.metadata || {};
  const speaker = messageSpeaker(message);
  const aiOriginSuffix = message.sender === "me" && metadata.source === "ai_suggestion"
    ? " (mensaje propio sugerido por IA y ya enviado)"
    : "";
  if (metadata.viewOnce) {
    return "";
  }
  if (message.message_type === "poll" || metadata.pollName) {
    const options = Array.isArray(metadata.pollOptions) && metadata.pollOptions.length
      ? ` Opciones: ${metadata.pollOptions.join(" / ")}.`
      : "";
    return `${speaker}${aiOriginSuffix}: encuesta "${metadata.pollName || message.body || "Encuesta"}".${options}`;
  }
  if (message.message_type === "location" || metadata.location) {
    const location = metadata.location || {};
    const label = location.name || location.address || message.body || "ubicacion";
    return `${speaker}${aiOriginSuffix}: compartio ubicacion (${label}).`;
  }
  if (message.message_type === "contact" || metadata.contactNames) {
    const names = Array.isArray(metadata.contactNames) && metadata.contactNames.length
      ? metadata.contactNames.join(", ")
      : (message.body || "contacto");
    return `${speaker}${aiOriginSuffix}: compartio contacto (${names}).`;
  }
  const mediaSuffix = message.has_media ? ` [${mediaKind(message)}${message.mime_type ? `, ${message.mime_type}` : ""}]` : "";
  const body = message.body || "";
  return `${speaker}${aiOriginSuffix}: ${body}${mediaSuffix}`;
}

function resolveContextTimeZone(profile = {}, extra = {}) {
  const candidate = String(
    extra.timeZone ||
      extra.timezone ||
      profile.time_zone ||
      profile.timezone ||
      process.env.TZ ||
      "UTC"
  ).trim();
  return candidate || "UTC";
}

function safeIsoFromMs(ms) {
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null;
}

function formatLocalTimestamp(ms, timeZone = "UTC") {
  if (!Number.isFinite(ms) || ms <= 0) return "sin_fecha";
  try {
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
      hour12: false,
      timeZone
    }).format(new Date(ms));
  } catch (_) {
    return new Date(ms).toISOString();
  }
}

function durationLabel(ms) {
  const value = Math.max(0, Math.round(Number(ms || 0)));
  if (value < 60000) return value < 1000 ? "0s" : `${Math.round(value / 1000)}s`;
  const minutes = Math.round(value / 60000);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.round((value / 3600000) * 10) / 10;
  if (hours < 48) return `${hours}h`;
  const days = Math.round((value / 86400000) * 10) / 10;
  return `${days}d`;
}

function ageLabel(ms, nowMs) {
  if (!Number.isFinite(ms) || ms <= 0) return "sin_fecha";
  const delta = Number(nowMs || Date.now()) - ms;
  if (Math.abs(delta) < 60000) return "ahora";
  return delta >= 0 ? `hace ${durationLabel(delta)}` : `en ${durationLabel(Math.abs(delta))}`;
}

function messageStatus(message = {}) {
  message = asMessage(message);
  const metadata = message.metadata || {};
  return compactText(message.status || message.delivery_status || message.deliveryStatus || metadata.status || "unknown", 40);
}

function messageCaption(message = {}) {
  message = asMessage(message);
  const metadata = message.metadata || {};
  return compactText(message.caption || metadata.caption || metadata.description || "", 260);
}

function messageTranscript(message = {}) {
  message = asMessage(message);
  const metadata = message.metadata || {};
  return compactText(metadata.transcript || metadata.audioTranscript || metadata.transcription || message.transcript || "", 420);
}

function messageQuotedSummary(message = {}) {
  message = asMessage(message);
  const metadata = message.metadata || {};
  const quoted = metadata.quotedMessage || metadata.quoted || metadata.contextInfo?.quotedMessage || null;
  if (!quoted) return "";
  if (typeof quoted === "string") return compactText(quoted, 220);
  const origin = quoted.sender === "me" || quoted.fromMe === true ? "usuario" : "contacto";
  const text = compactText(quoted.text || quoted.body || quoted.caption || quoted.message || quoted.type || "", 220);
  return `${origin}: ${text || "sin texto visible"}`;
}

function messageIsAiGenerated(message = {}) {
  message = asMessage(message);
  const metadata = message.metadata || {};
  return Boolean(
    metadata.source === "ai_suggestion" ||
      metadata.aiGenerated ||
      metadata.generatedByAi ||
      metadata.wafliAi
  );
}

function escapeAttr(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatStructuredMessage(message = {}, index = 0, previousMessage = null, options = {}) {
  message = asMessage(message);
  if (!Object.keys(message).length) return "";
  const nowMs = Number(options.nowMs || Date.now());
  const timeZone = options.timeZone || "UTC";
  const isGroup = Boolean(options.isGroup);
  const sentMs = sentAtMs(message);
  const previousMs = previousMessage ? sentAtMs(previousMessage) : 0;
  const id = message.external_message_id || message.id || `message_${index + 1}`;
  const owner = ownerForMessage(message, isGroup);
  const type = message.message_type || message.messageType || message.type || message.metadata?.messageType || "text";
  const text = compactText(messageTextForSignals(message) || message.body || "", 720);
  const caption = messageCaption(message);
  const transcript = messageTranscript(message);
  const quoted = messageQuotedSummary(message);
  const media = message.has_media ? `${mediaKind(message)}${message.mime_type ? `/${message.mime_type}` : ""}` : "";
  const focus = options.targetMessage && sameCachedMessage(message, options.targetMessage) ? "true" : "false";
  const gapFromPrevious = sentMs && previousMs ? durationLabel(Math.abs(sentMs - previousMs)) : previousMs ? "sin_fecha" : "inicio";
  const lines = [
    `<message index="${index + 1}" id="${escapeAttr(id)}" owner="${owner}" sent_at_iso="${safeIsoFromMs(sentMs) || "unknown"}" sent_at_local="${escapeAttr(formatLocalTimestamp(sentMs, timeZone))}" age="${escapeAttr(ageLabel(sentMs, nowMs))}" gap_from_previous="${escapeAttr(gapFromPrevious)}" message_type="${escapeAttr(type)}" status="${escapeAttr(messageStatus(message))}" is_ai_generated="${messageIsAiGenerated(message) ? "true" : "false"}" focus="${focus}">`,
    text ? `text: ${text}` : "text: (sin texto visible)",
    caption ? `caption: ${caption}` : "",
    transcript ? `transcript: ${transcript}` : "",
    quoted ? `quoted_message: ${quoted}` : "",
    media ? `media: ${media}` : "",
    "</message>"
  ].filter(Boolean);
  return lines.join("\n");
}

function formatStructuredMessages(messages = [], options = {}) {
  const ordered = compactMessages(messages);
  return ordered
    .map((message, index) => formatStructuredMessage(message, index, index > 0 ? ordered[index - 1] : null, options))
    .filter(Boolean)
    .join("\n");
}

function buildContextNow(now = new Date(), timeZone = "UTC") {
  const ms = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return {
    iso: safeIsoFromMs(ms) || new Date().toISOString(),
    local: formatLocalTimestamp(ms, timeZone),
    timeZone
  };
}

function buildTimelineSpan(messages = [], nowMs = Date.now()) {
  const times = compactMessages(messages)
    .map(sentAtMs)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  const first = times[0] || null;
  const last = times[times.length - 1] || null;
  return {
    messageCount: messages.length,
    firstMessageAt: safeIsoFromMs(first),
    lastMessageAt: safeIsoFromMs(last),
    spanHours: first && last ? Math.round(((last - first) / 3600000) * 10) / 10 : null,
    silenceHours: last ? Math.round(((nowMs - last) / 3600000) * 10) / 10 : null
  };
}

function cleanForChat(rawText = "") {
  return cleanGeneratedText(rawText)
    .replace(/[¿¡]/g, "")
    .replace(/\s+([?!.,;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^(?:y\s+)?(?:que|qué)\s+te\s+parece\?\s*/i, "")
    .replace(/^si\s+te\s+parece,\s*/i, "")
    .replace(/^(?:viste|ves)\?\s*/i, "")
    .replace(/,\s*no\?\s*/gi, ", ")
    .replace(/\s+(?:que|qué)\s+te\s+parece\??$/i, "")
    .replace(/\s+a\s+(?:que|qué)\s+hora\s+[^.!?]*\??$/i, "")
    .replace(/\s+(?:cuando|cuándo|donde|dónde)\s+[^.!?]*\??$/i, "")
    .replace(/\s+(?:como|cómo)\s+(?:estuvo|va)\s+[^.!?]*\??$/i, "")
    .replace(/\s+(?:ten[eé]s|tienes)\s+(?:alg[uú]n|un)\s+[^.!?]*\??$/i, "")
    .replace(/\s+(?:quieres|quer[eé]s)\s+que\s+[^.!?]*\??$/i, "")
    .replace(/\s+(?:que|qué)\s+m[aá]s\s+(?:cont[aá]s|cuentas|quer[eé]s|quieres)(?:\s+.*)?\??$/i, "")
    .replace(/\s+(?:que|qué)\s+m[aá]s(?:\s+se\s+te\s+ocurre|\s+podemos\s+hacer|\s+seguimos|\s+.*)?\??$/i, "")
    .replace(/\s+(?:que|qué)\s+tal\s+va(?:\s+.*)?\??$/i, "")
    .replace(/\s+(?:lo\s+vemos|lo\s+miramos)\s+(?:desde\s+)?(?:otro|otra)\s+(?:angulo|ángulo|lado|forma)\??$/i, "")
    .replace(/\s+(?:seguimos|seguimos\s+por\s+ah[ií]|le\s+seguimos|vamos\s+viendo|lo\s+vamos\s+viendo)\??$/i, "")
    .replace(/\s+(?:te\s+parece|te\s+copa|te\s+apetece|verdad|no|no\s+cre[eé]s|como\s+quieras|si\s+quer[eé]s|si\s+quieres|si\s+pinta.*|avisame|av[ií]same|me\s+avis[aá]s.*|te\s+anim[aá]s.*|cualquier\s+cosa)\??$/i, "")
    .replace(/\s+(?:quieres|quer[eé]s|te\s+gustar[ií]a)\s+[^.!?]*\??$/i, "")
    .replace(/[,\s]+$/g, "")
    .trim();
}

const OWN_TURN_CONTACT_REPLY_RE =
  /^(?:dale|perfecto|me parece(?:\s+\w+)?|obvio|s[ií]|si|de una|claro|genial|joya|sale|va|vale|ok|esta bien|est[aá] bien|entonces quedamos|quedamos as[ií]|quedamos asi)[,!.]?(?:\s+|$)/i;

const OWN_TURN_QUESTION_TAIL_RE =
  /(?:^|\s)[^.!?]*(?:te\s+parece|te\s+copa|te\s+anim[aá]s|si\s+quer[eé]s|si\s+quieres|qu[eé]\s+dec[ií]s|que\s+dices)[^.!?]*\?\s*/gi;

function ownTurnFallback(metadata = {}) {
  const agent = String(metadata.agent || metadata.tone || "").toLowerCase();
  const objective = String(metadata.objective || "").toLowerCase();
  const situation = String(metadata.situation || "").toLowerCase();
  const signal = `${agent} ${objective} ${situation}`;
  if (/prof|cliente|jefe|trabajo|presupuesto|pago|documento|tarea|laboral/.test(signal)) {
    return "Lo dejo claro por acá y avanzo con el siguiente paso cuando tenga confirmación";
  }
  if (/lig|flirt|cita|plan|salir|quimica|química|coqueteo/.test(signal)) {
    return "También puedo proponer algo concreto y dejarlo liviano, sin darle tantas vueltas";
  }
  return "Lo dejo así, más claro y con calma, para que se entienda bien";
}

function isOwnTurnReplyToUser(text = "") {
  return OWN_TURN_CONTACT_REPLY_RE.test(String(text || "").trim());
}

function cleanForTurn(rawText = "", action = "suggest", metadata = {}) {
  const original = cleanForChat(rawText);
  let cleaned = original;
  const ownTurn = action === "suggest" && (metadata.targetMessageSender === "me" || metadata.lastMessageFromUser);

  if (ownTurn) {
    const lookedLikeContactReply = isOwnTurnReplyToUser(original);
    cleaned = cleaned
      .replace(OWN_TURN_CONTACT_REPLY_RE, "")
      .replace(OWN_TURN_QUESTION_TAIL_RE, " ")
      .replace(/\s+[^.!?]*\?\s*$/i, "")
      .trim();
    cleaned = cleanForChat(cleaned);
    if (
      !cleaned ||
      isOwnTurnReplyToUser(cleaned) ||
      (lookedLikeContactReply && cleaned.length < 24) ||
      isTooShortGeneratedText(cleaned)
    ) {
      return ownTurnFallback(metadata);
    }
  }

  return cleanForChat(cleaned) || original;
}

function containsAnonymizedPlaceholder(text = "") {
  ANONYMIZED_PLACEHOLDER_RE.lastIndex = 0;
  return ANONYMIZED_PLACEHOLDER_RE.test(String(text || ""));
}

function stripAnonymizedPlaceholders(text = "") {
  return cleanForChat(String(text || "")
    .replace(/\s*\[(?:persona_\d+|telefono|email|url|documento)\]\s*/gi, " ")
    .replace(/\s+([?!.,;:])/g, "$1")
    .replace(/\s{2,}/g, " "));
}

function providerCompletionText(result) {
  if (typeof result === "string") return result;
  return result?.text || "";
}

function isTooShortGeneratedText(text = "") {
  const value = String(text || "").trim();
  const words = value.split(/\s+/).filter(Boolean);
  return value.length < 6 || words.length < 3 || /^(?:y|me|si|sí|ok|dale|va|sale)$/i.test(value);
}

async function rewriteWithoutPlaceholders(_provider, text, _tone, _model) {
  if (!containsAnonymizedPlaceholder(text)) return { text, completion: null };
  return { text: stripAnonymizedPlaceholders(text) || text, completion: null };
}

function shortGeneratedFallback(action, metadata = {}, payload = {}) {
  const agent = normalizeAgentName(metadata.agent || payload.agent || payload.tone);
  if (action === "rewrite") {
    return cleanForChat(payload.draft || payload.message || payload.text || "");
  }
  if (metadata.turnOwner === "me") return ownTurnFallback(metadata);
  if (agent === "Profesional") return "Lo reviso y te confirmo el siguiente paso.";
  if (agent === "Amistoso") return "Te leo, seguimos cuando puedas.";
  if (agent === "Ligoteo") return "Me gusta por donde va esto; sigamos un rato.";
  return "Te respondo mejor en un momento.";
}

function modelForAction(action = "suggest") {
  const normalized = normalizeAction(action);
  return config.openai.models?.[normalized] || config.openai.model || "gpt-4.1-mini";
}

function generationTemperature(action = "suggest", promptConfig = {}, metadata = {}) {
  const normalized = normalizeAction(action);
  const agent = String(promptConfig.agent || metadata.agent || metadata.tone || "").trim().toLowerCase();
  const objective = String(metadata.objective || metadata.customObjective || "").trim().toLowerCase();
  const riskText = [
    metadata.riskLevel,
    metadata.situation,
    metadata.relationshipType,
    objective
  ].filter(Boolean).join(" ").toLowerCase();
  const precisionContext = /\b(?:profesional|cliente|jefe|jefa|contrato|presupuesto|factura|pago|pagos|legal|soporte|incidencia|documento|archivo|tarea|reunion|reuni[oó]n|plazo|deadline)\b/i.test(riskText);
  const boundaryContext = /\b(?:limite|l[ií]mite|no quiero|no puedo|necesito espacio|privacidad|seguridad|conflicto|reclamo|queja|molestia)\b/i.test(riskText);

  let temperature = {
    analyze: 0.38,
    rewrite: 0.56,
    suggest: 0.62,
    reactivate: 0.66,
    opener: 0.74,
    recommend: 0.64
  }[normalized] || 0.62;

  if (agent === "profesional") temperature -= 0.08;
  if (agent === "ligoteo") temperature += normalized === "rewrite" ? 0.08 : 0.1;
  if (agent === "amistoso") temperature += 0.04;

  if (/\b(?:auto|crear conexion|crear conexión|romper hielo|seguir|quimica|química|personalizado)\b/i.test(objective)) temperature += 0.04;
  if (/\b(?:cerrar tarea|confirmar|pedir informacion|pedir información|aclarar|revisar|soporte)\b/i.test(objective)) temperature -= 0.06;

  if (precisionContext) temperature -= 0.08;
  if (boundaryContext) temperature -= 0.1;
  if (metadata.hasPreviousGeneratedText || metadata.isRegeneration || (Array.isArray(metadata.recentGeneratedTexts) && metadata.recentGeneratedTexts.length)) {
    temperature += normalized === "rewrite" ? 0.06 : 0.08;
  }

  return Math.max(0.32, Math.min(0.82, Number(temperature.toFixed(2))));
}

function contextLimitForAction(action = "suggest") {
  const normalized = normalizeAction(action);
  const configured = Number(config.openai.contextLimits?.[normalized]);
  if (Number.isFinite(configured) && configured > 0) return Math.round(configured);
  return Math.max(1, Number(config.openai.contextMessageLimit || 20));
}

function contextLimitInfoForAction(action = "suggest") {
  const normalized = normalizeAction(action);
  const envName = CONTEXT_LIMIT_ENV_BY_ACTION[normalized] || "";
  const configured = Number(config.openai.contextLimits?.[normalized]);
  const globalLimit = Number(config.openai.contextMessageLimit || 20);
  const hasActionEnv = Boolean(envName && String(process.env[envName] || "").trim());
  const hasGlobalEnv = Boolean(String(process.env.AI_CONTEXT_MESSAGE_LIMIT || "").trim());
  if (Number.isFinite(configured) && configured > 0) {
    return {
      limit: Math.round(configured),
      source: hasActionEnv ? envName : "config.openai.contextLimits"
    };
  }
  return {
    limit: Math.max(1, Math.round(globalLimit)),
    source: hasGlobalEnv ? "AI_CONTEXT_MESSAGE_LIMIT" : "config.openai.contextMessageLimit"
  };
}

function qualityContractPrompt(action = "suggest", metadata = {}) {
  const normalized = normalizeAction(action);
  return [
    `Contrato WaFli contextual ${metadata.promptProfileVersion || PROMPT_PROFILE_VERSION}:`,
    "Devuelve solo el mensaje final listo para WhatsApp.",
    "Responde al foco actual y respeta el turno detectado; si el foco es propio, continua o mejora esa voz sin fingir respuesta del contacto.",
    "Usa la linea de tiempo y sus timestamps como evidencia. No inventes fechas, horas, planes, disponibilidad, emociones ni contenido multimedia.",
    "Elige una sola jugada conversacional: responder, confirmar, proponer, aclarar, acompanar, bromear, bajar intensidad o cerrar.",
    `Intencion local: ${metadata.intent || "general_reply"}; fase=${metadata.conversationPhase || "active_reply"}; movimiento=${metadata.responseMove || metadata.intentResponseMove || "responder_al_foco_actual"}; evidencia=${metadata.evidenceMode || "visible_context_only"}.`,
    metadata.hasUserContext
      ? "Las notas manuales de la persona usuaria tienen prioridad sobre inferencias automaticas."
      : "Si no hay notas manuales, usa el contexto estructurado y el copiloto como apoyo, no como guion rigido.",
    metadata.hasMedia ? "Multimedia: usa solo imagen adjunta, caption, transcripcion o metadata visible; sticker, video o archivo no visible no se interpreta." : "",
    metadata.riskLevel === "high" ? "Riesgo alto: respeta limites explicitos y no presiones, no sexualices, no prometas ni rellenes informacion ausente." : "",
    normalized === "rewrite" ? "Reescritura: conserva la intencion del borrador y mejora naturalidad sin cambiar quien habla." : "",
    normalized === "reactivate" ? "Reactivar: si hay foco vivo, responde ese foco; si el hilo esta frio, reabre breve, especifico y sin reproche." : "",
    normalized === "analyze" ? "Analisis: explica el sentido probable con cautela y separa evidencia visible de inferencia." : ""
  ].filter(Boolean).join("\n");
}

function messageCacheId(message = {}) {
  message = message || {};
  return String(message.external_message_id || message.id || "").trim();
}

function sameCachedMessage(a = {}, b = {}) {
  a = a || {};
  b = b || {};
  const aId = messageCacheId(a);
  const bId = messageCacheId(b);
  return Boolean(aId && bId && aId === bId);
}

function focusedMediaMessages(messages = [], { targetMessage = null, lastMessage = null, quotedMessage = null } = {}) {
  const result = [];
  const pushUnique = (message) => {
    if (!message?.has_media || !messageCacheId(message)) return;
    if (result.some((item) => sameCachedMessage(item, message))) return;
    result.push(message);
  };

  const quotedId = messageCacheId(quotedMessage);
  if (quotedId) {
    const quotedCached = messages.find((message) => messageCacheId(message) === quotedId);
    pushUnique(quotedCached);
    if (result.length) return result;
  }

  pushUnique(targetMessage);
  if (result.length) return result;

  pushUnique(lastMessage);
  return result;
}

async function readStreamToBufferLimited(stream, maxBytes = 0) {
  const chunks = [];
  let total = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk || []);
    total += buffer.length;
    if (maxBytes > 0 && total > maxBytes) {
      const error = new Error("media_too_large_for_ai_context");
      error.code = "media_too_large_for_ai_context";
      throw error;
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, total);
}

async function loadDescriptorImageForAiContext(userId, chatId, messageId, maxBytes = 0) {
  if (!messageId || !config.openai.attachImagesToContext || maxBytes <= 0) return null;
  try {
    const whatsappService = require("./whatsappService");
    if (typeof whatsappService.streamMessageMedia !== "function") return null;
    const streamed = await whatsappService.streamMessageMedia(userId, chatId, messageId);
    const declaredSize = Number(streamed?.sizeBytes || 0);
    if (declaredSize > maxBytes) {
      return { skipped: true, reason: "too_large", sizeBytes: declaredSize };
    }
    const data = await readStreamToBufferLimited(streamed.stream, maxBytes);
    if (!data.length) return null;
    return {
      media_type: streamed.mediaType || "image",
      mime_type: streamed.mimeType || "image/jpeg",
      file_name: streamed.fileName || `${messageId}.jpg`,
      size_bytes: data.length,
      data,
      metadata: { source: "ai_descriptor_stream", temporary: true }
    };
  } catch (error) {
    return {
      skipped: true,
      reason: error?.code || error?.name || "download_failed",
      message: error?.message || "download failed"
    };
  }
}

async function buildMediaContext({ userId, chatId, messages, provider, targetMessage = null, lastMessage = null, quotedMessage = null }) {
  const mediaNotes = [];
  const imageParts = [];
  const limit = Math.max(0, config.openai.mediaContextLimit);
  const mediaMessages = focusedMediaMessages(messages, { targetMessage, lastMessage, quotedMessage }).slice(-limit);

  for (const message of mediaMessages) {
    const kind = mediaKind(message);
    const speaker = messageSpeaker(message);
    const messageId = message.external_message_id || message.id;
    let mediaRow = await chatService.getMessageMedia(userId, chatId, messageId).catch(() => null);
    let descriptorReason = "";
    const declaredSize = Number(message.metadata?.sizeBytes || message.size_bytes || 0);
    if (!mediaRow?.data && kind === "image" && config.openai.attachImagesToContext) {
      if (declaredSize > config.openai.imageContextMaxBytes) {
        descriptorReason = "imagen demasiado grande para adjuntar a IA";
      } else {
        const streamedRow = await loadDescriptorImageForAiContext(userId, chatId, messageId, config.openai.imageContextMaxBytes);
        if (streamedRow?.data) {
          mediaRow = streamedRow;
        } else if (streamedRow?.reason) {
          descriptorReason = streamedRow.reason;
        }
      }
    }
    if (!mediaRow?.data) {
      if (message.metadata?.viewOnce) {
        mediaNotes.push(`Adjunto de ${speaker}: contenido de una sola visualizacion, no disponible para WaFli ni para IA.`);
      } else {
        mediaNotes.push(`Adjunto de ${speaker}: ${kind}, no disponible para ver en esta generacion${descriptorReason ? ` (${descriptorReason})` : ""}. Usa solo caption, metadata o contexto escrito; no inventes contenido.`);
      }
      continue;
    }

    const mimeType = mediaRow.mime_type || message.mime_type || "application/octet-stream";
    if (kind === "sticker") {
      mediaNotes.push(`Sticker de ${speaker}: no se interpreta como contenido. Usalo solo como senal minima de tono si el texto cercano lo hace obvio; no lo analices ni bases la respuesta en el sticker.`);
      continue;
    }

    if (kind === "image" && mimeType.startsWith("image/")) {
      const sizeBytes = Number(mediaRow.size_bytes || mediaRow.data?.length || 0);
      const temporaryVision = mediaRow.metadata?.source === "ai_descriptor_stream";
      mediaNotes.push(`Imagen de ${speaker}: ${message.body || mediaRow.file_name || "imagen recibida"} (${mimeType}${sizeBytes ? `, ${Math.ceil(sizeBytes / 1024)} KB` : ""}). ${temporaryVision ? "Adjuntada temporalmente a IA para esta generacion; no queda cacheada. " : ""}Usa lo visible solo si aporta contexto claro; no inventes detalles.`);
      if (
        config.openai.attachImagesToContext &&
        imageParts.length < config.openai.imageContextMaxFiles &&
        sizeBytes > 0 &&
        sizeBytes <= config.openai.imageContextMaxBytes
      ) {
        imageParts.push({
          type: "image_url",
          image_url: {
            url: `data:${mimeType};base64,${mediaRow.data.toString("base64")}`
          }
        });
      }
      continue;
    }

    if (kind === "audio") {
      const transcript = message.metadata?.transcript
        || message.metadata?.audioTranscript
        || message.metadata?.transcription
        || message.metadata?.text
        || "";
      mediaNotes.push(transcript
        ? `Audio de ${speaker} transcrito: ${transcript}`
        : `Audio de ${speaker}: audio recibido. No se transcribe automaticamente durante la generacion para mantener una sola llamada de IA; usar solo caption o transcripcion disponible.`);
      continue;
    }

    if (kind === "video") {
      const sizeMb = mediaRow.size_bytes ? `, ${(Number(mediaRow.size_bytes) / (1024 * 1024)).toFixed(1)} MB` : "";
      mediaNotes.push([
        `Video de ${speaker}: ${message.body || mediaRow.file_name || "video recibido"} (${mimeType}${sizeMb}).`,
        "El video no se envia ni se interpreta en V0. Si el contenido del video es importante, usa solo la descripcion/caption disponible o pide a la persona usuaria que lo describa para mayor precision."
      ].join(" "));
      continue;
    }

    if (kind === "document") {
      mediaNotes.push(`Documento de ${speaker}: ${mediaRow.file_name || message.body || "archivo"}. El contenido del documento no se lee automaticamente en V0.`);
      continue;
    }

    mediaNotes.push(`Archivo de ${speaker}: tipo ${kind}, ${mimeType}.`);
  }

  return { mediaNotes, imageParts };
}

function isAutoSelection(value) {
  const key = String(value || "").trim().toLowerCase();
  return !key || key === "auto" || key === "automatico" || key === "automático" || key === "recomendado";
}

function normalizeAgentLabel(value) {
  const raw = String(value || "").trim();
  const key = raw.toLowerCase();
  if (!raw || isAutoSelection(raw)) return "";
  if (/prof|trabajo|cliente|jefe|formal/.test(key)) return "Profesional";
  if (/lig|flirt|cita|quimica|química|romant/.test(key)) return "Ligoteo";
  if (/ami|casual|cercan|famil|natural/.test(key)) return "Amistoso";
  return "";
}

function resolveContextAgent(extra = {}, manualProfile = {}, profile = {}) {
  const explicit = normalizeAgentLabel(extra.agent || extra.aiAgent || extra.tone);
  if (explicit) return explicit;
  const preferred = normalizeAgentLabel(manualProfile.preferredAgent);
  if (preferred) return preferred;
  return normalizeAgentLabel(profile.base_tone || profile.tone) || "Ligoteo";
}

function signalTextFrom({ orderedRecent = [], extra = {}, targetMessage = null, lastInbound = null, lastOutbound = null, mediaNotes = [] }) {
  const messageBits = [targetMessage, lastInbound, lastOutbound]
    .filter(Boolean)
    .map((message) => String(asMessage(message).body || asMessage(message).text || "").trim())
    .filter(Boolean);
  const recentBits = orderedRecent
    .slice(-8)
    .map((message) => String(asMessage(message).body || asMessage(message).text || "").trim())
    .filter(Boolean);
  return [
    ...messageBits,
    ...recentBits,
    extra.userContext,
    extra.customObjective,
    extra.objective,
    extra.draft,
    extra.message,
    extra.mediaContext,
    extra.notes,
    mediaNotes.join(" ")
  ].filter(Boolean).join(" ").toLowerCase();
}

function inferRelationshipType({ manualProfile = {}, agent = "", signalText = "", isGroup = false }) {
  if (manualProfile.relationshipType && manualProfile.relationshipType !== "auto") return manualProfile.relationshipType;
  if (isGroup) return "group";
  if (/jefe|manager|cliente|presupuesto|factura|reunion|reunión|contrato|proyecto|entrega|trabajo|empresa/.test(signalText)) {
    if (/jefe|manager/.test(signalText)) return "boss";
    if (/cliente|presupuesto|factura|contrato/.test(signalText)) return "client";
    return "professional";
  }
  if (agent === "Ligoteo" || /cita|quedar|vernos|tomar algo|cafe|café|beso|ligue|me gustas|guapo|guapa|quimica|química/.test(signalText)) return "flirt";
  if (/mama|mamá|papa|papá|herman|familia|primo|prima|tio|tía|abuelo|abuela/.test(signalText)) return "family";
  if (/amigo|amiga|colega|bro|tio|tía|plan|finde|jaja|jeje/.test(signalText)) return "friend";
  return "unknown";
}

function inferSituation({ action, relationshipType, threadState = {}, targetMessageSender, mediaNotes = [], signalText = "" }) {
  if (action === "rewrite") return "reescritura_mensaje_propio";
  if (action === "reactivate" || threadState.cooledThread) return "hilo_frio";
  if (targetMessageSender === "me") return "continuar_mensaje_propio";
  if (mediaNotes.length) return "respuesta_con_multimedia";
  if (["boss", "client", "professional"].includes(relationshipType)) return "conversacion_profesional";
  if (relationshipType === "flirt") return "conversacion_ligoteo";
  if (/perdon|lo siento|disculpa|malentendido|enfad|molest/.test(signalText)) return "reparar_tension";
  return "responder_turno_actual";
}

function inferObjective({ action, agent, extra = {}, signalText = "", threadState = {}, targetMessageSender, relationshipType }) {
  const requested = String(extra.objective || "").trim();
  if (!isAutoSelection(requested)) return { objective: requested, objectiveSource: "manual" };
  if (agent === "Profesional") {
    if (/\?|cuando|cu[aá]ndo|dato|documento|archivo|precio|presupuesto|detalle|confirm/.test(signalText)) {
      return { objective: "Pedir informacion", objectiveSource: "auto" };
    }
    if (action === "reactivate" || /cerrar|terminar|entrega|reunion|reunión|tarea|deadline|fecha/.test(signalText)) {
      return { objective: "Cerrar una tarea", objectiveSource: "auto" };
    }
    return { objective: "Responder con claridad", objectiveSource: "auto" };
  }
  if (agent === "Ligoteo") {
    if (/quedar|vernos|cita|tomar algo|cafe|café|cuando puedes|cu[aá]ndo puedes|esta semana/.test(signalText)) {
      return { objective: "Concretar una cita", objectiveSource: "auto" };
    }
    if (action === "reactivate" || threadState.cooledThread || relationshipType === "flirt") {
      return { objective: "Crear conexion", objectiveSource: "auto" };
    }
    return { objective: "Seguir la charla con quimica", objectiveSource: "auto" };
  }
  if (/mal|triste|agobiad|ansiedad|cansad|preocupad|duro|fatal|llorar/.test(signalText)) {
    return { objective: "Apoyar o acompanar", objectiveSource: "auto" };
  }
  if (action === "reactivate" || threadState.cooledThread) {
    return { objective: "Mantener la conversacion", objectiveSource: "auto" };
  }
  if (targetMessageSender === "me") {
    return { objective: "Responder natural", objectiveSource: "auto" };
  }
  return { objective: "Responder natural", objectiveSource: "auto" };
}

function inferIntensity({ extra = {}, manualProfile = {}, agent = "", objective = "", relationshipType = "", signalText = "" }) {
  const requested = String(extra.intensity || manualProfile.intensity || "").trim().toLowerCase();
  if (["suave", "media", "directa"].includes(requested)) return requested;
  if (/directo|directa|sin vueltas|claro|clara/.test(signalText)) return "directa";
  if (agent === "Ligoteo") return /cita|concretar|quedar|vernos/.test(String(objective).toLowerCase()) ? "media" : "suave";
  if (agent === "Profesional") return "media";
  if (relationshipType === "boss" || relationshipType === "client") return "media";
  return "suave";
}

function inferResponseLength({ manualProfile = {}, signalText = "" }) {
  const requested = String(manualProfile.responseLength || "").trim().toLowerCase();
  if (["corta", "media", "larga"].includes(requested)) return requested;
  if (/explica|detalla|desarrolla/.test(signalText)) return "media";
  return "auto";
}

function inferInitiativeLevel({ manualProfile = {}, agent = "", objective = "", signalText = "" }) {
  const requested = String(manualProfile.initiativeLevel || manualProfile.initiative || "").trim().toLowerCase();
  if (["prudente", "equilibrada", "proactiva"].includes(requested)) return requested;
  const joined = `${String(objective || "").toLowerCase()} ${signalText}`;
  if (agent === "Ligoteo" && /plan|cita|quedar|vernos|tomar algo|esta noche|hoy|concretar/.test(joined)) return "proactiva";
  if (agent === "Profesional") return "equilibrada";
  return "equilibrada";
}

function buildContextIntelligenceSignals({ action, extra, profile, orderedRecent, lastInbound, lastOutbound, targetMessage, targetMessageSender, threadState, mediaNotes, requestedAgent, conversationProfile, isGroup }) {
  const manualProfile = conversationProfile?.manual || {};
  const signalText = signalTextFrom({ orderedRecent, extra, targetMessage, lastInbound, lastOutbound, mediaNotes });
  const agent = requestedAgent || resolveContextAgent(extra, manualProfile, profile);
  const relationshipType = inferRelationshipType({ manualProfile, agent, signalText, isGroup });
  const { objective, objectiveSource } = inferObjective({ action, agent, extra, signalText, threadState, targetMessageSender, relationshipType });
  const intensity = inferIntensity({ extra, manualProfile, agent, objective, relationshipType, signalText });
  const responseLength = inferResponseLength({ manualProfile, signalText });
  const initiativeLevel = inferInitiativeLevel({ manualProfile, agent, objective, signalText });
  const situation = inferSituation({ action, relationshipType, threadState, targetMessageSender, mediaNotes, signalText });
  return {
    agent,
    objective,
    objectiveSource,
    intensity,
    responseLength,
    initiativeLevel,
    addressMode: manualProfile.addressMode || "auto",
    situation,
    relationshipType,
    usedConversationProfile: Boolean(conversationProfile?.style || conversationProfile?.manual)
  };
}

function formatUserAiStyleProfile(profile = {}) {
  const source = profile.ai_style_profile || profile.aiStyleProfile || {};
  if (!source || typeof source !== "object") return "";
  const wordsUse = String(source.wordsUse || source.words_use || "").trim();
  const wordsAvoid = String(source.wordsAvoid || source.words_avoid || "").trim();
  const examples = String(source.examples || source.writingExamples || source.styleExamples || "").trim();
  const parts = [
    wordsUse ? `palabras_que_suele_usar=${wordsUse}` : "",
    wordsAvoid ? `palabras_que_no_usa=${wordsAvoid}` : "",
    examples ? `ejemplos_de_como_escribe=${examples}` : ""
  ].filter(Boolean);
  return parts.length ? `estilo_personal_usuario: ${parts.join("; ")}. Usalo como preferencia suave: imita cadencia y longitud sin copiar literal, sin exagerar y evita palabras marcadas si no son necesarias.` : "";
}

async function buildContext(userId, chatId, extra = {}, provider, profile = {}) {
  const manualMode = isManualAiContext(chatId, extra);
  const messages = compactMessages(manualMode ? buildManualAiMessages(extra) : (chatId ? await chatService.getMessages(userId, chatId).catch(() => []) : []));
  const action = normalizeAction(extra.action || "suggest");
  const contextLimitInfo = contextLimitInfoForAction(action);
  const contextMessageLimit = contextLimitInfo.limit;
  const recentMessages = messages.slice(-contextMessageLimit);
  const orderedRecent = [...recentMessages].sort((a, b) => sentAtMs(a) - sentAtMs(b));
  const lastMessage = orderedRecent[orderedRecent.length - 1] || null;
  const lastInbound = [...orderedRecent].reverse().find((message) => message.sender !== "me") || null;
  const lastOutbound = [...orderedRecent].reverse().find((message) => message.sender === "me") || null;
  const lastMessageFromUser = Boolean(lastMessage?.sender === "me");
  const lastMessageFromContact = Boolean(lastMessage && lastMessage.sender !== "me");
  const hasQuotedMessage = Boolean(extra.quotedMessage && typeof extra.quotedMessage === "object");
  const quotedFromUser = quotedMessageFromUser(extra.quotedMessage);
  const quotedFromContact = quotedMessageFromContact(extra.quotedMessage);
  let targetMessage = null;
  let targetMessageSource = "last_message";

  if (hasQuotedMessage) {
    targetMessageSource = "quoted";
  } else if (action === "suggest" || action === "analyze" || action === "recommend") {
    targetMessage = lastMessage;
    targetMessageSource = targetMessage
      ? (targetMessage.sender === "me" ? "last_outbound" : "last_inbound")
      : "none";
  } else if (action === "rewrite") {
    const hasOwnInput = Boolean(extra.draft || extra.message);
    targetMessage = hasOwnInput ? null : (lastMessageFromUser ? lastMessage : lastOutbound);
    targetMessageSource = hasOwnInput ? "draft" : targetMessage ? "last_outbound" : "none";
  } else if (action === "opener") {
    targetMessage = lastMessage;
    targetMessageSource = targetMessage ? (targetMessage.sender === "me" ? "last_outbound" : "last_inbound") : "new_thread";
  } else if (action === "reactivate") {
    targetMessage = lastMessage;
    targetMessageSource = targetMessage ? (targetMessage.sender === "me" ? "last_outbound" : "last_inbound") : "new_thread";
  } else {
    targetMessage = lastMessage;
    targetMessageSource = targetMessage ? (targetMessage.sender === "me" ? "last_outbound" : "last_inbound") : "none";
  }

  const targetMessageSender = hasQuotedMessage ? (quotedFromUser ? "me" : "match") : (targetMessage?.sender || null);
  const supportMessages = targetMessage
    ? orderedRecent.filter((message) => message !== targetMessage)
    : orderedRecent;
  const threadState = detectThreadState(recentMessages);
  const conversationFacts = extractConversationFacts(recentMessages);
  const conversationProfile = chatId && !manualMode
    ? await conversationProfileService.refreshProfile(userId, chatId, recentMessages).catch(() => null)
    : null;
  const safeConversationProfile = conversationProfile ? conversationProfileService.normalizeProfile(conversationProfile) : null;
  const conversationProfilePrompt = conversationProfileService.formatProfileForPrompt(conversationProfile);
  const mediaResult = await buildMediaContext({
    userId,
    chatId,
    messages: recentMessages,
    provider,
    targetMessage,
    lastMessage,
    quotedMessage: extra.quotedMessage
  });
  const mediaNotes = [...(mediaResult.mediaNotes || [])];
  const imageParts = mediaResult.imageParts || [];
  const standaloneToolImage = normalizeStandaloneToolImage(extra.screenshot || extra.profileScreenshot || extra.toolImage);
  if (standaloneToolImage) {
    mediaNotes.push(`captura_herramienta: ${standaloneToolImage.fileName}. Usa la imagen solo como contexto visual de la herramienta standalone. No inventes datos que no se vean o no esten escritos.`);
    imageParts.push({ type: "image_url", image_url: { url: standaloneToolImage.dataUrl } });
  }
  const manualContext = normalizeManualContext(extra.manualContext);
  if (manualMode && manualContext.captureName) {
    mediaNotes.push(`captura_manual: ${manualContext.captureName}. No inventes contenido visual; usa solo detalles escritos en el contexto adicional o en el mensaje.`);
  }
  const variant = toolVariant(extra.variant || extra.spanishVariant, profile.spanish_variant || profile.variant);
  const isGroup = orderedRecent.some((message) => asMessage(message).metadata?.isGroup || String(asMessage(message).chat_id || asMessage(message).chatId || "").endsWith("@g.us"));
  const now = new Date();
  const nowMs = now.getTime();
  const contextTimeZone = resolveContextTimeZone(profile, extra);
  const contextNow = buildContextNow(now, contextTimeZone);
  const contextTimelineSpan = buildTimelineSpan(orderedRecent, nowMs);
  const requestedAgent = resolveContextAgent(extra, safeConversationProfile?.manual || {}, profile);
  const tone = normalizeTone(requestedAgent);
  const contextIntelligence = buildContextIntelligenceSignals({
    action,
    extra,
    profile,
    orderedRecent,
    lastInbound,
    lastOutbound,
    targetMessage,
    targetMessageSender,
    threadState,
    mediaNotes,
    requestedAgent,
    conversationProfile: safeConversationProfile,
    isGroup
  });
  const contextMode = String(extra.contextMode || extra.mode || "").trim().toLowerCase();
  const editingMessage = Boolean(extra.editingMessage || contextMode === "edit_message" || contextMode === "editing_message");
  const notes = [extra.userContext, extra.notes, extra.mediaContext, extra.mediaNotes, extra.mood, extra.intent]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" | ");
  const previousGeneratedText = cleanGeneratedText(extra.previousGeneratedText || extra.previous_generated_text || "");
  const currentDraftText = cleanGeneratedText(extra.currentDraftText || extra.current_draft_text || "");
  const isRegeneration = Boolean(extra.regeneration || extra.regenerate || previousGeneratedText || currentDraftText);
  const quotedContext = formatQuotedMessage(extra.quotedMessage);
  const contextCopilot = buildContextCopilot({
    action,
    extra,
    profile,
    orderedRecent,
    lastInbound,
    lastOutbound,
    targetMessage,
    targetMessageSource,
    hasQuotedMessage,
    quotedFromUser,
    quotedFromContact,
    threadState,
    conversationFacts,
    mediaNotes,
    requestedAgent,
    tone
  });
  const userAiStylePrompt = formatUserAiStyleProfile(profile);
  const conversationIntent = detectConversationIntent({
    action,
    draft: extra.draft || extra.message || "",
    messages: orderedRecent,
    targetMessage,
    lastMessage,
    lastInbound,
    quotedMessage: extra.quotedMessage,
    mediaNotes: mediaNotes.join("\n"),
    threadState,
    isGroup,
    now
  });
  const intentPrompt = formatIntentForPrompt(conversationIntent);
  const timelineOptions = { nowMs, timeZone: contextTimeZone, isGroup, targetMessage };
  const recentStructuredMessages = formatStructuredMessages(orderedRecent, timelineOptions);
  const supportStructuredMessages = targetMessage
    ? formatStructuredMessages(supportMessages, timelineOptions)
    : "";
  const targetStructuredMessage = targetMessage && !hasQuotedMessage
    ? formatStructuredMessage(targetMessage, 0, null, timelineOptions)
    : "";
  const turnDecision = !lastMessage
    ? "decision_turno: sin mensajes previos; escribir desde la voz del usuario."
    : targetMessageSender === "me"
      ? "decision_turno: el foco lo envio el usuario. No responder como contacto; continuar, reforzar, aclarar o proponer desde la misma voz."
      : "decision_turno: el foco lo envio el contacto. Responder a ese mensaje desde la voz del usuario.";
  const recentOwnRepeatTexts = recentOwnTextsForQuality(orderedRecent);

  const textContext = anonymize([
    `perfil_usuario: variante=${variant}; agente=${contextIntelligence.agent || requestedAgent || tone}; tono=${tone}; alias=${profile.alias || profile.display_name || profile.name || "yo"}`,
    userAiStylePrompt,
    conversationProfilePrompt,
    `hora_actual_contexto: iso=${contextNow.iso}; local=${contextNow.local}; timezone=${contextNow.timeZone}`,
    `span_linea_tiempo: mensajes=${contextTimelineSpan.messageCount}; primero=${contextTimelineSpan.firstMessageAt || "n/a"}; ultimo=${contextTimelineSpan.lastMessageAt || "n/a"}; span_horas=${contextTimelineSpan.spanHours ?? "n/a"}; silencio_horas=${contextTimelineSpan.silenceHours ?? "n/a"}`,
    `estado_hilo: frio=${threadState.cooledThread}; horas_inactivo=${threadState.inactiveHours ?? "n/a"}; esperando_respuesta=${threadState.waitingForReply}; ultimo_mensaje_de=${lastMessageFromUser ? "usuario" : lastMessageFromContact ? "contacto" : "nadie"}`,
    `copiloto_automatico: situacion=${contextIntelligence.situation}; relacion=${contextIntelligence.relationshipType}; objetivo=${contextIntelligence.objective}; fuente_objetivo=${contextIntelligence.objectiveSource}; intensidad=${contextIntelligence.intensity}; longitud=${contextIntelligence.responseLength}; trato=${contextIntelligence.addressMode}; iniciativa=${contextIntelligence.initiativeLevel}. Usa estas senales sin explicarlas al usuario.`,
    intentPrompt,
    recentStructuredMessages ? `ultimos_mensajes_estructurados:\n${recentStructuredMessages}` : "",
    turnDecision,
    contextCopilot ? `copiloto_contexto:\n${contextCopilot}` : "",
    quotedContext,
    hasQuotedMessage && quotedFromContact ? "prioridad_actual: el mensaje marcado es de otra persona. La respuesta debe contestar ese mensaje, no el ultimo mensaje propio ni un tema antiguo." : "",
    hasQuotedMessage && quotedFromUser ? "prioridad_actual: el mensaje marcado es de la persona usuaria. No lo respondas como contacto; reescribelo, refuerzalo, aclaralo o sacale mas jugo segun la accion." : "",
    editingMessage
      ? "modo_edicion_mensaje: la persona usuaria esta editando un mensaje propio ya enviado. La IA debe reescribir solamente ese texto para guardarlo como edicion; no debe responder al contacto, no debe abrir tema nuevo y no debe explicar el cambio."
      : "",
    extra.agent || extra.aiAgent ? `agente_ia: ${extra.agent || extra.aiAgent}` : "",
    contextIntelligence.objective ? `objetivo_ia: ${contextIntelligence.objective}` : "",
    extra.objective && isAutoSelection(extra.objective) ? "objetivo_auto: el backend eligio el objetivo por contexto dentro de esta generacion." : "",
    extra.customObjective ? `objetivo_personalizado_ia: ${extra.customObjective}` : "",
    extra.userContext ? `contexto_util_usuario: ${extra.userContext}` : "",
    isRegeneration ? "regeneracion_ia: la persona pulso Regenerar. Genera una alternativa realmente distinta, no una version maquillada del texto anterior." : "",
    previousGeneratedText ? `texto_anterior_generado_no_repetir:\n${previousGeneratedText}` : "",
    currentDraftText && currentDraftText !== previousGeneratedText ? `texto_actual_editado_no_copiar:\n${currentDraftText}` : "",
    isRegeneration ? "criterio_regenerar: cambia el enfoque, el arranque y la estructura. Mantiene el objetivo y el contexto, pero no repite frases clave ni el mismo cierre." : "",
    recentOwnRepeatTexts.length ? `mensajes_propios_recientes_no_repetir_literal:\n${recentOwnRepeatTexts.join("\n")}` : "",
    extra.intent ? `idea_base_usuario_no_enviada: ${extra.intent}` : "",
    !hasQuotedMessage && action === "suggest" && lastMessageFromUser
      ? "bloqueo_autorespuesta: el ultimo mensaje visible ya fue enviado por la persona usuaria. Prohibido responderle con acuerdo, aceptacion o entusiasmo como si fueras la otra persona. Escribe solo una continuacion propia desde yo: reforzar la idea, suavizarla, agregar un detalle util o dejar una segunda linea natural."
      : "",
    !hasQuotedMessage && action === "suggest" && targetMessage?.metadata?.source === "ai_suggestion"
      ? "mensaje_objetivo_es_sugerido_por_ia: ese mensaje ya fue generado y enviado por la persona usuaria. No lo repitas ni lo respondas; continua desde la misma voz si hace falta."
      : "",
    lastInbound ? `${lastOutbound && sentAtMs(lastOutbound) > sentAtMs(lastInbound) ? "ultimo_mensaje_de_otra_persona_anterior_al_ultimo_mensaje_propio" : "ultimo_mensaje_de_otra_persona"}:\n${formatMessage(lastInbound)}` : "ultimo_mensaje_de_otra_persona: no disponible",
    lastOutbound ? `${lastInbound && sentAtMs(lastInbound) > sentAtMs(lastOutbound) ? "ultimo_mensaje_enviado_por_usuario_anterior_al_ultimo_mensaje_ajeno" : "ultimo_mensaje_enviado_por_usuario"}:\n${formatMessage(lastOutbound)}` : "",
    conversationFacts.length ? `datos_concretos_ya_mencionados_no_preguntar_de_nuevo:\n${conversationFacts.join("\n")}` : "",
    targetStructuredMessage ? `foco_actual_estructurado (${targetMessageSource}):\n${targetStructuredMessage}` : "",
    !lastMessage
      ? "turno_actual: no hay mensajes previos. Cualquier accion IA debe abrir la conversacion desde la voz de la persona usuaria."
      : hasQuotedMessage
        ? "turno_actual: hay un mensaje marcado. Ese mensaje es el objetivo principal y el historial solo apoya tono/contexto."
        : targetMessageSender === "me"
          ? "turno_actual: el objetivo actual es un mensaje propio. Cualquier accion IA debe escribir como la persona usuaria, reforzando, aclarando, continuando o abriendo un camino nuevo. No respondas como si fueras el contacto."
          : "turno_actual: el objetivo actual viene del contacto o grupo. Cualquier accion IA puede responder a ese mensaje desde la voz de la persona usuaria.",
    supportStructuredMessages ? `historial_de_apoyo_menos_importante:\n${supportStructuredMessages}` : "historial_de_apoyo_menos_importante: sin mensajes separados",
    mediaNotes.length ? `contenido_multimedia:\n${mediaNotes.join("\n")}` : "",
    extra.draft ? `borrador_usuario: ${extra.draft}` : "",
    extra.message ? `mensaje_seleccionado: ${extra.message}` : "",
    notes ? `notas_usuario: ${notes}` : "",
    requestedAgent ? `agente_o_tono_pedido: ${requestedAgent}` : ""
  ].filter(Boolean).join("\n"));

  return {
    content: imageParts.length
      ? [{ type: "text", text: textContext || "Sin contexto adicional." }, ...imageParts]
      : (textContext || "Sin contexto adicional."),
    metadata: {
      chatId: chatId || null,
      manualContextMode: manualMode,
      manualContextCaptureName: manualMode ? manualContext.captureName || null : null,
      contextMessageLimit,
      effectiveContextLimit: contextMessageLimit,
      contextLimitSource: contextLimitInfo.source,
      promptRigidityProfile: PROMPT_RIGIDITY_PROFILE,
      contextMessagesUsed: recentMessages.length,
      contextTimelineSpan,
      contextNow,
      promptProfileVersion: conversationIntent.promptProfileVersion || PROMPT_PROFILE_VERSION,
      conversationIntent,
      intent: conversationIntent.intent,
      conversationPhase: conversationIntent.conversationPhase,
      currentFocusMessageId: conversationIntent.currentFocusMessageId,
      intentResponseMove: conversationIntent.responseMove,
      responseMove: conversationIntent.responseMove,
      questionPolicy: conversationIntent.questionPolicy,
      evidenceMode: conversationIntent.evidenceMode,
      riskLevel: conversationIntent.riskLevel,
      mediaAttached: imageParts.length,
      mediaNotes: mediaNotes.length,
      ...threadState
      ,
      targetMessageSource,
      targetMessageSender,
      lastMessageSender: lastMessageFromUser ? "me" : lastMessageFromContact ? "match" : null,
      turnOwner: targetMessageSender === "me" ? "user" : targetMessageSender ? "contact" : null,
      targetMessageAt: hasQuotedMessage ? (extra.quotedMessage?.sentAt || extra.quotedMessage?.sent_at || null) : (targetMessage?.sent_at || targetMessage?.sentAt || null),
      hasQuotedMessage,
      quotedMessageSender: quotedSpeaker(extra.quotedMessage) || null,
      quotedMessageFromUser: quotedFromUser,
      quotedMessageFromContact: quotedFromContact,
      hasDraft: Boolean(extra.draft || extra.message),
      hasIntent: Boolean(extra.intent),
      editingMessage,
      contextMode: contextMode || null,
      hasNotes: Boolean(notes),
      agent: contextIntelligence.agent || requestedAgent || tone,
      objective: contextIntelligence.objective || null,
      objectiveSource: contextIntelligence.objectiveSource,
      requestedObjective: extra.objective || null,
      customObjective: extra.customObjective || null,
      intensity: contextIntelligence.intensity,
      situation: contextIntelligence.situation,
      relationshipType: contextIntelligence.relationshipType,
      responseLength: contextIntelligence.responseLength,
      addressMode: contextIntelligence.addressMode,
      initiativeLevel: contextIntelligence.initiativeLevel,
      usedConversationProfile: Boolean(contextIntelligence.usedConversationProfile),
      hasUserAiStyleProfile: Boolean(userAiStylePrompt),
      hasUserContext: Boolean(extra.userContext),
      isRegeneration,
      hasPreviousGeneratedText: Boolean(previousGeneratedText),
      recentOwnTextsForQuality: recentOwnRepeatTexts,
      recentOwnRepeatReferenceCount: recentOwnRepeatTexts.length,
      hasConversationProfile: Boolean(conversationProfilePrompt),
      contextCopilotHints: contextCopilot ? contextCopilot.split(/\n/).filter(Boolean).length : 0,
      conversationProfileVersion: safeConversationProfile?.version || null,
      conversationProfileMessageLength: safeConversationProfile?.style?.messageLength || null,
      conversationProfileCadence: safeConversationProfile?.style?.cadence || null,
      conversationProfileTreatment: safeConversationProfile?.style?.treatment || null,
      hasMedia: Boolean(mediaNotes.length || imageParts.length),
      isGroup,
      lastMessageFromUser,
      lastMessageFromContact
    }
  };
}

function normalizeAction(action = "suggest") {
  const safeAction = String(action || "suggest").trim().toLowerCase();
  if (["suggest", "rewrite", "opener", "reactivate", "analyze", "recommend"].includes(safeAction)) return safeAction;
  if (["recomendar", "recomendacion", "next-move", "movimiento"].includes(safeAction)) return "recommend";
  if (["open", "abrir", "need-open", "necesito-abrir"].includes(safeAction)) return "opener";
  if (["cool", "cooled", "reactivar"].includes(safeAction)) return "reactivate";
  if (["explain", "que-quiere-decir", "que quiere decir"].includes(safeAction)) return "analyze";
  return "suggest";
}

function providerErrorToApiError(error) {
  if (error instanceof ApiError) return error;
  const providerStatus = Number(error?.status || error?.statusCode || error?.response?.status || 0) || null;
  const providerCode = String(error?.code || error?.error?.code || "").trim();
  const providerType = String(error?.type || error?.error?.type || "").trim();
  const providerMessage = String(error?.message || error?.error?.message || "").trim();
  const providerName = String(error?.name || error?.constructor?.name || "").trim();
  const providerCauseCode = String(error?.cause?.code || error?.cause?.name || "").trim();
  const providerCauseMessage = String(error?.cause?.message || "").trim();
  const providerDetails = {
    providerStatus,
    providerCode: providerCode || null,
    providerType: providerType || null,
    providerName: providerName || null,
    providerCauseCode: providerCauseCode || null,
    providerMessage: providerMessage ? providerMessage.slice(0, 500) : null,
    providerCauseMessage: providerCauseMessage ? providerCauseMessage.slice(0, 500) : null
  };
  if (error?.code === "ai_not_configured") {
    return new ApiError(503, "ai_not_configured", "El servicio de IA no esta configurado.");
  }
  if (error?.code === "ai_provider_not_implemented") {
    return new ApiError(503, "ai_provider_not_implemented", "El proveedor de IA configurado todavia no esta disponible.");
  }
  const providerFingerprint = `${providerCode} ${providerType} ${providerName} ${providerCauseCode} ${providerMessage} ${providerCauseMessage}`;
  if (providerStatus === 401 || /invalid.*api.*key|incorrect.*api.*key|unauthorized/i.test(providerFingerprint)) {
    return new ApiError(503, "ai_provider_auth_failed", "No pudimos conectar con el proveedor de IA. Revisa la configuracion de OpenAI.", providerDetails);
  }
  if (/quota|insufficient_quota|billing|credit|credits|exceeded.*current.*quota/i.test(providerFingerprint)) {
    return new ApiError(429, "ai_provider_quota_exhausted", "La cuenta de OpenAI no tiene cuota disponible o requiere revisar la facturacion.", providerDetails);
  }
  if (providerStatus === 429 || /rate.?limit/i.test(providerFingerprint)) {
    return new ApiError(429, "ai_rate_limited", "La IA esta saturada ahora mismo. Intentalo de nuevo en unos segundos.", providerDetails);
  }
  if (providerStatus === 400 || /invalid_request|context_length|maximum context|too many tokens/i.test(providerFingerprint)) {
    return new ApiError(400, "ai_request_invalid", "No pudimos preparar esta sugerencia. Prueba con menos contexto o intentalo de nuevo.", providerDetails);
  }
  if (providerStatus === 404 || /model.*not.*found|does not exist|model_not_found/i.test(providerFingerprint)) {
    return new ApiError(503, "ai_model_unavailable", "El modelo de IA configurado no esta disponible.", providerDetails);
  }
  if (providerStatus >= 500 || /timeout|network|fetch failed|connection error|api connection|ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|UND_ERR/i.test(providerFingerprint)) {
    return new ApiError(503, "ai_provider_unavailable", "El proveedor de IA no respondio correctamente. Intentalo de nuevo en unos segundos.", providerDetails);
  }
  return new ApiError(503, "ai_generation_failed", "No hemos podido generar la sugerencia. Intentalo de nuevo.", providerDetails);
}

function alternativesFor(action, text) {
  if (action !== "opener") return [];
  return String(text || "")
    .split(/\n+/)
    .map(cleanGeneratedText)
    .filter(Boolean)
    .slice(0, 3);
}

async function generate(userId, requestedAction, payload = {}) {
  const action = normalizeAction(requestedAction);
  const provider = getTextProvider();
  const providerName = provider.provider;
  const model = modelForAction(action);
  let reservationId = null;

  try {
    if (!provider.configured && providerName !== "openai") {
      throw new ApiError(503, "ai_provider_not_implemented", "El proveedor de IA configurado todavia no esta disponible.");
    }
    if (!provider.configured) {
      throw new ApiError(503, "ai_not_configured", "El servicio de IA no esta configurado.");
    }

    const reservation = await quotaService.reserveGeneration(userId, {
      action,
      provider: providerName,
      model,
      metadata: { chatId: payload.chatId || null }
    });
    reservationId = reservation.reservationId;

    const profile = await loadProfile(userId);
  const context = asAiContext(await buildContext(userId, payload.chatId, { ...payload, action }, provider, profile));
  const previousGeneratedText = previousGeneratedTextFromPayload(payload);
  const [recentGeneratedTextsByAction, recentGeneratedTextsByChat] = await Promise.all([
    loadRecentGeneratedTexts(userId, payload.chatId, action),
    loadRecentGeneratedTexts(userId, payload.chatId, "")
  ]);
  const recentGeneratedTexts = [...new Set([
    ...recentGeneratedTextsByAction,
    ...recentGeneratedTextsByChat
  ])].slice(0, 8);
  const antiRecycleTexts = [
    previousGeneratedText,
    ...recentGeneratedTexts,
    ...(Array.isArray(context.metadata.previousGeneratedTexts) ? context.metadata.previousGeneratedTexts : [])
  ].map((value) => compactText(value, 260)).filter(Boolean);
  const responseMoveState = detectResponseMove({
    action,
    agent: payload.agent || payload.aiAgent || payload.tone || context.metadata.agent || profile.base_tone,
    objective: payload.objective || context.metadata.objective || payload.customObjective || "",
    context: context.content,
    metadata: context.metadata,
    previousGeneratedText: previousGeneratedText || recentGeneratedTexts[0] || ""
  });
  context.metadata = {
    ...context.metadata,
    ...responseMoveState,
    previousGeneratedText: previousGeneratedText || context.metadata.previousGeneratedText || recentGeneratedTexts[0] || null,
    lastGeneratedText: context.metadata.lastGeneratedText || recentGeneratedTexts[0] || null,
    previousGeneratedTexts: [...new Set(antiRecycleTexts)].slice(0, 8),
    hasPreviousGeneratedText: Boolean(previousGeneratedText || recentGeneratedTexts.length || context.metadata.hasPreviousGeneratedText),
    antiRecycleReferenceCount: recentGeneratedTexts.length,
    antiRecycleMemoryVersion: "anti-recycle-v1"
  };
    const requestedAgent = context.metadata.agent || payload.agent || payload.aiAgent || payload.tone || profile.base_tone;
    const promptState = {
      ...context.metadata,
      agent: context.metadata.agent || payload.agent || payload.aiAgent,
      objective: context.metadata.objective || payload.objective,
      customObjective: payload.customObjective || context.metadata.customObjective,
      userContext: payload.userContext || ""
    };
    const promptConfig = actionPrompt(action, { ...profile, base_tone: requestedAgent || profile.base_tone }, promptState);
    const aiDecisionContext = buildAiDecisionContext({
      action,
      payload: {
        ...payload,
        agent: promptState.agent,
        objective: promptState.objective,
        customObjective: promptState.customObjective,
        userContext: promptState.userContext
      },
      profile,
      contextMetadata: context.metadata,
      responseMoveState,
      promptConfig
    });
    context.metadata = {
      ...context.metadata,
      aiDecisionContext,
      decisionContextVersion: aiDecisionContext.version,
      decisionPreventionContract: aiDecisionContext.preventionContract,
      preferenceAdapterRole: aiDecisionContext.preferenceAdapter.role,
      preferenceAdapterRule: aiDecisionContext.preferenceAdapter.rule
    };
    const qualityState = {
      ...context.metadata,
      action,
      agent: context.metadata.agent || payload.agent || payload.aiAgent || promptConfig.agent || promptConfig.tone,
      objective: context.metadata.objective || payload.objective || null,
      variant: promptConfig.variant,
      tone: promptConfig.tone
    };
    const previousGeneratedTextForPrompt = previousGeneratedText
      ? `\nTexto anterior a evitar: ${previousGeneratedText.slice(0, 500)}`
      : "";
    const regenerationInstruction = context.metadata.isRegeneration || previousGeneratedText
      ? `Regeneracion: el usuario ya vio una propuesta anterior. No repitas el mismo arranque, la misma estructura ni el mismo cierre. Da una alternativa distinta, igual de enviable y contextual.${previousGeneratedTextForPrompt}`
      : "";
    const antiRecycleInstruction = recentGeneratedTexts.length
      ? `Memoria anti-reciclaje activa para este chat: evita reciclar estas propuestas recientes y no uses el mismo movimiento conversacional:\n${recentGeneratedTexts.map((item) => `- ${item}`).join("\n")}`
      : "";
    const turnGuardInstruction = turnGuardPrompt(context.content, {
      agent: promptState.agent,
      tone: promptConfig.tone,
      base_tone: promptConfig.tone,
      action,
      objective: promptState.objective
    });
    const completionMessages = [
      { role: "system", content: `${promptConfig.prompt}\n\n${aiDecisionContextPrompt(aiDecisionContext)}\n\n${qualityContractPrompt(action, context.metadata)}\n\n${qualityPolicyPrompt(action, qualityState)}${regenerationInstruction ? `\n\n${regenerationInstruction}` : ""}${antiRecycleInstruction ? `\n\n${antiRecycleInstruction}` : ""}` },
      { role: "user", content: [context.content, turnGuardInstruction].filter(Boolean).join("\n\n") }
    ];
    const temperature = generationTemperature(action, promptConfig, context.metadata);
    const completion = await provider.complete({
      model,
      temperature,
      messages: completionMessages
    });
    const rawText = providerCompletionText(completion);

    const placeholderRewrite = await rewriteWithoutPlaceholders(provider, cleanForTurn(rawText, action, context.metadata), promptConfig.tone, model);
    let text = postprocessAiText(placeholderRewrite.text, {
      variant: promptConfig.variant,
      action,
      tone: promptConfig.tone,
      state: context.metadata,
      context: context.content
    });
    if (isTooShortGeneratedText(text)) {
      text = postprocessAiText(cleanForTurn(shortGeneratedFallback(action, context.metadata, payload), action, context.metadata), {
        variant: promptConfig.variant,
        action,
        tone: promptConfig.tone,
        state: context.metadata,
        context: context.content
      });
    }
    if (!text) throw new ApiError(503, "ai_empty", "El proveedor IA no devolvio texto");

    const qualityPostprocess = applyQualityPostprocess(text, qualityState, context.content);
    text = qualityPostprocess.text;

    let alternatives = alternativesFor(action, text);
    let finalText = action === "opener" && alternatives.length ? alternatives.join("\n") : text;
    let qualityMeta = evaluateAiResponse(finalText, qualityState, context.content);
    if (Array.isArray(qualityPostprocess.postprocessFlags) && qualityPostprocess.postprocessFlags.length) {
      qualityMeta = {
        ...qualityMeta,
        flags: [...new Set([...(Array.isArray(qualityMeta.flags) ? qualityMeta.flags : []), ...qualityPostprocess.postprocessFlags])],
        postprocessRepairMode: qualityPostprocess.repairMode || null
      };
    }
    let retryCompletion = null;
    let retryMessages = null;
    let retryRawText = "";
    const automaticRetrySuppressed = repetitionRetryNeeded(qualityMeta);
    if (automaticRetrySuppressed) {
      qualityMeta = {
        ...qualityMeta,
        automaticRetrySuppressed: true,
        flags: [...new Set([...(Array.isArray(qualityMeta.flags) ? qualityMeta.flags : []), "automatic_retry_suppressed_one_call_mode"])]
      };
    }

    const {
      recentOwnTextsForQuality: _recentOwnTextsForQuality,
      recentUserTextsForQuality: _recentUserTextsForQuality,
      doNotRepeatTexts: _doNotRepeatTexts,
      ...safeContextMetadata
    } = context.metadata;
    const metadata = {
      chatId: payload.chatId || null,
      action,
      promptVersion: promptConfig.promptVersion,
      promptVersionSource: ACTIVE_PROMPT_VERSION_META.source,
      promptVersionRequested: ACTIVE_PROMPT_VERSION_META.requested,
      promptVersionFallbackUsed: ACTIVE_PROMPT_VERSION_META.fallbackUsed,
      promptVariant: qualityMeta.promptVariant,
      promptRigidityProfile: context.metadata.promptRigidityProfile || PROMPT_RIGIDITY_PROFILE,
      variant: promptConfig.variant,
      tone: promptConfig.tone,
      agent: context.metadata.agent || payload.agent || payload.aiAgent || promptConfig.agent || promptConfig.tone,
      objective: context.metadata.objective || payload.objective || null,
      objectiveSource: context.metadata.objectiveSource || (payload.objective ? "manual" : "auto"),
      requestedObjective: context.metadata.requestedObjective || payload.objective || null,
      customObjective: payload.customObjective || null,
      intensity: context.metadata.intensity || payload.intensity || "auto",
      situation: context.metadata.situation || null,
      relationshipType: context.metadata.relationshipType || null,
      humanReplyScore: qualityMeta.score,
      humanReplyDimensions: qualityMeta.dimensions,
      qualityFlags: qualityMeta.flags,
      dialectWarnings: qualityMeta.dialectWarnings,
      spanishNaturalnessFlags: qualityMeta.spanishNaturalnessFlags,
      automaticRetrySuppressed: Boolean(qualityMeta.automaticRetrySuppressed),
      postprocessRepairMode: qualityMeta.postprocessRepairMode || qualityPostprocess.repairMode || null,
      repairMode: qualityPostprocess.repairMode || qualityMeta.postprocessRepairMode || null,
      postprocessFlags: qualityPostprocess.postprocessFlags || [],
      agentFit: qualityMeta.agentFit,
      nonObviousValue: qualityMeta.nonObviousValue,
      reducedRegionality: qualityMeta.reducedRegionality,
      usedConversationProfile: Boolean(context.metadata.usedConversationProfile),
      selectedModel: model,
      temperature,
      modelStrategy: ["reactivate", "analyze", "recommend"].includes(action) ? "quality_contextual" : "fast_cost_controlled",
      generatedTextForAntiRepeat: compactText(finalText, 320),
      ...safeContextMetadata
    };

    const primaryCost = calculateAiCost({
      model,
      usage: completion?.usage,
      messages: completionMessages,
      outputText: rawText,
      latencyMs: completion?.latencyMs
    });
    const rewriteCost = placeholderRewrite.completion ? calculateAiCost({
      model,
      usage: placeholderRewrite.completion?.usage,
      messages: [],
      inputText: rawText,
      outputText: text,
      latencyMs: placeholderRewrite.completion?.latencyMs
    }) : null;
    const retryCost = retryCompletion ? calculateAiCost({
      model,
      usage: retryCompletion?.usage,
      messages: retryMessages || [],
      outputText: retryRawText,
      latencyMs: retryCompletion?.latencyMs
    }) : null;
    const aiCost = combineAiCosts([primaryCost, rewriteCost, retryCost]);
    const quota = await quotaService.finalizeReservation(userId, reservationId, {
      provider: providerName,
      model,
      metadata: {
        ...metadata,
        aiCost: {
          inputTokens: aiCost.inputTokens,
          cachedInputTokens: aiCost.cachedInputTokens,
          outputTokens: aiCost.outputTokens,
          totalTokens: aiCost.totalTokens,
          quotaEquivalentGenerations: aiCost.quotaEquivalentGenerations,
          estimatedCostUsd: aiCost.estimatedCostUsd,
          pricingVersion: aiCost.pricingVersion,
          costEstimated: aiCost.costEstimated
        }
      },
      aiCost
    });
    const responseMeta = {
      chatId: payload.chatId || null,
      action,
      agent: metadata.agent || promptConfig.agent || promptConfig.tone,
      objective: metadata.objective || null,
      objectiveSource: metadata.objectiveSource || null,
      customObjective: metadata.customObjective || null,
      intensity: metadata.intensity || null,
      situation: metadata.situation || null,
      relationshipType: metadata.relationshipType || null,
      usedConversationProfile: Boolean(metadata.usedConversationProfile),
      variant: metadata.variant || promptConfig.variant,
      tone: metadata.tone || promptConfig.tone,
      model,
      promptVersion: promptConfig.promptVersion,
      promptVersionSource: metadata.promptVersionSource || null,
      promptVersionRequested: metadata.promptVersionRequested || null,
      promptVersionFallbackUsed: Boolean(metadata.promptVersionFallbackUsed),
      promptVariant: metadata.promptVariant || null,
      humanReplyScore: metadata.humanReplyScore ?? null,
      humanReplyDimensions: metadata.humanReplyDimensions || null,
      qualityFlags: metadata.qualityFlags || [],
      postprocessRepairMode: metadata.postprocessRepairMode || null,
      dialectWarnings: metadata.dialectWarnings || [],
      spanishNaturalnessFlags: metadata.spanishNaturalnessFlags || [],
      agentFit: metadata.agentFit || null,
      nonObviousValue: metadata.nonObviousValue ?? null,
      reducedRegionality: Boolean(metadata.reducedRegionality),
      intent: metadata.intent || null,
      conversationPhase: metadata.conversationPhase || null,
      currentFocusMessageId: metadata.currentFocusMessageId || null,
      responseMove: metadata.responseMove || metadata.intentResponseMove || null,
      evidenceMode: metadata.evidenceMode || null,
      promptProfileVersion: metadata.promptProfileVersion || PROMPT_PROFILE_VERSION,
      contextNow: metadata.contextNow || null,
      contextTimelineSpan: metadata.contextTimelineSpan || null,
      contextCopilotHints: metadata.contextCopilotHints || 0,
      contextMessagesUsed: metadata.contextMessagesUsed || 0,
      contextMessageLimit: metadata.contextMessageLimit || null,
      effectiveContextLimit: metadata.effectiveContextLimit || metadata.contextMessageLimit || null,
      contextLimitSource: metadata.contextLimitSource || null,
      promptRigidityProfile: metadata.promptRigidityProfile || PROMPT_RIGIDITY_PROFILE,
      repairMode: metadata.repairMode || metadata.postprocessRepairMode || null,
      postprocessFlags: metadata.postprocessFlags || [],
      hasUserContext: Boolean(metadata.hasUserContext),
      hasMedia: Boolean(metadata.hasMedia),
      mediaAttached: metadata.mediaAttached || 0,
      targetMessageSource: metadata.targetMessageSource || null,
      targetMessageSender: metadata.targetMessageSender || null,
      hasQuotedMessage: Boolean(metadata.hasQuotedMessage),
      cooledThread: Boolean(metadata.cooledThread),
      inactiveHours: metadata.inactiveHours ?? null
    };

    return {
      text: finalText,
      alternatives,
      provider: providerName,
      model,
      promptVersion: promptConfig.promptVersion,
      variant: promptConfig.variant,
      tone: promptConfig.tone,
      agent: metadata.agent || promptConfig.agent || promptConfig.tone,
      objective: metadata.objective || null,
      objectiveSource: metadata.objectiveSource || null,
      intensity: metadata.intensity || null,
      situation: metadata.situation || null,
      relationshipType: metadata.relationshipType || null,
      usedConversationProfile: Boolean(metadata.usedConversationProfile),
      customObjective: payload.customObjective || null,
      meta: responseMeta,
      cooledThread: Boolean(context.metadata.cooledThread),
      inactiveHours: context.metadata.inactiveHours,
      quota
    };
  } catch (error) {
    const normalized = providerErrorToApiError(error);
    if (reservationId) {
      await quotaService.releaseReservation(userId, reservationId, { provider: providerName, model, errorMessage: normalized.message }).catch(() => {});
    } else if (normalized.code !== "quota_exhausted") {
      await quotaService.recordFailure(userId, { action, provider: providerName, model, errorMessage: normalized.message });
    }
    throw normalized;
  }
}

async function generateToolReply(userId, payload = {}) {
  const conversationText = String(payload.conversationText || payload.text || "").trim();
  const screenshot = normalizeStandaloneToolImage(payload.screenshot);
  requireToolContext({
    text: conversationText,
    image: screenshot,
    message: "Añade una captura o pega la conversación para generar una respuesta."
  });
  const mode = String(payload.mode || "reply").trim().toLowerCase();
  const action = /qu[eé]\s+quiere|interpret|explain|analizar|meaning/.test(mode) ? "analyze" : "suggest";
  const tone = String(payload.tone || "").trim();
  const selectedObjective = String(payload.objective || "").trim();
  const customObjectiveText = String(payload.customObjective || "").trim();
  const notes = String(payload.notes || payload.context || "").trim();
  const manualMessage = conversationText || "Captura de conversación adjunta.";
  const objective = action === "analyze"
    ? (selectedObjective === "Personalizado" && customObjectiveText ? customObjectiveText : selectedObjective && selectedObjective !== "Auto" ? selectedObjective : "Qué quiere decir")
    : (selectedObjective === "Personalizado" && customObjectiveText ? customObjectiveText : selectedObjective || "Auto");
  const result = await generate(userId, action, {
    chatId: MANUAL_AI_CHAT_ID,
    action,
    agent: toolAgentFromTone(tone),
    tone: toolAgentFromTone(tone),
    variant: payload.variant,
    objective,
    customObjective: action === "analyze"
      ? "Explica de forma breve qué puede querer decir la otra persona y qué conviene tener en cuenta. No escribas como asistente."
      : `Escribe una respuesta lista para copiar. Natural, útil, contextual y sin botón de enviar.${objective && objective !== "Auto" ? ` Objetivo elegido: ${objective}.` : ""}`,
    userContext: [
      "herramienta_standalone=que_le_respondo",
      tone ? `tono_visible=${tone}` : "",
      objective ? `objetivo_visible=${objective}` : "",
      notes ? `contexto_adicional=${notes}` : ""
    ].filter(Boolean).join(" | "),
    manualContext: {
      message: manualMessage,
      additionalContext: notes,
      captureName: screenshot?.fileName || "",
      updatedAt: new Date().toISOString()
    },
    screenshot: payload.screenshot || null,
    mediaContext: screenshot ? "captura de conversación adjunta por el usuario" : ""
  });
  return {
    ...result,
    tool: "reply",
    meta: {
      ...(result.meta || {}),
      tool: "reply",
      standalone: true,
      inputMode: screenshot ? "image" : "text",
      replyMode: action === "analyze" ? "interpret" : "suggest"
    }
  };
}

async function generateToolIcebreakers(userId, payload = {}) {
  const knownInfo = String(payload.knownInfo || payload.text || "").trim();
  const profileScreenshot = normalizeStandaloneToolImage(payload.profileScreenshot);
  requireToolContext({
    text: knownInfo,
    image: profileScreenshot,
    message: "Añade algo sobre la otra persona o una captura de perfil para romper el hielo."
  });
  const tone = String(payload.tone || "").trim();
  const selectedObjective = String(payload.objective || "").trim();
  const customObjectiveText = String(payload.customObjective || "").trim();
  const objective = selectedObjective === "Personalizado" && customObjectiveText
    ? customObjectiveText
    : selectedObjective && selectedObjective !== "Auto" ? selectedObjective : "Romper el hielo";
  const notes = String(payload.notes || "").trim();
  const result = await generate(userId, "opener", {
    chatId: MANUAL_AI_CHAT_ID,
    action: "opener",
    agent: toolAgentFromTone(tone || "Ligoteo"),
    tone: toolAgentFromTone(tone || "Ligoteo"),
    variant: payload.variant,
    objective,
    customObjective: `Genera exactamente 3 aperturas distintas en lineas separadas: directa, juguetona y curiosa. Que se puedan copiar tal cual. No expliques las opciones.${objective ? ` Objetivo elegido: ${objective}.` : ""}`,
    userContext: [
      "herramienta_standalone=rompe_el_hielo",
      tone ? `tono_visible=${tone}` : "",
      objective ? `objetivo_visible=${objective}` : "",
      notes ? `notas=${notes}` : "",
      "devolver_tres_opciones=directa_juguetona_curiosa"
    ].filter(Boolean).join(" | "),
    manualContext: {
      message: knownInfo || "Captura de perfil adjunta.",
      additionalContext: notes,
      captureName: profileScreenshot?.fileName || "",
      updatedAt: new Date().toISOString()
    },
    profileScreenshot: payload.profileScreenshot || null,
    mediaContext: profileScreenshot ? "captura de perfil adjunta por el usuario" : ""
  });
  const alternatives = Array.isArray(result.alternatives) && result.alternatives.length
    ? result.alternatives.slice(0, 3)
    : String(result.text || "")
      .split(/\n+/)
      .map(cleanGeneratedText)
      .filter(Boolean)
      .slice(0, 3);
  return {
    ...result,
    alternatives,
    text: alternatives.length ? alternatives.join("\n") : result.text,
    tool: "icebreakers",
    meta: {
      ...(result.meta || {}),
      tool: "icebreakers",
      standalone: true,
      inputMode: profileScreenshot ? "image" : "text"
    }
  };
}

async function listSavedLines(userId, options = {}) {
  const { pool } = require("../config/db");
  const q = String(options.q || options.search || "").trim();
  const params = [userId];
  let where = "user_id = $1";
  if (q) {
    params.push(`%${q}%`);
    where += ` AND text ILIKE $${params.length}`;
  }
  const result = await pool.query(
    `SELECT id, text, tone, variant, source, metadata, created_at
       FROM ai_saved_lines
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT 100`,
    params
  );
  return { lines: result.rows };
}

async function saveLine(userId, payload = {}) {
  const { pool } = require("../config/db");
  const text = cleanGeneratedText(payload.text || "");
  if (!text) throw new ApiError(400, "saved_line_text_required", "La línea no puede estar vacía.");
  if (text.length > 1000) throw new ApiError(400, "saved_line_too_long", "La línea guardada es demasiado larga.");
  const tone = String(payload.tone || "").slice(0, 80) || null;
  const variant = String(payload.variant || "").slice(0, 80) || null;
  const source = savedLineSource(payload.source);
  const metadata = payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};
  const result = await pool.query(
    `INSERT INTO ai_saved_lines (user_id, text, tone, variant, source, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id, text, tone, variant, source, metadata, created_at`,
    [userId, text, tone, variant, source, JSON.stringify(metadata)]
  );
  return { line: result.rows[0] };
}

async function deleteLine(userId, lineId) {
  const { pool } = require("../config/db");
  const id = Number(lineId);
  if (!Number.isFinite(id) || id <= 0) throw new ApiError(400, "saved_line_invalid_id", "Línea guardada inválida.");
  const result = await pool.query(
    `DELETE FROM ai_saved_lines WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  if (!result.rowCount) throw new ApiError(404, "saved_line_not_found", "No encontramos esa línea guardada.");
  return { deleted: true, id };
}

module.exports = {
  generate,
  generateToolReply,
  generateToolIcebreakers,
  listSavedLines,
  saveLine,
  deleteLine,
  anonymize,
  detectThreadState,
  __test: {
    contextLimitInfoForAction,
    PROMPT_RIGIDITY_PROFILE
  }
};
