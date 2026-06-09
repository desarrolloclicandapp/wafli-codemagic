const PROMPT_PROFILE_VERSION = "wafli-contextual-intent-v1";

const INTENTS = Object.freeze({
  GREETING: "greeting",
  DIRECT_QUESTION: "direct_question",
  PLAN_REQUESTED: "plan_requested",
  PLAN_CONFIRMED: "plan_confirmed",
  BOUNDARY_REJECTION: "boundary_rejection",
  APOLOGY_DELAY: "apology_delay",
  BANTER_FLIRT: "banter_flirt",
  EMOTIONAL_SUPPORT: "emotional_support",
  PROFESSIONAL_TASK: "professional_task",
  OWN_MESSAGE_CONTINUATION: "own_message_continuation",
  REWRITE_DRAFT: "rewrite_draft",
  UNAVAILABLE_MEDIA: "unavailable_media",
  REACTIVATE_THREAD: "reactivate_thread",
  GENERAL_REPLY: "general_reply"
});

function compactText(value = "", max = 360) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
}

function normalizeText(value = "") {
  return compactText(value, 1200)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseTimestampMs(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === "number") {
    const ms = value > 100000000000 ? value : value * 1000;
    return Number.isFinite(ms) ? ms : null;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function sentAtMs(message = {}) {
  const metadata = message.metadata || {};
  return parseTimestampMs(
    message.sent_at ||
      message.sentAt ||
      message.created_at ||
      message.timestamp ||
      metadata.sent_at ||
      metadata.sentAt ||
      metadata.timestamp
  );
}

function messageId(message = {}) {
  const metadata = message.metadata || {};
  return String(
    message.id ||
      message.external_message_id ||
      message.externalMessageId ||
      metadata.id ||
      metadata.messageId ||
      metadata.externalMessageId ||
      metadata.providerMessageId ||
      "message"
  );
}

function messageType(message = {}) {
  const metadata = message.metadata || {};
  return String(message.message_type || message.messageType || message.type || metadata.type || metadata.messageType || "text");
}

function messageText(message = {}) {
  if (!message) return "";
  const metadata = message.metadata || {};
  const candidates = [
    message.body,
    message.text,
    message.caption,
    message.transcript,
    metadata.body,
    metadata.text,
    metadata.caption,
    metadata.transcript,
    metadata.audioTranscript,
    metadata.ocrText,
    metadata.description
  ];
  for (const candidate of candidates) {
    const text = compactText(candidate, 1200);
    if (text) return text;
  }
  return "";
}

function isOwnMessage(message = {}) {
  if (!message) return false;
  if (message.fromMe === true || message.isFromMe === true || message.key?.fromMe === true) return true;
  const sender = String(message.sender || message.owner || message.from || "").toLowerCase();
  return ["me", "mine", "self", "user", "usuario", "out", "outbound"].includes(sender);
}

function ownerForMessage(message = {}, isGroup = false) {
  if (isOwnMessage(message)) return "usuario";
  return isGroup ? "grupo" : "contacto";
}

function chooseCurrentFocus({
  action,
  draft,
  targetMessage,
  lastInbound,
  lastMessage,
  quotedMessage,
  now
}) {
  if (String(action || "").toLowerCase() === "rewrite" || compactText(draft)) {
    return {
      id: "draft",
      sender: "me",
      message_type: "draft",
      body: draft || "",
      sent_at: now
    };
  }
  return targetMessage || quotedMessage || lastInbound || lastMessage || null;
}

function hasUnavailableMediaSignal({ text, mediaNotes = "", focusMessage }) {
  const source = normalizeText(`${text} ${mediaNotes} ${messageType(focusMessage || {})}`);
  const mediaType = messageType(focusMessage || "").toLowerCase();
  const visibleText = compactText(text);
  const hasMediaKind = /image|video|audio|voice|sticker|document|media|imagen|foto|video|audio|nota|sticker|archivo/.test(mediaType + " " + source);
  const unavailable = /(no visible|sin descripcion|sin transcripcion|no se transcribe|no disponible|una sola visualizacion|view once|sticker|imagen no|foto no|video no|audio sin|archivo sin|multimedia no)/.test(source);
  return Boolean(unavailable || (hasMediaKind && !visibleText && !/audio transcript|transcript|transcripcion|caption|descripcion/.test(source)));
}

function detectPattern(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function classifyIntent({
  action,
  text,
  normalized,
  draft,
  turnOwner,
  mediaUnavailable,
  inactiveHours
}) {
  const normalizedAction = String(action || "suggest").toLowerCase();
  const isShort = normalized.length <= 42;

  if (normalizedAction === "rewrite" || compactText(draft)) return INTENTS.REWRITE_DRAFT;
  if (mediaUnavailable) return INTENTS.UNAVAILABLE_MEDIA;
  if (turnOwner === "usuario" && normalizedAction !== "reactivate") return INTENTS.OWN_MESSAGE_CONTINUATION;

  if (detectPattern(normalized, [
    /\b(no quiero|no puedo|prefiero no|mejor no|hoy no puedo|no me presiones|necesito espacio|dejame|dejame tranquila|dejame tranquilo)\b/,
    /\b(mejor otro dia|hablamos luego|hasta luego|cuidate|ya fue|olvidalo|olvidalo|no insistas)\b/
  ])) {
    return INTENTS.BOUNDARY_REJECTION;
  }

  if (detectPattern(normalized, [
    /\b(me siento mal|estoy mal|ando mal|triste|agotad[oa]|cansad[oa]|ansiedad|preocupad[oa]|duro|fatal|llorar|bajon|necesito hablar)\b/,
    /\b(no doy mas|me supera|me cuesta|estoy saturad[oa]|estoy rot[oa])\b/
  ])) {
    return INTENTS.EMOTIONAL_SUPPORT;
  }

  if (detectPattern(normalized, [
    /\b(cliente|jefe|factura|pago|presupuesto|informe|reunion|deadline|plazo|documento|archivo|propuesta|contrato|soporte|incidencia|tarea|trabajo)\b/,
    /\b(enviar|mandar|revisar|coordinar|confirmar|agendar|cotizar|aprobar|resolver)\b.*\b(cliente|equipo|reunion|informe|archivo|documento|contrato|pago)\b/
  ])) {
    return INTENTS.PROFESSIONAL_TASK;
  }

  if (detectPattern(normalized, [
    /\b(nos vemos|quedamos|listo entonces|confirmad[oa]|te veo|paso por|me apunto|dale entonces|queda asi|a las \d{1,2})\b/,
    /\b(manana|hoy|viernes|sabado|domingo|lunes|martes|miercoles|jueves)\b.*\b(listo|confirm|nos vemos|quedamos)\b/
  ])) {
    return INTENTS.PLAN_CONFIRMED;
  }

  if (detectPattern(normalized, [
    /\b(que plan|algo como que|como que|donde|a que hora|cuando|tomar algo|vernos|quedar|juntarnos|cita|pasas|paso|venis|vienes)\b/,
    /\b(que hacemos|que propones|que se te ocurre|salimos|vamos)\b/
  ])) {
    return INTENTS.PLAN_REQUESTED;
  }

  if (detectPattern(normalized, [
    /\b(perdon|disculpa|disculpame|tarde|demore|colgue|recien veo|recien leo|se me paso|estuve a mil)\b/
  ])) {
    return INTENTS.APOLOGY_DELAY;
  }

  if (detectPattern(normalized, [
    /\b(jaja|jeje|jiji|me gustas|guap[oa]|lind[oa]|coquet|ganas de verte|me hiciste reir|vos decis|tu dices|seguro\?)\b/,
    /\b(atrevid[oa]|peligros[oa]|tentador|tentadora|me debes|te debo)\b/
  ])) {
    return INTENTS.BANTER_FLIRT;
  }

  if (detectPattern(normalized, [
    /\b(hola|buenas|hey|holi|que tal|como estas|como va|buen dia|buenas tardes|buenas noches)\b/
  ]) && isShort) {
    return INTENTS.GREETING;
  }

  if (text.includes("?") || detectPattern(normalized, [
    /\b(que|como|cuando|donde|quien|cual|por que|porque|puedes|podrias|me ayudas|sabes)\b/
  ])) {
    return INTENTS.DIRECT_QUESTION;
  }

  if (normalizedAction === "reactivate" || inactiveHours >= 24) return INTENTS.REACTIVATE_THREAD;
  return INTENTS.GENERAL_REPLY;
}

function conversationPhaseForIntent(intent, { messageCount = 0, inactiveHours = 0 }) {
  if (intent === INTENTS.REWRITE_DRAFT) return "draft_rewrite";
  if (intent === INTENTS.UNAVAILABLE_MEDIA) return "media_context";
  if (intent === INTENTS.OWN_MESSAGE_CONTINUATION) return "own_followup";
  if (intent === INTENTS.BOUNDARY_REJECTION) return "boundary";
  if (intent === INTENTS.EMOTIONAL_SUPPORT) return "support";
  if (intent === INTENTS.PLAN_REQUESTED || intent === INTENTS.PLAN_CONFIRMED) return "planning";
  if (intent === INTENTS.PROFESSIONAL_TASK) return "professional_task";
  if (intent === INTENTS.BANTER_FLIRT) return "banter";
  if (intent === INTENTS.REACTIVATE_THREAD || inactiveHours >= 24) return "cold_reactivation";
  if (intent === INTENTS.GREETING && messageCount <= 2) return "new_thread";
  return "active_reply";
}

function responseMoveForIntent(intent) {
  return {
    [INTENTS.GREETING]: "saludar_y_abrir_suave",
    [INTENTS.DIRECT_QUESTION]: "responder_directo_con_contexto",
    [INTENTS.PLAN_REQUESTED]: "proponer_plan_concreto",
    [INTENTS.PLAN_CONFIRMED]: "confirmar_y_cerrar_detalle",
    [INTENTS.BOUNDARY_REJECTION]: "respetar_limite_sin_presionar",
    [INTENTS.APOLOGY_DELAY]: "reconocer_demora_y_retomar",
    [INTENTS.BANTER_FLIRT]: "seguir_juego_sin_exagerar",
    [INTENTS.EMOTIONAL_SUPPORT]: "validar_y_acompanar",
    [INTENTS.PROFESSIONAL_TASK]: "resolver_o_pedir_dato_minimo",
    [INTENTS.OWN_MESSAGE_CONTINUATION]: "continuar_sin_fingir_respuesta_del_contacto",
    [INTENTS.REWRITE_DRAFT]: "reescribir_preservando_intencion",
    [INTENTS.UNAVAILABLE_MEDIA]: "pedir_descripcion_o_transcripcion",
    [INTENTS.REACTIVATE_THREAD]: "reactivar_con_contexto_y_baja_presion",
    [INTENTS.GENERAL_REPLY]: "responder_al_foco_actual"
  }[intent] || "responder_al_foco_actual";
}

function questionPolicyForIntent(intent) {
  if ([INTENTS.BOUNDARY_REJECTION, INTENTS.PLAN_CONFIRMED, INTENTS.OWN_MESSAGE_CONTINUATION].includes(intent)) return "avoid_question";
  if ([INTENTS.DIRECT_QUESTION, INTENTS.PROFESSIONAL_TASK].includes(intent)) return "answer_first";
  if (intent === INTENTS.PLAN_REQUESTED) return "avoid_question_after_proposal";
  if (intent === INTENTS.UNAVAILABLE_MEDIA) return "allow_specific_question";
  return "question_only_if_needed";
}

function riskLevelForIntent(intent) {
  if ([INTENTS.BOUNDARY_REJECTION, INTENTS.UNAVAILABLE_MEDIA].includes(intent)) return "high";
  if ([INTENTS.EMOTIONAL_SUPPORT, INTENTS.OWN_MESSAGE_CONTINUATION, INTENTS.PROFESSIONAL_TASK].includes(intent)) return "medium";
  if ([INTENTS.PLAN_CONFIRMED, INTENTS.PLAN_REQUESTED].includes(intent)) return "normal";
  return "low";
}

function evidenceModeForIntent(intent) {
  if (intent === INTENTS.UNAVAILABLE_MEDIA) return "metadata_and_transcript_only";
  if ([INTENTS.BANTER_FLIRT, INTENTS.GREETING].includes(intent)) return "contextual_inference_allowed";
  return "visible_context_only";
}

function currentFocusSummary(message, owner) {
  if (!message) return null;
  const ms = sentAtMs(message);
  return {
    id: messageId(message),
    owner,
    sentAtIso: ms ? new Date(ms).toISOString() : null,
    messageType: messageType(message),
    text: compactText(messageText(message), 220)
  };
}

function detectConversationIntent({
  action = "suggest",
  draft = "",
  messages = [],
  targetMessage = null,
  lastMessage = null,
  lastInbound = null,
  quotedMessage = null,
  mediaNotes = "",
  threadState = {},
  isGroup = false,
  now = new Date()
} = {}) {
  const ordered = Array.isArray(messages) ? messages.filter(Boolean) : [];
  const focusMessage = chooseCurrentFocus({
    action,
    draft,
    targetMessage,
    lastInbound,
    lastMessage: lastMessage || ordered[ordered.length - 1] || null,
    quotedMessage,
    now
  });
  const focusText = messageText(focusMessage || {});
  const normalized = normalizeText(focusText || draft || "");
  const owner = ownerForMessage(focusMessage || {}, isGroup);
  const nowMs = parseTimestampMs(now) || Date.now();
  const lastMs = sentAtMs(focusMessage || ordered[ordered.length - 1] || {});
  const inactiveHours = Number.isFinite(Number(threadState?.inactivityHours))
    ? Number(threadState.inactivityHours)
    : lastMs
      ? Math.max(0, (nowMs - lastMs) / 3600000)
      : 0;
  const mediaUnavailable = hasUnavailableMediaSignal({ text: focusText, mediaNotes, focusMessage });
  const intent = classifyIntent({
    action,
    text: focusText || draft || "",
    normalized,
    draft,
    turnOwner: owner,
    mediaUnavailable,
    inactiveHours
  });
  const conversationPhase = conversationPhaseForIntent(intent, {
    messageCount: ordered.length,
    inactiveHours
  });
  const signals = [
    owner === "usuario" ? "last_focus_is_user_owned" : "last_focus_is_contact_owned",
    mediaUnavailable ? "media_unavailable_or_not_visible" : null,
    inactiveHours >= 24 ? "long_pause" : null,
    intent !== INTENTS.GENERAL_REPLY ? `intent_${intent}` : null
  ].filter(Boolean);

  return {
    turnOwner: owner,
    currentFocus: currentFocusSummary(focusMessage, owner),
    currentFocusMessageId: focusMessage ? messageId(focusMessage) : null,
    conversationPhase,
    intent,
    riskLevel: riskLevelForIntent(intent),
    responseMove: responseMoveForIntent(intent),
    questionPolicy: questionPolicyForIntent(intent),
    evidenceMode: evidenceModeForIntent(intent),
    promptProfileVersion: PROMPT_PROFILE_VERSION,
    signals
  };
}

function formatIntentForPrompt(intentState = {}) {
  if (!intentState || typeof intentState !== "object") return "";
  const focus = intentState.currentFocus || {};
  return [
    "decision_intencion_local:",
    `- turnOwner=${intentState.turnOwner || "unknown"}`,
    `- currentFocusMessageId=${intentState.currentFocusMessageId || "none"}`,
    `- conversationPhase=${intentState.conversationPhase || "unknown"}`,
    `- intent=${intentState.intent || "general_reply"}`,
    `- riskLevel=${intentState.riskLevel || "low"}`,
    `- responseMove=${intentState.responseMove || "responder_al_foco_actual"}`,
    `- questionPolicy=${intentState.questionPolicy || "question_only_if_needed"}`,
    `- evidenceMode=${intentState.evidenceMode || "visible_context_only"}`,
    focus.text ? `- currentFocusText=${focus.text}` : null
  ].filter(Boolean).join("\n");
}

module.exports = {
  PROMPT_PROFILE_VERSION,
  INTENTS,
  compactText,
  detectConversationIntent,
  formatIntentForPrompt,
  messageText,
  ownerForMessage,
  sentAtMs
};
