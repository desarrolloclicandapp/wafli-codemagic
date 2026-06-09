const { pool } = require("../config/db");
const { config } = require("../config/env");
const { ApiError } = require("../utils/responses");
const chatRealtime = require("./chatRealtimeService");
const pushService = require("./pushService");
const { logger } = require("./loggerService");
const conversationProfileService = require("./conversationProfileService");

const aliasMergeSweepAtByUser = new Map();

function cleanText(value) {
  const text = String(value || "").trim();
  return text || null;
}

function normalizeVisiblePhone(phone) {
  const value = String(phone || "").trim();
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits || digits.length < 7) return null;
  return `+${digits}`;
}

function chatIdFromPhone(phone) {
  const normalized = normalizeVisiblePhone(phone);
  if (!normalized) throw new ApiError(400, "invalid_phone", "Telefono invalido");
  return `${normalized.replace(/\D/g, "")}@s.whatsapp.net`;
}

function normalizeMessageType(value) {
  const type = String(value || "text").trim().toLowerCase();
  return ["text", "image", "audio", "sticker"].includes(type) ? type : "text";
}

function fallbackBodyForMessageType(type) {
  return {
    image: "Imagen",
    audio: "Audio",
    sticker: "Sticker"
  }[type] || "Mensaje";
}

function chatAliasType(chatId) {
  const value = String(chatId || "");
  if (value.endsWith("@g.us")) return "group";
  if (value.endsWith("@lid")) return "lid";
  if (value.endsWith("@s.whatsapp.net")) return "phone_jid";
  return value.includes("@") ? "jid" : "phone";
}

function readPositiveLimit(value, fallback = 50, max = 100) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.min(max, parsed));
}

function phoneFromChatId(chatId) {
  const value = String(chatId || "");
  if (!value.endsWith("@s.whatsapp.net")) return null;
  const digits = value.split("@")[0].split(":")[0].replace(/\D/g, "");
  return digits ? `+${digits}` : null;
}

async function resolveCanonicalChatId(userId, chatId, hints = {}) {
  const safeChatId = cleanText(chatId);
  if (!safeChatId) throw new ApiError(400, "invalid_chat_id", "Chat invalido");
  if (safeChatId.endsWith("@g.us")) return safeChatId;

  const aliasResult = await pool.query(
    `SELECT canonical_chat_id
     FROM whatsapp_chat_aliases
     WHERE user_id = $1 AND alias_chat_id = $2
     LIMIT 1`,
    [userId, safeChatId]
  );
  if (aliasResult.rows[0]?.canonical_chat_id) return aliasResult.rows[0].canonical_chat_id;

  const hintedPhone = normalizeVisiblePhone(hints.phone) || phoneFromChatId(safeChatId);
  if (hintedPhone) {
    const phoneAlias = await pool.query(
      `SELECT canonical_chat_id
       FROM whatsapp_chat_aliases
       WHERE user_id = $1 AND phone = $2
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId, hintedPhone]
    );
    if (phoneAlias.rows[0]?.canonical_chat_id) return phoneAlias.rows[0].canonical_chat_id;

    const existing = await pool.query(
      `SELECT external_chat_id
       FROM (
         SELECT cm.external_chat_id, cm.last_message_at, cm.updated_at, 1 AS rank
         FROM conversation_meta cm
         WHERE cm.user_id = $1 AND cm.phone = $2
         UNION ALL
         SELECT wc.external_chat_id, NULL::timestamptz AS last_message_at, wc.updated_at, 2 AS rank
         FROM whatsapp_contacts wc
         WHERE wc.user_id = $1 AND wc.phone = $2
       ) candidates
       ORDER BY rank ASC, last_message_at DESC NULLS LAST, updated_at DESC
       LIMIT 1`,
      [userId, hintedPhone]
    );
    if (existing.rows[0]?.external_chat_id) return existing.rows[0].external_chat_id;
  }

  return safeChatId;
}

async function mergeAliasConversation(userId, canonicalChatId, aliasChatId, details = {}) {
  const canonical = cleanText(canonicalChatId);
  const alias = cleanText(aliasChatId);
  if (!canonical || !alias || canonical === alias || alias.endsWith("@g.us")) return { merged: false };
  const phone = normalizeVisiblePhone(details.phone) || phoneFromChatId(canonical) || phoneFromChatId(alias);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO conversation_meta (
         user_id, external_chat_id, display_name, avatar_url, phone, favorite, muted,
         excluded, unread_count, stale, last_message_preview, last_message_at, created_at, updated_at
       )
       SELECT
         user_id,
         $2::varchar,
         display_name,
         avatar_url,
         COALESCE($4::varchar, phone),
         favorite,
         muted,
         excluded,
         unread_count,
         stale,
         last_message_preview,
         last_message_at,
         created_at,
         NOW()
       FROM conversation_meta
       WHERE user_id = $1 AND external_chat_id = $3
       ON CONFLICT (user_id, external_chat_id) DO UPDATE SET
         display_name = COALESCE(NULLIF(conversation_meta.display_name, ''), EXCLUDED.display_name),
         avatar_url = COALESCE(conversation_meta.avatar_url, EXCLUDED.avatar_url),
         phone = COALESCE(conversation_meta.phone, EXCLUDED.phone),
         favorite = conversation_meta.favorite OR EXCLUDED.favorite,
         muted = conversation_meta.muted OR EXCLUDED.muted,
         excluded = conversation_meta.excluded AND EXCLUDED.excluded,
         unread_count = conversation_meta.unread_count + EXCLUDED.unread_count,
         stale = conversation_meta.stale OR EXCLUDED.stale,
         last_message_preview = CASE
           WHEN conversation_meta.last_message_at IS NULL OR EXCLUDED.last_message_at >= conversation_meta.last_message_at
             THEN EXCLUDED.last_message_preview
           ELSE conversation_meta.last_message_preview
         END,
         last_message_at = GREATEST(COALESCE(conversation_meta.last_message_at, EXCLUDED.last_message_at), EXCLUDED.last_message_at),
         updated_at = NOW()`,
      [userId, canonical, alias, phone]
    );
    await client.query(
      `UPDATE message_cache target
       SET metadata = target.metadata || source.metadata || jsonb_build_object('mergedFromChatId', $3::varchar),
           body = COALESCE(target.body, source.body),
           sent_at = COALESCE(target.sent_at, source.sent_at),
           expires_at = GREATEST(target.expires_at, source.expires_at)
       FROM message_cache source
       WHERE target.user_id = source.user_id
         AND target.external_chat_id = $2
         AND source.external_chat_id = $3
         AND target.external_message_id = source.external_message_id
         AND target.user_id = $1`,
      [userId, canonical, alias]
    );
    await client.query(
      `DELETE FROM message_cache source
       WHERE source.user_id = $1
         AND source.external_chat_id = $3
         AND EXISTS (
           SELECT 1 FROM message_cache target
           WHERE target.user_id = source.user_id
             AND target.external_chat_id = $2
             AND target.external_message_id = source.external_message_id
         )`,
      [userId, canonical, alias]
    );
    await client.query(
      `UPDATE message_cache
       SET external_chat_id = $2,
           metadata = metadata || jsonb_build_object('mergedFromChatId', $3::varchar)
       WHERE user_id = $1 AND external_chat_id = $3`,
      [userId, canonical, alias]
    );
    await client.query(
      `UPDATE message_media_cache target
       SET metadata = target.metadata || source.metadata || jsonb_build_object('mergedFromChatId', $3::varchar),
           expires_at = GREATEST(target.expires_at, source.expires_at)
       FROM message_media_cache source
       WHERE target.user_id = source.user_id
         AND target.external_chat_id = $2
         AND source.external_chat_id = $3
         AND target.external_message_id = source.external_message_id
         AND target.user_id = $1`,
      [userId, canonical, alias]
    );
    await client.query(
      `DELETE FROM message_media_cache source
       WHERE source.user_id = $1
         AND source.external_chat_id = $3
         AND EXISTS (
           SELECT 1 FROM message_media_cache target
           WHERE target.user_id = source.user_id
             AND target.external_chat_id = $2
             AND target.external_message_id = source.external_message_id
         )`,
      [userId, canonical, alias]
    );
    await client.query(
      `UPDATE message_media_cache
       SET external_chat_id = $2,
           metadata = metadata || jsonb_build_object('mergedFromChatId', $3::varchar)
       WHERE user_id = $1 AND external_chat_id = $3`,
      [userId, canonical, alias]
    );
    await client.query(
      `DELETE FROM conversation_meta
       WHERE user_id = $1 AND external_chat_id = $2`,
      [userId, alias]
    );
    await client.query("COMMIT");
    chatRealtime.emitChatUpdated(userId, canonical, { reason: "alias_merged", aliasChatId: alias });
    return { merged: true };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function mergeKnownAliasesForUser(userId) {
  const now = Date.now();
  const lastSweepAt = aliasMergeSweepAtByUser.get(userId) || 0;
  if (now - lastSweepAt < 5 * 60 * 1000) return;
  aliasMergeSweepAtByUser.set(userId, now);
  const aliases = await pool.query(
    `SELECT canonical_chat_id, alias_chat_id, phone
     FROM whatsapp_chat_aliases
     WHERE user_id = $1
       AND canonical_chat_id <> alias_chat_id
       AND alias_chat_id NOT LIKE '%@g.us'
     ORDER BY updated_at DESC
     LIMIT 50`,
    [userId]
  ).catch(() => ({ rows: [] }));
  for (const alias of aliases.rows) {
    await mergeAliasConversation(userId, alias.canonical_chat_id, alias.alias_chat_id, {
      phone: alias.phone,
      source: "known_alias_sweep"
    }).catch((error) => logger.warn("whatsapp-sync", "Could not merge known aliased WhatsApp chat", {
      context: {
        userId,
        canonicalChatId: alias.canonical_chat_id,
        aliasChatId: alias.alias_chat_id,
        error: error.message
      }
    }));
  }
}

async function registerChatAlias(userId, canonicalChatId, aliasChatId, details = {}) {
  const safeAlias = cleanText(aliasChatId);
  const safeCanonicalInput = cleanText(canonicalChatId);
  if (!safeAlias || !safeCanonicalInput || safeAlias.endsWith("@g.us")) return null;
  const canonical = await resolveCanonicalChatId(userId, safeCanonicalInput, details).catch(() => safeCanonicalInput);
  const phone = normalizeVisiblePhone(details.phone) || phoneFromChatId(safeAlias) || phoneFromChatId(canonical);
  const aliasType = cleanText(details.aliasType) || chatAliasType(safeAlias);
  const previous = await pool.query(
    `SELECT canonical_chat_id
     FROM whatsapp_chat_aliases
     WHERE user_id = $1 AND alias_chat_id = $2
     LIMIT 1`,
    [userId, safeAlias]
  ).catch(() => ({ rows: [] }));
  const result = await pool.query(
    `INSERT INTO whatsapp_chat_aliases (
       user_id, canonical_chat_id, alias_chat_id, alias_type, phone, metadata
     )
     VALUES ($1::bigint, $2::varchar, $3::varchar, $4::varchar, $5::varchar, $6::jsonb)
     ON CONFLICT (user_id, alias_chat_id) DO UPDATE SET
       canonical_chat_id = EXCLUDED.canonical_chat_id,
       alias_type = EXCLUDED.alias_type,
       phone = COALESCE(EXCLUDED.phone, whatsapp_chat_aliases.phone),
       metadata = whatsapp_chat_aliases.metadata || EXCLUDED.metadata,
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      canonical,
      safeAlias,
      aliasType,
      phone,
      JSON.stringify({ source: details.source || "identity_resolution", ...(details.metadata || {}) })
    ]
  );
  const previousCanonical = previous.rows[0]?.canonical_chat_id || null;
  if (!previousCanonical || previousCanonical !== canonical) {
    logger.info("whatsapp-sync", "WhatsApp chat alias registered", {
      context: {
        userId,
        canonicalChatId: canonical,
        aliasChatId: safeAlias,
        previousCanonicalChatId: previousCanonical,
        aliasType,
        source: details.source || "identity_resolution"
      }
    }).catch(() => {});
  }
  if (safeAlias !== canonical) {
    await pool.query(
      `INSERT INTO whatsapp_chat_aliases (
         user_id, canonical_chat_id, alias_chat_id, alias_type, phone, metadata
       )
       VALUES ($1::bigint, $2::varchar, $2::varchar, $3::varchar, $4::varchar, $5::jsonb)
       ON CONFLICT (user_id, alias_chat_id) DO UPDATE SET
         canonical_chat_id = EXCLUDED.canonical_chat_id,
         phone = COALESCE(EXCLUDED.phone, whatsapp_chat_aliases.phone),
         metadata = whatsapp_chat_aliases.metadata || EXCLUDED.metadata,
         updated_at = NOW()`,
      [userId, canonical, chatAliasType(canonical), phone, JSON.stringify({ source: "canonical_self_alias" })]
    ).catch(() => {});
    await mergeAliasConversation(userId, canonical, safeAlias, {
      phone,
      source: details.source || "identity_resolution"
    }).catch((error) => logger.warn("whatsapp-sync", "Could not merge aliased WhatsApp chat", {
      context: { userId, canonicalChatId: canonical, aliasChatId: safeAlias, error: error.message }
    }));
  }
  return result.rows[0] || null;
}

function firstText(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return null;
}

function isWeakDisplayName(value, chatId, phone) {
  const text = cleanText(value);
  if (!text) return true;
  const safeChatId = cleanText(chatId);
  const safePhone = normalizeVisiblePhone(phone);
  const textDigits = text.replace(/\D/g, "");
  const phoneDigits = String(safePhone || "").replace(/\D/g, "");
  return (
    text === safeChatId ||
    text === safePhone ||
    Boolean(phoneDigits && textDigits === phoneDigits) ||
    /@(s\.whatsapp\.net|lid|g\.us)$/i.test(text)
  );
}

function messageExpiresAt(baseDate = new Date()) {
  const base = baseDate instanceof Date ? baseDate : new Date(baseDate);
  const expiresAt = new Date(Number.isFinite(base.getTime()) ? base.getTime() : Date.now());
  expiresAt.setUTCDate(expiresAt.getUTCDate() + Math.max(1, Number(config.whatsapp.messageCacheRetentionDays || 7)));
  return expiresAt;
}

function mediaExpiresAt(baseDate = new Date()) {
  const base = baseDate instanceof Date ? baseDate : new Date(baseDate);
  const expiresAt = new Date(Number.isFinite(base.getTime()) ? base.getTime() : Date.now());
  expiresAt.setUTCHours(expiresAt.getUTCHours() + Math.max(1, Number(config.whatsapp.mediaCacheRetentionHours || 12)));
  return expiresAt;
}

function minimizeMessageBody(value) {
  const text = String(value || "").trim();
  const maxChars = Math.max(280, Number(config.whatsapp.messageBodyMaxChars || 4000));
  if (text.length <= maxChars) return { text, truncated: false, originalLength: text.length, maxChars };
  return {
    text: text.slice(0, maxChars).trimEnd(),
    truncated: true,
    originalLength: text.length,
    maxChars
  };
}

function contentCachePolicy() {
  return {
    policy: config.whatsapp.contentCachePolicy || "ephemeral_ttl",
    retentionDays: config.whatsapp.messageCacheRetentionDays,
    incomingMediaAutoCache: Boolean(config.whatsapp.incomingMediaAutoCache),
    mediaRetentionHours: config.whatsapp.mediaCacheRetentionHours,
    messageBodyMaxChars: config.whatsapp.messageBodyMaxChars,
    mediaMaxBytes: config.whatsapp.mediaCacheMaxBytes,
    storesMessageBodies: true,
    storesMediaBlobs: Number(config.whatsapp.mediaCacheMaxBytes || 0) > 0,
    note: "Cache temporal para historial reciente e IA. Los adjuntos se sirven bajo demanda y los binarios multimedia expiran rapido."
  };
}

function latestMessagePreviewSql() {
  return `CASE
            WHEN lm.sent_at IS NOT NULL AND (cm.last_message_at IS NULL OR lm.sent_at >= cm.last_message_at) THEN
              CASE
                WHEN lm.deleted_at IS NOT NULL THEN 'Mensaje eliminado'
                WHEN NULLIF(lm.body, '') IS NOT NULL THEN lm.body
                WHEN lm.message_type = 'image' THEN 'Imagen'
                WHEN lm.message_type = 'sticker' THEN 'Sticker'
                WHEN lm.message_type = 'audio' THEN 'Audio'
                WHEN lm.message_type = 'video' THEN 'Video'
                WHEN lm.message_type = 'document' THEN 'Documento'
                WHEN lm.message_type = 'location' THEN 'Ubicacion'
                WHEN lm.message_type = 'contact' THEN 'Contacto'
                ELSE COALESCE(NULLIF(cm.last_message_preview, ''), 'Mensaje')
              END
            ELSE cm.last_message_preview
          END`;
}

function latestMessageAtSql() {
  return `CASE
            WHEN lm.sent_at IS NOT NULL AND (cm.last_message_at IS NULL OR lm.sent_at >= cm.last_message_at)
              THEN lm.sent_at
            ELSE cm.last_message_at
          END`;
}

function latestMessageJoinForConversation() {
  return `LEFT JOIN LATERAL (
       SELECT m.body, m.message_type, m.sent_at, m.created_at, m.deleted_at
       FROM message_cache m
       WHERE m.user_id = cm.user_id
         AND m.external_chat_id = cm.external_chat_id
         AND m.expires_at > NOW()
       ORDER BY m.sent_at DESC NULLS LAST, m.created_at DESC
       LIMIT 1
     ) lm ON TRUE`;
}

function chatProjection() {
  return `cm.external_chat_id AS id,
          cm.external_chat_id AS "canonicalChatId",
          COALESCE(
            NULLIF(wc.manual_alias, ''),
            NULLIF(CASE WHEN wc.source = 'group_participant' THEN NULL ELSE wc.whatsapp_name END, ''),
            NULLIF(wc.push_name, ''),
            NULLIF(wc.notify_name, ''),
            NULLIF(wc.verified_name, ''),
            NULLIF(cm.display_name, ''),
            NULLIF(wc.phone, ''),
            NULLIF(cm.phone, ''),
            cm.external_chat_id
          ) AS name,
          COALESCE(wc.avatar_url, cm.avatar_url) AS avatar_url,
          COALESCE(wc.phone, cm.phone) AS phone,
          wc.manual_alias,
          wc.whatsapp_name,
          wc.push_name,
          wc.notify_name,
          wc.verified_name,
          wc.source AS contact_source,
          cm.favorite,
          cm.muted,
          cm.excluded,
          cm.unread_count AS unread,
          cm.stale,
          ${latestMessagePreviewSql()} AS last,
          ${latestMessageAtSql()} AS last_at,
          TRUE AS has_conversation`;
}

function contactProjection() {
  return `wc.external_chat_id AS id,
          wc.external_chat_id AS "canonicalChatId",
          COALESCE(
            NULLIF(wc.manual_alias, ''),
            NULLIF(CASE WHEN wc.source = 'group_participant' THEN NULL ELSE wc.whatsapp_name END, ''),
            NULLIF(wc.push_name, ''),
            NULLIF(wc.notify_name, ''),
            NULLIF(wc.verified_name, ''),
            NULLIF(cm.display_name, ''),
            NULLIF(wc.phone, ''),
            wc.external_chat_id
          ) AS name,
          COALESCE(wc.avatar_url, cm.avatar_url) AS avatar_url,
          COALESCE(wc.phone, cm.phone) AS phone,
          wc.manual_alias,
          wc.whatsapp_name,
          wc.push_name,
          wc.notify_name,
          wc.verified_name,
          wc.source AS contact_source,
          COALESCE(cm.favorite, FALSE) AS favorite,
          COALESCE(cm.muted, FALSE) AS muted,
          COALESCE(cm.excluded, FALSE) AS excluded,
          COALESCE(cm.unread_count, 0) AS unread,
          COALESCE(cm.stale, FALSE) AS stale,
          cm.last_message_preview AS last,
          cm.last_message_at AS last_at,
          (cm.id IS NOT NULL) AS has_conversation`;
}

function bestContactJoinForConversation() {
  return `LEFT JOIN LATERAL (
       SELECT candidate.*
       FROM whatsapp_contacts candidate
       WHERE candidate.user_id = cm.user_id
         AND (
           candidate.external_chat_id = cm.external_chat_id
           OR (cm.phone IS NOT NULL AND candidate.phone = cm.phone)
           OR EXISTS (
             SELECT 1
             FROM whatsapp_chat_aliases a
             WHERE a.user_id = cm.user_id
               AND (
                 (a.canonical_chat_id = cm.external_chat_id AND a.alias_chat_id = candidate.external_chat_id)
                 OR (a.alias_chat_id = cm.external_chat_id AND a.canonical_chat_id = candidate.external_chat_id)
               )
           )
         )
       ORDER BY
         CASE
           WHEN candidate.external_chat_id = cm.external_chat_id THEN 1
           WHEN cm.phone IS NOT NULL AND candidate.phone = cm.phone THEN 2
           ELSE 3
         END,
         CASE WHEN NULLIF(candidate.manual_alias, '') IS NOT NULL THEN 1 ELSE 2 END,
         candidate.updated_at DESC
       LIMIT 1
     ) wc ON TRUE`;
}

async function attachChatAliases(userId, rows = []) {
  const normalizedRows = rows.map((row) => {
    const canonicalChatId = row.canonicalChatId || row.canonical_chat_id || row.id;
    return {
      ...row,
      id: canonicalChatId,
      canonicalChatId,
      aliases: Array.isArray(row.aliases) ? row.aliases : []
    };
  });
  const canonicalIds = [...new Set(normalizedRows.map((row) => row.canonicalChatId).filter(Boolean))];
  if (canonicalIds.length === 0) return normalizedRows;
  const result = await pool.query(
    `SELECT
       canonical_chat_id,
       json_agg(
         json_build_object(
           'id', alias_chat_id,
           'type', alias_type,
           'phone', phone,
           'isCanonical', alias_chat_id = canonical_chat_id
         )
         ORDER BY updated_at DESC
       ) AS aliases
     FROM whatsapp_chat_aliases
     WHERE user_id = $1 AND canonical_chat_id = ANY($2::varchar[])
     GROUP BY canonical_chat_id`,
    [userId, canonicalIds]
  ).catch(() => ({ rows: [] }));
  const aliasesByCanonical = new Map(
    result.rows.map((row) => [row.canonical_chat_id, Array.isArray(row.aliases) ? row.aliases : []])
  );
  return normalizedRows.map((row) => ({
    ...row,
    aliases: aliasesByCanonical.get(row.canonicalChatId) || row.aliases || []
  }));
}

async function listChats(userId, filters = {}) {
  await mergeKnownAliasesForUser(userId);
  const params = [userId];
  let where = `WHERE cm.user_id = $1 AND cm.excluded = FALSE`;
  const limit = readPositiveLimit(filters.limit, 60, 100);
  if (filters.favorite === "true") where += ` AND cm.favorite = TRUE`;
  if (filters.unread === "true") where += ` AND cm.unread_count > 0`;
  if (filters.stale === "true") where += ` AND cm.stale = TRUE`;
  if (filters.activeOnly === "true" || filters.includeEmpty === "false") {
    where += ` AND (cm.last_message_at IS NOT NULL OR cm.unread_count > 0 OR cm.favorite = TRUE)`;
  }
  if (filters.includeSilentGroups !== "true") {
    where += ` AND (cm.external_chat_id NOT LIKE '%@g.us' OR cm.last_message_at IS NOT NULL OR cm.unread_count > 0 OR cm.favorite = TRUE)`;
  }
  if (filters.excludeLid === "true") {
    where += ` AND (cm.external_chat_id NOT LIKE '%@lid' OR cm.last_message_at IS NOT NULL OR cm.unread_count > 0)`;
  }
  params.push(limit);
  const result = await pool.query(
    `SELECT ${chatProjection()}
     FROM conversation_meta cm
     ${latestMessageJoinForConversation()}
     ${bestContactJoinForConversation()}
     ${where}
     ORDER BY ${latestMessageAtSql()} DESC NULLS LAST, cm.updated_at DESC
     LIMIT $${params.length}`,
    params
  );
  return attachChatAliases(userId, result.rows);
}

async function getChat(userId, chatId) {
  const canonicalChatId = await resolveCanonicalChatId(userId, chatId);
  const result = await pool.query(
    `SELECT ${chatProjection()}
     FROM conversation_meta cm
     ${latestMessageJoinForConversation()}
     ${bestContactJoinForConversation()}
     WHERE cm.user_id = $1 AND cm.external_chat_id = $2`,
    [userId, canonicalChatId]
  );
  if (!result.rows[0]) throw new ApiError(404, "chat_not_found", "Chat no encontrado");
  const rows = await attachChatAliases(userId, result.rows);
  return rows[0];
}

async function getMessages(userId, chatId) {
  const canonicalChatId = await resolveCanonicalChatId(userId, chatId);
  const meta = await pool.query(`SELECT * FROM conversation_meta WHERE user_id = $1 AND external_chat_id = $2`, [userId, canonicalChatId]);
  if (!meta.rows[0]) throw new ApiError(404, "chat_not_found", "Chat no encontrado");
  const rows = await pool.query(
    `SELECT m.external_message_id AS id, m.sender, m.message_type, m.delivery_status AS status,
            m.error_message,
            CASE WHEN m.deleted_at IS NOT NULL THEN NULL ELSE m.body END AS body,
            m.metadata, m.sent_at, m.edited_at, m.deleted_at, m.deleted_scope,
            COALESCE(
              NULLIF(pc.manual_alias, ''),
              NULLIF(CASE WHEN pc.source = 'group_participant' THEN NULL ELSE pc.whatsapp_name END, ''),
              NULLIF(pc.push_name, ''),
              NULLIF(pc.notify_name, ''),
              NULLIF(pc.verified_name, ''),
              NULLIF(m.metadata->>'senderName', ''),
              NULLIF(m.metadata->>'participantName', ''),
              NULLIF(m.metadata->>'pushName', '')
            ) AS sender_name,
            (mm.id IS NOT NULL OR COALESCE((m.metadata->>'hasMedia')::boolean, false)) AS has_media,
            COALESCE(mm.media_type, NULLIF(m.metadata->>'mediaType', '')) AS media_type,
            COALESCE(mm.mime_type, NULLIF(m.metadata->>'mimeType', '')) AS mime_type,
            COALESCE(mm.file_name, NULLIF(m.metadata->>'fileName', '')) AS file_name,
            COALESCE(
              mm.size_bytes,
              CASE WHEN COALESCE(m.metadata->>'sizeBytes', '') ~ '^[0-9]+$' THEN (m.metadata->>'sizeBytes')::int ELSE NULL END
            ) AS size_bytes
     FROM (
       SELECT *
       FROM message_cache
       WHERE user_id = $1 AND external_chat_id = $2 AND expires_at > NOW()
       ORDER BY sent_at DESC NULLS LAST, created_at DESC
       LIMIT 60
     ) m
     LEFT JOIN whatsapp_contacts pc
       ON pc.user_id = m.user_id
      AND pc.external_chat_id = NULLIF(m.metadata->>'participant', '')
     LEFT JOIN message_media_cache mm
      ON mm.user_id = m.user_id
     AND mm.external_chat_id = m.external_chat_id
     AND mm.external_message_id = m.external_message_id
     AND mm.expires_at > NOW()
     ORDER BY m.sent_at ASC NULLS LAST, m.created_at ASC
     `,
    [userId, canonicalChatId]
  );
  return rows.rows;
}

async function markRead(userId, chatId) {
  const canonicalChatId = await resolveCanonicalChatId(userId, chatId);
  const result = await pool.query(
    `UPDATE conversation_meta
     SET unread_count = 0,
         updated_at = NOW()
     WHERE user_id = $1 AND external_chat_id = $2
     RETURNING external_chat_id AS id`,
    [userId, canonicalChatId]
  );
  if (!result.rows[0]) throw new ApiError(404, "chat_not_found", "Chat no encontrado");
  const chat = await getChat(userId, canonicalChatId);
  chatRealtime.emitChatUpdated(userId, canonicalChatId, { reason: "read", chat });
  return chat;
}

async function updateChatMeta(userId, chatId, patch = {}) {
  const canonicalChatId = await resolveCanonicalChatId(userId, chatId);
  const allowed = ["favorite", "muted", "excluded", "stale"];
  const updates = [];
  const params = [userId, canonicalChatId];
  for (const key of allowed) {
    if (patch[key] !== undefined) {
      params.push(!!patch[key]);
      updates.push(`${key} = $${params.length}`);
    }
  }
  if (updates.length === 0) throw new ApiError(400, "empty_patch", "Nada para actualizar");
  await pool.query(
    `UPDATE conversation_meta SET ${updates.join(", ")}, updated_at = NOW() WHERE user_id = $1 AND external_chat_id = $2`,
    params
  );
  const result = await pool.query(`SELECT * FROM conversation_meta WHERE user_id = $1 AND external_chat_id = $2`, [userId, canonicalChatId]);
  if (!result.rows[0]) throw new ApiError(404, "chat_not_found", "Chat no encontrado");
  if (patch.stale === true) {
    pushService.notify(userId, "stalled", {
      title: "Conversación encallada",
      body: `Quizás conviene retomar ${result.rows[0].display_name || "este chat"}.`,
      chatId: canonicalChatId,
      target: "/",
      tag: `stalled-${canonicalChatId}`,
      renotify: false
    }).catch(() => {});
  }
  chatRealtime.emitChatUpdated(userId, canonicalChatId, { reason: "meta", patch });
  return result.rows[0];
}

async function upsertContact({
  userId,
  chatId,
  phone = null,
  alias = null,
  whatsappName = null,
  pushName = null,
  notifyName = null,
  verifiedName = null,
  avatarUrl = null,
  source = "whatsapp",
  metadata = {},
  ensureConversation = false
}) {
  const safeChatId = cleanText(chatId);
  if (!safeChatId) throw new ApiError(400, "invalid_chat_id", "Chat invalido");
  const safePhone = normalizeVisiblePhone(phone);
  const canonicalChatId = await resolveCanonicalChatId(userId, safeChatId, { phone: safePhone });
  if (canonicalChatId !== safeChatId) {
    await registerChatAlias(userId, canonicalChatId, safeChatId, {
      phone: safePhone,
      source: "upsert_contact_alias",
      metadata: { originalSource: source }
    }).catch(() => {});
  }
  const richDisplayNameRaw = firstText(alias, whatsappName, pushName, notifyName, verifiedName);
  const richDisplayName = isWeakDisplayName(richDisplayNameRaw, canonicalChatId, safePhone) ? null : richDisplayNameRaw;
  const displayName = firstText(richDisplayName, safePhone, safeChatId);
  const forceDisplayNameUpdate = Boolean(richDisplayName && (source === "manual" || source === "chats" || String(canonicalChatId).endsWith("@g.us")));
  const result = await pool.query(
    `INSERT INTO whatsapp_contacts (
       user_id, external_chat_id, phone, manual_alias, whatsapp_name, push_name, notify_name,
       verified_name, avatar_url, source, metadata
     )
     VALUES (
       $1::bigint, $2::varchar, $3::varchar, $4::varchar, $5::varchar, $6::varchar,
       $7::varchar, $8::varchar, $9::text, COALESCE(NULLIF($10::varchar, ''), 'whatsapp'), $11::jsonb
     )
     ON CONFLICT (user_id, external_chat_id) DO UPDATE SET
       phone = COALESCE(EXCLUDED.phone, whatsapp_contacts.phone),
       manual_alias = COALESCE(EXCLUDED.manual_alias, whatsapp_contacts.manual_alias),
       whatsapp_name = CASE
         WHEN EXCLUDED.source = 'group_participant' AND NULLIF(EXCLUDED.whatsapp_name, '') IS NULL
           THEN whatsapp_contacts.whatsapp_name
         WHEN whatsapp_contacts.source = 'group_participant'
              AND EXCLUDED.source <> 'group_participant'
              AND NULLIF(EXCLUDED.whatsapp_name, '') IS NULL
           THEN NULL
         ELSE COALESCE(NULLIF(EXCLUDED.whatsapp_name, ''), whatsapp_contacts.whatsapp_name)
       END,
       push_name = COALESCE(NULLIF(EXCLUDED.push_name, ''), whatsapp_contacts.push_name),
       notify_name = COALESCE(NULLIF(EXCLUDED.notify_name, ''), whatsapp_contacts.notify_name),
       verified_name = COALESCE(NULLIF(EXCLUDED.verified_name, ''), whatsapp_contacts.verified_name),
       avatar_url = COALESCE(EXCLUDED.avatar_url, whatsapp_contacts.avatar_url),
       source = COALESCE(NULLIF(EXCLUDED.source, ''), whatsapp_contacts.source),
       metadata = whatsapp_contacts.metadata || EXCLUDED.metadata,
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      canonicalChatId,
      safePhone,
      cleanText(alias),
      cleanText(whatsappName),
      cleanText(pushName),
      cleanText(notifyName),
      cleanText(verifiedName),
      cleanText(avatarUrl),
      cleanText(source),
      JSON.stringify(metadata || {})
    ]
  );
  if (ensureConversation) {
    await pool.query(
      `INSERT INTO conversation_meta (user_id, external_chat_id, display_name, phone, avatar_url)
       VALUES ($1::bigint, $2::varchar, $3::varchar, $4::varchar, $7::text)
       ON CONFLICT (user_id, external_chat_id) DO UPDATE SET
         display_name = CASE
           WHEN NULLIF($5::varchar, '') IS NULL THEN conversation_meta.display_name
           WHEN $6::boolean THEN $5::varchar
           WHEN NULLIF(conversation_meta.display_name, '') IS NULL THEN $5::varchar
           WHEN conversation_meta.display_name = conversation_meta.external_chat_id THEN $5::varchar
           WHEN conversation_meta.phone IS NOT NULL AND conversation_meta.display_name = conversation_meta.phone THEN $5::varchar
           ELSE conversation_meta.display_name
         END,
         phone = COALESCE(NULLIF($4::varchar, ''), conversation_meta.phone),
         avatar_url = COALESCE(NULLIF($7::text, ''), conversation_meta.avatar_url),
         updated_at = NOW()`,
      [userId, canonicalChatId, displayName, safePhone, richDisplayName, forceDisplayNameUpdate, cleanText(avatarUrl)]
    );
  }
  return result.rows[0];
}

async function listContacts(userId, filters = {}) {
  const params = [userId];
  let where = `WHERE wc.user_id = $1`;
  const q = cleanText(filters.q || filters.search || filters.query);
  const limit = readPositiveLimit(filters.limit, 25, 50);
  const includeAll = filters.includeAll === "true";
  if (!includeAll && (!q || q.length < 2)) return [];
  if (filters.excludeLid !== "false") where += ` AND wc.external_chat_id NOT LIKE '%@lid'`;
  if (filters.includeGroups !== "true") where += ` AND wc.external_chat_id NOT LIKE '%@g.us'`;
  where += ` AND wc.external_chat_id <> 'status@broadcast' AND wc.external_chat_id NOT LIKE '%@newsletter'`;
  if (filters.activeOnly === "true") {
    where += ` AND (cm.id IS NOT NULL OR wc.source = 'manual')`;
  }
  if (filters.onlyUseful === "true") {
    where += ` AND (
      NULLIF(wc.manual_alias, '') IS NOT NULL
      OR NULLIF(wc.whatsapp_name, '') IS NOT NULL
      OR NULLIF(wc.push_name, '') IS NOT NULL
      OR NULLIF(wc.notify_name, '') IS NOT NULL
      OR NULLIF(wc.verified_name, '') IS NOT NULL
      OR wc.phone IS NOT NULL
      OR cm.id IS NOT NULL
    )`;
  }
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where += ` AND (
      LOWER(COALESCE(wc.manual_alias, '')) LIKE $${params.length}
      OR LOWER(COALESCE(wc.whatsapp_name, '')) LIKE $${params.length}
      OR LOWER(COALESCE(wc.push_name, '')) LIKE $${params.length}
      OR LOWER(COALESCE(wc.notify_name, '')) LIKE $${params.length}
      OR LOWER(COALESCE(wc.verified_name, '')) LIKE $${params.length}
      OR LOWER(COALESCE(wc.phone, '')) LIKE $${params.length}
      OR LOWER(wc.external_chat_id) LIKE $${params.length}
    )`;
  }
  params.push(limit);
  const result = await pool.query(
    `SELECT ${contactProjection()}
     FROM whatsapp_contacts wc
     LEFT JOIN conversation_meta cm
       ON cm.user_id = wc.user_id AND cm.external_chat_id = wc.external_chat_id
     ${where}
     ORDER BY cm.last_message_at DESC NULLS LAST, wc.updated_at DESC
     LIMIT $${params.length}`,
    params
  );
  return attachChatAliases(userId, result.rows);
}

async function createContact(userId, payload = {}) {
  const alias = cleanText(payload.name || payload.alias);
  const phone = normalizeVisiblePhone(payload.phone);
  if (!alias) throw new ApiError(400, "invalid_contact_name", "Nombre de contacto invalido");
  if (!phone) throw new ApiError(400, "invalid_phone", "Telefono invalido");
  const chatId = chatIdFromPhone(phone);
  await upsertContact({
    userId,
    chatId,
    phone,
    alias,
    source: "manual",
    metadata: { source: "manual_create" },
    ensureConversation: true
  });
  const chat = await getChat(userId, chatId);
  chatRealtime.emitChatUpdated(userId, chatId, { reason: "contact_created", chat });
  return chat;
}

async function startConversation(userId, chatId) {
  const canonicalChatId = await resolveCanonicalChatId(userId, chatId);
  const result = await pool.query(
    `SELECT ${contactProjection()}
     FROM whatsapp_contacts wc
     LEFT JOIN conversation_meta cm
       ON cm.user_id = wc.user_id AND cm.external_chat_id = wc.external_chat_id
     WHERE wc.user_id = $1 AND wc.external_chat_id = $2`,
    [userId, canonicalChatId]
  );
  const contact = result.rows[0];
  if (!contact) {
    const existing = await pool.query(
      `SELECT id FROM conversation_meta WHERE user_id = $1 AND external_chat_id = $2`,
      [userId, canonicalChatId]
    );
    if (existing.rows[0]) return getChat(userId, canonicalChatId);
    throw new ApiError(404, "contact_not_found", "Contacto no encontrado");
  }
  await pool.query(
    `INSERT INTO conversation_meta (user_id, external_chat_id, display_name, phone)
     VALUES ($1::bigint, $2::varchar, $3::varchar, $4::varchar)
     ON CONFLICT (user_id, external_chat_id) DO UPDATE SET
       display_name = COALESCE(NULLIF($3::varchar, ''), conversation_meta.display_name),
       phone = COALESCE(NULLIF($4::varchar, ''), conversation_meta.phone),
       updated_at = NOW()`,
    [userId, canonicalChatId, contact.name, contact.phone]
  );
  const chat = await getChat(userId, canonicalChatId);
  chatRealtime.emitChatUpdated(userId, canonicalChatId, { reason: "conversation_started", chat });
  return chat;
}

async function updateContact(userId, chatId, patch = {}) {
  const canonicalChatId = await resolveCanonicalChatId(userId, chatId);
  const aliasProvided = patch.name !== undefined || patch.alias !== undefined;
  const phoneProvided = patch.phone !== undefined;
  if (!aliasProvided && !phoneProvided) throw new ApiError(400, "empty_patch", "Nada para actualizar");
  const alias = aliasProvided ? cleanText(patch.name || patch.alias) : null;
  const phone = phoneProvided ? normalizeVisiblePhone(patch.phone) : null;
  if (aliasProvided && !alias) throw new ApiError(400, "invalid_contact_name", "Nombre de contacto invalido");
  if (phoneProvided && !phone) throw new ApiError(400, "invalid_phone", "Telefono invalido");
  await upsertContact({
    userId,
    chatId: canonicalChatId,
    phone,
    alias,
    source: "manual",
    metadata: { source: "manual_update" },
    ensureConversation: true
  });
  await pool.query(
    `UPDATE conversation_meta
     SET display_name = COALESCE($3::varchar, display_name),
         phone = COALESCE($4::varchar, phone),
         updated_at = NOW()
     WHERE user_id = $1 AND external_chat_id = $2`,
    [userId, canonicalChatId, alias, phone]
  );
  const chat = await getChat(userId, canonicalChatId);
  chatRealtime.emitChatUpdated(userId, canonicalChatId, { reason: "contact_updated", chat });
  return chat;
}

async function getChatAiProfile(userId, chatId) {
  const canonicalChatId = await resolveCanonicalChatId(userId, chatId);
  const profile = await conversationProfileService.getPublicProfile(userId, canonicalChatId);
  return { chatId: canonicalChatId, profile };
}

async function updateChatAiProfile(userId, chatId, patch = {}) {
  const canonicalChatId = await resolveCanonicalChatId(userId, chatId);
  const profile = await conversationProfileService.updateProfile(userId, canonicalChatId, patch);
  return { chatId: canonicalChatId, profile };
}

async function resetChatAiProfile(userId, chatId) {
  const canonicalChatId = await resolveCanonicalChatId(userId, chatId);
  const profile = await conversationProfileService.resetProfile(userId, canonicalChatId);
  return { chatId: canonicalChatId, profile };
}

function normalizeChatIdForSend(chatId) {
  const value = cleanText(chatId);
  if (!value) throw new ApiError(400, "invalid_chat_id", "Chat invalido");
  if (value.includes("@")) return value;
  return chatIdFromPhone(value);
}

async function createOutgoingMessage(userId, chatId, body, options = {}) {
  const messageType = normalizeMessageType(options.messageType);
  const minimizedBody = minimizeMessageBody(body || fallbackBodyForMessageType(messageType));
  const safeBody = cleanText(minimizedBody.text);
  if (!safeBody) throw new ApiError(400, "empty_message", "Mensaje vacio");
  const safeChatId = normalizeChatIdForSend(chatId);
  const canonicalChatId = await resolveCanonicalChatId(userId, safeChatId, { phone: options.phone });
  if (canonicalChatId !== safeChatId) {
    await registerChatAlias(userId, canonicalChatId, safeChatId, {
      phone: options.phone,
      source: "outgoing_message_alias"
    }).catch(() => {});
  }
  const messageId = cleanText(options.localMessageId) || `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const phone = normalizeVisiblePhone(options.phone) || phoneFromChatId(canonicalChatId) || phoneFromChatId(safeChatId);
  const contact = await upsertContact({
    userId,
    chatId: canonicalChatId,
    phone,
    alias: options.displayName || null,
    source: options.source || "manual",
    metadata: { source: "outgoing_message" },
    ensureConversation: true
  }).catch(() => null);
  const displayName = firstText(
    contact?.manual_alias,
    contact?.whatsapp_name,
    contact?.push_name,
    contact?.notify_name,
    contact?.verified_name,
    options.displayName,
    phone,
    safeChatId
  );
  const sentAt = options.sentAt || new Date();
  await pool.query(
     `INSERT INTO message_cache (
       user_id, external_chat_id, external_message_id, sender, message_type,
       delivery_status, body, metadata, sent_at, expires_at
     )
     VALUES ($1::bigint, $2::varchar, $3::varchar, 'me', $4::varchar, 'sending', $5::text, $6::jsonb, $7::timestamptz, $8::timestamptz)
     ON CONFLICT (user_id, external_chat_id, external_message_id) DO UPDATE SET
       body = EXCLUDED.body,
       delivery_status = CASE
         WHEN message_cache.delivery_status = 'failed' THEN 'sending'
         ELSE message_cache.delivery_status
       END,
       error_message = NULL,
       metadata = message_cache.metadata || EXCLUDED.metadata,
       sent_at = EXCLUDED.sent_at,
       expires_at = GREATEST(message_cache.expires_at, EXCLUDED.expires_at)`,
    [userId, canonicalChatId, messageId, messageType, safeBody, JSON.stringify({ ...(options.metadata || {}), originalChatId: safeChatId, canonicalChatId, cachePolicy: config.whatsapp.contentCachePolicy, bodyTruncated: minimizedBody.truncated, originalBodyLength: minimizedBody.originalLength }), sentAt, messageExpiresAt(sentAt)]
  );
  await pool.query(
    `INSERT INTO conversation_meta (user_id, external_chat_id, display_name, phone, last_message_preview, last_message_at, unread_count)
     VALUES ($1::bigint, $2::varchar, $3::varchar, $4::varchar, $5::text, $6::timestamptz, 0)
     ON CONFLICT (user_id, external_chat_id) DO UPDATE SET
       display_name = CASE
         WHEN NULLIF(conversation_meta.display_name, '') IS NULL THEN COALESCE(NULLIF($3::varchar, ''), conversation_meta.display_name)
         WHEN conversation_meta.display_name = conversation_meta.external_chat_id THEN COALESCE(NULLIF($3::varchar, ''), conversation_meta.display_name)
         WHEN conversation_meta.phone IS NOT NULL AND conversation_meta.display_name = conversation_meta.phone THEN COALESCE(NULLIF($3::varchar, ''), conversation_meta.display_name)
         ELSE conversation_meta.display_name
       END,
       phone = COALESCE(NULLIF($4::varchar, ''), conversation_meta.phone),
       last_message_preview = CASE
         WHEN conversation_meta.last_message_at IS NULL OR $6::timestamptz >= conversation_meta.last_message_at
           THEN $5::text
         ELSE conversation_meta.last_message_preview
       END,
       last_message_at = GREATEST(COALESCE(conversation_meta.last_message_at, $6::timestamptz), $6::timestamptz),
       updated_at = NOW()`,
    [userId, canonicalChatId, displayName, phone, safeBody, sentAt]
  );
  chatRealtime.emitMessageCreated(userId, canonicalChatId, messageId, { status: "sending" });
  chatRealtime.emitChatUpdated(userId, canonicalChatId, { reason: "outgoing_created" });
  return {
    id: messageId,
    chatId: canonicalChatId,
    canonicalChatId,
    sender: "me",
    message_type: messageType,
    status: "sending",
    body: safeBody,
    metadata: options.metadata || {},
    sent_at: sentAt
  };
}

async function markOutgoingMessageSent(userId, chatId, localMessageId, sent = {}) {
  if (!localMessageId) return null;
  const safeChatId = normalizeChatIdForSend(chatId);
  const canonicalChatId = await resolveCanonicalChatId(userId, safeChatId, { phone: phoneFromChatId(safeChatId) });
  const providerMessageId = sent?.key?.id || sent?.id || null;
  const sentAt = new Date();
  const result = await pool.query(
    `UPDATE message_cache
     SET delivery_status = 'sent',
         error_message = NULL,
         metadata = metadata || $4::jsonb,
         sent_at = COALESCE(sent_at, $5::timestamptz)
     WHERE user_id = $1 AND external_chat_id = $2 AND external_message_id = $3
     RETURNING external_chat_id AS chat_id, external_message_id AS id, sender, message_type, delivery_status AS status, error_message, body, metadata, sent_at`,
    [
      userId,
      canonicalChatId,
      localMessageId,
      JSON.stringify({ providerMessageId, providerRemoteJid: sent?.key?.remoteJid || safeChatId, sentConfirmedAt: sentAt, originalChatId: safeChatId, canonicalChatId }),
      sentAt
    ]
  );
  if (result.rows[0]) {
    chatRealtime.emitMessageUpdated(userId, canonicalChatId, localMessageId, { status: "sent" });
    chatRealtime.emitChatUpdated(userId, canonicalChatId, { reason: "message_sent" });
  }
  return result.rows[0] || null;
}

async function markOutgoingMessageFailed(userId, chatId, localMessageId, error) {
  if (!localMessageId) return null;
  const safeChatId = normalizeChatIdForSend(chatId);
  const canonicalChatId = await resolveCanonicalChatId(userId, safeChatId, { phone: phoneFromChatId(safeChatId) });
  const message = String(error?.message || "No se pudo enviar el mensaje").slice(0, 1000);
  const result = await pool.query(
    `UPDATE message_cache
     SET delivery_status = 'failed',
         error_message = $4::text,
         metadata = metadata || $5::jsonb
     WHERE user_id = $1 AND external_chat_id = $2 AND external_message_id = $3
     RETURNING external_message_id AS id, sender, message_type, delivery_status AS status, error_message, body, metadata, sent_at`,
    [userId, canonicalChatId, localMessageId, message, JSON.stringify({ failedAt: new Date(), errorCode: error?.code || error?.name || null, originalChatId: safeChatId })]
  );
  if (result.rows[0]) {
    chatRealtime.emitMessageUpdated(userId, canonicalChatId, localMessageId, { status: "failed", errorMessage: message });
    chatRealtime.emitChatUpdated(userId, canonicalChatId, { reason: "message_failed" });
  }
  return result.rows[0] || null;
}

function normalizeDeliveryStatus(status) {
  if (typeof status === "number") {
    if (status >= 4) return "read";
    if (status === 3) return "delivered";
    if (status === 1 || status === 2) return "sent";
    if (status < 0) return "failed";
  }
  const raw = String(status || "").trim().toLowerCase();
  if (["read", "played"].includes(raw)) return "read";
  if (["delivery", "delivered"].includes(raw)) return "delivered";
  if (["server", "sent", "pending"].includes(raw)) return "sent";
  if (["error", "failed"].includes(raw)) return "failed";
  return null;
}

async function updateOutgoingMessageStatus(userId, providerMessageId, status, details = {}) {
  const safeProviderMessageId = cleanText(providerMessageId);
  const normalizedStatus = normalizeDeliveryStatus(status);
  if (!safeProviderMessageId || !normalizedStatus) return null;
  const result = await pool.query(
    `UPDATE message_cache
     SET delivery_status = CASE
           WHEN delivery_status = 'read' THEN delivery_status
           WHEN delivery_status = 'delivered' AND $3::varchar = 'sent' THEN delivery_status
           WHEN delivery_status = 'failed' AND $3::varchar IN ('sent', 'delivered', 'read') THEN $3::varchar
           ELSE $3::varchar
         END,
         error_message = CASE WHEN $3::varchar = 'failed' THEN COALESCE($5::text, error_message) ELSE NULL END,
         metadata = metadata || $4::jsonb
     WHERE user_id = $1
       AND sender = 'me'
       AND metadata->>'providerMessageId' = $2
     RETURNING external_chat_id AS chat_id, external_message_id AS id, sender, message_type, delivery_status AS status, error_message, body, metadata, sent_at`,
    [
      userId,
      safeProviderMessageId,
      normalizedStatus,
      JSON.stringify({
        lastDeliveryStatusAt: new Date(),
        providerDeliveryStatus: status,
        providerMessageId: safeProviderMessageId,
        ...(details || {})
      }),
      details?.errorMessage ? String(details.errorMessage).slice(0, 1000) : null
    ]
  );
  const row = result.rows[0];
  if (row) {
    chatRealtime.emitMessageUpdated(userId, row.chat_id, row.id, {
      status: row.status,
      errorMessage: row.error_message || null,
      providerMessageId: safeProviderMessageId
    });
    chatRealtime.emitChatUpdated(userId, row.chat_id, { reason: "message_status", status: row.status });
  }
  return row || null;
}

function publicMessageRow(row = {}) {
  if (!row) return null;
  return {
    id: row.external_message_id || row.id,
    external_message_id: row.external_message_id || row.id,
    chat_id: row.external_chat_id || row.chat_id,
    sender: row.sender,
    message_type: row.message_type,
    status: row.delivery_status || row.status || "sent",
    delivery_status: row.delivery_status || row.status || "sent",
    error_message: row.error_message || null,
    body: row.deleted_at ? null : row.body,
    metadata: row.metadata || {},
    sent_at: row.sent_at,
    edited_at: row.edited_at || null,
    deleted_at: row.deleted_at || null,
    deleted_scope: row.deleted_scope || null,
  };
}

function isLocalOnlyMessageId(messageId) {
  return String(messageId || "").startsWith("local_");
}

function getProviderMessageId(row = {}) {
  const metadata = row.metadata || {};
  const fromMetadata = cleanText(metadata.providerMessageId);
  if (fromMetadata) return fromMetadata;
  const externalMessageId = cleanText(row.external_message_id || row.id);
  if (externalMessageId && !isLocalOnlyMessageId(externalMessageId)) return externalMessageId;
  return null;
}

function getCachedMessageTimestamp(row = {}) {
  const value = row.sent_at || row.created_at || Date.now();
  const timestamp = new Date(value).getTime();
  return Math.floor((Number.isFinite(timestamp) ? timestamp : Date.now()) / 1000);
}

function buildCachedMessageKey(row = {}) {
  const metadata = row.metadata || {};
  const providerMessageId = getProviderMessageId(row);
  const remoteJid =
    cleanText(metadata.providerRemoteJid) ||
    cleanText(metadata.remoteJid) ||
    cleanText(metadata.originalChatId) ||
    cleanText(row.external_chat_id || row.chat_id);

  if (!providerMessageId || !remoteJid) {
    throw new ApiError(409, "message_key_unavailable", "No se pudo resolver la clave de WhatsApp para este mensaje");
  }

  const key = {
    remoteJid,
    id: providerMessageId,
    fromMe: row.sender === "me",
  };
  const participant = cleanText(metadata.participant);
  if (participant) key.participant = participant;

  return {
    key,
    timestamp: getCachedMessageTimestamp(row),
    providerMessageId,
  };
}

async function getMessageForAction(userId, chatId, messageId) {
  const canonicalChatId = await resolveCanonicalChatId(userId, chatId);
  const safeMessageId = cleanText(messageId);
  if (!safeMessageId) {
    throw new ApiError(400, "message_required", "El mensaje es obligatorio");
  }

  const { rows } = await pool.query(
    `SELECT *
     FROM message_cache
     WHERE user_id = $1
       AND external_chat_id = $2
       AND (external_message_id = $3 OR metadata->>'providerMessageId' = $3)
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, canonicalChatId, safeMessageId]
  );

  const row = rows[0];
  if (!row) {
    throw new ApiError(404, "message_not_found", "No se encontró el mensaje");
  }

  return {
    row,
    chatId: row.external_chat_id,
    messageId: row.external_message_id,
    ...buildCachedMessageKey(row),
  };
}

async function prepareMessageEdit(userId, chatId, messageId, text) {
  const prepared = await getMessageForAction(userId, chatId, messageId);
  const nextText = cleanText(text);

  if (!nextText) {
    throw new ApiError(400, "message_text_required", "El texto es obligatorio");
  }
  if (prepared.row.sender !== "me") {
    throw new ApiError(403, "message_edit_forbidden", "Solo puedes editar mensajes propios");
  }
  if (prepared.row.message_type !== "text") {
    throw new ApiError(400, "message_edit_text_only", "Solo se pueden editar mensajes de texto");
  }
  if (prepared.row.deleted_at) {
    throw new ApiError(409, "message_deleted", "No se puede editar un mensaje eliminado");
  }

  return { ...prepared, text: nextText };
}

async function prepareMessageDelete(userId, chatId, messageId, scope = "me") {
  const prepared = await getMessageForAction(userId, chatId, messageId);
  const normalizedScope = scope === "everyone" ? "everyone" : "me";

  if (normalizedScope === "everyone" && prepared.row.sender !== "me") {
    throw new ApiError(403, "message_delete_for_everyone_forbidden", "Solo puedes eliminar para todos tus propios mensajes");
  }

  return { ...prepared, scope: normalizedScope };
}

async function markMessageEdited(userId, chatId, messageId, text, details = {}) {
  const canonicalChatId = await resolveCanonicalChatId(userId, chatId);
  const safeMessageId = cleanText(messageId);
  const safeText = cleanText(text);
  if (!safeMessageId || !safeText) {
    throw new ApiError(400, "message_edit_invalid", "El mensaje y el texto son obligatorios");
  }

  const metadataPatch = JSON.stringify({ ...details, editedAt: new Date().toISOString() });
  const { rows } = await pool.query(
    `UPDATE message_cache
     SET body = $4,
         edited_at = NOW(),
         deleted_at = NULL,
         deleted_scope = NULL,
         metadata = metadata || $5::jsonb
     WHERE user_id = $1
       AND external_chat_id = $2
       AND (external_message_id = $3 OR metadata->>'providerMessageId' = $3)
     RETURNING *`,
    [userId, canonicalChatId, safeMessageId, safeText, metadataPatch]
  );

  const row = rows[0];
  if (!row) {
    throw new ApiError(404, "message_not_found", "No se encontró el mensaje");
  }

  await pool.query(
    `UPDATE conversation_meta
     SET last_message_preview = $3,
         updated_at = NOW()
     WHERE user_id = $1
       AND external_chat_id = $2
       AND (last_message_at IS NULL OR last_message_at <= $4::timestamptz + INTERVAL '1 second')`,
    [userId, row.external_chat_id, safeText, row.sent_at]
  );

  const message = publicMessageRow(row);
  chatRealtime.emitMessageUpdated(userId, row.external_chat_id, row.external_message_id, { message, edited: true });
  chatRealtime.emitChatUpdated(userId, row.external_chat_id, { reason: "message_edited", preview: safeText });
  return message;
}

async function markMessageDeleted(userId, chatId, messageId, scope = "me", details = {}) {
  const canonicalChatId = await resolveCanonicalChatId(userId, chatId);
  const safeMessageId = cleanText(messageId);
  const normalizedScope = scope === "everyone" ? "everyone" : "me";
  if (!safeMessageId) {
    throw new ApiError(400, "message_required", "El mensaje es obligatorio");
  }

  const metadataPatch = JSON.stringify({
    ...details,
    deletedAt: new Date().toISOString(),
    deletedScope: normalizedScope,
  });
  const { rows } = await pool.query(
    `UPDATE message_cache
     SET body = NULL,
         deleted_at = COALESCE(deleted_at, NOW()),
         deleted_scope = $4,
         metadata = metadata || $5::jsonb
     WHERE user_id = $1
       AND external_chat_id = $2
       AND (external_message_id = $3 OR metadata->>'providerMessageId' = $3)
     RETURNING *`,
    [userId, canonicalChatId, safeMessageId, normalizedScope, metadataPatch]
  );

  const row = rows[0];
  if (!row) {
    throw new ApiError(404, "message_not_found", "No se encontró el mensaje");
  }

  await pool.query(
    `UPDATE conversation_meta
     SET last_message_preview = $3,
         updated_at = NOW()
     WHERE user_id = $1
       AND external_chat_id = $2
       AND (last_message_at IS NULL OR last_message_at <= $4::timestamptz + INTERVAL '1 second')`,
    [userId, row.external_chat_id, "Mensaje eliminado", row.sent_at]
  );

  const message = publicMessageRow(row);
  chatRealtime.emitMessageDeleted(userId, row.external_chat_id, row.external_message_id, { message, scope: normalizedScope });
  chatRealtime.emitChatUpdated(userId, row.external_chat_id, { reason: "message_deleted", preview: "Mensaje eliminado" });
  return message;
}

async function markProviderMessageEdited(userId, providerMessageId, chatId, text, details = {}) {
  const safeProviderMessageId = cleanText(providerMessageId);
  const safeText = cleanText(text);
  if (!safeProviderMessageId || !safeText) return null;

  const rawChatId = cleanText(chatId);
  let canonicalChatId = null;
  if (rawChatId) {
    try {
      canonicalChatId = await resolveCanonicalChatId(userId, rawChatId);
    } catch (_) {
      canonicalChatId = rawChatId;
    }
  }

  const params = [
    userId,
    safeProviderMessageId,
    safeText,
    JSON.stringify({ ...details, editedAt: new Date().toISOString() }),
  ];
  let chatClause = "";
  if (canonicalChatId) {
    params.push(canonicalChatId, rawChatId);
    chatClause = `AND (
      external_chat_id = $5
      OR metadata->>'remoteJid' = $6
      OR metadata->>'providerRemoteJid' = $6
      OR metadata->>'originalChatId' = $6
    )`;
  }

  const { rows } = await pool.query(
    `UPDATE message_cache
     SET body = $3,
         edited_at = NOW(),
         metadata = metadata || $4::jsonb
     WHERE user_id = $1
       AND (external_message_id = $2 OR metadata->>'providerMessageId' = $2)
       AND deleted_at IS NULL
       ${chatClause}
     RETURNING *`,
    params
  );

  const row = rows[0];
  if (!row) return null;
  await pool.query(
    `UPDATE conversation_meta
     SET last_message_preview = $3,
         updated_at = NOW()
     WHERE user_id = $1
       AND external_chat_id = $2
       AND (last_message_at IS NULL OR last_message_at <= $4::timestamptz + INTERVAL '1 second')`,
    [userId, row.external_chat_id, safeText, row.sent_at]
  );
  const message = publicMessageRow(row);
  chatRealtime.emitMessageUpdated(userId, row.external_chat_id, row.external_message_id, { message, edited: true });
  chatRealtime.emitChatUpdated(userId, row.external_chat_id, { reason: "message_edited", preview: safeText });
  return message;
}

async function markProviderMessageDeleted(userId, providerMessageId, chatId, scope = "everyone", details = {}) {
  const safeProviderMessageId = cleanText(providerMessageId);
  if (!safeProviderMessageId) return null;

  const rawChatId = cleanText(chatId);
  let canonicalChatId = null;
  if (rawChatId) {
    try {
      canonicalChatId = await resolveCanonicalChatId(userId, rawChatId);
    } catch (_) {
      canonicalChatId = rawChatId;
    }
  }

  const normalizedScope = scope === "me" ? "me" : "everyone";
  const params = [
    userId,
    safeProviderMessageId,
    normalizedScope,
    JSON.stringify({ ...details, deletedAt: new Date().toISOString(), deletedScope: normalizedScope }),
  ];
  let chatClause = "";
  if (canonicalChatId) {
    params.push(canonicalChatId, rawChatId);
    chatClause = `AND (
      external_chat_id = $5
      OR metadata->>'remoteJid' = $6
      OR metadata->>'providerRemoteJid' = $6
      OR metadata->>'originalChatId' = $6
    )`;
  }

  const { rows } = await pool.query(
    `UPDATE message_cache
     SET body = NULL,
         deleted_at = COALESCE(deleted_at, NOW()),
         deleted_scope = $3,
         metadata = metadata || $4::jsonb
     WHERE user_id = $1
       AND (external_message_id = $2 OR metadata->>'providerMessageId' = $2)
       ${chatClause}
     RETURNING *`,
    params
  );

  const row = rows[0];
  if (!row) return null;
  await pool.query(
    `UPDATE conversation_meta
     SET last_message_preview = $3,
         updated_at = NOW()
     WHERE user_id = $1
       AND external_chat_id = $2
       AND (last_message_at IS NULL OR last_message_at <= $4::timestamptz + INTERVAL '1 second')`,
    [userId, row.external_chat_id, "Mensaje eliminado", row.sent_at]
  );
  const message = publicMessageRow(row);
  chatRealtime.emitMessageDeleted(userId, row.external_chat_id, row.external_message_id, { message, scope: normalizedScope });
  chatRealtime.emitChatUpdated(userId, row.external_chat_id, { reason: "message_deleted", preview: "Mensaje eliminado" });
  return message;
}

async function findOutgoingMessageByProviderMessageId(userId, providerMessageId) {
  const safeProviderMessageId = cleanText(providerMessageId);
  if (!safeProviderMessageId) return null;
  const result = await pool.query(
    `SELECT external_chat_id, external_message_id
     FROM message_cache
     WHERE user_id = $1
       AND sender = 'me'
       AND metadata->>'providerMessageId' = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, safeProviderMessageId]
  );
  const row = result.rows[0];
  return row ? { chatId: row.external_chat_id, messageId: row.external_message_id } : null;
}

async function findOutgoingChatByProviderMessageId(userId, providerMessageId) {
  const found = await findOutgoingMessageByProviderMessageId(userId, providerMessageId);
  return found?.chatId || null;
}

async function findRecentOutgoingEchoCandidate(userId, chatId, body, sentAt = new Date(), messageType = null) {
  const safeChatId = cleanText(chatId);
  const safeBody = cleanText(body);
  const safeMessageType = cleanText(messageType);
  if (!safeChatId || (!safeBody && !safeMessageType)) return null;
  const canonicalChatId = await resolveCanonicalChatId(userId, safeChatId, {
    phone: phoneFromChatId(safeChatId)
  }).catch(() => safeChatId);
  const referenceDate = sentAt instanceof Date ? sentAt : new Date(sentAt);
  const referenceAt = Number.isFinite(referenceDate.getTime()) ? referenceDate : new Date();
  const result = await pool.query(
    `SELECT external_chat_id, external_message_id
     FROM message_cache
     WHERE user_id = $1
       AND sender = 'me'
       AND (
         ($2::text <> '' AND body = $2::text)
         OR ($6::text <> '' AND message_type = $6::text)
         OR ($6::text <> '' AND metadata->>'mediaType' = $6::text)
       )
       AND delivery_status IN ('sending', 'sent')
       AND created_at >= NOW() - INTERVAL '10 minutes'
       AND sent_at BETWEEN ($3::timestamptz - INTERVAL '5 minutes') AND ($3::timestamptz + INTERVAL '5 minutes')
       AND (
         external_chat_id = $5
         OR metadata->>'providerRemoteJid' = $4
         OR metadata->>'originalChatId' = $4
         OR COALESCE(metadata->>'source', '') IN ('api_queue', 'api_direct', 'sendMessage_direct')
       )
     ORDER BY
       CASE
         WHEN external_chat_id = $5 THEN 0
         WHEN metadata->>'providerRemoteJid' = $4 THEN 1
         WHEN metadata->>'originalChatId' = $4 THEN 2
         ELSE 3
       END,
       CASE
         WHEN $2::text <> '' AND body = $2::text THEN 0
         WHEN $6::text <> '' AND message_type = $6::text THEN 1
         WHEN $6::text <> '' AND metadata->>'mediaType' = $6::text THEN 2
         ELSE 3
       END,
       ABS(EXTRACT(EPOCH FROM (sent_at - $3::timestamptz))) ASC,
       created_at DESC
     LIMIT 1`,
    [userId, safeBody || "", referenceAt, safeChatId, canonicalChatId, safeMessageType || ""]
  );
  const row = result.rows[0];
  return row ? { chatId: row.external_chat_id, messageId: row.external_message_id } : null;
}

async function cacheMessageMedia({
  userId,
  chatId,
  messageId,
  mediaType,
  mimeType = null,
  fileName = null,
  data,
  metadata = {},
  sentAt = new Date()
}) {
  const safeChatId = cleanText(chatId);
  const safeMessageId = cleanText(messageId);
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data || []);
  if (!safeChatId || !safeMessageId || buffer.length === 0) return { cached: false, reason: "empty" };
  const canonicalChatId = await resolveCanonicalChatId(userId, safeChatId, {
    phone: metadata?.phone || phoneFromChatId(safeChatId)
  });
  if (canonicalChatId !== safeChatId) {
    await registerChatAlias(userId, canonicalChatId, safeChatId, {
      phone: metadata?.phone || phoneFromChatId(safeChatId),
      source: "media_alias"
    }).catch(() => {});
  }
  const maxBytes = Number(config.whatsapp.mediaCacheMaxBytes || 0);
  if (maxBytes <= 0) return { cached: false, reason: "disabled" };
  if (buffer.length > maxBytes) {
    await pool.query(
      `UPDATE message_cache
       SET metadata = metadata || $4::jsonb
       WHERE user_id = $1 AND external_chat_id = $2 AND external_message_id = $3`,
      [userId, canonicalChatId, safeMessageId, JSON.stringify({ mediaSkipped: true, mediaSkipReason: "too_large", mediaSizeBytes: buffer.length, originalChatId: safeChatId, cachePolicy: config.whatsapp.contentCachePolicy })]
    );
    return { cached: false, reason: "too_large", sizeBytes: buffer.length, maxBytes };
  }
  const expiresAt = mediaExpiresAt(sentAt);
  const result = await pool.query(
    `INSERT INTO message_media_cache (
       user_id, external_chat_id, external_message_id, media_type, mime_type,
       file_name, size_bytes, data, metadata, expires_at
     )
     VALUES ($1::bigint, $2::varchar, $3::varchar, $4::varchar, $5::varchar, $6::varchar, $7::int, $8::bytea, $9::jsonb, $10::timestamptz)
     ON CONFLICT (user_id, external_chat_id, external_message_id) DO UPDATE SET
       media_type = EXCLUDED.media_type,
       mime_type = EXCLUDED.mime_type,
       file_name = EXCLUDED.file_name,
       size_bytes = EXCLUDED.size_bytes,
       data = EXCLUDED.data,
       metadata = message_media_cache.metadata || EXCLUDED.metadata,
       expires_at = EXCLUDED.expires_at
     RETURNING id`,
    [userId, canonicalChatId, safeMessageId, mediaType, mimeType, fileName, buffer.length, buffer, JSON.stringify({ ...(metadata || {}), originalChatId: safeChatId, cachePolicy: config.whatsapp.contentCachePolicy }), expiresAt]
  );
  await pool.query(
    `UPDATE message_cache
     SET metadata = metadata || $4::jsonb
     WHERE user_id = $1 AND external_chat_id = $2 AND external_message_id = $3`,
    [userId, canonicalChatId, safeMessageId, JSON.stringify({ hasMedia: true, mediaType, mimeType, fileName, sizeBytes: buffer.length, originalChatId: safeChatId, cachePolicy: config.whatsapp.contentCachePolicy })]
  );
  chatRealtime.emitMessageUpdated(userId, canonicalChatId, safeMessageId, { status: "media_cached", mediaType, mimeType, sizeBytes: buffer.length });
  chatRealtime.emitChatUpdated(userId, canonicalChatId, { reason: "media_cached" });
  return { cached: result.rowCount > 0, sizeBytes: buffer.length };
}

async function getMessageMediaDescriptor(userId, chatId, messageId) {
  const canonicalChatId = await resolveCanonicalChatId(userId, chatId);
  const result = await pool.query(
    `SELECT external_message_id, message_type, metadata, body
     FROM message_cache
     WHERE user_id = $1 AND external_chat_id = $2 AND external_message_id = $3 AND expires_at > NOW()`,
    [userId, canonicalChatId, messageId]
  );
  const row = result.rows[0];
  if (!row) throw new ApiError(404, "media_not_found", "Media no encontrada o expirada");
  const metadata = row.metadata || {};
  if (!metadata.hasMedia || metadata.viewOnce) throw new ApiError(404, "media_not_found", "Media no disponible");
  return {
    externalMessageId: row.external_message_id,
    messageType: row.message_type,
    mediaType: metadata.mediaType || row.message_type,
    mimeType: metadata.mimeType || "application/octet-stream",
    fileName: metadata.fileName || row.external_message_id,
    sizeBytes: Number(metadata.sizeBytes || 0),
    mediaKey: metadata.mediaKey || null,
    directPath: metadata.directPath || null,
    url: metadata.url || null,
    body: row.body || null,
    metadata
  };
}

async function getMessageMedia(userId, chatId, messageId) {
  const canonicalChatId = await resolveCanonicalChatId(userId, chatId);
  const result = await pool.query(
    `SELECT media_type, mime_type, file_name, size_bytes, data, metadata, created_at
     FROM message_media_cache
     WHERE user_id = $1 AND external_chat_id = $2 AND external_message_id = $3 AND expires_at > NOW()`,
    [userId, canonicalChatId, messageId]
  );
  if (!result.rows[0]) throw new ApiError(404, "media_not_found", "Media no encontrada o expirada");
  return result.rows[0];
}

async function getChatCacheDiagnostics(userId) {
  const params = [];
  const where = userId ? "WHERE user_id = $1" : "";
  const messageWhere = (condition) => userId ? `WHERE user_id = $1 AND ${condition}` : `WHERE ${condition}`;
  if (userId) params.push(userId);
  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM conversation_meta ${where}) AS conversations,
       (SELECT COUNT(*)::int FROM whatsapp_contacts ${where}) AS contacts,
       (SELECT COUNT(*)::int FROM message_cache ${where}) AS messages,
       (SELECT COUNT(*)::int FROM message_cache ${messageWhere("sender = 'match'")}) AS received_messages,
       (SELECT COUNT(*)::int FROM message_cache ${messageWhere("sender = 'me'")}) AS sent_messages,
       (SELECT COUNT(*)::int FROM message_cache ${messageWhere("delivery_status = 'sending'")}) AS sending_messages,
       (SELECT COUNT(*)::int FROM message_cache ${messageWhere("delivery_status = 'failed'")}) AS failed_messages,
       (SELECT COUNT(*)::int FROM message_cache ${messageWhere("expires_at <= NOW()")}) AS expired_messages,
       (SELECT COUNT(*)::int FROM message_media_cache ${where}) AS media_items,
       (SELECT COALESCE(SUM(size_bytes), 0)::bigint FROM message_media_cache ${where}) AS media_bytes,
       (SELECT MAX(created_at) FROM message_cache ${where}) AS last_message_cached_at`,
    params
  );
  return {
    ...result.rows[0],
    retentionDays: config.whatsapp.messageCacheRetentionDays,
    contentPolicy: contentCachePolicy()
  };
}

function normalizePhoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

function normalizeNameKey(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
  if (!text || text.length < 3) return null;
  if (/@(s\.whatsapp\.net|lid|g\.us)$/i.test(text)) return null;
  if (/^\+?\d[\d\s().-]{6,}$/.test(text)) return null;
  return text;
}

function candidateName(row = {}) {
  return firstText(
    row.manual_alias,
    row.whatsapp_name,
    row.push_name,
    row.notify_name,
    row.verified_name,
    row.display_name,
    row.phone,
    row.external_chat_id
  );
}

function candidateActivityScore(row = {}) {
  const lastMessageAt = row.last_message_at ? new Date(row.last_message_at).getTime() : 0;
  const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
  return Math.max(lastMessageAt || 0, updatedAt || 0) + Number(row.message_count || 0) * 1000 + Number(row.media_count || 0) * 100;
}

function buildDuplicateProposal(kind, key, rows = []) {
  const candidates = rows
    .map((row) => ({
      userId: Number(row.user_id),
      chatId: row.external_chat_id,
      canonicalChatId: row.canonical_chat_id || row.external_chat_id,
      name: candidateName(row),
      phone: row.phone || null,
      favorite: Boolean(row.favorite),
      muted: Boolean(row.muted),
      excluded: Boolean(row.excluded),
      unread: Number(row.unread_count || 0),
      messageCount: Number(row.message_count || 0),
      mediaCount: Number(row.media_count || 0),
      lastMessageAt: row.last_message_at || null,
      updatedAt: row.updated_at || null,
      aliases: Array.isArray(row.aliases) ? row.aliases.filter(Boolean) : [],
      score: candidateActivityScore(row)
    }))
    .sort((a, b) => b.score - a.score);
  const canonical = candidates[0] || null;
  return {
    kind,
    key,
    risk: kind === "phone" ? "high" : "review",
    recommendedCanonicalChatId: canonical?.chatId || null,
    duplicateChatIds: candidates.slice(1).map((candidate) => candidate.chatId),
    mergedFlags: {
      favorite: candidates.some((candidate) => candidate.favorite),
      muted: candidates.some((candidate) => candidate.muted),
      excluded: candidates.every((candidate) => candidate.excluded),
      unread: candidates.reduce((sum, candidate) => sum + candidate.unread, 0)
    },
    messageCount: candidates.reduce((sum, candidate) => sum + candidate.messageCount, 0),
    mediaCount: candidates.reduce((sum, candidate) => sum + candidate.mediaCount, 0),
    candidates
  };
}

async function getDuplicateChatDiagnostics(userId = null, options = {}) {
  const safeUserId = userId ? Number.parseInt(String(userId), 10) : null;
  const limit = Math.max(1, Math.min(100, Number(options.limit || 25)));
  const params = [];
  let where = "WHERE cm.external_chat_id NOT LIKE '%@g.us'";
  if (Number.isFinite(safeUserId) && safeUserId > 0) {
    params.push(safeUserId);
    where += ` AND cm.user_id = $${params.length}`;
  }
  const result = await pool.query(
    `SELECT
       cm.user_id,
       cm.external_chat_id,
       cm.display_name,
       COALESCE(wc.phone, cm.phone) AS phone,
       wc.manual_alias,
       wc.whatsapp_name,
       wc.push_name,
       wc.notify_name,
       wc.verified_name,
       wc.source AS contact_source,
       cm.favorite,
       cm.muted,
       cm.excluded,
       cm.unread_count,
       cm.last_message_at,
       cm.updated_at,
       COALESCE((
         SELECT COUNT(*)::int
         FROM message_cache m
         WHERE m.user_id = cm.user_id
           AND m.external_chat_id = cm.external_chat_id
       ), 0) AS message_count,
       COALESCE((
         SELECT COUNT(*)::int
         FROM message_media_cache mm
         WHERE mm.user_id = cm.user_id
           AND mm.external_chat_id = cm.external_chat_id
       ), 0) AS media_count,
       COALESCE((
         SELECT json_agg(alias_chat_id ORDER BY updated_at DESC)
         FROM whatsapp_chat_aliases a
         WHERE a.user_id = cm.user_id
           AND a.canonical_chat_id = cm.external_chat_id
       ), '[]'::json) AS aliases
     FROM conversation_meta cm
     LEFT JOIN whatsapp_contacts wc
       ON wc.user_id = cm.user_id
      AND wc.external_chat_id = cm.external_chat_id
     ${where}
     ORDER BY cm.user_id ASC, cm.last_message_at DESC NULLS LAST, cm.updated_at DESC`,
    params
  );

  const phoneGroups = new Map();
  const nameGroups = new Map();
  for (const row of result.rows) {
    const phoneKey = normalizePhoneDigits(row.phone);
    if (phoneKey) {
      const key = `${row.user_id}:phone:${phoneKey}`;
      phoneGroups.set(key, [...(phoneGroups.get(key) || []), row]);
    }
    const nameKey = normalizeNameKey(candidateName(row));
    if (nameKey && !phoneKey) {
      const key = `${row.user_id}:name:${nameKey}`;
      nameGroups.set(key, [...(nameGroups.get(key) || []), row]);
    }
  }

  const proposals = [
    ...Array.from(phoneGroups.entries())
      .filter(([, rows]) => new Set(rows.map((row) => row.external_chat_id)).size > 1)
      .map(([key, rows]) => buildDuplicateProposal("phone", key.split(":phone:")[1], rows)),
    ...Array.from(nameGroups.entries())
      .filter(([, rows]) => new Set(rows.map((row) => row.external_chat_id)).size > 1)
      .map(([key, rows]) => buildDuplicateProposal("name", key.split(":name:")[1], rows))
  ]
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, limit);

  return {
    userId: Number.isFinite(safeUserId) && safeUserId > 0 ? safeUserId : null,
    checkedAt: new Date().toISOString(),
    dryRun: true,
    candidateConversations: result.rows.length,
    probableDuplicateGroups: proposals.length,
    safeToAutoMergeGroups: proposals.filter((proposal) => proposal.kind === "phone" && proposal.duplicateChatIds.length > 0).length,
    requiresReviewGroups: proposals.filter((proposal) => proposal.kind !== "phone").length,
    proposals
  };
}

async function getChatSyncDiagnostics(userId = null) {
  const safeUserId = userId ? Number.parseInt(String(userId), 10) : null;
  const params = [];
  let where = "";
  if (Number.isFinite(safeUserId) && safeUserId > 0) {
    params.push(safeUserId);
    where = `WHERE user_id = $${params.length}`;
  }
  const userFilter = where || "";
  const messageFilter = userFilter ? `${userFilter} AND` : "WHERE";

  const summary = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM whatsapp_chat_aliases ${userFilter}) AS aliases,
       (SELECT COUNT(*)::int FROM whatsapp_chat_aliases ${messageFilter} updated_at >= NOW() - INTERVAL '24 hours') AS aliases_last_24h,
       (SELECT COUNT(*)::int FROM message_cache ${messageFilter} sender = 'me'
          AND delivery_status = 'sending'
          AND created_at < NOW() - INTERVAL '2 minutes'
          AND created_at >= NOW() - INTERVAL '24 hours') AS stuck_sending_messages,
       (SELECT COUNT(*)::int FROM message_cache ${messageFilter} sender = 'me'
          AND metadata->>'source' = 'messages.upsert'
          AND metadata->>'fromMe' = 'true'
          AND COALESCE(metadata->>'providerMessageId', '') = ''
          AND created_at >= NOW() - INTERVAL '24 hours') AS provider_echoes_without_local_match,
       (SELECT COUNT(*)::int FROM conversation_meta ${messageFilter} created_at >= NOW() - INTERVAL '24 hours') AS conversations_created_24h,
       (SELECT COUNT(*)::int
        FROM conversation_meta cm
        WHERE ($1::bigint IS NULL OR cm.user_id = $1::bigint)
          AND cm.created_at >= NOW() - INTERVAL '24 hours'
          AND NOT EXISTS (
            SELECT 1
            FROM message_cache m
            WHERE m.user_id = cm.user_id
              AND m.external_chat_id = cm.external_chat_id
              AND m.sender = 'match'
          )) AS conversations_without_incoming_24h`,
    Number.isFinite(safeUserId) && safeUserId > 0 ? [safeUserId] : [null]
  );

  const aliases = await pool.query(
    `SELECT canonical_chat_id, alias_chat_id, alias_type, phone, metadata, updated_at
     FROM whatsapp_chat_aliases
     WHERE ($1::bigint IS NULL OR user_id = $1::bigint)
     ORDER BY updated_at DESC
     LIMIT 25`,
    Number.isFinite(safeUserId) && safeUserId > 0 ? [safeUserId] : [null]
  );

  const unreconciled = await pool.query(
    `SELECT external_chat_id, external_message_id, delivery_status, metadata, created_at
     FROM message_cache
     WHERE ($1::bigint IS NULL OR user_id = $1::bigint)
       AND sender = 'me'
       AND created_at >= NOW() - INTERVAL '24 hours'
       AND (
         (delivery_status = 'sending' AND created_at < NOW() - INTERVAL '2 minutes')
         OR (
           metadata->>'source' = 'messages.upsert'
           AND metadata->>'fromMe' = 'true'
           AND COALESCE(metadata->>'providerMessageId', '') = ''
         )
       )
     ORDER BY created_at DESC
     LIMIT 25`,
    Number.isFinite(safeUserId) && safeUserId > 0 ? [safeUserId] : [null]
  );

  const row = summary.rows[0] || {};
  const alerts = [];
  if (Number(row.provider_echoes_without_local_match || 0) > 0) {
    alerts.push({
      code: "from_me_echo_unreconciled",
      level: "warn",
      message: "Hay ecos fromMe recientes que no parecen vinculados a un mensaje local."
    });
  }
  if (Number(row.stuck_sending_messages || 0) > 0) {
    alerts.push({
      code: "outgoing_stuck_sending",
      level: "warn",
      message: "Hay mensajes salientes en estado sending por mas de 2 minutos."
    });
  }
  if (Number(row.conversations_without_incoming_24h || 0) >= 5) {
    alerts.push({
      code: "conversation_growth_without_incoming",
      level: "warn",
      message: "Crecieron varias conversaciones sin mensajes entrantes; revisar duplicados o envios por alias."
    });
  }

  return {
    userId: Number.isFinite(safeUserId) && safeUserId > 0 ? safeUserId : null,
    checkedAt: new Date().toISOString(),
    summary: row,
    alerts,
    recentAliases: aliases.rows,
    recentUnreconciledOutgoing: unreconciled.rows
  };
}

async function purgeExpiredMessages(userId = null) {
  const params = [];
  let where = "WHERE expires_at <= NOW()";
  if (userId) {
    params.push(userId);
    where += ` AND user_id = $1`;
  }
  const mediaResult = await pool.query(`DELETE FROM message_media_cache ${where}`, params);
  const result = await pool.query(`DELETE FROM message_cache ${where}`, params);
  return { deleted: result.rowCount || 0, mediaDeleted: mediaResult.rowCount || 0, retentionDays: config.whatsapp.messageCacheRetentionDays, contentPolicy: contentCachePolicy() };
}

async function cacheMessage({
  userId,
  chatId,
  messageId,
  sender,
  body,
  messageType = "text",
  metadata = {},
  sentAt = new Date(),
  displayName = null,
  phone = null,
  incrementUnread = false
}) {
  const safeInputChatId = cleanText(chatId);
  if (!safeInputChatId) throw new ApiError(400, "invalid_chat_id", "Chat invalido");
  const safePhone = normalizeVisiblePhone(phone) || phoneFromChatId(safeInputChatId);
  const canonicalChatId = await resolveCanonicalChatId(userId, safeInputChatId, { phone: safePhone });
  if (canonicalChatId !== safeInputChatId) {
    await registerChatAlias(userId, canonicalChatId, safeInputChatId, {
      phone: safePhone,
      source: "cache_message_alias",
      metadata: { messageType }
    }).catch(() => {});
  }
  const safeMessageId = String(messageId || `local_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const minimizedBody = minimizeMessageBody(body);
  const safeBody = minimizedBody.text;
  const isGroupChat = String(canonicalChatId || "").endsWith("@g.us");
  const isFromMe = Boolean(metadata?.fromMe || sender === "me");
  const messageSenderName = firstText(metadata?.senderName, metadata?.participantName, metadata?.pushName);
  const contact = await upsertContact({
    userId,
    chatId: canonicalChatId,
    phone: safePhone,
    pushName: isGroupChat || isFromMe ? null : metadata?.pushName || displayName,
    whatsappName: metadata?.whatsappName || (isGroupChat ? displayName : null),
    notifyName: metadata?.notifyName || null,
    verifiedName: metadata?.verifiedName || null,
    avatarUrl: metadata?.avatarUrl || null,
    source: "message",
    metadata: { lastMessageType: messageType, lastMessageAt: sentAt, isGroup: isGroupChat }
  }).catch(() => null);
  const richConversationNameRaw = firstText(
    contact?.manual_alias,
    contact?.whatsapp_name,
    isGroupChat ? null : contact?.push_name,
    contact?.notify_name,
    contact?.verified_name,
    isGroupChat ? displayName : null
  );
  const richConversationName = isWeakDisplayName(richConversationNameRaw, canonicalChatId, safePhone) ? null : richConversationNameRaw;
  const resolvedDisplayName = firstText(
    richConversationName,
    displayName,
    phone,
    canonicalChatId
  );
  const messageInsert = await pool.query(
    `INSERT INTO message_cache (user_id, external_chat_id, external_message_id, sender, message_type, delivery_status, body, metadata, sent_at, expires_at)
     VALUES ($1::bigint, $2::varchar, $3::varchar, $4::varchar, $5::varchar, 'sent', $6::text, $7::jsonb, $8::timestamptz, $9::timestamptz)
     ON CONFLICT (user_id, external_chat_id, external_message_id) DO NOTHING
     RETURNING external_chat_id AS chat_id, external_message_id AS id, sender, message_type, delivery_status AS status,
       error_message, body, metadata, sent_at, edited_at, deleted_at, deleted_scope`,
    [userId, canonicalChatId, safeMessageId, sender, messageType, safeBody, JSON.stringify({ ...(metadata || {}), originalChatId: safeInputChatId, isGroup: isGroupChat, senderName: isGroupChat && !isFromMe ? messageSenderName : null, cachePolicy: config.whatsapp.contentCachePolicy, bodyTruncated: minimizedBody.truncated, originalBodyLength: minimizedBody.originalLength }), sentAt, messageExpiresAt(sentAt)]
  );
  const shouldIncrementUnread = Boolean(incrementUnread && messageInsert.rowCount > 0);
  const shouldUpdateDisplayName = Boolean((!isFromMe || isGroupChat) && richConversationName);
  await pool.query(
    `INSERT INTO conversation_meta (user_id, external_chat_id, display_name, phone, last_message_preview, last_message_at, unread_count)
     VALUES (
       $1::bigint,
       $2::varchar,
       COALESCE(NULLIF($3::varchar, ''), $2::varchar),
       NULLIF($4::varchar, ''),
       $5::text,
       $6::timestamptz,
       CASE WHEN $7::boolean THEN 1 ELSE 0 END
     )
     ON CONFLICT (user_id, external_chat_id) DO UPDATE SET
       display_name = CASE
         WHEN $8::boolean THEN COALESCE(EXCLUDED.display_name, conversation_meta.display_name)
         WHEN NULLIF(conversation_meta.display_name, '') IS NULL THEN COALESCE(EXCLUDED.display_name, conversation_meta.display_name)
         WHEN conversation_meta.display_name = conversation_meta.external_chat_id THEN COALESCE(EXCLUDED.display_name, conversation_meta.display_name)
         WHEN conversation_meta.phone IS NOT NULL AND conversation_meta.display_name = conversation_meta.phone THEN COALESCE(EXCLUDED.display_name, conversation_meta.display_name)
         ELSE conversation_meta.display_name
       END,
      phone = COALESCE(EXCLUDED.phone, conversation_meta.phone),
      excluded = CASE WHEN $7::boolean THEN FALSE ELSE conversation_meta.excluded END,
      last_message_preview = CASE
         WHEN conversation_meta.last_message_at IS NULL OR EXCLUDED.last_message_at >= conversation_meta.last_message_at
           THEN EXCLUDED.last_message_preview
         ELSE conversation_meta.last_message_preview
       END,
       last_message_at = GREATEST(COALESCE(conversation_meta.last_message_at, EXCLUDED.last_message_at), EXCLUDED.last_message_at),
       unread_count = conversation_meta.unread_count + CASE WHEN $7::boolean THEN 1 ELSE 0 END,
       updated_at = NOW()`,
    [userId, canonicalChatId, resolvedDisplayName, safePhone, safeBody, sentAt, shouldIncrementUnread, shouldUpdateDisplayName]
  );
  if (messageInsert.rowCount > 0) {
    const publicMessage = publicMessageRow(messageInsert.rows[0]);
    chatRealtime.emitMessageCreated(userId, canonicalChatId, safeMessageId, {
      status: "sent",
      sender,
      messageType,
      message: publicMessage
    });
    if (!isFromMe && shouldIncrementUnread) {
      const preview = safeBody || ({
        image: "Te enviaron una imagen",
        video: "Te enviaron un video",
        audio: "Te enviaron un audio",
        sticker: "Te enviaron un sticker",
        document: "Te enviaron un documento"
      }[messageType] || "Tienes un mensaje nuevo");
      pushService.notify(userId, "new_message", {
        title: resolvedDisplayName || "Nuevo mensaje",
        body: preview,
        chatId: canonicalChatId,
        target: "/",
        tag: `chat-${canonicalChatId}`,
        renotify: true
      }).catch((error) => logger.warn("push", "Could not send new message notification", {
        context: { userId, chatId: canonicalChatId, messageId: safeMessageId, error: error?.message || "push failed" }
      }));
    }
  }
  chatRealtime.emitChatUpdated(userId, canonicalChatId, { reason: "message_cached" });
  return { inserted: messageInsert.rowCount > 0, messageId: safeMessageId };
}

module.exports = {
  listChats,
  getChat,
  getMessages,
  markRead,
  updateChatMeta,
  listContacts,
  createContact,
  startConversation,
  updateContact,
  upsertContact,
  resolveCanonicalChatId,
  registerChatAlias,
  createOutgoingMessage,
  markOutgoingMessageSent,
  markOutgoingMessageFailed,
  updateOutgoingMessageStatus,
  getMessageForAction,
  prepareMessageEdit,
  prepareMessageDelete,
  markMessageEdited,
  markMessageDeleted,
  markProviderMessageEdited,
  markProviderMessageDeleted,
  findOutgoingMessageByProviderMessageId,
  findOutgoingChatByProviderMessageId,
  findRecentOutgoingEchoCandidate,
  cacheMessageMedia,
  getMessageMediaDescriptor,
  getMessageMedia,
  getChatCacheDiagnostics,
  getDuplicateChatDiagnostics,
  getChatSyncDiagnostics,
  getChatAiProfile,
  updateChatAiProfile,
  resetChatAiProfile,
  contentCachePolicy,
  purgeExpiredMessages,
  cacheMessage
};
