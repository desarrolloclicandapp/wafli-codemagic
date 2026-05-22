const { config } = require("../config/env");
const { ApiError } = require("../utils/responses");
const chatService = require("./chatService");
const conversationProfileService = require("./conversationProfileService");
const quotaService = require("./quotaService");
const { anonymize, cleanGeneratedText } = require("./aiAnonymizer");
const { actionPrompt, normalizeTone, normalizeVariant } = require("./aiPromptRegistry");
const { getTextProvider } = require("./aiProviders");
const { calculateAiCost, combineAiCosts } = require("./aiCostService");

const COOLED_THREAD_HOURS = 24;
const ANONYMIZED_PLACEHOLDER_RE = /\[(?:persona_\d+|telefono|email|url|documento)\]/gi;

async function loadProfile(userId) {
  const { pool } = require("../config/db");
  const result = await pool.query(`SELECT * FROM user_profiles WHERE user_id = $1`, [userId]);
  return result.rows[0] || {};
}

function messageSpeaker(message = {}) {
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
  return message.media_type || message.metadata?.mediaType || message.message_type || "archivo";
}

function sentAtMs(message = {}) {
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
  const metadata = message.metadata || {};
  const speaker = messageSpeaker(message);
  const aiOriginSuffix = message.sender === "me" && metadata.source === "ai_suggestion"
    ? " (mensaje propio sugerido por IA y ya enviado)"
    : "";
  if (metadata.viewOnce) {
    return `${speaker}${aiOriginSuffix}: contenido de una sola visualizacion (${message.message_type || mediaKind(message)}). No disponible para WaFli ni para IA.`;
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
    .replace(/\s+(?:te\s+parece|te\s+copa|verdad|no|no\s+cre[eé]s|como\s+quieras|si\s+quer[eé]s|si\s+quieres|si\s+pinta.*|avisame|av[ií]same|me\s+avis[aá]s.*|te\s+anim[aá]s.*|cualquier\s+cosa)\??$/i, "")
    .replace(/[,\s]+$/g, "")
    .trim();
}

function cleanForTurn(rawText = "", action = "suggest", metadata = {}) {
  const original = cleanForChat(rawText);
  let cleaned = original;
  const ownTurn = action === "suggest" && (metadata.targetMessageSender === "me" || metadata.lastMessageFromUser);

  if (ownTurn) {
    cleaned = cleaned
      .replace(/^(?:dale|perfecto|me parece(?:\s+\w+)?|obvio|s[ií]|de una|claro|genial|joya)[,!.]?\s+/i, "")
      .replace(/(?:^|\s)[^.!?]*(?:te\s+parece|te\s+copa|te\s+anim[aá]s|si\s+quer[eé]s|si\s+quieres)[^.!?]*\?\s*/gi, " ")
      .replace(/\s+[^.!?]*\?\s*$/i, "")
      .trim();
    if (cleaned.length < 16 && original.length > cleaned.length) {
      cleaned = original.replace(/[¿?]/g, "").trim();
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

async function rewriteWithoutPlaceholders(provider, text, tone, model = provider.model) {
  if (!containsAnonymizedPlaceholder(text)) return { text, completion: null };
  try {
    const completion = await provider.complete({
      model,
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content: [
            "Reescribe el mensaje para que suene natural en chat.",
            "Conserva la intencion original y escribe siempre desde la voz de la persona usuaria.",
            "No lo conviertas en una respuesta de la otra persona ni cambies el turno de la conversacion.",
            "Si el texto es una idea incompleta, interpretala con cuidado y sacale jugo sin inventar datos.",
            "No agregues datos nuevos.",
            "No uses placeholders anonimizados como [persona_1], [telefono], [email], [url] o [documento].",
            "Si falta un dato concreto, usa una formulacion generica.",
            "No uses signos de apertura invertidos.",
            `Tono pedido: ${tone || "desenfadado"}.`,
            "Devuelve solo el texto final."
          ].join(" ")
        },
        { role: "user", content: text }
      ]
    });
    const cleaned = cleanForChat(providerCompletionText(completion));
    return {
      text: containsAnonymizedPlaceholder(cleaned) ? stripAnonymizedPlaceholders(cleaned) : cleaned,
      completion
    };
  } catch (_) {
    return { text: stripAnonymizedPlaceholders(text), completion: null };
  }
}

function modelForAction(action = "suggest") {
  const normalized = normalizeAction(action);
  return config.openai.models?.[normalized] || config.openai.model || "gpt-4o-mini";
}

function contextLimitForAction(action = "suggest") {
  const normalized = normalizeAction(action);
  const configured = Number(config.openai.contextLimits?.[normalized]);
  if (Number.isFinite(configured) && configured > 0) return Math.round(configured);
  return Math.max(1, Number(config.openai.contextMessageLimit || 20));
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

async function buildMediaContext({ userId, chatId, messages, provider, targetMessage = null, lastMessage = null, quotedMessage = null }) {
  const mediaNotes = [];
  const imageParts = [];
  const limit = Math.max(0, config.openai.mediaContextLimit);
  const mediaMessages = focusedMediaMessages(messages, { targetMessage, lastMessage, quotedMessage }).slice(-limit);

  for (const message of mediaMessages) {
    const kind = mediaKind(message);
    const speaker = messageSpeaker(message);
    const messageId = message.external_message_id || message.id;
    const mediaRow = await chatService.getMessageMedia(userId, chatId, messageId).catch(() => null);
    if (!mediaRow?.data) {
      if (message.metadata?.viewOnce) {
        mediaNotes.push(`Adjunto de ${speaker}: contenido de una sola visualizacion, no disponible para WaFli ni para IA.`);
      } else {
        mediaNotes.push(`Adjunto de ${speaker}: ${kind}, no disponible en cache temporal.`);
      }
      continue;
    }

    const mimeType = mediaRow.mime_type || message.mime_type || "application/octet-stream";
    if (kind === "sticker") {
      mediaNotes.push(`Sticker de ${speaker}: úsalo solo como señal ligera de tono, reacción o humor. No lo analices ni bases la respuesta en el sticker salvo que el texto cercano lo pida.`);
      continue;
    }

    if (kind === "image" && mimeType.startsWith("image/")) {
      const sizeBytes = Number(mediaRow.size_bytes || mediaRow.data?.length || 0);
      mediaNotes.push(`Imagen de ${speaker}: ${message.body || mediaRow.file_name || "imagen recibida"} (${mimeType}${sizeBytes ? `, ${Math.ceil(sizeBytes / 1024)} KB` : ""}). Usa caption, metadata y contexto del usuario; no inventes detalles visuales.`);
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
      const transcript = await provider.transcribeAudio(mediaRow).catch(() => "");
      mediaNotes.push(transcript
        ? `Audio de ${speaker} transcrito: ${transcript}`
        : `Audio de ${speaker}: no se pudo transcribir automaticamente.`);
      continue;
    }

    if (kind === "video") {
      const transcript = await provider.transcribeAudio(mediaRow).catch(() => "");
      const sizeMb = mediaRow.size_bytes ? `, ${(Number(mediaRow.size_bytes) / (1024 * 1024)).toFixed(1)} MB` : "";
      mediaNotes.push([
        `Video de ${speaker}: ${message.body || mediaRow.file_name || "video recibido"} (${mimeType}${sizeMb}).`,
        transcript ? `Audio del video transcrito: ${transcript}` : "No se pudo transcribir automaticamente el audio del video.",
        "El contenido visual del video no se analiza completo en V0; si el usuario agrega contexto multimedia, priorizalo y no inventes escenas."
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

async function buildContext(userId, chatId, extra = {}, provider, profile = {}) {
  const messages = chatId ? await chatService.getMessages(userId, chatId).catch(() => []) : [];
  const action = normalizeAction(extra.action || "suggest");
  const contextMessageLimit = contextLimitForAction(action);
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
  const conversationProfile = chatId
    ? await conversationProfileService.refreshProfile(userId, chatId, recentMessages).catch(() => null)
    : null;
  const conversationProfilePrompt = conversationProfileService.formatProfileForPrompt(conversationProfile);
  const { mediaNotes, imageParts } = await buildMediaContext({
    userId,
    chatId,
    messages: recentMessages,
    provider,
    targetMessage,
    lastMessage,
    quotedMessage: extra.quotedMessage
  });
  const variant = normalizeVariant(profile.spanish_variant || profile.variant);
  const tone = normalizeTone(extra.tone || profile.base_tone || profile.tone);
  const contextMode = String(extra.contextMode || extra.mode || "").trim().toLowerCase();
  const editingMessage = Boolean(extra.editingMessage || contextMode === "edit_message" || contextMode === "editing_message");
  const notes = [extra.notes, extra.mediaContext, extra.mediaNotes, extra.mood, extra.intent]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" | ");
  const quotedContext = formatQuotedMessage(extra.quotedMessage);

  const textContext = anonymize([
    `perfil_usuario: variante=${variant}; tono=${tone}; alias=${profile.alias || profile.display_name || profile.name || "yo"}`,
    conversationProfilePrompt,
    `estado_hilo: frio=${threadState.cooledThread}; horas_inactivo=${threadState.inactiveHours ?? "n/a"}; esperando_respuesta=${threadState.waitingForReply}; ultimo_mensaje_de=${lastMessageFromUser ? "usuario" : lastMessageFromContact ? "contacto" : "nadie"}`,
    quotedContext,
    hasQuotedMessage && quotedFromContact ? "prioridad_actual: el mensaje marcado es de otra persona. La respuesta debe contestar ese mensaje, no el ultimo mensaje propio ni un tema antiguo." : "",
    hasQuotedMessage && quotedFromUser ? "prioridad_actual: el mensaje marcado es de la persona usuaria. No lo respondas como contacto; reescribelo, refuerzalo, aclaralo o sacale mas jugo segun la accion." : "",
    editingMessage
      ? "modo_edicion_mensaje: la persona usuaria esta editando un mensaje propio ya enviado. La IA debe reescribir solamente ese texto para guardarlo como edicion; no debe responder al contacto, no debe abrir tema nuevo y no debe explicar el cambio."
      : "",
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
    targetMessage && !hasQuotedMessage ? `mensaje_objetivo_actual (${targetMessageSource}):\n${formatMessage(targetMessage)}` : "",
    !lastMessage
      ? "turno_actual: no hay mensajes previos. Cualquier accion IA debe abrir la conversacion desde la voz de la persona usuaria."
      : hasQuotedMessage
        ? "turno_actual: hay un mensaje marcado. Ese mensaje es el objetivo principal y el historial solo apoya tono/contexto."
        : targetMessageSender === "me"
          ? "turno_actual: el objetivo actual es un mensaje propio. Cualquier accion IA debe escribir como la persona usuaria, reforzando, aclarando, continuando o abriendo un camino nuevo. No respondas como si fueras el contacto."
          : "turno_actual: el objetivo actual viene del contacto o grupo. Cualquier accion IA puede responder a ese mensaje desde la voz de la persona usuaria.",
    supportMessages.length ? `historial_de_apoyo_menos_importante:\n${supportMessages.map(formatMessage).join("\n")}` : "historial_de_apoyo_menos_importante: sin mensajes previos",
    mediaNotes.length ? `contenido_multimedia:\n${mediaNotes.join("\n")}` : "",
    extra.draft ? `borrador_usuario: ${extra.draft}` : "",
    extra.message ? `mensaje_seleccionado: ${extra.message}` : "",
    notes ? `notas_usuario: ${notes}` : "",
    extra.tone ? `tono_pedido: ${extra.tone}` : ""
  ].filter(Boolean).join("\n"));

  return {
    content: imageParts.length
      ? [{ type: "text", text: textContext || "Sin contexto adicional." }, ...imageParts]
      : (textContext || "Sin contexto adicional."),
    metadata: {
      chatId: chatId || null,
      contextMessageLimit,
      contextMessagesUsed: recentMessages.length,
      mediaAttached: imageParts.length,
      mediaNotes: mediaNotes.length,
      ...threadState
      ,
      targetMessageSource,
      targetMessageSender,
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
      hasConversationProfile: Boolean(conversationProfilePrompt),
      conversationProfileVersion: conversationProfile?.version || null,
      conversationProfileMessageLength: conversationProfile?.messageLength || null,
      conversationProfileCadence: conversationProfile?.cadence || null,
      conversationProfileTreatment: conversationProfile?.treatment || null,
      hasMedia: Boolean(mediaNotes.length || imageParts.length),
      isGroup: orderedRecent.some((message) => message.metadata?.isGroup || String(message.chat_id || message.chatId || "").endsWith("@g.us")),
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
  if (error?.code === "ai_not_configured") {
    return new ApiError(503, "ai_not_configured", "El servicio de IA no esta configurado.");
  }
  if (error?.code === "ai_provider_not_implemented") {
    return new ApiError(503, "ai_provider_not_implemented", "El proveedor de IA configurado todavia no esta disponible.");
  }
  return error;
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
    const context = await buildContext(userId, payload.chatId, { ...payload, action }, provider, profile);
    const promptConfig = actionPrompt(action, { ...profile, base_tone: payload.tone || profile.base_tone }, context.metadata);
    const completionMessages = [
      { role: "system", content: promptConfig.prompt },
      { role: "user", content: context.content }
    ];
    const completion = await provider.complete({
      model,
      temperature: action === "rewrite" ? 0.55 : action === "suggest" ? 0.62 : 0.72,
      messages: completionMessages
    });
    const rawText = providerCompletionText(completion);

    const placeholderRewrite = await rewriteWithoutPlaceholders(provider, cleanForTurn(rawText, action, context.metadata), promptConfig.tone, model);
    const text = placeholderRewrite.text;
    if (!text) throw new ApiError(502, "ai_empty", "El proveedor IA no devolvio texto");

    const alternatives = alternativesFor(action, text);
    const finalText = action === "opener" && alternatives.length ? alternatives.join("\n") : text;
    const metadata = {
      chatId: payload.chatId || null,
      action,
      promptVersion: promptConfig.promptVersion,
      variant: promptConfig.variant,
      tone: promptConfig.tone,
      selectedModel: model,
      modelStrategy: ["reactivate", "analyze", "recommend"].includes(action) ? "quality_contextual" : "fast_cost_controlled",
      ...context.metadata
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
    const aiCost = combineAiCosts([primaryCost, rewriteCost]);
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

    return {
      text: finalText,
      alternatives,
      provider: providerName,
      model,
      promptVersion: promptConfig.promptVersion,
      variant: promptConfig.variant,
      tone: promptConfig.tone,
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

module.exports = { generate, anonymize, detectThreadState };
