const { pool } = require("../config/db");

async function purgeWhatsappCache(userId) {
  await pool.query(`DELETE FROM conversation_ai_profiles WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM message_media_cache WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM message_cache WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM conversation_meta WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM whatsapp_contacts WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM whatsapp_chat_aliases WHERE user_id = $1`, [userId]);
}

async function purgeWhatsappHistoryCache(userId) {
  await pool.query(`DELETE FROM conversation_ai_profiles WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM message_media_cache WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM message_cache WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM conversation_meta WHERE user_id = $1`, [userId]);
}

async function purgeNotificationData(userId) {
  await pool.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM native_push_tokens WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM notification_preferences WHERE user_id = $1`, [userId]);
}

async function purgeWhatsappData(userId, options = {}) {
  if (options.auth) {
    await pool.query(
      `DELETE FROM baileys_auth
       WHERE session_id IN (SELECT session_id FROM whatsapp_connections WHERE user_id = $1)`,
      [userId]
    );
  }
  await purgeWhatsappCache(userId);
}

async function exportData(userId) {
  const tables = [
    "users",
    "user_profiles",
    "legal_acceptances",
    "whatsapp_connections",
    "whatsapp_contacts",
    "whatsapp_chat_aliases",
    "conversation_meta",
    "conversation_ai_profiles",
    "message_cache",
    "message_media_cache",
    "usage_ledger",
    "quota_balances",
    "plan_subscriptions",
    "pack_purchases",
    "push_subscriptions",
    "native_push_tokens",
    "notification_preferences",
    "audit_logs"
  ];
  const data = {};
  for (const table of tables) {
    const column = table === "users" ? "id" : "user_id";
    const result = await pool.query(`SELECT * FROM ${table} WHERE ${column} = $1`, [userId]);
    data[table] = result.rows;
  }
  return data;
}

async function deleteHistory(userId) {
  await purgeWhatsappHistoryCache(userId);
  await pool.query(`INSERT INTO audit_logs (user_id, action, metadata) VALUES ($1, 'history_deleted', '{}'::jsonb)`, [userId]);
}

async function requestDelete(userId) {
  await purgeWhatsappData(userId, { auth: true });
  await purgeNotificationData(userId);
  await pool.query(`UPDATE users SET status = 'pending_deletion', pending_delete_at = NOW() + INTERVAL '7 days', updated_at = NOW() WHERE id = $1`, [userId]);
  await pool.query(`UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
  await pool.query(`UPDATE whatsapp_connections SET status = 'disconnected', pairing_code = NULL, disconnect_reason = 'account_delete_requested', updated_at = NOW() WHERE user_id = $1`, [userId]);
  await pool.query(`INSERT INTO audit_logs (user_id, action, metadata) VALUES ($1, 'account_delete_requested', '{}'::jsonb)`, [userId]);
}

async function cancelDelete(userId) {
  await pool.query(`UPDATE users SET status = 'active', pending_delete_at = NULL, updated_at = NOW() WHERE id = $1 AND status = 'pending_deletion'`, [userId]);
  await pool.query(`INSERT INTO audit_logs (user_id, action, metadata) VALUES ($1, 'account_delete_cancelled', '{}'::jsonb)`, [userId]);
}

async function purgeDueAccounts() {
  const due = await pool.query(
    `SELECT id
       FROM users
      WHERE status = 'pending_deletion'
        AND pending_delete_at <= NOW()
        AND deleted_at IS NULL
      ORDER BY id
      LIMIT 100`
  );

  for (const row of due.rows) {
    const userId = row.id;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM baileys_auth
          WHERE session_id IN (SELECT session_id FROM whatsapp_connections WHERE user_id = $1)`,
        [userId]
      );
      await client.query(`DELETE FROM user_sessions WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM user_identities WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM user_profiles WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM legal_acceptances WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM whatsapp_pairing_guards WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM whatsapp_connections WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM conversation_ai_profiles WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM message_media_cache WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM message_cache WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM conversation_meta WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM whatsapp_contacts WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM whatsapp_chat_aliases WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM native_push_tokens WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM notification_preferences WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM usage_ledger WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM quota_balances WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM audit_logs WHERE user_id = $1`, [userId]);
      await client.query(
        `UPDATE users
            SET email = CONCAT('deleted+', id::text, '@deleted.wafli.local'),
                phone = NULL,
                stripe_customer_id = NULL,
                default_plan = 'free',
                status = 'permanently_deleted',
                onboarding_status = 'deleted',
                pending_delete_at = NULL,
                deleted_at = NOW(),
                suspended_until = NULL,
                suspension_reason = NULL,
                updated_at = NOW()
          WHERE id = $1`,
        [userId]
      );
      await client.query(
        `INSERT INTO audit_logs (user_id, action, metadata)
         VALUES ($1, 'account_permanently_deleted', '{"source":"privacy_purge"}'::jsonb)`,
        [userId]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  return due.rows.length || 0;
}

module.exports = { exportData, deleteHistory, requestDelete, cancelDelete, purgeDueAccounts, purgeWhatsappCache, purgeWhatsappHistoryCache, purgeWhatsappData, purgeNotificationData };
