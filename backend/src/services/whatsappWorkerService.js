const { config } = require("../config/env");
const { pool } = require("../config/db");
const { logger } = require("./loggerService");
const whatsappService = require("./whatsappService");
const taskService = require("./whatsappTaskService");

let timer = null;
let restoreTimer = null;
let running = false;
let restoreRunning = false;

async function executeTask(task) {
  const payload = task.payload || {};
  switch (task.task_type) {
    case "start": {
      logger.info("whatsapp-worker", "Starting WhatsApp session task", {
        context: { taskId: task.id, userId: task.user_id, source: payload.source || null }
      });
      const result = await whatsappService.startWhatsApp(task.user_id, {
        force: payload.force === true,
        waitForOpen: payload.waitForOpen === true,
        waitForOpenTimeoutMs: payload.waitForOpenTimeoutMs
      });
      logger.info("whatsapp-worker", "WhatsApp session task finished", {
        context: { taskId: task.id, userId: task.user_id, source: payload.source || null, status: result?.status || null }
      });
      return result;
    }
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
  restoreConnectedSessions({ source: "startup_restore" }).catch((error) => logger.warn("whatsapp-worker", error.message, { context: { source: "restore_connected_sessions" } }));
  if (config.whatsapp.restoreConnectedSessions) {
    restoreTimer = setInterval(() => {
      restoreConnectedSessions({ source: "watchdog_restore" }).catch((error) => logger.warn("whatsapp-worker", error.message, { context: { source: "restore_connected_sessions_watchdog" } }));
    }, config.whatsapp.restoreConnectedSessionsIntervalMs);
  }
  timer = setInterval(() => tick().catch((error) => logger.error("whatsapp-worker", error.message)), config.whatsapp.taskPollIntervalMs);
  tick().catch((error) => logger.error("whatsapp-worker", error.message));
}

function stopWhatsAppWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (restoreTimer) {
    clearInterval(restoreTimer);
    restoreTimer = null;
  }
}

async function restoreConnectedSessions(options = {}) {
  if (restoreRunning || !config.whatsapp.restoreConnectedSessions) return { queued: 0, skipped: true };
  restoreRunning = true;
  const source = options.source || "restore_connected_sessions";
  try {
    const result = await pool.query(
      `SELECT user_id, status, pause_reason
       FROM whatsapp_connections
       WHERE status = 'connected'
          OR (status = 'connecting' AND updated_at < NOW() - INTERVAL '2 minutes')
          OR (status = 'reconnect_paused' AND pause_reason = 'max_attempts')
       ORDER BY updated_at ASC`
    );
    let queued = 0;
    let alreadyOpen = 0;
    const statusCounts = {};
    for (const row of result.rows) {
      statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
      if (whatsappService.hasOpenRuntimeSession(row.user_id)) {
        alreadyOpen += 1;
        continue;
      }
      await taskService.enqueueWhatsappTask(row.user_id, "start", {
        force: true,
        source,
        restoreStatus: row.status,
        restorePauseReason: row.pause_reason || null,
        waitForOpen: true
      }, { priority: 20, maxAttempts: Math.max(6, config.whatsapp.reconnectMaxAttempts) });
      queued += 1;
    }
    if (queued > 0 || alreadyOpen > 0) {
      logger.info("whatsapp-worker", "Checked connected WhatsApp sessions for runtime restore", {
        context: { source, queued, alreadyOpen, total: result.rows.length, statusCounts }
      });
    }
    return { queued, alreadyOpen, total: result.rows.length };
  } finally {
    restoreRunning = false;
  }
}

module.exports = { startWhatsAppWorker, stopWhatsAppWorker, executeTask, restoreConnectedSessions };
