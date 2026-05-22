const { config } = require("../config/env");
const { pool } = require("../config/db");
const { logger } = require("./loggerService");
const whatsappService = require("./whatsappService");
const taskService = require("./whatsappTaskService");

let timer = null;
let running = false;
let restoreStarted = false;

async function executeTask(task) {
  const payload = task.payload || {};
  switch (task.task_type) {
    case "start":
      return whatsappService.startWhatsApp(task.user_id, {
        force: payload.force === true,
        waitForOpen: payload.waitForOpen === true,
        waitForOpenTimeoutMs: payload.waitForOpenTimeoutMs
      });
    case "pairing_code":
      return whatsappService.requestPairingCode(task.user_id, payload.phone, {
        customPairingCode: payload.customPairingCode,
        forceNew: payload.forceNew === true
      });
    case "qr":
      return whatsappService.requestQr(task.user_id, {
        forceNew: payload.forceNew === true
      });
    case "reconnect":
      return whatsappService.reconnect(task.user_id);
    case "disconnect":
      return whatsappService.disconnect(task.user_id, payload.purge === true);
    case "send_message":
      return whatsappService.sendMessage(task.user_id, payload.chatId, payload.message, {
        localMessageId: payload.localMessageId,
        quotedMessage: payload.quotedMessage,
        taskId: task.id
      });
    case "send_media":
      return whatsappService.sendMediaMessage(task.user_id, payload.chatId, {
        mediaType: payload.mediaType,
        mimeType: payload.mimeType,
        fileName: payload.fileName,
        dataBase64: payload.dataBase64
      }, {
        localMessageId: payload.localMessageId,
        caption: payload.caption,
        ptt: payload.ptt === true,
        quotedMessage: payload.quotedMessage,
        taskId: task.id
      });
    case "edit_message":
      return whatsappService.editMessage(task.user_id, payload.chatId, payload.messageId, payload.text, {
        taskId: task.id
      });
    case "delete_message":
      return whatsappService.deleteMessage(task.user_id, payload.chatId, payload.messageId, payload.scope, {
        taskId: task.id
      });
    case "mark_read":
      return whatsappService.markChatRead(task.user_id, payload.chatId, {
        taskId: task.id
      });
    case "presence":
      return whatsappService.sendPresence(task.user_id, payload.chatId, payload.presence, {
        taskId: task.id
      });
    default:
      throw new Error(`Unsupported WhatsApp runtime task: ${task.task_type}`);
  }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const task = await taskService.claimNextTask(config.whatsapp.workerId);
      if (!task) break;
      try {
        const result = await executeTask(task);
        await taskService.completeTask(task.id, result);
      } catch (error) {
        await taskService.failTask(task, error);
        logger.warn("whatsapp-worker", error.message, { context: { taskId: task.id, taskType: task.task_type, userId: task.user_id } });
      }
    }
  } finally {
    running = false;
  }
}

function startWhatsAppWorker() {
  if (timer) return;
  restoreConnectedSessions().catch((error) => logger.warn("whatsapp-worker", error.message, { context: { source: "restore_connected_sessions" } }));
  timer = setInterval(() => tick().catch((error) => logger.error("whatsapp-worker", error.message)), config.whatsapp.taskPollIntervalMs);
  tick().catch((error) => logger.error("whatsapp-worker", error.message));
}

function stopWhatsAppWorker() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

async function restoreConnectedSessions() {
  if (restoreStarted || !config.whatsapp.restoreConnectedSessions) return { queued: 0 };
  restoreStarted = true;
  const result = await pool.query(
    `SELECT user_id
     FROM whatsapp_connections
     WHERE status = 'connected'
     ORDER BY updated_at ASC`
  );
  let queued = 0;
  for (const row of result.rows) {
    await taskService.enqueueWhatsappTask(row.user_id, "start", {
      force: true,
      source: "startup_restore",
      waitForOpen: true
    }, { priority: 20 });
    queued += 1;
  }
  if (queued > 0) {
    logger.info("whatsapp-worker", "Queued connected WhatsApp sessions for startup restore", {
      context: { queued }
    });
  }
  return { queued };
}

module.exports = { startWhatsAppWorker, stopWhatsAppWorker, executeTask, restoreConnectedSessions };
