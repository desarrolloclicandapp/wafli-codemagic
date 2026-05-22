const { pool } = require("../config/db");
const { config } = require("../config/env");

const DEDUPED_TASKS = new Set(["start", "pairing_code", "qr", "reconnect", "disconnect"]);

function sessionIdForUser(userId) {
  return `user_${userId}`;
}

function sanitizeTaskResult(row) {
  const result = row?.result && typeof row.result === "object" ? { ...row.result } : row?.result;
  if (
    (row?.task_type === "pairing_code" || row?.task_type === "qr") &&
    result?.pairingCode &&
    result?.pairingCodeExpiresAt &&
    new Date(result.pairingCodeExpiresAt).getTime() <= Date.now()
  ) {
    return { ...result, pairingCode: null, expired: true };
  }
  return result;
}

function publicTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    type: row.task_type,
    status: row.status,
    attempts: row.attempts,
    availableAt: row.available_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    result: sanitizeTaskResult(row)
  };
}

async function enqueueWhatsappTask(userId, taskType, payload = {}, options = {}) {
  const sessionId = sessionIdForUser(userId);
  const type = String(taskType || "").trim();
  if (!type) throw new Error("taskType is required");

  if (options.cancelExisting === true) {
    await pool.query(
      `UPDATE whatsapp_runtime_tasks
       SET status = 'canceled',
           error_code = 'superseded',
           error_message = 'Canceled by a newer task',
           updated_at = NOW(),
           completed_at = NOW()
       WHERE user_id = $1
         AND task_type = $2
         AND status IN ('pending', 'running')`,
      [userId, type]
    );
  }

  if (type === "mark_read" && options.dedupe !== false && payload?.chatId) {
    const existing = await pool.query(
      `SELECT * FROM whatsapp_runtime_tasks
       WHERE user_id = $1
         AND task_type = $2
         AND payload->>'chatId' = $3
         AND (
           status = 'pending'
           OR (status = 'running' AND locked_at >= NOW() - INTERVAL '2 minutes')
         )
       ORDER BY created_at DESC LIMIT 1`,
      [userId, type, String(payload.chatId)]
    );
    if (existing.rows[0]) return publicTask(existing.rows[0]);
  }

  if (type === "presence" && options.dedupe !== false && payload?.chatId) {
    const existing = await pool.query(
      `SELECT * FROM whatsapp_runtime_tasks
       WHERE user_id = $1
         AND task_type = $2
         AND payload->>'chatId' = $3
         AND payload->>'presence' = $4
         AND (
           status = 'pending'
           OR (status = 'running' AND locked_at >= NOW() - INTERVAL '20 seconds')
         )
       ORDER BY created_at DESC LIMIT 1`,
      [userId, type, String(payload.chatId), String(payload.presence || "paused")]
    );
    if (existing.rows[0]) return publicTask(existing.rows[0]);
  }

  if (DEDUPED_TASKS.has(type) && options.dedupe !== false) {
    const existing = await pool.query(
      `SELECT * FROM whatsapp_runtime_tasks
       WHERE user_id = $1
         AND task_type = $2
         AND (
           status = 'pending'
           OR (status = 'running' AND locked_at >= NOW() - INTERVAL '2 minutes')
         )
       ORDER BY created_at DESC LIMIT 1`,
      [userId, type]
    );
    if (existing.rows[0]) return publicTask(existing.rows[0]);
  }

  const result = await pool.query(
    `INSERT INTO whatsapp_runtime_tasks (user_id, session_id, task_type, payload, priority, max_attempts)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6)
     RETURNING *`,
    [userId, sessionId, type, JSON.stringify(payload || {}), Number(options.priority || 0), Number(options.maxAttempts || 3)]
  );
  return publicTask(result.rows[0]);
}

async function claimNextTask(workerId = config.whatsapp.workerId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const taskRes = await client.query(
      `SELECT t.* FROM whatsapp_runtime_tasks t
       WHERE (
           (t.status = 'pending' AND t.available_at <= NOW())
           OR (t.status = 'running' AND t.locked_at < NOW() - INTERVAL '2 minutes')
         )
         AND NOT EXISTS (
           SELECT 1 FROM whatsapp_runtime_tasks r
           WHERE r.session_id = t.session_id
             AND r.status = 'running'
             AND r.locked_at >= NOW() - INTERVAL '2 minutes'
             AND r.id <> t.id
         )
       ORDER BY t.priority DESC, t.created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`
    );
    const task = taskRes.rows[0];
    if (!task) {
      await client.query("COMMIT");
      return null;
    }
    const updated = await client.query(
      `UPDATE whatsapp_runtime_tasks
       SET status = 'running', attempts = attempts + 1, locked_at = NOW(), locked_by = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [task.id, workerId]
    );
    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function completeTask(taskId, result = {}) {
  await pool.query(
    `UPDATE whatsapp_runtime_tasks
     SET status = 'succeeded',
         result = $2::jsonb,
         payload = CASE
           WHEN task_type = 'send_media' THEN jsonb_build_object('redacted', true, 'chatId', payload->>'chatId', 'mediaType', payload->>'mediaType')
           ELSE payload
         END,
         updated_at = NOW(),
         completed_at = NOW(),
         error_code = NULL,
         error_message = NULL
     WHERE id = $1::bigint`,
    [taskId, JSON.stringify(result || {})]
  );
}

async function failTask(task, error) {
  const retry = Number(task.attempts || 0) < Number(task.max_attempts || 1);
  await pool.query(
    `UPDATE whatsapp_runtime_tasks
     SET status = $2::varchar,
         payload = CASE
           WHEN task_type = 'send_media' AND $2::text = 'failed' THEN jsonb_build_object('redacted', true, 'chatId', payload->>'chatId', 'mediaType', payload->>'mediaType')
           ELSE payload
         END,
         available_at = CASE
           WHEN $2::text = 'pending' THEN NOW() + ($3::int * INTERVAL '1 second')
           ELSE available_at
         END,
         error_code = $4::text,
         error_message = $5::text,
         updated_at = NOW(),
         completed_at = CASE WHEN $2::text = 'failed' THEN NOW() ELSE completed_at END
     WHERE id = $1::bigint`,
    [
      task.id,
      retry ? "pending" : "failed",
      Math.min(60, 2 ** Number(task.attempts || 1)),
      error?.code || error?.name || "task_failed",
      String(error?.message || "Task failed").slice(0, 1000)
    ]
  );
}

async function getRecentTasks(userId, limit = 10) {
  const result = await pool.query(
    `SELECT * FROM whatsapp_runtime_tasks WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, Number(limit || 10)]
  );
  return result.rows.map(publicTask);
}

async function countTasksByStatus() {
  const result = await pool.query(
    `SELECT status, COUNT(*)::int AS count FROM whatsapp_runtime_tasks GROUP BY status ORDER BY status ASC`
  );
  return result.rows.reduce((acc, row) => {
    acc[row.status] = row.count;
    return acc;
  }, {});
}

module.exports = { enqueueWhatsappTask, claimNextTask, completeTask, failTask, getRecentTasks, countTasksByStatus, sessionIdForUser };
