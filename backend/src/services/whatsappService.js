const { pool } = require("../config/db");
const { config } = require("../config/env");
const { ApiError } = require("../utils/responses");
const { normalizePhone } = require("../utils/normalize");
const { runSessionTask } = require("./sessionTaskQueueService");
const { logger } = require("./loggerService");
const chatService = require("./chatService");
const pairingGuardService = require("./whatsappPairingGuardService");
const { spawn } = require("child_process");
let ffmpegPath = null;
try {
  ffmpegPath = require("ffmpeg-static");
} catch (_) {
  ffmpegPath = null;
}
const pino = require("pino");

let vendorConsoleFilterInstalled = false;
const sessions = new Map();
const reconnectTimers = new Map();
const pairingResumeTracker = new Map();
const sentMessageEchoes = new Map();
let socketModulePromise = null;
let cachedBaileysVersion = null;
let baileysVersionFetchedAt = 0;

const VERSION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function installVendorConsoleFilter() {
  if (vendorConsoleFilterInstalled) return;
  vendorConsoleFilterInstalled = true;

  ["debug", "log", "info", "warn", "error"].forEach((method) => {
    const original = console[method]?.bind(console);
    if (typeof original !== "function") return;

    console[method] = (...args) => {
      const first = String(args[0] || "");
      if (first.startsWith("Closing session:")) return;
      original(...args);
    };
  });
}

installVendorConsoleFilter();

function rememberSentMessageEcho(messageId, chatId, localMessageId = null) {
  const safeMessageId = String(messageId || "").trim();
  const safeChatId = String(chatId || "").trim();
  if (!safeMessageId || !safeChatId) return;
  sentMessageEchoes.set(safeMessageId, {
    chatId: safeChatId,
    localMessageId: String(localMessageId || "").trim() || null,
    expiresAt: Date.now() + 10 * 60 * 1000
  });
}

function consumeSentMessageEcho(messageId) {
  const safeMessageId = String(messageId || "").trim();
  if (!safeMessageId) return null;
  const item = sentMessageEchoes.get(safeMessageId);
  if (!item) return null;
  sentMessageEchoes.delete(safeMessageId);
  if (item.expiresAt <= Date.now()) return null;
  return { chatId: item.chatId, localMessageId: item.localMessageId || null };
}

function pruneSentMessageEchoes(now = Date.now()) {
  for (const [messageId, item] of sentMessageEchoes.entries()) {
    if (!item?.expiresAt || item.expiresAt <= now) sentMessageEchoes.delete(messageId);
  }
}

function sessionIdForUser(userId) {
  return `user_${userId}`;
}

function isSocketOpen(sock) {
  return Boolean(sock?.ws?.isOpen || sock?.ws?.readyState === 1);
}

function normalizeDisconnectCode(code) {
  const parsed = Number(code);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRecoverablePairingClose(code) {
  return [408, 428, 440, 515].includes(normalizeDisconnectCode(code));
}

function resetPairingResumeState(sessionId) {
  pairingResumeTracker.delete(sessionId);
}

function registerPairingResume(sessionId) {
  const now = Date.now();
  const current = pairingResumeTracker.get(sessionId) || { count: 0, lastAt: 0 };
  const count = now - Number(current.lastAt || 0) > 10 * 60 * 1000 ? 1 : Number(current.count || 0) + 1;
  pairingResumeTracker.set(sessionId, { count, lastAt: now });
  return count;
}

function pairingResumeDelay(code) {
  const normalizedCode = normalizeDisconnectCode(code);
  const baseDelay = normalizedCode === 515 ? 1500 : Number(config.whatsapp.pairingResumeBaseDelayMs || 2500);
  const jitter = Math.floor(Math.random() * 1500);
  return Math.max(1000, baseDelay + jitter);
}

function effectiveSocketConnectTimeoutMs(usingProxy = config.whatsapp.useProxy) {
  const directTimeout = Math.max(10000, Number(config.whatsapp.socketConnectTimeoutMs || 45000));
  if (!usingProxy) return directTimeout;
  return Math.max(
    10000,
    Number(config.whatsapp.proxyConnectTimeoutMs || 60000),
    Number(config.whatsapp.proxySocketConnectTimeoutMs || 90000)
  );
}

function effectivePairingSocketReadyTimeoutMs() {
  const configured = Number(config.whatsapp.pairingSocketReadyTimeoutMs || 15000);
  if (!config.whatsapp.useProxy) return configured;
  return Math.max(
    configured,
    Number(config.whatsapp.pairingProxySocketReadyTimeoutMs || 90000),
    effectiveSocketConnectTimeoutMs(true) + 5000
  );
}

function parseBaileysVersion(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  const parts = value.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  return parts;
}

async function resolveBaileysVersion(fetchLatestSocketVersion) {
  const forcedVersion = parseBaileysVersion(config.whatsapp.forceBaileysVersion);
  if (forcedVersion) return forcedVersion;
  if (!config.whatsapp.fetchLatestVersion || typeof fetchLatestSocketVersion !== "function") return undefined;
  if (cachedBaileysVersion && Date.now() - baileysVersionFetchedAt < VERSION_CACHE_TTL_MS) return cachedBaileysVersion;
  try {
    const versionInfo = await fetchLatestSocketVersion();
    if (Array.isArray(versionInfo?.version) && versionInfo.version.length === 3) {
      cachedBaileysVersion = versionInfo.version;
      baileysVersionFetchedAt = Date.now();
      logger.info("whatsapp", "Baileys socket version resolved", { context: { version: cachedBaileysVersion.join(".") } });
      return cachedBaileysVersion;
    }
  } catch (error) {
    logger.warn("whatsapp", "Could not fetch latest WhatsApp socket version", { context: { error: error.message } });
  }
  return undefined;
}

function buildBrowserSignature(Browsers) {
  const fallback = ["Mac OS", "Chrome", "14.4.1"];
  if (!Browsers || typeof Browsers.ubuntu !== "function") return fallback;
  const platform = String(config.whatsapp.browserPlatform || "ubuntu").toLowerCase();
  const browserFactory = {
    ubuntu: Browsers.ubuntu,
    linux: Browsers.ubuntu,
    macos: Browsers.macOS,
    mac: Browsers.macOS,
    windows: Browsers.windows,
    win: Browsers.windows
  }[platform] || Browsers.ubuntu;
  const browserTuple = typeof browserFactory === "function" ? browserFactory("Chrome") : null;
  if (!Array.isArray(browserTuple) || browserTuple.length < 3) return fallback;
  return browserTuple;
}

function sanitizeProxyUrl(proxyUrl) {
  try {
    const parsed = new URL(proxyUrl);
    if (parsed.username) parsed.username = "***";
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch (_) {
    return "invalid_proxy_url";
  }
}

function proxyUrlWithSessionTag(proxyUrl, sessionId) {
  if (!config.whatsapp.proxyStickySession) return proxyUrl;
  try {
    const parsed = new URL(proxyUrl);
    if (!parsed.username || parsed.username.includes("-session-")) return proxyUrl;
    const tag = String(sessionId || "default").replace(/[^a-zA-Z0-9]/g, "");
    parsed.username = `${parsed.username}-session-${tag}`;
    return parsed.toString();
  } catch (_) {
    return proxyUrl;
  }
}

function createSocketProxyAgent(sessionId) {
  if (!config.whatsapp.useProxy) return null;
  const proxyUrl = String(config.whatsapp.proxyUrl || "").trim();
  if (!proxyUrl) {
    logger.warn("whatsapp", "WhatsApp proxy enabled but no proxy URL was configured");
    return null;
  }
  try {
    const { HttpsProxyAgent } = require("https-proxy-agent");
    const effectiveProxyUrl = proxyUrlWithSessionTag(proxyUrl, sessionId);
    const agent = new HttpsProxyAgent(effectiveProxyUrl, {
      timeout: config.whatsapp.proxyConnectTimeoutMs,
      keepAlive: config.whatsapp.proxyKeepAlive,
      keepAliveMsecs: config.whatsapp.proxyKeepAliveMs,
      rejectUnauthorized: false
    });
    logger.info("whatsapp", "WhatsApp socket proxy enabled", {
      context: {
        proxy: sanitizeProxyUrl(effectiveProxyUrl),
        stickySession: config.whatsapp.proxyStickySession,
        connectTimeoutMs: config.whatsapp.proxyConnectTimeoutMs,
        keepAlive: config.whatsapp.proxyKeepAlive
      }
    });
    return agent;
  } catch (error) {
    logger.warn("whatsapp", "Could not create WhatsApp socket proxy agent", { context: { error: error.message } });
    return null;
  }
}

function getRuntimeDiagnostics() {
  return {
    pairingCodeEnabled: config.whatsapp.pairingCodeEnabled,
    fetchLatestVersion: config.whatsapp.fetchLatestVersion,
    forcedBaileysVersion: config.whatsapp.forceBaileysVersion || null,
    cachedBaileysVersion: cachedBaileysVersion ? cachedBaileysVersion.join(".") : null,
    browserName: config.whatsapp.browserName,
    browserPlatform: config.whatsapp.browserPlatform,
    dnsResultOrder: config.whatsapp.dnsResultOrder || null,
    useProxy: config.whatsapp.useProxy,
    proxyConfigured: Boolean(config.whatsapp.proxyUrl),
    proxy: config.whatsapp.proxyUrl ? sanitizeProxyUrl(config.whatsapp.proxyUrl) : null,
    proxyConnectTimeoutMs: config.whatsapp.proxyConnectTimeoutMs,
    proxySocketConnectTimeoutMs: config.whatsapp.proxySocketConnectTimeoutMs,
    proxyKeepAlive: config.whatsapp.proxyKeepAlive,
    proxyKeepAliveMs: config.whatsapp.proxyKeepAliveMs,
    proxyStickySession: config.whatsapp.proxyStickySession,
    socketConnectTimeoutMs: effectiveSocketConnectTimeoutMs(config.whatsapp.useProxy && Boolean(config.whatsapp.proxyUrl)),
    pairingSocketReadyTimeoutMs: effectivePairingSocketReadyTimeoutMs(),
    pairingRequireQrReady: config.whatsapp.pairingRequireQrReady,
    pairingRequestDelayMs: config.whatsapp.pairingRequestDelayMs,
    pairingReadyFallbackMs: config.whatsapp.pairingReadyFallbackMs,
    pairingQrTimeoutMs: config.whatsapp.pairingQrTimeoutMs,
    pairingCodeTtlMs: config.whatsapp.pairingCodeTtlMs,
    pairingResumeBaseDelayMs: config.whatsapp.pairingResumeBaseDelayMs,
    pairingResumeMaxAttempts: config.whatsapp.pairingResumeMaxAttempts,
    restoreConnectedSessions: config.whatsapp.restoreConnectedSessions,
    pairingGuardEnabled: config.whatsapp.pairingGuardEnabled,
    pairingGuardWindowMinutes: config.whatsapp.pairingGuardWindowMinutes,
    pairingGuardMaxAttempts: config.whatsapp.pairingGuardMaxAttempts,
    pairingGuardCooldownMinutes: config.whatsapp.pairingGuardCooldownMinutes
  };
}

async function loadSocketRuntime() {
  try {
    if (!socketModulePromise) {
      socketModulePromise = import("@whiskeysockets/baileys").then((mod) => ({
        ...mod,
        makeWASocket: mod.makeWASocket || mod.default
      }));
    }
    return await socketModulePromise;
  } catch (error) {
    socketModulePromise = null;
    return null;
  }
}

function normalizeCustomPairingCode(customPairingCode) {
  if (customPairingCode === undefined || customPairingCode === null || customPairingCode === "") return undefined;
  const code = String(customPairingCode).trim().replace(/[\s-]/g, "").toUpperCase();
  if (code.length !== 8) {
    throw new ApiError(400, "invalid_pairing_code_length", "El codigo de vinculacion debe tener exactamente 8 caracteres");
  }
  if (!/^[A-Z0-9]{8}$/.test(code)) {
    throw new ApiError(400, "invalid_pairing_code", "Pairing code custom invalido");
  }
  return code;
}

function jidToPhone(jid) {
  const value = String(jid || "");
  if (!value.endsWith("@s.whatsapp.net")) return null;
  const raw = value.split("@")[0].split(":")[0].replace(/\D/g, "");
  return raw ? `+${raw}` : null;
}

function jidDisplayId(jid) {
  const value = String(jid || "").trim();
  const raw = value.split("@")[0].split(":")[0].replace(/\D/g, "");
  return raw ? `+${raw}` : value;
}

function isRetryableMediaDownloadError(error) {
  const message = String(`${error?.message || error || ""} ${error?.cause?.message || ""}`).toLowerCase();
  const code = String(error?.code || error?.cause?.code || "").toUpperCase();
  const causeCode = String(error?.cause?.code || error?.cause?.name || "").toUpperCase();
  return Boolean(
    ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN", "ENOTFOUND", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_SOCKET", "UND_ERR_ABORTED", "ERR_STREAM_PREMATURE_CLOSE"].includes(code) ||
    ["ECONNRESET", "ETIMEDOUT", "UND_ERR_SOCKET", "UND_ERR_ABORTED", "ERR_STREAM_PREMATURE_CLOSE"].includes(causeCode) ||
    message.includes("fetch failed") ||
    message.includes("failed to fetch stream") ||
    message.includes("terminated") ||
    message.includes("aborted") ||
    message.includes("other side closed") ||
    message.includes("premature close") ||
    message.includes("timeout") ||
    message.includes("socket") ||
    message.includes("network")
  );
}

async function downloadMediaBufferWithRetries({
  message,
  downloadMediaMessage,
  logger,
  reuploadRequest,
  attempts = 3,
  delayMs = 900,
} = {}) {
  let lastError = null;
  const timeoutMs = config.whatsapp.mediaDownloadTimeoutMs;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = controller && Number.isFinite(timeoutMs) && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

    try {
      return await downloadMediaMessage(
        message,
        "buffer",
        { options: controller ? { signal: controller.signal } : {} },
        { logger, reuploadRequest }
      );
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableMediaDownloadError(error)) throw error;
      await sleep(delayMs * attempt);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
  throw lastError || new Error("No se pudo descargar media");
}

const HOT_CACHE_MEDIA_TYPES = new Set(["image", "audio", "sticker"]);

async function markMediaCacheMetadata(userId, chatId, messageId, metadata = {}) {
  const safeMetadata = metadata && typeof metadata === "object" ? metadata : {};
  if (!messageId || !Object.keys(safeMetadata).length) return;
  const canonicalChatId = await chatService.resolveCanonicalChatId(userId, chatId, {
    phone: jidToPhone(chatId)
  }).catch(() => chatId);
  await pool.query(
    `UPDATE message_cache
     SET metadata = metadata || $4::jsonb
     WHERE user_id = $1 AND external_chat_id = $2 AND external_message_id = $3`,
    [userId, canonicalChatId, messageId, JSON.stringify(safeMetadata)]
  );
}

async function cacheIncomingMediaBinary({
  userId,
  chatId,
  messageId,
  message,
  media,
  metadata = {},
  messageType,
  sentAt,
  sock,
  downloadMediaMessage,
  socketLogger
} = {}) {
  const mediaType = String(media?.mediaType || metadata.mediaType || messageType || "").trim().toLowerCase();
  const mimeType = media?.mimeType || metadata.mimeType || null;
  const fileName = media?.fileName || metadata.fileName || null;
  const maxBytes = Number(config.whatsapp.mediaCacheMaxBytes || 0);
  const declaredSize = Number(metadata.sizeBytes || media?.sizeBytes || 0);
  const baseContext = { userId, chatId, messageId, mediaType, mimeType, declaredSize: declaredSize || null, maxBytes };

  if (!config.whatsapp.incomingMediaAutoCache) {
    await markMediaCacheMetadata(userId, chatId, messageId, {
      mediaHotCacheStatus: "descriptor_only",
      mediaSkipReason: "auto_cache_disabled",
      mediaSizeBytes: declaredSize || null
    }).catch(() => {});
    logger.info("whatsapp-media", "Incoming media kept as descriptor only", {
      context: { ...baseContext, reason: "auto_cache_disabled" }
    }).catch(() => {});
    return { cached: false, reason: "auto_cache_disabled" };
  }

  if (!HOT_CACHE_MEDIA_TYPES.has(mediaType)) {
    logger.info("whatsapp-media", "Incoming media kept as descriptor only", {
      context: { ...baseContext, reason: "unsupported_v0" }
    }).catch(() => {});
    return { cached: false, reason: "descriptor_only" };
  }

  if (maxBytes <= 0) {
    await markMediaCacheMetadata(userId, chatId, messageId, {
      mediaHotCacheStatus: "descriptor_only",
      mediaSkipReason: "media_cache_disabled"
    }).catch(() => {});
    logger.info("whatsapp-media", "Incoming media kept as descriptor only", {
      context: { ...baseContext, reason: "media_cache_disabled" }
    }).catch(() => {});
    return { cached: false, reason: "media_cache_disabled" };
  }

  if (declaredSize > maxBytes) {
    await markMediaCacheMetadata(userId, chatId, messageId, {
      mediaSkipped: true,
      mediaHotCacheStatus: "descriptor_only",
      mediaSkipReason: "media_too_large",
      mediaSizeBytes: declaredSize
    }).catch(() => {});
    logger.info("whatsapp-media", "Incoming media kept as descriptor only", {
      context: { ...baseContext, reason: "media_too_large" }
    }).catch(() => {});
    return { cached: false, reason: "media_too_large" };
  }

  if (typeof downloadMediaMessage !== "function") {
    await markMediaCacheMetadata(userId, chatId, messageId, {
      mediaHotCacheStatus: "descriptor_only",
      mediaDownloadError: "download_media_unavailable"
    }).catch(() => {});
    logger.warn("whatsapp-media", "Incoming media hot cache unavailable", {
      context: { ...baseContext, reason: "download_media_unavailable" }
    }).catch(() => {});
    return { cached: false, reason: "download_media_unavailable" };
  }

  let buffer;
  try {
    buffer = await downloadMediaBufferWithRetries({
      message,
      downloadMediaMessage,
      logger: socketLogger,
      reuploadRequest: typeof sock?.updateMediaMessage === "function" ? sock.updateMediaMessage.bind(sock) : undefined
    });
  } catch (error) {
    await markMediaCacheMetadata(userId, chatId, messageId, {
      mediaHotCacheStatus: "descriptor_only",
      mediaDownloadError: "media_hot_cache_failed"
    }).catch(() => {});
    logger.warn("whatsapp-media", "Incoming media hot cache failed", {
      context: {
        ...baseContext,
        reason: "media_hot_cache_failed",
        errorCode: error?.code || error?.name || null,
        error: error?.message || "download failed"
      }
    }).catch(() => {});
    return { cached: false, reason: "media_hot_cache_failed" };
  }

  const result = await chatService.cacheMessageMedia({
    userId,
    chatId,
    messageId,
    mediaType,
    mimeType,
    fileName,
    data: buffer,
    sentAt,
    metadata: {
      ...metadata,
      source: "incoming_media_hot_cache",
      mediaHotCacheStatus: "cached"
    }
  });

  if (result?.cached) {
    logger.info("whatsapp-media", "Incoming media cached temporarily", {
      context: { ...baseContext, sizeBytes: result.sizeBytes || buffer.length }
    }).catch(() => {});
    return result;
  }

  await markMediaCacheMetadata(userId, chatId, messageId, {
    mediaHotCacheStatus: "descriptor_only",
    mediaSkipReason: result?.reason || "media_descriptor_only"
  }).catch(() => {});
  logger.info("whatsapp-media", "Incoming media kept as descriptor only", {
    context: { ...baseContext, reason: result?.reason || "media_descriptor_only", sizeBytes: buffer.length }
  }).catch(() => {});
  return result || { cached: false, reason: "media_descriptor_only" };
}

function unwrapMessageContent(message = {}) {
  let content = message.message || {};
  for (let i = 0; i < 5; i += 1) {
    const next =
      content.ephemeralMessage?.message ||
      content.viewOnceMessage?.message ||
      content.viewOnceMessageV2?.message ||
      content.documentWithCaptionMessage?.message ||
      content.editedMessage?.message;
    if (!next || next === content) break;
    content = next;
  }
  return content || {};
}

function isViewOnceMessage(message = {}) {
  const raw = message.message || {};
  const content = unwrapMessageContent(message);
  return Boolean(
    raw.viewOnceMessage ||
    raw.viewOnceMessageV2 ||
    raw.viewOnceMessageV2Extension ||
    content.imageMessage?.viewOnce ||
    content.videoMessage?.viewOnce
  );
}

function pollInfo(content = {}) {
  const poll = content.pollCreationMessageV3 || content.pollCreationMessageV2 || content.pollCreationMessage;
  if (!poll) return null;
  const name = String(poll.name || poll.title || "Encuesta").trim();
  const options = (poll.options || [])
    .map((option) => String(option.optionName || option.name || option.text || "").trim())
    .filter(Boolean)
    .slice(0, 12);
  return { name, options };
}

function locationInfo(location = {}) {
  const latitude = Number(location.degreesLatitude ?? location.lat ?? location.latitude);
  const longitude = Number(location.degreesLongitude ?? location.lng ?? location.longitude);
  return {
    name: String(location.name || location.address || "").trim() || null,
    address: String(location.address || "").trim() || null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null
  };
}

function numberFromProto(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(typeof value?.toString === "function" ? value.toString() : value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function bufferLikeToBase64(value) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return Buffer.from(value).toString("base64");
  if (Array.isArray(value.data)) return Buffer.from(value.data).toString("base64");
  return null;
}

function base64ToBuffer(value) {
  const safeValue = String(value || "").trim();
  if (!safeValue) return undefined;
  try {
    return Buffer.from(safeValue, "base64");
  } catch (_) {
    return undefined;
  }
}

function downloadableMediaMetadata(mediaNode = {}, mediaType) {
  return {
    hasMedia: true,
    mediaType,
    mimeType: mediaNode.mimetype || (mediaType === "audio" ? "audio/ogg" : mediaType === "sticker" ? "image/webp" : "image/jpeg"),
    fileName: mediaNode.fileName || null,
    sizeBytes: numberFromProto(mediaNode.fileLength),
    mediaKey: bufferLikeToBase64(mediaNode.mediaKey),
    mediaKeyTimestamp: numberFromProto(mediaNode.mediaKeyTimestamp),
    fileSha256: bufferLikeToBase64(mediaNode.fileSha256),
    fileEncSha256: bufferLikeToBase64(mediaNode.fileEncSha256),
    directPath: mediaNode.directPath || null,
    url: mediaNode.url || null
  };
}

function extractQuotedMessageInfo(content = {}) {
  const messageNode = Object.values(content || {}).find((value) => value?.contextInfo);
  const contextInfo = messageNode?.contextInfo || null;
  if (!contextInfo?.stanzaId && !contextInfo?.quotedMessage) return null;
  const quoted = contextInfo.quotedMessage || {};
  const quotedContent = unwrapMessageContent({ message: quoted });
  const text = String(
    quotedContent.conversation ||
    quotedContent.extendedTextMessage?.text ||
    quotedContent.imageMessage?.caption ||
    quotedContent.videoMessage?.caption ||
    quotedContent.documentMessage?.fileName ||
    (quotedContent.imageMessage ? "Imagen" : "") ||
    (quotedContent.videoMessage ? "Video" : "") ||
    (quotedContent.audioMessage ? "Audio" : "") ||
    (quotedContent.stickerMessage ? "Sticker" : "") ||
    "Mensaje"
  ).trim();
  const messageType = quotedContent.imageMessage ? "image"
    : quotedContent.videoMessage ? "video"
      : quotedContent.audioMessage ? "audio"
        : quotedContent.stickerMessage ? "sticker"
          : quotedContent.documentMessage ? "document"
            : "text";
  return {
    id: contextInfo.stanzaId || null,
    participant: contextInfo.participant || null,
    authorName: contextInfo.participant ? jidDisplayId(contextInfo.participant) : null,
    messageType,
    text
  };
}

function formatStubPhone(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const candidate = raw.split("@")[0] || raw;
  const digits = candidate.replace(/\D+/g, "");
  if (!digits) return candidate || raw;
  return `+${digits}`;
}

function systemInfoFromMessageStub(message = {}) {
  const rawType = message?.messageStubType ?? message?.message?.protocolMessage?.type ?? "";
  const rawName = message?.messageStubTypeName || message?.messageStubTypeLabel || "";
  const label = `${rawName} ${rawType}`.toLowerCase();
  const parameters = Array.isArray(message?.messageStubParameters) ? message.messageStubParameters : [];
  const readableParameters = parameters.map((value) => formatStubPhone(value)).filter(Boolean);

  if (!rawType && !rawName && !parameters.length) {
    return { body: "", metadata: {} };
  }

  if (/change.*number|number.*change|participant_change_number|change_number/.test(label)) {
    const oldNumber = readableParameters[0] || "";
    const newNumber = readableParameters[1] || readableParameters[0] || "";
    const body = newNumber
      ? `Este contacto cambio de numero. Nuevo numero: ${newNumber}`
      : "Este contacto cambio de numero.";
    return {
      body,
      metadata: {
        systemEvent: true,
        systemType: "number_change",
        oldNumber,
        newNumber,
        messageStubType: rawType,
        messageStubTypeName: rawName || null,
        messageStubParameters: parameters,
      },
    };
  }

  if (/security|identity|verified/.test(label)) {
    return {
      body: "Cambio el codigo de seguridad de este chat.",
      metadata: {
        systemEvent: true,
        systemType: "security_notice",
        messageStubType: rawType,
        messageStubTypeName: rawName || null,
        messageStubParameters: parameters,
      },
    };
  }

  return {
    body: "Aviso de WhatsApp",
    metadata: {
      systemEvent: true,
      systemType: "whatsapp_stub",
      messageStubType: rawType,
      messageStubTypeName: rawName || null,
      messageStubParameters: parameters,
      readableParameters,
    },
  };
}

function extractMessageInfo(message = {}) {
  const content = unwrapMessageContent(message);
  const viewOnce = isViewOnceMessage(message);
  const quotedMessage = extractQuotedMessageInfo(content);
  const withQuoted = (info = {}) => quotedMessage
    ? { ...info, metadata: { ...(info.metadata || {}), quotedMessage } }
    : info;
  if (content.conversation) return withQuoted({ body: content.conversation, messageType: "text" });
  if (content.extendedTextMessage?.text) return withQuoted({ body: content.extendedTextMessage.text, messageType: "text" });
  if (content.imageMessage) {
    return withQuoted({
      body: viewOnce ? "Imagen de una sola visualizacion" : (content.imageMessage.caption || "Imagen"),
      messageType: "image",
      media: {
        mediaType: "image",
        mimeType: content.imageMessage.mimetype || "image/jpeg",
        fileName: null,
      },
      metadata: { viewOnce, ...downloadableMediaMetadata(content.imageMessage, "image") }
    });
  }
  if (content.videoMessage) {
    return withQuoted({
      body: viewOnce ? "Video de una sola visualizacion" : (content.videoMessage.caption || "Video"),
      messageType: "video",
      media: {
        mediaType: "video",
        mimeType: content.videoMessage.mimetype || "video/mp4",
        fileName: null,
      },
      metadata: { viewOnce }
    });
  }
  if (content.audioMessage) {
    return withQuoted({
      body: "Audio",
      messageType: "audio",
      media: {
        mediaType: "audio",
        mimeType: content.audioMessage.mimetype || "audio/ogg",
        fileName: null,
      },
      metadata: { ptt: Boolean(content.audioMessage.ptt), ...downloadableMediaMetadata(content.audioMessage, "audio") }
    });
  }
  if (content.stickerMessage) {
    return withQuoted({
      body: "Sticker",
      messageType: "sticker",
      media: {
        mediaType: "sticker",
        mimeType: content.stickerMessage.mimetype || "image/webp",
        fileName: null,
      },
      metadata: downloadableMediaMetadata(content.stickerMessage, "sticker")
    });
  }
  if (content.documentMessage) {
    const fileName = String(content.documentMessage.fileName || content.documentMessage.title || content.documentMessage.caption || "Documento").trim();
    const sizeBytes = numberFromProto(content.documentMessage.fileLength);
    return withQuoted({
      body: fileName,
      messageType: "document",
      media: {
        mediaType: "document",
        mimeType: content.documentMessage.mimetype || "application/octet-stream",
        fileName,
        sizeBytes,
      },
      metadata: {
        hasMedia: true,
        mediaType: "document",
        mimeType: content.documentMessage.mimetype || null,
        fileName,
        sizeBytes,
        title: content.documentMessage.title || null,
        pageCount: content.documentMessage.pageCount || null
      }
    });
  }
  if (content.locationMessage) {
    const location = locationInfo(content.locationMessage);
    return withQuoted({ body: location.name || location.address || "Ubicacion", messageType: "location", metadata: { location } });
  }
  if (content.liveLocationMessage) {
    const location = locationInfo(content.liveLocationMessage);
    return withQuoted({ body: location.name || location.address || "Ubicacion en vivo", messageType: "location", metadata: { location, liveLocation: true } });
  }
  if (content.contactMessage) {
    const name = content.contactMessage.displayName || "Contacto";
    return withQuoted({ body: name, messageType: "contact", metadata: { contactNames: [name] } });
  }
  if (content.contactsArrayMessage) {
    const names = (content.contactsArrayMessage.contacts || [])
      .map((contact) => String(contact.displayName || "").trim())
      .filter(Boolean)
      .slice(0, 10);
    return withQuoted({ body: names.length ? `Contactos: ${names.join(", ")}` : "Contactos", messageType: "contact", metadata: { contactNames: names } });
  }
  if (content.buttonsResponseMessage) return withQuoted({ body: content.buttonsResponseMessage.selectedDisplayText || content.buttonsResponseMessage.selectedButtonId || "Respuesta", messageType: "interactive" });
  if (content.listResponseMessage) return withQuoted({ body: content.listResponseMessage.title || content.listResponseMessage.singleSelectReply?.selectedRowId || "Respuesta", messageType: "interactive" });
  if (content.templateButtonReplyMessage) return withQuoted({ body: content.templateButtonReplyMessage.selectedDisplayText || content.templateButtonReplyMessage.selectedId || "Respuesta", messageType: "interactive" });
  if (content.pollCreationMessage || content.pollCreationMessageV2 || content.pollCreationMessageV3) {
    const poll = pollInfo(content) || { name: "Encuesta", options: [] };
    return withQuoted({
      body: poll.options.length ? `Encuesta: ${poll.name} (${poll.options.join(" / ")})` : `Encuesta: ${poll.name}`,
      messageType: "poll",
      metadata: { pollName: poll.name, pollOptions: poll.options }
    });
  }
  if (content.reactionMessage) return withQuoted({ body: content.reactionMessage.text || "Reaccion", messageType: "reaction" });
  const firstKey = Object.keys(content)[0] || "";
  const technicalKeys = new Set([
    "messageContextInfo",
    "senderKeyDistributionMessage",
    "protocolMessage",
    "deviceSentMessage",
    "keepInChatMessage"
  ]);
  if (!firstKey || technicalKeys.has(firstKey)) {
    return withQuoted({
      body: "",
      messageType: "technical",
      metadata: firstKey ? { ignoredTechnicalMessageType: firstKey } : {}
    });
  }
  return withQuoted({
    body: "Mensaje no compatible",
    messageType: "unsupported",
    metadata: {
      unsupportedMessageType: firstKey,
      requiresWhatsappReview: true
    }
  });
}

function messageTimestampToDate(timestamp) {
  const raw = typeof timestamp?.toNumber === "function" ? timestamp.toNumber() : timestamp;
  const seconds = Number(raw || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return new Date();
  return new Date(seconds * 1000);
}

function displayNameForMessage(message = {}, chatId = "", knownContact = {}) {
  knownContact = knownContact || {};
  const isGroup = String(chatId).endsWith("@g.us");
  const contactDisplay = String(knownContact.subject || knownContact.name || knownContact.verifiedName || knownContact.notify || "").trim();
  const contactPush = String(knownContact.pushName || "").trim();
  const pushName = String(message.pushName || "").trim();
  if (isGroup) return contactDisplay || chatId;
  if (contactDisplay) return contactDisplay;
  if (pushName) return pushName;
  if (contactPush) return contactPush;
  return jidToPhone(chatId) || chatId;
}

function makeContactStore() {
  const contacts = new Map();
  const chats = new Map();
  const merge = (store, item = {}) => {
    const id = item.id || item.jid;
    if (!id) return null;
    const current = store.get(id) || {};
    const next = { ...current, ...item, id };
    store.set(id, next);
    return next;
  };
  return {
    contacts,
    chats,
    upsertContacts: (items = []) => items.map((item) => merge(contacts, item)).filter(Boolean),
    updateContacts: (items = []) => items.map((item) => merge(contacts, item)).filter(Boolean),
    upsertChats: (items = []) => items.map((item) => merge(chats, item)).filter(Boolean),
    updateChats: (items = []) => items.map((item) => merge(chats, item)).filter(Boolean)
  };
}

function shouldCacheContactJid(jid, source = "contacts") {
  const value = String(jid || "");
  if (!value || value === "status@broadcast" || value.endsWith("@newsletter")) return false;
  if (source === "contacts") return false;
  if (value.endsWith("@lid") && source !== "message") return false;
  return true;
}

function hasSocketChatActivity(chat = {}) {
  const unread = Number(chat.unreadCount || chat.unread || 0);
  return Boolean(unread > 0 || chat.conversationTimestamp || chat.lastMessageRecvTimestamp);
}

function contactName(contact = {}, jid = "") {
  contact = contact || {};
  const isGroup = String(jid || contact.id || contact.jid || "").endsWith("@g.us");
  const subject = String(contact.subject || "").trim();
  const name = String(contact.name || "").trim();
  const verifiedName = String(contact.verifiedName || "").trim();
  if (isGroup) return subject || name || verifiedName || null;
  return (
    name ||
    subject ||
    verifiedName ||
    null
  );
}

function contactPushName(contact = {}) {
  contact = contact || {};
  return String(contact.pushName || contact.verifiedName || "").trim() || null;
}

function contactNotifyName(contact = {}) {
  contact = contact || {};
  return String(contact.notify || contact.short || "").trim() || null;
}

async function resolveContactAvatarUrl(contact = {}, source = "contacts", options = {}) {
  contact = contact || {};
  const chatId = contact.id || contact.jid;
  const existing = contact.imgUrl || contact.avatar || contact.avatarUrl || null;
  if (existing) return existing;
  if (!options.fetchAvatar || !options.sock?.profilePictureUrl || !shouldCacheContactJid(chatId, source)) return null;
  if (source === "group_participant") return null;

  const cache = options.avatarCache;
  if (cache?.has(chatId)) return cache.get(chatId);

  try {
    const avatarUrl = await options.sock.profilePictureUrl(chatId, "image");
    const safeUrl = String(avatarUrl || "").trim() || null;
    if (cache) cache.set(chatId, safeUrl);
    return safeUrl;
  } catch (_) {
    if (cache) cache.set(chatId, null);
    return null;
  }
}

async function cacheSocketContact(userId, contact = {}, source = "contacts", options = {}) {
  const chatId = contact.id || contact.jid;
  if (!shouldCacheContactJid(chatId, source)) return;
  if (source === "chats" && !hasSocketChatActivity(contact)) return;
  const avatarUrl = await resolveContactAvatarUrl(contact, source, options);
  await chatService.upsertContact({
    userId,
    chatId,
    phone: jidToPhone(chatId),
    whatsappName: contactName(contact, chatId),
    pushName: contactPushName(contact),
    notifyName: contactNotifyName(contact),
    verifiedName: contact.verifiedName || null,
    avatarUrl,
    source,
    metadata: {
      source,
      isGroup: String(chatId).endsWith("@g.us"),
      isLid: String(chatId).endsWith("@lid"),
      avatarCached: Boolean(avatarUrl),
      avatarFetchedAt: options.fetchAvatar ? new Date().toISOString() : null
    },
    ensureConversation: false
  }).catch((error) => logger.warn("whatsapp", "Could not cache WhatsApp contact", { context: { userId, chatId, error: error.message } }));
}

function pairingCodeExpired(row = {}) {
  if (!row.pairing_code || !row.pairing_code_expires_at) return false;
  return new Date(row.pairing_code_expires_at).getTime() <= Date.now();
}

function qrExpired(row = {}) {
  if (!row.qr || !row.qr_updated_at) return false;
  return Date.now() - new Date(row.qr_updated_at).getTime() > config.whatsapp.pairingQrTimeoutMs;
}

function hasActivePairingCode(row = {}, phone = "") {
  if (row.status !== "pairing_code" || !row.pairing_code || !row.pairing_code_expires_at) return false;
  if (new Date(row.pairing_code_expires_at).getTime() <= Date.now()) return false;
  if (!phone) return true;
  return normalizePhone(row.phone) === normalizePhone(phone);
}

async function ensureConnectionRow(userId) {
  const sessionId = sessionIdForUser(userId);
  await pool.query(
    `INSERT INTO whatsapp_connections (user_id, session_id) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
    [userId, sessionId]
  );
  const result = await pool.query(`SELECT * FROM whatsapp_connections WHERE user_id = $1`, [userId]);
  return result.rows[0];
}

function destroyInMemorySession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  try {
    session.sock?.ev?.removeAllListeners?.("connection.update");
    session.sock?.ev?.removeAllListeners?.("creds.update");
    session.sock?.ev?.removeAllListeners?.("messages.upsert");
    session.sock?.ev?.removeAllListeners?.("messages.update");
    session.sock?.ev?.removeAllListeners?.("messages.delete");
    session.sock?.ev?.removeAllListeners?.("contacts.upsert");
    session.sock?.ev?.removeAllListeners?.("contacts.update");
    session.sock?.ev?.removeAllListeners?.("chats.upsert");
    session.sock?.ev?.removeAllListeners?.("chats.update");
  } catch (_) {}
  try {
    session.sock?.end?.();
  } catch (_) {}
  sessions.delete(sessionId);
}

function buildPairingSocketError(details = {}) {
  const statusCode = Number(details.statusCode || 0);
  const statusMessage = String(details.statusMessage || "").trim();
  const isIpBlacklisted = /ip_blacklisted/i.test(statusMessage);
  if (isIpBlacklisted) {
    return new ApiError(
      503,
      "pairing_proxy_ip_blacklisted",
      "La IP de salida del proxy fue bloqueada por WhatsApp (ip_blacklisted). No se genero codigo; cambia la IP/proxy o prueba una conexion directa controlada.",
      details
    );
  }
  if (statusCode === 401 || statusCode === 403) {
    return new ApiError(
      503,
      "pairing_socket_rejected",
      `WhatsApp rechazo la conexion de vinculacion (${statusCode}${statusMessage ? `: ${statusMessage}` : ""}). No se genero codigo; prueba con proxy/IP alternativo o una version Web diferente.`,
      details
    );
  }
  if (details.kind === "unexpected_response") {
    return new ApiError(
      503,
      "pairing_socket_rejected",
      "WhatsApp rechazo la conexion de vinculacion antes de generar el codigo.",
      details
    );
  }
  return new ApiError(
    503,
    "pairing_socket_error",
    "La conexion de vinculacion fallo antes de generar el codigo.",
    details
  );
}

function assertPairingSocketHealthy(session) {
  if (session?.socketFatalError) throw session.socketFatalError;
}

async function waitForSocketReady(sessionId, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const session = sessions.get(sessionId);
    assertPairingSocketHealthy(session);
    if (!session?.sock) throw new ApiError(503, "pairing_socket_closed", "La conexion de vinculacion se cerro antes de generar el codigo");
    if (isSocketOpen(session.sock)) return session;
    await sleep(250);
  }
  throw new ApiError(503, "pairing_socket_timeout", "La conexion de vinculacion tardo demasiado en estar lista");
}

async function waitForPairingReady(sessionId, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const session = sessions.get(sessionId);
    assertPairingSocketHealthy(session);
    if (!session?.sock) throw new ApiError(503, "pairing_socket_closed", "La conexion de vinculacion se cerro antes de preparar el codigo");
    if (session.pairingQrAt) return session;
    if (!config.whatsapp.pairingRequireQrReady && session.pairingReadyAt && isSocketOpen(session.sock)) return session;

    // Baileys emits "connecting" on nextTick. If the event was missed during a hot restart,
    // wait a short grace window before falling back to the open WebSocket.
    if (
      !config.whatsapp.pairingRequireQrReady &&
      isSocketOpen(session.sock) &&
      Date.now() - startedAt >= config.whatsapp.pairingReadyFallbackMs
    ) {
      session.pairingReadyAt = Date.now();
      return session;
    }
    await sleep(250);
  }
  throw new ApiError(503, "pairing_socket_timeout", "La conexion de vinculacion tardo demasiado en preparar el codigo");
}

async function waitForQrReady(sessionId, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const session = sessions.get(sessionId);
    assertPairingSocketHealthy(session);
    if (!session?.sock) throw new ApiError(503, "qr_socket_closed", "La conexion de vinculacion se cerro antes de preparar el QR");
    if (session.qr) return session;
    await sleep(250);
  }
  throw new ApiError(503, "qr_socket_timeout", "La conexion de vinculacion tardo demasiado en preparar el QR");
}

async function waitForRuntimeOpen(sessionId, timeoutMs = config.whatsapp.runtimeOpenTimeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const session = sessions.get(sessionId);
    if (!session?.sock) {
      throw new ApiError(503, "whatsapp_disconnected", "WhatsApp no esta conectado");
    }
    if (session.hasEverOpened && isSocketOpen(session.sock)) return session;
    await sleep(500);
  }
  throw new ApiError(503, "whatsapp_open_timeout", "No se pudo abrir la conexion de tu WhatsApp a tiempo");
}

async function ensureRuntimeOpenForSend(userId, timeoutMs = config.whatsapp.sendReadyTimeoutMs) {
  const sessionId = sessionIdForUser(userId);
  const current = await getStatus(userId);
  let session = sessions.get(sessionId);
  if (current.connected && session?.hasEverOpened && session?.sock && isSocketOpen(session.sock)) {
    return session;
  }

  await logConnectivity(userId, sessionId, "send_requires_runtime_restore", {
    status: current.status,
    hasSession: Boolean(session?.sock),
    socketOpen: Boolean(session?.sock && isSocketOpen(session.sock)),
    hasEverOpened: Boolean(session?.hasEverOpened)
  }).catch(() => {});

  await startWhatsApp(userId, {
    force: true,
    waitForOpen: true,
    waitForOpenTimeoutMs: timeoutMs
  });

  session = await waitForRuntimeOpen(sessionId, timeoutMs);
  return session;
}

async function purgeAuthState(sessionId) {
  await pool.query(`DELETE FROM baileys_auth WHERE session_id = $1`, [sessionId]);
}

async function resetPairingAttempt(userId, phone) {
  const sessionId = sessionIdForUser(userId);
  resetPairingResumeState(sessionId);
  destroyInMemorySession(sessionId);
  await purgeAuthState(sessionId);
  await updateConnection(userId, {
    status: "disconnected",
    phone,
    pairing_code: null,
    pairing_code_expires_at: null,
    qr: null,
    qr_updated_at: null,
    pause_reason: null,
    disconnect_reason: "pairing_reset",
    reconnect_attempts: 0
  });
  await logConnectivity(userId, sessionId, "pairing_reset", { phone });
}

function queuePairingResume(userId, delayMs, details = {}) {
  const sessionId = sessionIdForUser(userId);
  if (reconnectTimers.has(sessionId)) return;
  reconnectTimers.set(sessionId, setTimeout(async () => {
    reconnectTimers.delete(sessionId);
    const row = await ensureConnectionRow(userId);
    const expiresAt = row.pairing_code_expires_at ? new Date(row.pairing_code_expires_at).getTime() : 0;
    if (row.status !== "pairing_code" || !row.pairing_code || expiresAt <= Date.now()) {
      resetPairingResumeState(sessionId);
      return;
    }

    const attempt = registerPairingResume(sessionId);
    if (attempt > Number(config.whatsapp.pairingResumeMaxAttempts || 4)) {
      const shouldSilencePauseReason = isRecoverablePairingClose(details.errorCode);
      await updateConnection(userId, {
        status: "pairing_code",
        pause_reason: "pairing_resume_max_attempts",
        disconnect_reason: shouldSilencePauseReason ? null : "No se pudo mantener la vinculacion. Genera un codigo nuevo."
      });
      await logConnectivity(userId, sessionId, "pairing_resume_paused", {
        ...details,
        attempts: attempt - 1,
        maxAttempts: config.whatsapp.pairingResumeMaxAttempts
      });
      return;
    }

    await logConnectivity(userId, sessionId, "pairing_resume", { ...details, attempt });
    startWhatsApp(userId, { force: true, pairing: true, pairingResume: true })
      .catch((error) => logger.warn("whatsapp", error.message, { context: { userId, sessionId, source: "pairing_resume" } }));
  }, delayMs));
}

async function updateConnection(userId, patch) {
  const keys = Object.keys(patch);
  if (keys.length === 0) return ensureConnectionRow(userId);
  const params = [userId];
  const sets = keys.map((key) => {
    params.push(patch[key]);
    return `${key} = $${params.length}`;
  });
  await pool.query(`UPDATE whatsapp_connections SET ${sets.join(", ")}, updated_at = NOW() WHERE user_id = $1`, params);
  return ensureConnectionRow(userId);
}

function whatsappPhoneInUseError() {
  return new ApiError(
    409,
    "whatsapp_phone_already_registered",
    "Este numero de WhatsApp ya esta asociado a otra cuenta."
  );
}

async function assertWhatsappPhoneAvailableForUser(userId, phone) {
  const safePhone = normalizePhone(phone);
  const digits = normalizePhoneDigits(safePhone);
  if (!digits) throw new ApiError(400, "invalid_phone", "Telefono invalido");
  const result = await pool.query(
    `SELECT u.id, u.email, u.status, wc.status AS whatsapp_status
     FROM users u
     LEFT JOIN whatsapp_connections wc ON wc.user_id = u.id
     WHERE u.id <> $1
       AND u.deleted_at IS NULL
       AND (
         regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g') = $2::text
         OR (
           wc.status IN ('connected', 'pairing_code', 'connecting', 'reconnect_paused')
           AND regexp_replace(COALESCE(wc.phone, ''), '[^0-9]', '', 'g') = $2::text
         )
       )
     LIMIT 1`,
    [userId, digits]
  );
  if (result.rows[0]) throw whatsappPhoneInUseError();
  return safePhone;
}

async function reserveWhatsappPhoneForUser(userId, phone) {
  const safePhone = await assertWhatsappPhoneAvailableForUser(userId, phone);
  try {
    await pool.query(
      `UPDATE users
       SET phone = $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId, safePhone]
    );
  } catch (error) {
    if (error?.code === "23505") throw whatsappPhoneInUseError();
    throw error;
  }
  return safePhone;
}

async function logConnectivity(userId, sessionId, eventType, details = {}) {
  await pool.query(
    `INSERT INTO connectivity_logs (user_id, session_id, event_type, error_code, error_message, details)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [userId, sessionId, eventType, details.errorCode || null, details.errorMessage || null, JSON.stringify(details)]
  ).catch(() => {});
}

function bindSocketDiagnostics(sock, session, usingProxy) {
  const { userId, sessionId } = session;
  const ws = sock?.ws;
  if (!ws || typeof ws.on !== "function") return;
  ws.on("open", () => {
    logConnectivity(userId, sessionId, "ws_open", { useProxy: usingProxy }).catch(() => {});
  });
  ws.on("upgrade", (response) => {
    logConnectivity(userId, sessionId, "ws_upgrade", {
      useProxy: usingProxy,
      statusCode: response?.statusCode || null
    }).catch(() => {});
  });
  ws.on("unexpected-response", (_request, response) => {
    const details = {
      kind: "unexpected_response",
      useProxy: usingProxy,
      statusCode: response?.statusCode || null,
      statusMessage: response?.statusMessage || null
    };
    if (session.mode === "pairing" && !session.hasEverOpened) {
      session.socketFatalError = buildPairingSocketError(details);
    }
    logConnectivity(userId, sessionId, "ws_unexpected_response", {
      useProxy: usingProxy,
      statusCode: response?.statusCode || null,
      statusMessage: response?.statusMessage || null
    }).catch(() => {});
  });
  ws.on("error", (error) => {
    const details = {
      kind: "socket_error",
      useProxy: usingProxy,
      errorCode: error?.code || error?.name || null,
      errorMessage: error?.message || "WebSocket error"
    };
    if (session.mode === "pairing" && !session.hasEverOpened && !session.socketFatalError) {
      session.socketFatalError = buildPairingSocketError(details);
    }
    logConnectivity(userId, sessionId, "ws_error", {
      useProxy: usingProxy,
      errorCode: error?.code || error?.name || null,
      errorMessage: error?.message || "WebSocket error"
    }).catch(() => {});
  });
  ws.on("close", (code, reason) => {
    const details = {
      kind: "socket_close",
      useProxy: usingProxy,
      errorCode: code ? String(code) : null,
      errorMessage: reason ? String(reason) : null
    };
    if (session.mode === "pairing" && !session.hasEverOpened && !session.socketFatalError && code) {
      session.socketFatalError = buildPairingSocketError(details);
    }
    logConnectivity(userId, sessionId, "ws_close", {
      useProxy: usingProxy,
      errorCode: code ? String(code) : null,
      errorMessage: reason ? String(reason) : null
    }).catch(() => {});
  });
}

async function useDbAuthState(sessionId) {
  const socketRuntime = await loadSocketRuntime();
  if (!socketRuntime) throw new ApiError(503, "whatsapp_runtime_unavailable", "El servicio de vinculacion no esta disponible temporalmente");
  const { initAuthCreds, BufferJSON } = socketRuntime;
  const writeData = async (data, key) => {
    await pool.query(
      `INSERT INTO baileys_auth (session_id, key_id, data, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (session_id, key_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [sessionId, key, JSON.stringify(data, BufferJSON.replacer)]
    );
  };
  const readData = async (key) => {
    const res = await pool.query(`SELECT data FROM baileys_auth WHERE session_id = $1 AND key_id = $2`, [sessionId, key]);
    if (!res.rows[0]) return null;
    return JSON.parse(JSON.stringify(res.rows[0].data), BufferJSON.reviver);
  };
  const removeData = async (key) => pool.query(`DELETE FROM baileys_auth WHERE session_id = $1 AND key_id = $2`, [sessionId, key]);
  const creds = (await readData("creds")) || initAuthCreds();
  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(ids.map(async (id) => {
            let value = await readData(`${type}-${id}`);
            if (type === "app-state-sync-key" && value && socketRuntime.proto?.Message?.AppStateSyncKeyData) {
              value = socketRuntime.proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          }));
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category of Object.keys(data)) {
            for (const id of Object.keys(data[category])) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(value, key) : removeData(key));
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: () => writeData(creds, "creds")
  };
}

async function startWhatsApp(userId, options = {}) {
  const sessionId = sessionIdForUser(userId);
  return runSessionTask(sessionId, async () => {
    const connectionRow = await ensureConnectionRow(userId);
    const existing = sessions.get(sessionId);
    if (existing?.sock && !options.force) return getStatus(userId);
    const socketRuntime = await loadSocketRuntime();
    if (!socketRuntime) {
      await updateConnection(userId, { status: "runtime_unavailable", disconnect_reason: "WhatsApp runtime unavailable" });
      return getStatus(userId);
    }
  const { makeWASocket, DisconnectReason, makeCacheableSignalKeyStore, Browsers, downloadMediaMessage } = socketRuntime;
    const fetchLatestSocketVersion =
      socketRuntime.fetchLatestWaWebVersion ||
      socketRuntime.fetchLatestBaileysVersion ||
      socketRuntime[["fetchLatest", "Bai", "leysVersion"].join("")];
    if (existing?.sock && options.force) destroyInMemorySession(sessionId);
    const { state, saveCreds } = await useDbAuthState(sessionId);
    await updateConnection(userId, { status: "connecting", disconnect_reason: null, reconnect_attempts: 0 });
    const silentSocketLogger = pino({ level: "silent" });
    const version = await resolveBaileysVersion(fetchLatestSocketVersion);
    const defaultVersion = socketRuntime.DEFAULT_CONNECTION_CONFIG?.version;
    const effectiveVersion = Array.isArray(version)
      ? version
      : Array.isArray(defaultVersion)
        ? defaultVersion
        : undefined;
    const browser = buildBrowserSignature(Browsers);
    const proxyAgent = createSocketProxyAgent(sessionId);
    const effectiveConnectTimeoutMs = effectiveSocketConnectTimeoutMs(Boolean(proxyAgent));
    const auth = makeCacheableSignalKeyStore
      ? { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, silentSocketLogger) }
      : state;
    await logConnectivity(userId, sessionId, options.pairingResume ? "pairing_socket_resume_start" : options.pairing ? "pairing_socket_start" : "socket_start", {
      version: Array.isArray(effectiveVersion) ? effectiveVersion.join(".") : null,
      versionSource: Array.isArray(version) ? "resolved" : Array.isArray(defaultVersion) ? "baileys_default" : "missing",
      browser,
      useProxy: Boolean(proxyAgent),
      proxyConfigured: Boolean(config.whatsapp.proxyUrl),
      dnsResultOrder: config.whatsapp.dnsResultOrder || null,
      connectTimeoutMs: effectiveConnectTimeoutMs
    });
    const socketConfig = {
      logger: silentSocketLogger,
      auth,
      browser,
      agent: proxyAgent || undefined,
      connectTimeoutMs: effectiveConnectTimeoutMs,
      qrTimeout: config.whatsapp.pairingQrTimeoutMs,
      defaultQueryTimeoutMs: config.whatsapp.defaultQueryTimeoutMs,
      keepAliveIntervalMs: config.whatsapp.keepAliveIntervalMs,
      printQRInTerminal: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      retryRequestDelayMs: config.whatsapp.retryRequestDelayMs,
      markOnlineOnConnect: true,
      getMessage: async () => undefined,
      emitOwnEvents: false
    };
    if (Array.isArray(effectiveVersion)) socketConfig.version = effectiveVersion;
    const sock = makeWASocket(socketConfig);
    const contactStore = makeContactStore();
    const session = {
      userId,
      sessionId,
      sock,
      contactStore,
      avatarCache: new Map(),
      startedAt: Date.now(),
      pairingCode: options.pairing ? connectionRow.pairing_code || null : null,
      pairingReadyAt: null,
      pairingQrAt: null,
      qr: null,
      qrGeneratedAt: null,
      mode: options.qr ? "qr" : options.pairing ? "pairing" : "runtime",
      hasEverOpened: false,
      socketFatalError: null
    };
    sessions.set(sessionId, session);
    const isCurrentSocket = () => sessions.get(sessionId)?.sock === sock;
    bindSocketDiagnostics(sock, session, Boolean(proxyAgent));
    sock.ev.on("creds.update", async () => {
      if (!isCurrentSocket()) return;
      await saveCreds();
    });
    sock.ev.on("contacts.upsert", async (contacts = []) => {
      if (!isCurrentSocket()) return;
      contactStore.upsertContacts(Array.isArray(contacts) ? contacts : []);
    });
    sock.ev.on("contacts.update", async (updates = []) => {
      if (!isCurrentSocket()) return;
      contactStore.updateContacts(Array.isArray(updates) ? updates : []);
    });
    sock.ev.on("chats.upsert", async (chats = []) => {
      if (!isCurrentSocket()) return;
      const merged = contactStore.upsertChats(Array.isArray(chats) ? chats : []);
      await Promise.all(merged.map((chat) => cacheSocketContact(userId, chat, "chats", { avatarCache: session.avatarCache })));
    });
    sock.ev.on("chats.update", async (updates = []) => {
      if (!isCurrentSocket()) return;
      const merged = contactStore.updateChats(Array.isArray(updates) ? updates : []);
      await Promise.all(merged.map((chat) => cacheSocketContact(userId, chat, "chats", { avatarCache: session.avatarCache })));
    });
    sock.ev.on("message-receipt.update", async (updates = []) => {
      if (!isCurrentSocket()) return;
      for (const update of Array.isArray(updates) ? updates : []) {
        const providerMessageId = update?.key?.id || update?.id || null;
        const receiptType = update?.receipt?.type || update?.type || update?.status || null;
        if (!providerMessageId || !receiptType) continue;
        await chatService.updateOutgoingMessageStatus(userId, providerMessageId, receiptType, {
          source: "message-receipt.update",
          remoteJid: update?.key?.remoteJid || null,
          participant: update?.key?.participant || update?.participant || null
        }).catch((error) => logger.warn("whatsapp", "Could not update message receipt", {
          context: { userId, providerMessageId, receiptType, error: error.message }
        }));
      }
    });
    sock.ev.on("messages.update", async (updates = []) => {
      if (!isCurrentSocket()) return;
      for (const update of Array.isArray(updates) ? updates : []) {
        const providerMessageId = update?.key?.id || update?.id || null;
        if (!providerMessageId) continue;
        const remoteJid = update?.key?.remoteJid || update?.remoteJid || null;
        const editedMessage =
          update?.update?.message?.editedMessage?.message ||
          update?.message?.editedMessage?.message ||
          update?.update?.message?.protocolMessage?.editedMessage ||
          null;
        if (editedMessage) {
          const editedInfo = extractMessageInfo({ message: editedMessage });
          if (editedInfo.body) {
            await chatService.markProviderMessageEdited(userId, providerMessageId, remoteJid, editedInfo.body, {
              source: "messages.update",
              remoteJid,
              participant: update?.key?.participant || null
            }).catch((error) => logger.warn("whatsapp", "Could not mark provider message edited", {
              context: { userId, providerMessageId, error: error.message }
            }));
          }
          continue;
        }
        const revokeLike =
          update?.update?.message === null ||
          update?.message === null ||
          /revoke|delete/i.test(String(update?.update?.messageStubType || update?.messageStubType || ""));
        if (revokeLike) {
          await chatService.markProviderMessageDeleted(userId, providerMessageId, remoteJid, "everyone", {
            source: "messages.update",
            remoteJid,
            participant: update?.key?.participant || null
          }).catch((error) => logger.warn("whatsapp", "Could not mark provider message deleted", {
            context: { userId, providerMessageId, error: error.message }
          }));
          continue;
        }
        const rawStatus = update?.update?.status || update?.status || update?.deliveryStatus || null;
        const errorMessage = update?.update?.error?.message || update?.error?.message || null;
        const status = errorMessage ? "failed" : rawStatus;
        if (!status) continue;
        await chatService.updateOutgoingMessageStatus(userId, providerMessageId, status, {
          source: "messages.update",
          remoteJid,
          errorMessage
        }).catch((error) => logger.warn("whatsapp", "Could not update message status", {
          context: { userId, providerMessageId, status, error: error.message }
        }));
      }
    });
    sock.ev.on("messages.delete", async (payload = {}) => {
      if (!isCurrentSocket()) return;
      const keys = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.keys)
          ? payload.keys
          : payload?.key
            ? [payload.key]
            : [];
      for (const key of keys) {
        const providerMessageId = key?.id || null;
        if (!providerMessageId) continue;
        await chatService.markProviderMessageDeleted(userId, providerMessageId, key?.remoteJid || null, "me", {
          source: "messages.delete",
          remoteJid: key?.remoteJid || null,
          participant: key?.participant || null
        }).catch((error) => logger.warn("whatsapp", "Could not mark local message deleted", {
          context: { userId, providerMessageId, error: error.message }
        }));
      }
    });
    sock.ev.on("connection.update", async (update) => {
      if (!isCurrentSocket()) return;
      const { connection, lastDisconnect, qr } = update;
      if (session.mode === "pairing" && qr) {
        session.pairingQrAt = session.pairingQrAt || Date.now();
      }
      if (session.mode === "pairing" && (connection === "connecting" || qr)) {
        session.pairingReadyAt = session.pairingReadyAt || Date.now();
      }
      if (session.mode === "qr" && qr) {
        session.qr = qr;
        session.qrGeneratedAt = Date.now();
        await updateConnection(userId, {
          status: "qr",
          qr,
          qr_updated_at: new Date(),
          pairing_code: null,
          pairing_code_expires_at: null,
          disconnect_reason: null
        });
        await logConnectivity(userId, sessionId, "qr_generated", {});
      }
      if (connection === "open") {
        session.hasEverOpened = true;
        resetPairingResumeState(sessionId);
        pairingGuardService.resetUser(userId).catch(() => {});
        const phone = sock.user?.id ? `+${String(sock.user.id).split(":")[0].replace(/\D/g, "")}` : null;
        try {
          await reserveWhatsappPhoneForUser(userId, phone);
        } catch (error) {
          await logConnectivity(userId, sessionId, "phone_ownership_conflict", {
            phone,
            errorCode: error?.code || error?.name || null,
            errorMessage: error?.message || "Numero ya asociado a otra cuenta"
          }).catch(() => {});
          await updateConnection(userId, {
            status: "disconnected",
            pairing_code: null,
            pairing_code_expires_at: null,
            qr: null,
            qr_updated_at: null,
            disconnect_reason: error?.message || "Numero ya asociado a otra cuenta"
          }).catch(() => {});
          await purgeAuthState(sessionId).catch(() => {});
          try {
            await sock.logout?.();
          } catch (_) {}
          destroyInMemorySession(sessionId);
          return;
        }
        await purgeCacheIfPhoneChanged(userId, phone);
        await updateConnection(userId, { status: "connected", phone, pairing_code: null, pairing_code_expires_at: null, qr: null, qr_updated_at: null, last_heartbeat_at: new Date(), reconnect_attempts: 0 });
        await logConnectivity(userId, sessionId, "open", { phone });
      }
      if (connection === "close") {
        const code = normalizeDisconnectCode(lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.status || null);
        const message = lastDisconnect?.error?.message || "Connection closed";
        const isLogout = code === 401 || code === 403 || code === DisconnectReason?.loggedOut;
        const isPairingBootstrap = (session.mode === "pairing" || session.mode === "qr") && !session.hasEverOpened;
        const keepPairingCodeVisible = isPairingBootstrap && Boolean(session.pairingCode) && !isLogout;
        const shouldResumePairing = keepPairingCodeVisible && !isLogout && isRecoverablePairingClose(code);
        const pairingDisconnectReason = shouldResumePairing ? "" : code ? `${message} (${code})` : message;
        await updateConnection(userId, keepPairingCodeVisible ? {
          status: "pairing_code",
          qr: null,
          qr_updated_at: null,
          disconnect_reason: pairingDisconnectReason
        } : {
          status: "disconnected",
          disconnect_reason: code ? `${message} (${code})` : message,
          pairing_code: null,
          pairing_code_expires_at: null,
          qr: null,
          qr_updated_at: null
        });
        await logConnectivity(userId, sessionId, "close", { errorCode: String(code || ""), errorMessage: message });
        sessions.delete(sessionId);
        if (shouldResumePairing) {
          queuePairingResume(userId, pairingResumeDelay(code), { reason: message, errorCode: code });
        } else if (!isLogout && !isPairingBootstrap) {
          queueReconnection(userId, config.whatsapp.reconnectBaseDelayMs, { reason: message });
        }
      }
    });
    sock.ev.on("messages.upsert", async ({ messages = [], type } = {}) => {
      if (type && type !== "notify") return;
      for (const message of messages) {
        if (!isCurrentSocket()) return;
        const remoteJid = message?.key?.remoteJid;
        if (!remoteJid || remoteJid === "status@broadcast" || remoteJid.endsWith("@newsletter")) continue;
        const remoteJidAlt = message?.key?.remoteJidAlt || null;
        const fromMe = Boolean(message?.key?.fromMe);
        const messageId = message?.key?.id || `wa_${Date.now()}`;
        let chatId = remoteJid;
        const chatPhone = jidToPhone(remoteJid) || jidToPhone(remoteJidAlt);
        if (remoteJidAlt && !String(remoteJid).endsWith("@g.us")) {
          const canonicalHint = jidToPhone(remoteJid) ? remoteJid : (jidToPhone(remoteJidAlt) ? remoteJidAlt : remoteJid);
          const aliasHint = canonicalHint === remoteJid ? remoteJidAlt : remoteJid;
          await chatService.registerChatAlias(userId, canonicalHint, aliasHint, {
            phone: chatPhone,
            source: "message_alt_jid_alias",
            metadata: { messageId, remoteJid, remoteJidAlt }
          }).catch(() => {});
          chatId = await chatService.resolveCanonicalChatId(userId, remoteJid, { phone: chatPhone }).catch(() => remoteJid);
        }
      const extractedInfo = extractMessageInfo(message);
      const systemInfo = systemInfoFromMessageStub(message);
      const body = extractedInfo.body || systemInfo.body || "";
      const messageType = systemInfo.body && !extractedInfo.media ? "system" : extractedInfo.messageType;
      const media = extractedInfo.media;
      const extractedMetadata = {
        ...(extractedInfo.metadata || {}),
        ...(systemInfo.metadata || {}),
      };
        const sentAt = messageTimestampToDate(message?.messageTimestamp);
        if (fromMe) {
          const consumedEcho = consumeSentMessageEcho(messageId);
          const knownSentEcho = consumedEcho || await chatService.findOutgoingMessageByProviderMessageId(userId, messageId).catch(() => null);
          if (knownSentEcho?.chatId) {
            logger.info("whatsapp-sync", "Duplicate fromMe echo reconciled", {
              context: {
                userId,
                chatId,
                canonicalChatId: knownSentEcho.chatId,
                providerMessageId: messageId,
                localMessageId: knownSentEcho.localMessageId || knownSentEcho.messageId || null,
                strategy: consumedEcho ? "memory" : "provider_message_id"
              }
            }).catch(() => {});
            if (knownSentEcho.chatId !== chatId) {
              await chatService.registerChatAlias(userId, knownSentEcho.chatId, chatId, {
                phone: chatPhone || jidToPhone(chatId),
                source: "from_me_echo_alias",
                metadata: { messageId, remoteJid, remoteJidAlt }
              }).catch(() => {});
            }
            if (knownSentEcho.localMessageId || knownSentEcho.messageId) {
              await chatService.markOutgoingMessageSent(userId, knownSentEcho.chatId, knownSentEcho.localMessageId || knownSentEcho.messageId, {
                id: messageId,
                key: { id: messageId, remoteJid: chatId }
              }).catch(() => {});
            }
            pruneSentMessageEchoes();
            continue;
          }
          const recentEcho = await chatService.findRecentOutgoingEchoCandidate(userId, chatId, body, sentAt, messageType).catch(() => null);
          if (recentEcho) {
            logger.info("whatsapp-sync", "Duplicate fromMe echo reconciled by recent outgoing fallback", {
              context: {
                userId,
                chatId,
                canonicalChatId: recentEcho.chatId,
                providerMessageId: messageId,
                localMessageId: recentEcho.messageId || null,
                strategy: messageType === "text" ? "recent_text_window" : "recent_media_window"
              }
            }).catch(() => {});
            if (recentEcho.chatId && recentEcho.chatId !== chatId) {
              await chatService.registerChatAlias(userId, recentEcho.chatId, chatId, {
                phone: chatPhone || jidToPhone(chatId),
                source: "recent_from_me_echo_alias",
                metadata: { messageId, localMessageId: recentEcho.messageId || null, remoteJid, remoteJidAlt }
              }).catch(() => {});
            }
            if (recentEcho.messageId) {
              await chatService.markOutgoingMessageSent(userId, recentEcho.chatId, recentEcho.messageId, {
                id: messageId,
                key: { id: messageId, remoteJid: chatId }
              }).catch(() => {});
            }
            rememberSentMessageEcho(messageId, recentEcho.chatId, recentEcho.messageId);
            pruneSentMessageEchoes();
            continue;
          }
          logger.info("whatsapp-sync", "fromMe message cached as external WhatsApp send", {
            context: {
              userId,
              chatId,
              providerMessageId: messageId,
              messageType,
              hasBody: Boolean(body),
              hasMedia: Boolean(media)
            }
          }).catch(() => {});
        }
        if (messageType === "reaction") continue;
        if (!body && !media) continue;
        const isGroupChat = String(chatId).endsWith("@g.us");
        const findStoredContact = (jid) => jid
          ? session.contactStore?.contacts?.get(jid) || session.contactStore?.chats?.get(jid) || null
          : null;
        const knownContact = isGroupChat
          ? findStoredContact(chatId) || findStoredContact(remoteJid) || findStoredContact(remoteJidAlt)
          : findStoredContact(chatId) || findStoredContact(remoteJid) || findStoredContact(remoteJidAlt);
        const participantJid = isGroupChat ? message?.key?.participant || null : null;
        const knownParticipant = participantJid
          ? session.contactStore?.contacts?.get(participantJid) || session.contactStore?.chats?.get(participantJid) || null
          : null;
        const participantName = String(
          contactName(knownParticipant, participantJid) ||
          knownParticipant?.notify ||
          knownParticipant?.pushName ||
          (!fromMe ? message?.pushName : "") ||
          jidDisplayId(participantJid) ||
          ""
        ).trim() || null;
        if (participantJid && participantName && !fromMe) {
          cacheSocketContact(userId, { id: participantJid, pushName: participantName, notify: participantName }, "group_participant").catch(() => {});
          session.contactStore?.upsertContacts?.([{ id: participantJid, pushName: participantName, notify: participantName }]);
        }
        let contactDisplayName = String(
          contactName(knownContact, chatId) ||
          knownContact?.verifiedName ||
          knownContact?.notify ||
          ""
        ).trim();
        if (!contactDisplayName && isGroupChat && typeof sock.groupMetadata === "function") {
          try {
            const groupMetadata = await sock.groupMetadata(chatId);
            if (groupMetadata?.subject) {
              contactDisplayName = String(groupMetadata.subject).trim();
              const cachedGroup = contactStore.upsertChats([{ id: chatId, subject: contactDisplayName }])[0];
              if (cachedGroup) cacheSocketContact(userId, cachedGroup, "chats", { sock, avatarCache: session.avatarCache, fetchAvatar: true }).catch(() => {});
            }
          } catch (_) {}
        }
        const messageContact = contactDisplayName ? { ...(knownContact || {}), subject: contactDisplayName } : knownContact;
        const contactForAvatar = {
          ...(messageContact || {}),
          id: chatId,
          pushName: !fromMe ? message?.pushName || messageContact?.pushName : messageContact?.pushName,
          notify: messageContact?.notify,
          subject: contactDisplayName || messageContact?.subject
        };
        const avatarUrl = await resolveContactAvatarUrl(contactForAvatar, "message_chat", {
          sock,
          avatarCache: session.avatarCache,
          fetchAvatar: true
        });
        if (avatarUrl) contactForAvatar.imgUrl = avatarUrl;
        cacheSocketContact(userId, contactForAvatar, "message_chat", { avatarCache: session.avatarCache }).catch(() => {});
        const resolvedDisplayName = fromMe
          ? (contactDisplayName || jidToPhone(chatId) || chatId)
          : displayNameForMessage(message, chatId, messageContact);
        const senderName = isGroupChat && !fromMe
          ? (participantName || message?.pushName || jidDisplayId(participantJid) || null)
          : null;
        await chatService.cacheMessage({
          userId,
          chatId,
          messageId,
          sender: fromMe ? "me" : "match",
          body,
          messageType,
          displayName: resolvedDisplayName,
          phone: chatPhone || jidToPhone(chatId),
          sentAt,
          incrementUnread: !fromMe,
          metadata: {
            source: "messages.upsert",
            upsertType: type || null,
            fromMe,
            isGroup: isGroupChat,
            remoteJid,
            remoteJidAlt,
            canonicalChatId: chatId,
            participant: participantJid,
            participantName,
            senderName,
            pushName: fromMe ? null : message?.pushName || null,
            whatsappName: knownContact ? contactName(knownContact, chatId) : null,
            notifyName: knownContact ? contactNotifyName(knownContact) : null,
            verifiedName: knownContact?.verifiedName || null,
            avatarUrl: avatarUrl || null,
            ...extractedMetadata,
            messageStubType: message?.messageStubType || null
          }
        }).catch((error) => logger.warn("whatsapp", "Could not cache incoming message", { context: { userId, error: error.message } }));
        if (media && !extractedMetadata.viewOnce) {
          cacheIncomingMediaBinary({
            userId,
            chatId,
            messageId,
            message,
            media,
            metadata: extractedMetadata,
            messageType,
            sentAt,
            sock,
            downloadMediaMessage,
            socketLogger: silentSocketLogger
          }).catch((error) => logger.warn("whatsapp-media", "Incoming media cache task failed", {
            context: {
              userId,
              chatId,
              messageId,
              mediaType: media.mediaType || messageType,
              errorCode: error?.code || error?.name || null,
              error: error?.message || "media cache failed"
            }
          }).catch(() => {}));
        }
      }
    });
    if (options.waitForOpen) {
      try {
        await waitForRuntimeOpen(sessionId, options.waitForOpenTimeoutMs || config.whatsapp.runtimeOpenTimeoutMs);
      } catch (error) {
        if (sessions.get(sessionId)?.sock === sock) {
          destroyInMemorySession(sessionId);
          await updateConnection(userId, {
            status: "disconnected",
            disconnect_reason: error?.message || "No se pudo abrir la conexion de tu WhatsApp"
          }).catch(() => {});
          queueReconnection(userId, config.whatsapp.reconnectBaseDelayMs, {
            reason: error?.message || "open timeout",
            source: "runtime_open_timeout"
          });
        }
        await logConnectivity(userId, sessionId, "runtime_open_timeout", {
          errorCode: error?.code || error?.name || null,
          errorMessage: error?.message || "No se pudo abrir la conexion de tu WhatsApp"
        }).catch(() => {});
        throw error;
      }
    }
    return getStatus(userId);
  });
}

async function requestPairingCode(userId, phone, options = {}) {
  if (!config.whatsapp.pairingCodeEnabled) throw new ApiError(400, "pairing_disabled", "Pairing code disabled");
  const safePhone = normalizePhone(phone);
  if (!safePhone) throw new ApiError(400, "invalid_phone", "Telefono invalido");
  const current = await ensureConnectionRow(userId);
  if (current.status === "connected") throw new ApiError(409, "whatsapp_already_connected", "WhatsApp ya esta conectado");
  await assertWhatsappPhoneAvailableForUser(userId, safePhone);
  const guard = await pairingGuardService.checkAllowed(userId, { phone: safePhone });
  if (!guard.allowed) {
    throw new ApiError(429, "pairing_cooldown", guard.message || "Demasiados intentos de vinculacion. Intentalo mas tarde.", guard);
  }
  await logConnectivity(userId, sessionIdForUser(userId), "pairing_attempt", {
    phone: safePhone,
    useProxy: config.whatsapp.useProxy,
    proxyConfigured: Boolean(config.whatsapp.proxyUrl),
    dnsResultOrder: config.whatsapp.dnsResultOrder || null,
    socketReadyTimeoutMs: effectivePairingSocketReadyTimeoutMs()
  });
  const sessionId = sessionIdForUser(userId);
  try {
    await resetPairingAttempt(userId, safePhone);
    await startWhatsApp(userId, { force: true, pairing: true });
    const socketReadyTimeoutMs = effectivePairingSocketReadyTimeoutMs();
    const session = await waitForPairingReady(sessionId, socketReadyTimeoutMs);
    if (config.whatsapp.pairingRequestDelayMs > 0) await sleep(config.whatsapp.pairingRequestDelayMs);
    if (!session?.sock?.requestPairingCode) throw new ApiError(503, "pairing_unavailable", "La vinculacion por codigo no esta disponible temporalmente");
    const customPairingCode = normalizeCustomPairingCode(options.customPairingCode);
    const code = await session.sock.requestPairingCode(safePhone.replace(/\D/g, ""), customPairingCode);
    if (String(code || "").replace(/[\s-]/g, "").length !== 8) {
      logger.warn("whatsapp", "Unexpected pairing code length from WhatsApp socket runtime", { context: { userId, length: String(code || "").length } });
    }
    session.pairingCode = code;
    await pairingGuardService.recordGeneratedCode(userId, { phone: safePhone });
    await updateConnection(userId, { status: "pairing_code", phone: safePhone, pairing_code: code, pairing_code_expires_at: new Date(Date.now() + (Number(config.whatsapp.pairingCodeTtlMs) || 3 * 60 * 1000)) });
    await logConnectivity(userId, session.sessionId, "pairing_code", { phone: safePhone });
    return getStatus(userId);
  } catch (error) {
    destroyInMemorySession(sessionId);
    await updateConnection(userId, {
      status: "disconnected",
      pairing_code: null,
      pairing_code_expires_at: null,
      disconnect_reason: error?.message || "No se pudo preparar la vinculacion"
    }).catch(() => {});
    await logConnectivity(userId, sessionId, "pairing_failed", {
      errorCode: error?.code || error?.name || null,
      errorMessage: error?.message || "Pairing failed"
    });
    throw error;
  }
}

async function requestQr(userId, options = {}) {
  const current = await ensureConnectionRow(userId);
  if (current.status === "connected") throw new ApiError(409, "whatsapp_already_connected", "WhatsApp ya esta conectado");
  const sessionId = sessionIdForUser(userId);
  try {
    resetPairingResumeState(sessionId);
    destroyInMemorySession(sessionId);
    await purgeAuthState(sessionId);
    await updateConnection(userId, {
      status: "qr_pending",
      pairing_code: null,
      pairing_code_expires_at: null,
      qr: null,
      qr_updated_at: null,
      disconnect_reason: null,
      reconnect_attempts: 0
    });
    await logConnectivity(userId, sessionId, "qr_attempt", {
      useProxy: config.whatsapp.useProxy,
      proxyConfigured: Boolean(config.whatsapp.proxyUrl),
      socketReadyTimeoutMs: effectivePairingSocketReadyTimeoutMs()
    });
    await startWhatsApp(userId, { force: true, qr: true });
    await waitForQrReady(sessionId, effectivePairingSocketReadyTimeoutMs());
    return getStatus(userId);
  } catch (error) {
    destroyInMemorySession(sessionId);
    await updateConnection(userId, {
      status: "disconnected",
      pairing_code: null,
      pairing_code_expires_at: null,
      qr: null,
      qr_updated_at: null,
      disconnect_reason: error?.message || "No se pudo preparar el QR"
    }).catch(() => {});
    await logConnectivity(userId, sessionId, "qr_failed", {
      errorCode: error?.code || error?.name || null,
      errorMessage: error?.message || "QR failed"
    });
    throw error;
  }
}

function queueReconnection(userId, delayMs, details = {}) {
  const sessionId = sessionIdForUser(userId);
  if (reconnectTimers.has(sessionId)) return;
  reconnectTimers.set(sessionId, setTimeout(async () => {
    reconnectTimers.delete(sessionId);
    const row = await ensureConnectionRow(userId);
    if (row.reconnect_attempts >= config.whatsapp.reconnectMaxAttempts) {
      await updateConnection(userId, { status: "reconnect_paused", pause_reason: "max_attempts" });
      return;
    }
    await pool.query(`UPDATE whatsapp_connections SET reconnect_attempts = reconnect_attempts + 1 WHERE user_id = $1`, [userId]);
    await logConnectivity(userId, sessionId, "reconnect", details);
    startWhatsApp(userId, { force: true }).catch((error) => logger.warn("whatsapp", error.message, { context: { userId } }));
  }, delayMs));
}

async function getStatus(userId) {
  let row = await ensureConnectionRow(userId);
  if (pairingCodeExpired(row)) {
    row = await updateConnection(userId, {
      status: row.status === "pairing_code" ? "disconnected" : row.status,
      pairing_code: null,
      pairing_code_expires_at: null,
      disconnect_reason: "pairing_code_expired"
    });
    await logConnectivity(userId, row.session_id, "pairing_code_expired", {});
  }
  if (qrExpired(row)) {
    row = await updateConnection(userId, {
      status: row.status === "qr" || row.status === "qr_pending" ? "disconnected" : row.status,
      qr: null,
      qr_updated_at: null,
      disconnect_reason: "qr_expired"
    });
    await logConnectivity(userId, row.session_id, "qr_expired", {});
  }
  const qrExpiresAt = row.qr_updated_at ? new Date(new Date(row.qr_updated_at).getTime() + config.whatsapp.pairingQrTimeoutMs) : null;
  return {
    sessionId: row.session_id,
    status: row.status,
    connected: row.status === "connected",
    phone: row.phone,
    pairingCode: row.pairing_code,
    pairingCodeExpiresAt: row.pairing_code_expires_at,
    qr: row.qr,
    qrUpdatedAt: row.qr_updated_at,
    qrExpiresAt,
    lastHeartbeatAt: row.last_heartbeat_at,
    pauseReason: row.pause_reason,
    disconnectReason: row.disconnect_reason,
    reconnectAttempts: row.reconnect_attempts
  };
}

async function reconnect(userId) {
  return startWhatsApp(userId, { force: true });
}

function normalizePhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

async function purgeUserWhatsappCache(userId) {
  await pool.query(`DELETE FROM message_media_cache WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM message_cache WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM conversation_meta WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM whatsapp_contacts WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM whatsapp_chat_aliases WHERE user_id = $1`, [userId]);
}

async function purgeCacheIfPhoneChanged(userId, nextPhone) {
  const nextDigits = normalizePhoneDigits(nextPhone);
  if (!nextDigits) return;
  const result = await pool.query(`SELECT phone FROM whatsapp_connections WHERE user_id = $1`, [userId]);
  const previousDigits = normalizePhoneDigits(result.rows[0]?.phone);
  if (previousDigits && previousDigits !== nextDigits) {
    await purgeUserWhatsappCache(userId);
    await logConnectivity(userId, sessionIdForUser(userId), "phone_changed_cache_purged", {
      previousPhone: result.rows[0]?.phone || null,
      nextPhone
    });
  }
}

async function disconnect(userId, purge = false) {
  const sessionId = sessionIdForUser(userId);
  const session = sessions.get(sessionId);
  if (session?.sock?.logout) await session.sock.logout().catch(() => {});
  resetPairingResumeState(sessionId);
  destroyInMemorySession(sessionId);
  if (purge) await purgeAuthState(sessionId);
  if (purge) await purgeUserWhatsappCache(userId);
  await updateConnection(userId, { status: "disconnected", pairing_code: null, pairing_code_expires_at: null, qr: null, qr_updated_at: null, disconnect_reason: purge ? "purged" : "manual_disconnect" });
  await logConnectivity(userId, sessionId, purge ? "purge" : "disconnect", {});
  return getStatus(userId);
}

async function markChatRead(userId, chatId, options = {}) {
  const canonicalChatId = await chatService.resolveCanonicalChatId(userId, chatId, { phone: jidToPhone(chatId) }).catch(() => chatId);
  const jid = String(canonicalChatId || chatId || "").includes("@")
    ? String(canonicalChatId || chatId)
    : `${String(canonicalChatId || chatId || "").replace(/\D/g, "")}@s.whatsapp.net`;
  const sessionId = sessionIdForUser(userId);
  const session = sessions.get(sessionId);

  if (!session?.sock || !isSocketOpen(session.sock)) {
    return { skipped: true, reason: "socket_not_open", chatId: jid };
  }
  if (typeof session.sock.readMessages !== "function") {
    return { skipped: true, reason: "read_messages_unavailable", chatId: jid };
  }

  const messages = await chatService.getMessages(userId, jid)
    .catch(() => chatService.getMessages(userId, canonicalChatId))
    .catch(() => []);
  const keys = messages
    .filter((message) => message?.sender !== "me" && message?.id)
    .slice(-25)
    .map((message) => {
      const metadata = message.metadata || {};
      const key = {
        remoteJid: metadata.remoteJid || jid,
        id: message.id,
        fromMe: false
      };
      const participant = metadata.participant || metadata.participantJid || metadata.senderJid;
      if (participant && String(key.remoteJid || "").endsWith("@g.us")) key.participant = participant;
      return key;
    });

  if (keys.length === 0) return { skipped: true, reason: "no_message_keys", chatId: jid };

  await session.sock.readMessages(keys);
  await logConnectivity(userId, sessionId, "read_messages", {
    chatId: jid,
    count: keys.length,
    taskId: options.taskId || null
  }).catch(() => {});
  return { chatId: jid, count: keys.length };
}

function normalizePresenceUpdate(presence) {
  const value = String(presence || "").trim().toLowerCase();
  return ["composing", "recording", "paused"].includes(value) ? value : "paused";
}

async function sendPresence(userId, chatId, presence = "paused", options = {}) {
  const canonicalChatId = await chatService.resolveCanonicalChatId(userId, chatId, { phone: jidToPhone(chatId) }).catch(() => chatId);
  const jid = String(canonicalChatId || chatId || "").includes("@")
    ? String(canonicalChatId || chatId)
    : `${String(canonicalChatId || chatId || "").replace(/\D/g, "")}@s.whatsapp.net`;
  const presenceType = normalizePresenceUpdate(presence);
  const sessionId = sessionIdForUser(userId);
  const session = sessions.get(sessionId);

  if (!session?.sock || !isSocketOpen(session.sock)) {
    return { skipped: true, reason: "socket_not_open", chatId: jid, presence: presenceType };
  }
  if (typeof session.sock.sendPresenceUpdate !== "function") {
    return { skipped: true, reason: "presence_unavailable", chatId: jid, presence: presenceType };
  }

  await session.sock.sendPresenceUpdate(presenceType, jid);
  await logConnectivity(userId, sessionId, "presence_update", {
    chatId: jid,
    presence: presenceType,
    taskId: options.taskId || null
  }).catch(() => {});
  return { chatId: jid, presence: presenceType };
}

function buildQuotedMessageForSend(jid, quotedMessage = {}) {
  if (!quotedMessage || typeof quotedMessage !== "object") return null;
  const id = String(quotedMessage.id || quotedMessage.externalMessageId || "").trim();
  if (!id) return null;
  const text = String(quotedMessage.text || quotedMessage.body || quotedMessage.messageType || "Mensaje").trim() || "Mensaje";
  const sender = String(quotedMessage.sender || "").toLowerCase();
  const key = {
    remoteJid: String(quotedMessage.chatId || jid),
    id,
    fromMe: sender === "me" || quotedMessage.fromMe === true
  };
  const participant = quotedMessage.participant || quotedMessage.participantJid || null;
  if (participant && String(key.remoteJid || "").endsWith("@g.us")) key.participant = participant;
  return {
    key,
    message: { conversation: text }
  };
}

function normalizeOutgoingMediaType(mediaType, mimeType) {
  const requested = String(mediaType || "").trim().toLowerCase();
  const mime = String(mimeType || "").trim().toLowerCase();
  if (["image", "audio", "sticker", "video"].includes(requested)) return requested;
  if (mime === "image/webp") return "sticker";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  throw new ApiError(400, "unsupported_media_type", "Por ahora puedes enviar imágenes, videos, stickers webp o audios.");
}

function isLikelyVoiceNoteCompatibleMime(mimeType) {
  const normalized = String(mimeType || "").toLowerCase();
  if (!normalized.startsWith("audio/")) return false;
  if (normalized.includes("codecs=opus")) return true;
  if (normalized === "audio/ogg") return true;
  return false;
}

function normalizePttMimeType(inputMimeType) {
  const normalized = String(inputMimeType || "").trim().toLowerCase();
  if (!normalized) return "audio/ogg; codecs=opus";
  if (normalized.includes("audio/ogg")) return "audio/ogg; codecs=opus";
  if (normalized.includes("audio/webm")) return normalized.includes("codecs=opus")
    ? normalized
    : "audio/webm; codecs=opus";
  if (normalized.includes("audio/mp4") || normalized.includes("audio/m4a") || normalized.includes("video/mp4")) {
    return "audio/mp4";
  }
  return "audio/ogg; codecs=opus";
}

function normalizeAudioFallbackMimeType(inputMimeType) {
  const normalized = String(inputMimeType || "").trim().toLowerCase();
  if (normalized.includes("audio/ogg")) return "audio/ogg";
  if (normalized.includes("audio/webm")) return "audio/webm";
  if (normalized.includes("audio/mp4") || normalized.includes("audio/m4a") || normalized.includes("video/mp4")) return "audio/mp4";
  if (normalized.includes("audio/mpeg") || normalized.includes("audio/mp3")) return "audio/mpeg";
  return "audio/ogg";
}

function outgoingMediaLabel(mediaType) {
  return { image: "Imagen", video: "Video", audio: "Audio", sticker: "Sticker" }[mediaType] || "Archivo";
}

function transcodeVoiceNoteToOggOpus(inputBuffer, context = {}) {
  if (!ffmpegPath) {
    throw new ApiError(503, "audio_transcode_unavailable", "No pudimos preparar esta nota de voz.");
  }
  return new Promise((resolve, reject) => {
    const args = [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-vn",
      "-ac", "1",
      "-ar", "48000",
      "-c:a", "libopus",
      "-b:a", "32k",
      "-application", "voip",
      "-f", "ogg",
      "pipe:1"
    ];
    const child = spawn(ffmpegPath, args, { stdio: ["pipe", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      child.kill("SIGKILL");
      settled = true;
      logger.warn("whatsapp-media", "Voice note transcode timed out", { context }).catch(() => {});
      reject(new ApiError(422, "audio_transcode_failed", "No pudimos preparar esta nota de voz."));
    }, 20000);

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      logger.warn("whatsapp-media", "Voice note transcode could not start", {
        context: { ...context, error: error.message }
      }).catch(() => {});
      reject(new ApiError(503, "audio_transcode_unavailable", "No pudimos preparar esta nota de voz."));
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const output = Buffer.concat(stdout);
      if (code === 0 && output.length) {
        resolve(output);
        return;
      }
      logger.warn("whatsapp-media", "Voice note transcode failed", {
        context: {
          ...context,
          code,
          stderr: Buffer.concat(stderr).toString("utf8").slice(0, 500)
        }
      }).catch(() => {});
      reject(new ApiError(422, "audio_transcode_failed", "No pudimos preparar esta nota de voz."));
    });
    child.stdin.on("error", () => {});
    child.stdin.end(inputBuffer);
  });
}

async function streamMessageMedia(userId, chatId, messageId) {
  const descriptor = await chatService.getMessageMediaDescriptor(userId, chatId, messageId);
  const mediaType = normalizeOutgoingMediaType(descriptor.mediaType, descriptor.mimeType);
  if (descriptor.metadata?.viewOnce) throw new ApiError(404, "media_not_found", "Media no disponible");
  if (!descriptor.mediaKey || (!descriptor.directPath && !descriptor.url)) {
    throw new ApiError(404, "media_descriptor_missing", "Media temporal no disponible");
  }
  const session = await ensureRuntimeOpenForSend(userId, config.whatsapp.sendReadyTimeoutMs).catch((error) => {
    logger.warn("whatsapp-media", "Media stream socket unavailable", {
      context: { userId, chatId, messageId, mediaType, error: error.message }
    }).catch(() => {});
    throw new ApiError(503, "media_socket_unavailable", "Conecta tu WhatsApp para cargar este archivo.");
  });
  const socketRuntime = await loadSocketRuntime();
  if (typeof socketRuntime.downloadContentFromMessage !== "function") {
    throw new ApiError(503, "media_stream_unavailable", "Media temporal no disponible");
  }
  let stream;
  try {
    stream = await socketRuntime.downloadContentFromMessage(
      {
        mediaKey: base64ToBuffer(descriptor.mediaKey),
        directPath: descriptor.directPath || undefined,
        url: descriptor.url || undefined,
        mimetype: descriptor.mimeType || undefined,
        fileLength: descriptor.sizeBytes || undefined,
        fileSha256: base64ToBuffer(descriptor.metadata?.fileSha256),
        fileEncSha256: base64ToBuffer(descriptor.metadata?.fileEncSha256),
        mediaKeyTimestamp: descriptor.metadata?.mediaKeyTimestamp || undefined
      },
      mediaType,
      {}
    );
  } catch (error) {
    logger.warn("whatsapp-media", "Media download failed", {
      context: { userId, chatId, messageId, mediaType, error: error.message }
    }).catch(() => {});
    throw new ApiError(502, "media_download_failed", "No pudimos cargar este archivo temporal.");
  }
  return {
    stream,
    mediaType,
    mimeType: descriptor.mimeType || "application/octet-stream",
    fileName: descriptor.fileName || `${messageId}`,
    sizeBytes: descriptor.sizeBytes || null,
    socketOpen: isSocketOpen(session.sock)
  };
}

async function sendMediaMessage(userId, chatId, media = {}, options = {}) {
  const mimeType = String(media.mimeType || "application/octet-stream").trim();
  const mediaType = normalizeOutgoingMediaType(media.mediaType, mimeType);
  const ptt = mediaType === "audio" && options.ptt === true;
  const buffer = Buffer.isBuffer(media.data)
    ? media.data
    : Buffer.from(String(media.dataBase64 || ""), "base64");
  const maxBytes = 12 * 1024 * 1024;
  if (!buffer.length) throw new ApiError(400, "empty_media", "Adjunta un archivo para enviar.");
  if (buffer.length > maxBytes) throw new ApiError(413, "media_too_large", "El archivo es demasiado pesado para esta versión.");
    const caption = mediaType === "image" || mediaType === "video" ? String(options.caption || "").trim().slice(0, 1000) : "";
  const shouldTryVoiceNote = ptt;
  let pttEnabled = false;
  let uploadBuffer = buffer;
  let uploadMimeType = mimeType;
  const canonicalChatId = await chatService.resolveCanonicalChatId(userId, chatId, { phone: jidToPhone(chatId) }).catch(() => chatId);
  const jid = canonicalChatId.includes("@") ? canonicalChatId : `${canonicalChatId.replace(/\D/g, "")}@s.whatsapp.net`;
  let localMessageId = options.localMessageId || null;
  try {
    if (shouldTryVoiceNote) {
      const isCompatible = isLikelyVoiceNoteCompatibleMime(mimeType);
      if (isCompatible) {
        pttEnabled = true;
        uploadMimeType = normalizePttMimeType(mimeType);
      } else {
        try {
          uploadBuffer = await transcodeVoiceNoteToOggOpus(buffer, { userId, chatId: jid, localMessageId, inputMimeType: mimeType });
          uploadMimeType = "audio/ogg; codecs=opus";
          pttEnabled = true;
        } catch (error) {
          pttEnabled = false;
          uploadMimeType = normalizeAudioFallbackMimeType(mimeType);
          logger.warn("whatsapp-media", "Voice note transcode failed, fallback to normal audio upload", {
            context: {
              userId,
              chatId: jid,
              localMessageId,
              mediaType,
              inputMimeType: mimeType,
              errorCode: error?.code || error?.name || null,
              error: error?.message || "audio_transcode_failed"
            }
          }).catch(() => {});
        }
      }
    } else if (mediaType === "audio") {
      uploadMimeType = normalizeAudioFallbackMimeType(mimeType);
    }
    const body = (pttEnabled && mediaType === "audio") ? "Nota de voz" : (caption || outgoingMediaLabel(mediaType));
    const metadata = {
      source: "sendMediaMessage_direct",
      hasMedia: false,
      mediaPending: true,
      mediaType,
      mimeType,
      fileName: media.fileName || null,
      ptt: pttEnabled,
      sizeBytes: buffer.length,
      ...(options.quotedMessage ? { quotedMessage: options.quotedMessage } : {})
    };
    if (!localMessageId) {
      const pending = await chatService.createOutgoingMessage(userId, jid, body, {
        messageType: mediaType,
        metadata
      });
      localMessageId = pending.id;
    }
    await chatService.cacheMessageMedia({
      userId,
      chatId: jid,
      messageId: localMessageId,
      mediaType,
      mimeType: uploadMimeType,
      fileName: media.fileName || null,
      data: uploadBuffer,
      sentAt: new Date(),
      metadata: {
        source: "outgoing_media_upload_cache",
        ptt: pttEnabled,
        mediaHotCacheStatus: "cached",
        originalMimeType: mimeType
      }
    }).catch((cacheError) => logger.warn("whatsapp-media", "Could not cache outgoing media preview", {
      context: {
        userId,
        chatId: jid,
        localMessageId,
        mediaType,
        ptt,
        pttEnabled,
        errorCode: cacheError?.code || cacheError?.name || null,
        error: cacheError?.message || "outgoing media cache failed"
      }
    }));
    const session = await ensureRuntimeOpenForSend(userId, config.whatsapp.sendReadyTimeoutMs);
    const quoted = buildQuotedMessageForSend(jid, options.quotedMessage);
    const content = mediaType === "image"
      ? { image: uploadBuffer, caption, mimetype: uploadMimeType }
      : mediaType === "video"
        ? { video: uploadBuffer, caption, mimetype: uploadMimeType }
        : mediaType === "sticker"
          ? { sticker: uploadBuffer }
          : pttEnabled
            ? { audio: uploadBuffer, mimetype: uploadMimeType, ptt: true }
            : { audio: uploadBuffer, mimetype: uploadMimeType };
    const sent = await session.sock.sendMessage(jid, content, quoted ? { quoted } : undefined);
    rememberSentMessageEcho(sent?.key?.id || sent?.id, jid, localMessageId);
    const updated = await chatService.markOutgoingMessageSent(userId, sent?.key?.remoteJid || jid, localMessageId, sent);
    if (!updated) await chatService.markOutgoingMessageSent(userId, jid, localMessageId, sent);
    return sent;
  } catch (error) {
    logger.warn("whatsapp-media", "Could not send media message", {
      context: {
        userId,
        chatId: jid,
        localMessageId,
        mediaType,
        ptt,
        pttEnabled,
        errorCode: error?.code || error?.name || null,
        error: error?.message || "send media failed"
      }
    }).catch(() => {});
    await chatService.markOutgoingMessageFailed(userId, jid, localMessageId, error).catch(() => {});
    throw error;
  }
}

async function sendMessage(userId, chatId, message, options = {}) {
  const text = String(message || "").trim();
  if (!text) throw new ApiError(400, "empty_message", "Mensaje vacio");
  const canonicalChatId = await chatService.resolveCanonicalChatId(userId, chatId, { phone: jidToPhone(chatId) }).catch(() => chatId);
  const jid = canonicalChatId.includes("@") ? canonicalChatId : `${canonicalChatId.replace(/\D/g, "")}@s.whatsapp.net`;
  if (jid !== chatId && String(chatId || "").includes("@")) {
    await chatService.registerChatAlias(userId, jid, chatId, {
      phone: jidToPhone(chatId) || jidToPhone(jid),
      source: "send_message_input_alias"
    }).catch(() => {});
  }
  let localMessageId = options.localMessageId || null;
  if (!localMessageId) {
    const pending = await chatService.createOutgoingMessage(userId, jid, text, {
      metadata: { source: "sendMessage_direct", ...(options.quotedMessage ? { quotedMessage: options.quotedMessage } : {}) }
    });
    localMessageId = pending.id;
  }
  try {
    const session = await ensureRuntimeOpenForSend(userId, config.whatsapp.sendReadyTimeoutMs);
    const quoted = buildQuotedMessageForSend(jid, options.quotedMessage);
    const sent = await session.sock.sendMessage(jid, { text }, quoted ? { quoted } : undefined);
    const sentChatId = sent?.key?.remoteJid || jid;
    if (sentChatId !== jid) {
      await chatService.registerChatAlias(userId, jid, sentChatId, {
        phone: jidToPhone(sentChatId) || jidToPhone(jid),
        source: "send_message_provider_alias",
        metadata: { providerMessageId: sent?.key?.id || sent?.id || null }
      }).catch(() => {});
    }
    rememberSentMessageEcho(sent?.key?.id || sent?.id, jid, localMessageId);
    const updated = await chatService.markOutgoingMessageSent(userId, sentChatId, localMessageId, sent);
    if (!updated && sentChatId !== jid) await chatService.markOutgoingMessageSent(userId, jid, localMessageId, sent);
    return sent;
  } catch (error) {
    await chatService.markOutgoingMessageFailed(userId, jid, localMessageId, error).catch(() => {});
    throw error;
  }
}

async function editMessage(userId, chatId, messageId, text, options = {}) {
  const prepared = await chatService.prepareMessageEdit(userId, chatId, messageId, text);
  const session = await ensureRuntimeOpenForSend(userId, config.whatsapp.sendReadyTimeoutMs);
  try {
    const sent = await session.sock.sendMessage(prepared.key.remoteJid, {
      text: prepared.text,
      edit: prepared.key,
    });
    const message = await chatService.markMessageEdited(userId, prepared.chatId, prepared.messageId, prepared.text, {
      source: "editMessage_direct",
      taskId: options.taskId || null,
      providerEditMessageId: sent?.key?.id || sent?.id || null,
    });
    return { edited: true, message, sent };
  } catch (error) {
    throw new ApiError(409, "message_edit_rejected", error?.message || "WhatsApp no permitió editar este mensaje");
  }
}

async function deleteMessage(userId, chatId, messageId, scope = "me", options = {}) {
  const prepared = await chatService.prepareMessageDelete(userId, chatId, messageId, scope);
  const session = await ensureRuntimeOpenForSend(userId, config.whatsapp.sendReadyTimeoutMs);
  try {
    let sent = null;
    if (prepared.scope === "everyone") {
      sent = await session.sock.sendMessage(prepared.key.remoteJid, { delete: prepared.key });
    } else {
      if (!session.sock.chatModify) {
        throw new ApiError(503, "delete_for_me_unavailable", "La sesion de WhatsApp no permite eliminar para mi ahora");
      }
      sent = await session.sock.chatModify({
        deleteForMe: {
          key: prepared.key,
          timestamp: prepared.timestamp,
          deleteMedia: true,
        },
      }, prepared.key.remoteJid);
    }

    const message = await chatService.markMessageDeleted(userId, prepared.chatId, prepared.messageId, prepared.scope, {
      source: "deleteMessage_direct",
      taskId: options.taskId || null,
    });
    return { deleted: true, scope: prepared.scope, message, sent };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(409, "message_delete_rejected", error?.message || "WhatsApp no permitió eliminar este mensaje");
  }
}

module.exports = {
  startWhatsApp,
  requestPairingCode,
  requestQr,
  getStatus,
  reconnect,
  disconnect,
  markChatRead,
  sendPresence,
  sendMessage,
  editMessage,
  deleteMessage,
  sendMediaMessage,
  streamMessageMedia,
  queueReconnection,
  sessionIdForUser,
  normalizeCustomPairingCode,
  getRuntimeDiagnostics,
};
