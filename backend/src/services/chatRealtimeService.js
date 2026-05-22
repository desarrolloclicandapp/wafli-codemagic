const { pool } = require("../config/db");

const subscribersByUser = new Map();
const CHANNEL = "wafli_chat_realtime";
const ORIGIN = `${process.pid}:${Date.now()}`;
let listenClient = null;
let listenStarted = false;
let listenRetryTimer = null;

function safeJson(data) {
  try {
    return JSON.stringify(data || {});
  } catch (_) {
    return "{}";
  }
}

function writeEvent(res, event, data = {}) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${safeJson(data)}\n\n`);
}

function emitLocal(userId, event, data = {}) {
  const subscribers = subscribersByUser.get(String(userId));
  if (!subscribers || subscribers.size === 0) return;
  for (const res of subscribers) {
    try {
      writeEvent(res, event, { ...data, at: data.at || new Date().toISOString() });
    } catch (_) {
      subscribers.delete(res);
    }
  }
}

function compactPayload(payload = {}) {
  const serialized = safeJson(payload);
  if (Buffer.byteLength(serialized, "utf8") <= 7600) return serialized;
  return safeJson({
    ...payload,
    data: {
      ...(payload.data || {}),
      chat: undefined,
      message: undefined,
      truncated: true
    }
  });
}

function publishCrossProcess(userId, event, data = {}) {
  const payload = {
    origin: ORIGIN,
    userId: String(userId),
    event,
    data: { ...data, at: data.at || new Date().toISOString() }
  };
  pool.query("SELECT pg_notify($1, $2)", [CHANNEL, compactPayload(payload)]).catch(() => {});
}

function scheduleListenRetry() {
  if (listenRetryTimer) return;
  listenRetryTimer = setTimeout(() => {
    listenRetryTimer = null;
    listenStarted = false;
    listenClient = null;
    ensurePostgresListener();
  }, 2500);
}

async function ensurePostgresListener() {
  if (listenStarted || listenClient) return;
  listenStarted = true;
  try {
    const client = await pool.connect();
    listenClient = client;
    client.on("notification", (message) => {
      if (message.channel !== CHANNEL || !message.payload) return;
      let payload = null;
      try {
        payload = JSON.parse(message.payload);
      } catch (_) {
        return;
      }
      if (!payload || payload.origin === ORIGIN) return;
      emitLocal(payload.userId, payload.event || "message", payload.data || {});
    });
    client.on("error", () => {
      try {
        client.release();
      } catch (_) {}
      if (listenClient === client) listenClient = null;
      listenStarted = false;
      scheduleListenRetry();
    });
    await client.query(`LISTEN ${CHANNEL}`);
  } catch (_) {
    if (listenClient) {
      try {
        listenClient.release();
      } catch (__) {}
    }
    listenClient = null;
    listenStarted = false;
    scheduleListenRetry();
  }
}

function subscribe(userId, res) {
  ensurePostgresListener();
  const key = String(userId);
  const subscribers = subscribersByUser.get(key) || new Set();
  subscribers.add(res);
  subscribersByUser.set(key, subscribers);
  writeEvent(res, "connected", { at: new Date().toISOString() });
  return () => {
    subscribers.delete(res);
    if (subscribers.size === 0) subscribersByUser.delete(key);
  };
}

function emit(userId, event, data = {}) {
  const enriched = { ...data, at: data.at || new Date().toISOString() };
  emitLocal(userId, event, enriched);
  publishCrossProcess(userId, event, enriched);
}

function emitChatUpdated(userId, chatId, data = {}) {
  emit(userId, "chat.updated", { chatId, ...data });
}

function emitMessageCreated(userId, chatId, messageId, data = {}) {
  emit(userId, "message.created", { chatId, messageId, ...data });
}

function emitMessageUpdated(userId, chatId, messageId, data = {}) {
  emit(userId, "message.updated", { chatId, messageId, ...data });
}

function emitMessageDeleted(userId, chatId, messageId, data = {}) {
  emit(userId, "message.deleted", { chatId, messageId, ...data });
}

module.exports = {
  subscribe,
  emit,
  emitChatUpdated,
  emitMessageCreated,
  emitMessageUpdated,
  emitMessageDeleted,
};
