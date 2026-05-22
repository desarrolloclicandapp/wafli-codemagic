import { API_BASE_URL, getAccessToken, getRefreshToken, refreshSession, clearSession, request } from "./client.js";

const list = (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") params.set(key, String(value));
  });
  const qs = params.toString();
  return request(`/chats${qs ? `?${qs}` : ""}`);
};

const get = (chatId) => request(`/chats/${encodeURIComponent(chatId)}`);
const contacts = (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const qs = params.toString();
  return request(`/chats/contacts${qs ? `?${qs}` : ""}`);
};
const createContact = (payload) => request("/chats/contacts", { method: "POST", body: payload });
const messages = (chatId) => request(`/chats/${encodeURIComponent(chatId)}/messages`);
const media = async (chatId, messageId) => {
  const token = getAccessToken();
  const response = await fetch(
    `${API_BASE_URL}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/media`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" }
  );
  if (!response.ok) {
    const payload = await response.clone().json().catch(() => ({}));
    const error = new Error(payload.message || "Media no disponible");
    error.status = response.status;
    error.code = payload.error || payload.code || "media_unavailable";
    throw error;
  }
  return response.blob();
};
const markRead = (chatId) => request(`/chats/${encodeURIComponent(chatId)}/read`, { method: "POST" });
const presence = (chatId, presenceType) => request(`/chats/${encodeURIComponent(chatId)}/presence`, {
  method: "POST",
  body: { presence: presenceType }
});
const start = (chatId) => request(`/chats/${encodeURIComponent(chatId)}/start`, { method: "POST" });
const send = (chatId, message, options = {}) => request(`/chats/${encodeURIComponent(chatId)}/send`, { method: "POST", body: { message, ...options } });
const editMessage = (chatId, messageId, text) => request(`/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`, {
  method: "PATCH",
  body: { text }
});
const deleteMessage = (chatId, messageId, scope = "me") => request(`/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/delete`, {
  method: "POST",
  body: { scope }
});
const sendMedia = async (chatId, file, options = {}) => {
  const token = getAccessToken();
  const params = new URLSearchParams();
  if (options.mediaType) params.set("type", options.mediaType);
  if (options.caption) params.set("caption", options.caption);
  if (options.ptt) params.set("ptt", "1");
  if (file?.name) params.set("fileName", file.name);
  if (options.quotedMessage) params.set("quotedMessage", JSON.stringify(options.quotedMessage));
  const response = await fetch(
    `${API_BASE_URL}/chats/${encodeURIComponent(chatId)}/send-media${params.toString() ? `?${params.toString()}` : ""}`,
    {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": file?.type || "application/octet-stream"
      },
      body: file
    }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || "No pudimos enviar el archivo.");
    error.status = response.status;
    error.code = payload.error;
    throw error;
  }
  return payload;
};
const updateMeta = (chatId, patch) => request(`/chats/${encodeURIComponent(chatId)}/meta`, { method: "PATCH", body: patch });
const updateContact = (chatId, patch) => request(`/chats/${encodeURIComponent(chatId)}/contact`, { method: "PATCH", body: patch });

const realtimeSubscribers = new Set();
let realtimeController = null;
let realtimeReconnectTimer = null;
let realtimeAttempts = 0;
let realtimeConnecting = false;

function notifyRealtimeSubscribers(payload) {
  realtimeSubscribers.forEach((subscriber) => {
    try {
      subscriber.onEvent && subscriber.onEvent(payload);
    } catch (_) {}
  });
}

function notifyRealtimeError(error) {
  realtimeSubscribers.forEach((subscriber) => {
    try {
      subscriber.onError && subscriber.onError(error);
    } catch (_) {}
  });
}

function scheduleRealtimeReconnect() {
  if (!realtimeSubscribers.size) return;
  if (realtimeReconnectTimer) clearTimeout(realtimeReconnectTimer);
  realtimeAttempts += 1;
  const delay = Math.min(10000, 600 * realtimeAttempts);
  realtimeReconnectTimer = setTimeout(() => {
    realtimeReconnectTimer = null;
    openRealtimeStream();
  }, delay);
}

function closeRealtimeStream() {
  if (realtimeReconnectTimer) {
    clearTimeout(realtimeReconnectTimer);
    realtimeReconnectTimer = null;
  }
  if (realtimeController) {
    realtimeController.abort();
    realtimeController = null;
  }
  realtimeConnecting = false;
}

function parseRealtimeChunk(chunk) {
  const lines = chunk.split("\n");
  const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() || "message";
  const dataText = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
  if (!dataText) return null;
  let data = {};
  try {
    data = JSON.parse(dataText);
  } catch (_) {}
  return { event, data };
}

function openRealtimeStream() {
  if (!realtimeSubscribers.size || realtimeConnecting || realtimeController) return;
  if (typeof fetch !== "function" || typeof TextDecoder === "undefined") return;
  const token = getAccessToken();
  if (!token) {
    if (getRefreshToken()) {
      realtimeConnecting = true;
      refreshSession()
        .then(() => {
          realtimeConnecting = false;
          openRealtimeStream();
        })
        .catch((error) => {
          realtimeConnecting = false;
          notifyRealtimeError(error);
          scheduleRealtimeReconnect();
        });
      return;
    }
    scheduleRealtimeReconnect();
    return;
  }
  realtimeConnecting = true;
  realtimeController = new AbortController();
  const controller = realtimeController;

  fetch(`${API_BASE_URL}/chats/events`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
    cache: "no-store",
    signal: controller.signal
  }).then(async (response) => {
    if (response.status === 401 && getRefreshToken()) {
      await refreshSession();
      if (controller.signal.aborted) return;
      if (realtimeController === controller) realtimeController = null;
      realtimeConnecting = false;
      openRealtimeStream();
      return;
    }
    if (response.status === 401) {
      clearSession();
      throw new Error("Realtime no autorizado");
    }
    if (!response.ok || !response.body) throw new Error("Realtime no disponible");
    realtimeAttempts = 0;
    realtimeConnecting = false;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (!controller.signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";
      chunks.map(parseRealtimeChunk).filter(Boolean).forEach(notifyRealtimeSubscribers);
    }
    throw new Error("Realtime desconectado");
  }).catch((error) => {
    if (controller.signal.aborted) return;
    if (realtimeController === controller) realtimeController = null;
    realtimeConnecting = false;
    notifyRealtimeError(error);
    scheduleRealtimeReconnect();
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    closeRealtimeStream();
    openRealtimeStream();
  });
  window.addEventListener("wafli:session-updated", () => {
    closeRealtimeStream();
    openRealtimeStream();
  });
  window.addEventListener("wafli:session-cleared", closeRealtimeStream);
}

function subscribeEvents(onEvent, onError) {
  const subscriber = { onEvent, onError };
  realtimeSubscribers.add(subscriber);
  openRealtimeStream();
  return () => {
    realtimeSubscribers.delete(subscriber);
    if (!realtimeSubscribers.size) closeRealtimeStream();
  };
}

export {
  list,
  get,
  contacts,
  createContact,
  messages,
  media,
  markRead,
  presence,
  start,
  send,
  editMessage,
  deleteMessage,
  sendMedia,
  updateMeta,
  updateContact,
  subscribeEvents,
};
