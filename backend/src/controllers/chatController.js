const chatService = require("../services/chatService");
const whatsappService = require("../services/whatsappService");
const whatsappTaskService = require("../services/whatsappTaskService");
const { isApiOnly } = require("../services/runtimeModeService");
const chatRealtime = require("../services/chatRealtimeService");
const { ApiError, ok } = require("../utils/responses");

async function list(req, res) {
  return ok(res, { chats: await chatService.listChats(req.user.id, req.query) });
}

async function contacts(req, res) {
  return ok(res, { contacts: await chatService.listContacts(req.user.id, req.query) });
}

async function createContact(req, res) {
  return ok(res, { chat: await chatService.createContact(req.user.id, req.body) }, 201);
}

async function events(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Content-Encoding": "none",
    Connection: "keep-alive",
    "Keep-Alive": "timeout=60",
    "X-Accel-Buffering": "no"
  });
  if (res.socket?.setKeepAlive) res.socket.setKeepAlive(true);
  if (typeof res.flushHeaders === "function") res.flushHeaders();
  res.write(": wafli realtime\n\n");
  const unsubscribe = chatRealtime.subscribe(req.user.id, res);
  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch (_) {}
  }, 15000);
  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}

async function messages(req, res) {
  const canonicalChatId = await chatService.resolveCanonicalChatId(req.user.id, req.params.chatId);
  return ok(res, {
    chatId: canonicalChatId,
    canonicalChatId,
    messages: await chatService.getMessages(req.user.id, canonicalChatId)
  });
}

async function media(req, res) {
  let legacyMediaRow = null;
  try {
    legacyMediaRow = await chatService.getMessageMedia(req.user.id, req.params.chatId, req.params.messageId);
  } catch (_) {}
  if (legacyMediaRow) {
    const mimeType = legacyMediaRow.mime_type || "application/octet-stream";
    const fileName = legacyMediaRow.file_name || `${legacyMediaRow.external_message_id || req.params.messageId}`;
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", legacyMediaRow.data.length);
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Content-Disposition", `inline; filename="${String(fileName).replace(/"/g, "")}"`);
    return res.end(legacyMediaRow.data);
  }
  const streamed = await whatsappService.streamMessageMedia(req.user.id, req.params.chatId, req.params.messageId);
  const mimeType = streamed.mimeType || "application/octet-stream";
  const fileName = streamed.fileName || `${req.params.messageId}`;
  res.setHeader("Content-Type", mimeType);
  if (streamed.sizeBytes) res.setHeader("Content-Length", streamed.sizeBytes);
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Content-Disposition", `inline; filename="${String(fileName).replace(/"/g, "")}"`);
  streamed.stream.on("error", () => {
    if (!res.headersSent) res.status(502);
    res.end();
  });
  return streamed.stream.pipe(res);
}

async function get(req, res) {
  return ok(res, { chat: await chatService.getChat(req.user.id, req.params.chatId) });
}

async function markRead(req, res) {
  const chat = await chatService.markRead(req.user.id, req.params.chatId);
  const chatId = chat?.id || req.params.chatId;
  if (isApiOnly()) {
    await whatsappTaskService.enqueueWhatsappTask(req.user.id, "mark_read", {
      chatId
    }, { priority: 5, maxAttempts: 2 }).catch(() => null);
  } else {
    await whatsappService.markChatRead(req.user.id, chatId).catch(() => null);
  }
  return ok(res, { chat });
}

async function presence(req, res) {
  const rawPresence = String(req.body?.presence || req.body?.type || "").trim().toLowerCase();
  const presenceType = ["composing", "recording", "paused"].includes(rawPresence) ? rawPresence : "paused";
  const chatId = await chatService.resolveCanonicalChatId(req.user.id, req.params.chatId);

  if (isApiOnly()) {
    await whatsappTaskService.enqueueWhatsappTask(req.user.id, "presence", {
      chatId,
      presence: presenceType
    }, { priority: 3, maxAttempts: 1 }).catch(() => null);
  } else {
    await whatsappService.sendPresence(req.user.id, chatId, presenceType).catch(() => null);
  }

  return ok(res, { ok: true, chatId, presence: presenceType });
}

async function updateMeta(req, res) {
  return ok(res, { chat: await chatService.updateChatMeta(req.user.id, req.params.chatId, req.body) });
}

async function startConversation(req, res) {
  return ok(res, { chat: await chatService.startConversation(req.user.id, req.params.chatId) });
}

async function updateContact(req, res) {
  return ok(res, { chat: await chatService.updateContact(req.user.id, req.params.chatId, req.body) });
}

async function send(req, res) {
  const text = req.body.message || req.body.text;
  const quotedMessage = req.body.quotedMessage && typeof req.body.quotedMessage === "object" ? req.body.quotedMessage : null;
  const clientMetadata = req.body.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {};
  const allowedClientMetadata = {};
  if (clientMetadata.source === "ai_suggestion") allowedClientMetadata.source = "ai_suggestion";
  if (clientMetadata.aiAction) allowedClientMetadata.aiAction = String(clientMetadata.aiAction).slice(0, 40);
  if (clientMetadata.aiModel) allowedClientMetadata.aiModel = String(clientMetadata.aiModel).slice(0, 80);
  if (clientMetadata.promptVersion) allowedClientMetadata.promptVersion = String(clientMetadata.promptVersion).slice(0, 80);
  if (clientMetadata.wasEditedBeforeSend !== undefined) allowedClientMetadata.wasEditedBeforeSend = Boolean(clientMetadata.wasEditedBeforeSend);
  const pendingMessage = await chatService.createOutgoingMessage(req.user.id, req.params.chatId, text, {
    metadata: { source: isApiOnly() ? "api_queue" : "api_direct", ...allowedClientMetadata, ...(quotedMessage ? { quotedMessage } : {}) }
  });
  if (isApiOnly()) {
    const task = await whatsappTaskService.enqueueWhatsappTask(req.user.id, "send_message", {
      chatId: pendingMessage.chatId,
      message: text,
      localMessageId: pendingMessage.id,
      quotedMessage
    }, { priority: 15, maxAttempts: 1, dedupe: false });
    return ok(res, {
      queued: true,
      chatId: pendingMessage.chatId,
      canonicalChatId: pendingMessage.chatId,
      task,
      message: pendingMessage
    }, 202);
  }
  const sent = await whatsappService.sendMessage(req.user.id, pendingMessage.chatId, text, { localMessageId: pendingMessage.id, quotedMessage });
  const message = await chatService.markOutgoingMessageSent(req.user.id, pendingMessage.chatId, pendingMessage.id, sent);
  return ok(res, {
    chatId: pendingMessage.chatId,
    canonicalChatId: pendingMessage.chatId,
    sent,
    message: message || pendingMessage
  });
}

async function editMessage(req, res) {
  const text = req.body?.text || req.body?.message;
  const prepared = await chatService.prepareMessageEdit(req.user.id, req.params.chatId, req.params.messageId, text);

  if (isApiOnly()) {
    const task = await whatsappTaskService.enqueueWhatsappTask(req.user.id, "edit_message", {
      chatId: prepared.chatId,
      messageId: prepared.messageId,
      text: prepared.text,
    }, { priority: 14, maxAttempts: 1, dedupe: false });
    return ok(res, {
      queued: true,
      chatId: prepared.chatId,
      canonicalChatId: prepared.chatId,
      messageId: prepared.messageId,
      task,
    }, 202);
  }

  const result = await whatsappService.editMessage(req.user.id, prepared.chatId, prepared.messageId, prepared.text);
  return ok(res, {
    chatId: prepared.chatId,
    canonicalChatId: prepared.chatId,
    ...result,
  });
}

async function deleteMessage(req, res) {
  const prepared = await chatService.prepareMessageDelete(req.user.id, req.params.chatId, req.params.messageId, req.body?.scope);

  if (isApiOnly()) {
    const task = await whatsappTaskService.enqueueWhatsappTask(req.user.id, "delete_message", {
      chatId: prepared.chatId,
      messageId: prepared.messageId,
      scope: prepared.scope,
    }, { priority: 14, maxAttempts: 1, dedupe: false });
    return ok(res, {
      queued: true,
      chatId: prepared.chatId,
      canonicalChatId: prepared.chatId,
      messageId: prepared.messageId,
      scope: prepared.scope,
      task,
    }, 202);
  }

  const result = await whatsappService.deleteMessage(req.user.id, prepared.chatId, prepared.messageId, prepared.scope);
  return ok(res, {
    chatId: prepared.chatId,
    canonicalChatId: prepared.chatId,
    ...result,
  });
}

function mediaTypeFromUpload(contentType, requestedType) {
  const requested = String(requestedType || "").trim().toLowerCase();
  const mimeType = String(contentType || "application/octet-stream").split(";")[0].trim().toLowerCase();
  if (requested === "sticker" || mimeType === "image/webp") return "sticker";
  if (requested === "audio" || mimeType.startsWith("audio/")) return "audio";
  if (requested === "image" || mimeType.startsWith("image/")) return "image";
  return null;
}

function parseQuotedMessageQuery(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) {
    return null;
  }
}

async function sendMedia(req, res) {
  const data = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
  if (!data.length) throw new ApiError(400, "empty_media", "Adjunta un archivo para enviar.");
  if (data.length > 12 * 1024 * 1024) throw new ApiError(413, "media_too_large", "El archivo es demasiado pesado para esta versión.");
  const mimeType = String(req.headers["content-type"] || "application/octet-stream").split(";")[0].trim();
  const mediaType = mediaTypeFromUpload(mimeType, req.query.type || req.headers["x-wafli-media-type"]);
  if (!mediaType) {
    throw new ApiError(400, "unsupported_media_type", "Por ahora puedes enviar imágenes, stickers webp o audios.");
  }
  const ptt = mediaType === "audio" && ["1", "true", "yes"].includes(String(req.query.ptt || req.headers["x-wafli-ptt"] || "").trim().toLowerCase());
  const caption = String(req.query.caption || req.headers["x-wafli-caption"] || "").trim();
  const fileName = String(req.query.fileName || req.headers["x-wafli-file-name"] || "").trim() || null;
  const quotedMessage = parseQuotedMessageQuery(req.query.quotedMessage);
  const pendingMessage = await chatService.createOutgoingMessage(req.user.id, req.params.chatId, caption || (mediaType === "image" ? "Imagen" : mediaType === "audio" ? (ptt ? "Nota de voz" : "Audio") : "Sticker"), {
    messageType: mediaType,
    metadata: {
      source: isApiOnly() ? "api_queue_media" : "api_direct_media",
      hasMedia: false,
      mediaPending: true,
      mediaType,
      mimeType,
      ptt,
      fileName,
      sizeBytes: data.length,
      ...(quotedMessage ? { quotedMessage } : {})
    }
  });
  if (isApiOnly()) {
    const task = await whatsappTaskService.enqueueWhatsappTask(req.user.id, "send_media", {
      chatId: pendingMessage.chatId,
      localMessageId: pendingMessage.id,
      mediaType,
      mimeType,
      fileName,
      caption,
      ptt,
      dataBase64: data.toString("base64"),
      quotedMessage
    }, { priority: 15, maxAttempts: 1, dedupe: false });
    return ok(res, {
      queued: true,
      chatId: pendingMessage.chatId,
      canonicalChatId: pendingMessage.chatId,
      task,
      message: pendingMessage
    }, 202);
  }
  const sent = await whatsappService.sendMediaMessage(req.user.id, pendingMessage.chatId, {
    mediaType,
    mimeType,
    fileName,
    data
  }, { localMessageId: pendingMessage.id, caption, quotedMessage, ptt });
  const message = await chatService.markOutgoingMessageSent(req.user.id, pendingMessage.chatId, pendingMessage.id, sent);
  return ok(res, {
    chatId: pendingMessage.chatId,
    canonicalChatId: pendingMessage.chatId,
    sent,
    message: message || pendingMessage
  });
}

module.exports = {
  list,
  contacts,
  createContact,
  events,
  get,
  messages,
  media,
  markRead,
  presence,
  updateMeta,
  startConversation,
  updateContact,
  send,
  editMessage,
  deleteMessage,
  sendMedia,
};
