const { pool, withRetry } = require("../config/db");
const { config } = require("../config/env");

async function query(client, sql, params) {
  return client.query(sql, params);
}

async function seedSystemFlags(client) {
  await query(client, `
    INSERT INTO system_flags (key, value, description)
    VALUES
      ('maintenance', '{"enabled": false}'::jsonb, 'Global maintenance mode'),
      ('ai_provider_status', '{"openai": "unknown"}'::jsonb, 'AI provider health'),
      ('whatsapp_runtime', '{"mode": "combined"}'::jsonb, 'WhatsApp runtime mode')
    ON CONFLICT (key) DO NOTHING;
  `);
}

async function initDb() {
  const client = await withRetry(async () => pool.connect(), 5, 1500);
  try {
    const target = await query(client, `
      SELECT current_database() AS database, current_schema() AS schema, current_user AS username
    `);
    console.log(`[DB] Initializing WaFli database database=${target.rows[0].database} schema=${target.rows[0].schema} user=${target.rows[0].username}`);
    await query(client, "BEGIN");

    await query(client, `
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(50) UNIQUE,
        status VARCHAR(40) NOT NULL DEFAULT 'active',
        onboarding_status VARCHAR(40) NOT NULL DEFAULT 'pending',
        stripe_customer_id VARCHAR(255),
        default_plan VARCHAR(40) NOT NULL DEFAULT 'free',
        last_login_at TIMESTAMPTZ,
        pending_delete_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (email IS NOT NULL OR phone IS NOT NULL)
      );
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    `);
    await query(client, `
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
      CREATE INDEX IF NOT EXISTS idx_users_suspended_until ON users(suspended_until);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS user_sessions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_token_hash VARCHAR(128) NOT NULL UNIQUE,
        user_agent TEXT,
        ip_address VARCHAR(255),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS user_identities (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(40) NOT NULL,
        provider_subject VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        email_verified BOOLEAN NOT NULL DEFAULT FALSE,
        display_name VARCHAR(255),
        avatar_url TEXT,
        raw_claims JSONB NOT NULL DEFAULT '{}',
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (provider, provider_subject)
      );
      CREATE INDEX IF NOT EXISTS idx_user_identities_user ON user_identities(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_identities_email ON user_identities(email);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        alias VARCHAR(120),
        spanish_variant VARCHAR(40) NOT NULL DEFAULT 'Neutro',
        base_tone VARCHAR(40) NOT NULL DEFAULT 'Desenfadado',
        ui_language VARCHAR(10) NOT NULL DEFAULT 'ES',
        profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await query(client, `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT FALSE;`);
    await query(client, `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS spanish_variant_completed BOOLEAN NOT NULL DEFAULT FALSE;`);
    await query(client, `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS base_tone_completed BOOLEAN NOT NULL DEFAULT FALSE;`);

    await query(client, `
      CREATE TABLE IF NOT EXISTS legal_acceptances (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        terms_version VARCHAR(80) NOT NULL,
        privacy_version VARCHAR(80) NOT NULL,
        is_adult BOOLEAN NOT NULL DEFAULT FALSE,
        accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address VARCHAR(255),
        user_agent TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user ON legal_acceptances(user_id, accepted_at DESC);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS whatsapp_connections (
        user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        session_id VARCHAR(128) NOT NULL UNIQUE,
        phone VARCHAR(50),
        status VARCHAR(40) NOT NULL DEFAULT 'disconnected',
        pairing_code VARCHAR(40),
        pairing_code_expires_at TIMESTAMPTZ,
        qr TEXT,
        qr_updated_at TIMESTAMPTZ,
        last_heartbeat_at TIMESTAMPTZ,
        pause_reason TEXT,
        disconnect_reason TEXT,
        reconnect_attempts INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_status ON whatsapp_connections(status);
    `);

    await query(client, `
      ALTER TABLE whatsapp_connections
        ADD COLUMN IF NOT EXISTS qr TEXT,
        ADD COLUMN IF NOT EXISTS qr_updated_at TIMESTAMPTZ;
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS baileys_auth (
        session_id VARCHAR(128) NOT NULL,
        key_id VARCHAR(128) NOT NULL,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (session_id, key_id)
      );
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS whatsapp_pairing_guards (
        user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        attempt_timestamps JSONB NOT NULL DEFAULT '[]'::jsonb,
        blocked_until TIMESTAMPTZ,
        last_phone VARCHAR(50),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_whatsapp_pairing_guards_blocked ON whatsapp_pairing_guards(blocked_until);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS conversation_meta (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        external_chat_id VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        avatar_url TEXT,
        phone VARCHAR(50),
        favorite BOOLEAN NOT NULL DEFAULT FALSE,
        muted BOOLEAN NOT NULL DEFAULT FALSE,
        excluded BOOLEAN NOT NULL DEFAULT FALSE,
        unread_count INT NOT NULL DEFAULT 0,
        stale BOOLEAN NOT NULL DEFAULT FALSE,
        last_message_preview TEXT,
        last_message_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, external_chat_id)
      );
      CREATE INDEX IF NOT EXISTS idx_conversation_meta_user_last ON conversation_meta(user_id, last_message_at DESC NULLS LAST);
      CREATE INDEX IF NOT EXISTS idx_conversation_meta_user_flags ON conversation_meta(user_id, favorite, muted, excluded, stale);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS whatsapp_contacts (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        external_chat_id VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        manual_alias VARCHAR(255),
        whatsapp_name VARCHAR(255),
        push_name VARCHAR(255),
        notify_name VARCHAR(255),
        verified_name VARCHAR(255),
        avatar_url TEXT,
        source VARCHAR(40) NOT NULL DEFAULT 'whatsapp',
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, external_chat_id)
      );
      CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_user_name ON whatsapp_contacts(user_id, manual_alias, whatsapp_name, push_name);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_user_phone ON whatsapp_contacts(user_id, phone);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS whatsapp_chat_aliases (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        canonical_chat_id VARCHAR(255) NOT NULL,
        alias_chat_id VARCHAR(255) NOT NULL,
        alias_type VARCHAR(40) NOT NULL DEFAULT 'unknown',
        phone VARCHAR(50),
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, alias_chat_id)
      );
      CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_aliases_canonical ON whatsapp_chat_aliases(user_id, canonical_chat_id);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_aliases_phone ON whatsapp_chat_aliases(user_id, phone);
    `);

    await query(client, `
      INSERT INTO whatsapp_chat_aliases (
        user_id, canonical_chat_id, alias_chat_id, alias_type, phone, metadata
      )
      SELECT
        source_rows.user_id,
        source_rows.external_chat_id,
        source_rows.external_chat_id,
        CASE
          WHEN source_rows.external_chat_id LIKE '%@g.us' THEN 'group'
          WHEN source_rows.external_chat_id LIKE '%@lid' THEN 'lid'
          WHEN source_rows.external_chat_id LIKE '%@s.whatsapp.net' THEN 'phone_jid'
          WHEN source_rows.external_chat_id LIKE '%@%' THEN 'jid'
          ELSE 'unknown'
        END,
        NULLIF(source_rows.phone, ''),
        jsonb_build_object('source', 'backfill_self_alias')
      FROM (
        SELECT user_id, external_chat_id, phone FROM conversation_meta
        UNION
        SELECT user_id, external_chat_id, phone FROM whatsapp_contacts
      ) source_rows
      WHERE NULLIF(source_rows.external_chat_id, '') IS NOT NULL
      ON CONFLICT (user_id, alias_chat_id) DO UPDATE SET
        phone = COALESCE(EXCLUDED.phone, whatsapp_chat_aliases.phone),
        metadata = whatsapp_chat_aliases.metadata || EXCLUDED.metadata,
        updated_at = NOW();
    `);

    await query(client, `
      WITH candidates AS (
        SELECT user_id, external_chat_id, phone, last_message_at, updated_at, 1 AS source_rank
        FROM conversation_meta
        WHERE NULLIF(phone, '') IS NOT NULL
          AND external_chat_id NOT LIKE '%@g.us'
        UNION ALL
        SELECT user_id, external_chat_id, phone, NULL::timestamptz AS last_message_at, updated_at, 2 AS source_rank
        FROM whatsapp_contacts
        WHERE NULLIF(phone, '') IS NOT NULL
          AND external_chat_id NOT LIKE '%@g.us'
      ),
      normalized AS (
        SELECT
          user_id,
          external_chat_id,
          regexp_replace(phone, '[^0-9]', '', 'g') AS phone_digits,
          phone,
          last_message_at,
          updated_at,
          source_rank
        FROM candidates
        WHERE NULLIF(external_chat_id, '') IS NOT NULL
      ),
      safe_phones AS (
        SELECT user_id, phone_digits
        FROM normalized
        WHERE length(phone_digits) >= 7
        GROUP BY user_id, phone_digits
        HAVING COUNT(DISTINCT external_chat_id) = 1
      ),
      chosen AS (
        SELECT DISTINCT ON (n.user_id, n.phone_digits)
          n.user_id,
          n.external_chat_id AS canonical_chat_id,
          CONCAT(n.phone_digits, '@s.whatsapp.net') AS alias_chat_id,
          CONCAT('+', n.phone_digits) AS phone
        FROM normalized n
        JOIN safe_phones sp
          ON sp.user_id = n.user_id
         AND sp.phone_digits = n.phone_digits
        ORDER BY n.user_id, n.phone_digits, n.source_rank ASC, n.last_message_at DESC NULLS LAST, n.updated_at DESC
      )
      INSERT INTO whatsapp_chat_aliases (
        user_id, canonical_chat_id, alias_chat_id, alias_type, phone, metadata
      )
      SELECT
        user_id,
        canonical_chat_id,
        alias_chat_id,
        'phone_jid',
        phone,
        jsonb_build_object('source', 'backfill_unique_phone_alias')
      FROM chosen
      ON CONFLICT (user_id, alias_chat_id) DO UPDATE SET
        phone = COALESCE(EXCLUDED.phone, whatsapp_chat_aliases.phone),
        metadata = whatsapp_chat_aliases.metadata || EXCLUDED.metadata,
        updated_at = NOW();
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS message_cache (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        external_chat_id VARCHAR(255) NOT NULL,
        external_message_id VARCHAR(255),
        sender VARCHAR(40) NOT NULL,
        message_type VARCHAR(40) NOT NULL DEFAULT 'text',
        delivery_status VARCHAR(40) NOT NULL DEFAULT 'sent',
        error_message TEXT,
        body TEXT,
        metadata JSONB NOT NULL DEFAULT '{}',
        sent_at TIMESTAMPTZ,
        edited_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        deleted_scope VARCHAR(20),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, external_chat_id, external_message_id)
      );
      CREATE INDEX IF NOT EXISTS idx_message_cache_chat ON message_cache(user_id, external_chat_id, sent_at DESC);
      CREATE INDEX IF NOT EXISTS idx_message_cache_expires ON message_cache(expires_at);
      CREATE INDEX IF NOT EXISTS idx_message_cache_provider_message_id
        ON message_cache(user_id, ((metadata->>'providerMessageId')))
        WHERE metadata ? 'providerMessageId';
    `);
    await query(client, `ALTER TABLE message_cache ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(40) NOT NULL DEFAULT 'sent';`);
    await query(client, `ALTER TABLE message_cache ADD COLUMN IF NOT EXISTS error_message TEXT;`);
    await query(client, `ALTER TABLE message_cache ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;`);
    await query(client, `ALTER TABLE message_cache ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;`);
    await query(client, `ALTER TABLE message_cache ADD COLUMN IF NOT EXISTS deleted_scope VARCHAR(20);`);
    await query(client, `CREATE INDEX IF NOT EXISTS idx_message_cache_delivery_status ON message_cache(user_id, delivery_status, created_at DESC);`);

    await query(client, `
      CREATE TABLE IF NOT EXISTS conversation_ai_profiles (
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        external_chat_id VARCHAR(255) NOT NULL,
        profile JSONB NOT NULL DEFAULT '{}',
        message_count INT NOT NULL DEFAULT 0,
        last_message_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, external_chat_id)
      );
      CREATE INDEX IF NOT EXISTS idx_conversation_ai_profiles_updated ON conversation_ai_profiles(user_id, updated_at DESC);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS message_media_cache (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        external_chat_id VARCHAR(255) NOT NULL,
        external_message_id VARCHAR(255) NOT NULL,
        media_type VARCHAR(40) NOT NULL,
        mime_type VARCHAR(120),
        file_name VARCHAR(255),
        size_bytes INT NOT NULL DEFAULT 0,
        data BYTEA NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, external_chat_id, external_message_id)
      );
      CREATE INDEX IF NOT EXISTS idx_message_media_cache_chat ON message_media_cache(user_id, external_chat_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_message_media_cache_expires ON message_media_cache(expires_at);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS usage_ledger (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(40) NOT NULL,
        cost INT NOT NULL DEFAULT 1,
        status VARCHAR(40) NOT NULL,
        provider VARCHAR(40),
        model VARCHAR(120),
        input_tokens INT NOT NULL DEFAULT 0,
        cached_input_tokens INT NOT NULL DEFAULT 0,
        output_tokens INT NOT NULL DEFAULT 0,
        total_tokens INT NOT NULL DEFAULT 0,
        estimated_cost_usd NUMERIC(12, 8),
        latency_ms INT,
        pricing_version VARCHAR(80),
        cost_estimated BOOLEAN NOT NULL DEFAULT FALSE,
        error_message TEXT,
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_usage_ledger_user_created ON usage_ledger(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_usage_ledger_user_status ON usage_ledger(user_id, status, created_at DESC);
    `);
    await query(client, `ALTER TABLE usage_ledger ADD COLUMN IF NOT EXISTS input_tokens INT NOT NULL DEFAULT 0;`);
    await query(client, `ALTER TABLE usage_ledger ADD COLUMN IF NOT EXISTS cached_input_tokens INT NOT NULL DEFAULT 0;`);
    await query(client, `ALTER TABLE usage_ledger ADD COLUMN IF NOT EXISTS output_tokens INT NOT NULL DEFAULT 0;`);
    await query(client, `ALTER TABLE usage_ledger ADD COLUMN IF NOT EXISTS total_tokens INT NOT NULL DEFAULT 0;`);
    await query(client, `ALTER TABLE usage_ledger ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(12, 8);`);
    await query(client, `ALTER TABLE usage_ledger ADD COLUMN IF NOT EXISTS latency_ms INT;`);
    await query(client, `ALTER TABLE usage_ledger ADD COLUMN IF NOT EXISTS pricing_version VARCHAR(80);`);
    await query(client, `ALTER TABLE usage_ledger ADD COLUMN IF NOT EXISTS cost_estimated BOOLEAN NOT NULL DEFAULT FALSE;`);

    await query(client, `
      CREATE TABLE IF NOT EXISTS quota_balances (
        user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        plan_name VARCHAR(40) NOT NULL DEFAULT 'free',
        included_limit INT NOT NULL DEFAULT ${Number(config.quota.freeDailyMessages)},
        used_in_period INT NOT NULL DEFAULT 0,
        pack_balance INT NOT NULL DEFAULT 0,
        period_type VARCHAR(20) NOT NULL DEFAULT 'day',
        period_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        next_reset_at TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('day', NOW()) + INTERVAL '1 day'),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_quota_balances_next_reset ON quota_balances(next_reset_at);
    `);

    await query(client, `
      ALTER TABLE quota_balances ALTER COLUMN included_limit SET DEFAULT ${Number(config.quota.freeDailyMessages)};
      UPDATE quota_balances
      SET included_limit = ${Number(config.quota.freeDailyMessages)}, updated_at = NOW()
      WHERE plan_name = 'free' AND included_limit <> ${Number(config.quota.freeDailyMessages)};
      UPDATE quota_balances
      SET included_limit = ${Number(config.quota.plusMonthlyMessages)}, updated_at = NOW()
      WHERE plan_name IN ('plus', 'plus_trial') AND included_limit <> ${Number(config.quota.plusMonthlyMessages)};
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS plan_subscriptions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        stripe_subscription_id VARCHAR(255) UNIQUE,
        stripe_price_id VARCHAR(255),
        plan_name VARCHAR(60) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_plan_subscriptions_user ON plan_subscriptions(user_id, created_at DESC);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS pack_purchases (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        stripe_checkout_session_id VARCHAR(255) UNIQUE,
        stripe_payment_intent_id VARCHAR(255),
        pack_size INT NOT NULL,
        amount_total INT,
        currency VARCHAR(10),
        status VARCHAR(40) NOT NULL DEFAULT 'pending',
        applied_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_pack_purchases_user ON pack_purchases(user_id, created_at DESC);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS stripe_events (
        event_id VARCHAR(255) PRIMARY KEY,
        event_type VARCHAR(255) NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}',
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id, active);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS native_push_tokens (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        platform VARCHAR(40) NOT NULL DEFAULT 'android',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_native_push_tokens_user ON native_push_tokens(user_id, active);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        global_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        new_message BOOLEAN NOT NULL DEFAULT TRUE,
        stalled BOOLEAN NOT NULL DEFAULT TRUE,
        quota BOOLEAN NOT NULL DEFAULT TRUE,
        product BOOLEAN NOT NULL DEFAULT FALSE,
        whatsapp_status BOOLEAN NOT NULL DEFAULT TRUE,
        payments BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(80) NOT NULL,
        actor VARCHAR(50) NOT NULL DEFAULT 'user',
        metadata JSONB NOT NULL DEFAULT '{}',
        ip_address VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at DESC);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id BIGSERIAL PRIMARY KEY,
        admin_username VARCHAR(160) NOT NULL,
        action VARCHAR(100) NOT NULL,
        target_user_id BIGINT,
        target_email VARCHAR(255),
        before_state JSONB NOT NULL DEFAULT '{}',
        after_state JSONB NOT NULL DEFAULT '{}',
        metadata JSONB NOT NULL DEFAULT '{}',
        ip_address VARCHAR(255),
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON admin_audit_logs(target_user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action, created_at DESC);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS email_delivery_logs (
        id BIGSERIAL PRIMARY KEY,
        recipient VARCHAR(255) NOT NULL,
        subject TEXT,
        provider_message_id TEXT,
        status VARCHAR(40) NOT NULL,
        accepted JSONB NOT NULL DEFAULT '[]',
        rejected JSONB NOT NULL DEFAULT '[]',
        response TEXT,
        error_code TEXT,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_recipient ON email_delivery_logs(recipient, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_status ON email_delivery_logs(status, created_at DESC);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS connectivity_logs (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        session_id VARCHAR(128),
        event_type VARCHAR(50) NOT NULL,
        error_code TEXT,
        error_message TEXT,
        details JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_connectivity_logs_session ON connectivity_logs(session_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_connectivity_logs_user ON connectivity_logs(user_id, created_at DESC);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS whatsapp_runtime_tasks (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id VARCHAR(128) NOT NULL,
        task_type VARCHAR(60) NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}',
        status VARCHAR(40) NOT NULL DEFAULT 'pending',
        attempts INT NOT NULL DEFAULT 0,
        max_attempts INT NOT NULL DEFAULT 3,
        priority INT NOT NULL DEFAULT 0,
        available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        locked_at TIMESTAMPTZ,
        locked_by VARCHAR(120),
        result JSONB,
        error_code TEXT,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_whatsapp_runtime_tasks_pickup ON whatsapp_runtime_tasks(status, available_at, priority DESC, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_runtime_tasks_user ON whatsapp_runtime_tasks(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_runtime_tasks_session ON whatsapp_runtime_tasks(session_id, created_at DESC);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS error_logs (
        id BIGSERIAL PRIMARY KEY,
        level VARCHAR(10) NOT NULL DEFAULT 'error',
        category VARCHAR(50),
        message TEXT NOT NULL,
        stack TEXT,
        context JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(level);
      CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category);
      CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS ai_content_reports (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        chat_id VARCHAR(255),
        ai_action VARCHAR(60) NOT NULL DEFAULT 'unknown',
        report_reason VARCHAR(80) NOT NULL DEFAULT 'other',
        report_note TEXT,
        generated_text TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        status VARCHAR(40) NOT NULL DEFAULT 'new',
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ai_content_reports_user ON ai_content_reports(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_content_reports_status ON ai_content_reports(status, created_at DESC);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS play_purchase_receipts (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id VARCHAR(160) NOT NULL,
        product_type VARCHAR(40) NOT NULL,
        purchase_token TEXT NOT NULL UNIQUE,
        order_id VARCHAR(255),
        package_name VARCHAR(255),
        status VARCHAR(40) NOT NULL DEFAULT 'pending',
        entitlement VARCHAR(80),
        amount INT,
        raw_payload JSONB NOT NULL DEFAULT '{}',
        verified_at TIMESTAMPTZ,
        acknowledged_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_play_purchase_receipts_user ON play_purchase_receipts(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_play_purchase_receipts_status ON play_purchase_receipts(status, created_at DESC);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS revenuecat_events (
        id BIGSERIAL PRIMARY KEY,
        event_id VARCHAR(255) NOT NULL UNIQUE,
        event_type VARCHAR(80) NOT NULL,
        app_user_id VARCHAR(255),
        product_id VARCHAR(255),
        payload JSONB NOT NULL DEFAULT '{}',
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_revenuecat_events_app_user ON revenuecat_events(app_user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_revenuecat_events_type ON revenuecat_events(event_type, created_at DESC);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS native_entitlements (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(60) NOT NULL,
        app_user_id VARCHAR(255) NOT NULL,
        entitlement_id VARCHAR(120) NOT NULL,
        product_id VARCHAR(255),
        store VARCHAR(60),
        active BOOLEAN NOT NULL DEFAULT FALSE,
        purchased_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        raw_payload JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (provider, app_user_id, entitlement_id)
      );
      CREATE INDEX IF NOT EXISTS idx_native_entitlements_user ON native_entitlements(user_id, active, updated_at DESC);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS native_store_transactions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(60) NOT NULL,
        transaction_id VARCHAR(255) NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        product_type VARCHAR(60) NOT NULL,
        store VARCHAR(60),
        amount INT,
        purchased_at TIMESTAMPTZ,
        raw_payload JSONB NOT NULL DEFAULT '{}',
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (provider, transaction_id)
      );
      CREATE INDEX IF NOT EXISTS idx_native_store_transactions_user ON native_store_transactions(user_id, created_at DESC);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS native_purchase_syncs (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(60) NOT NULL,
        app_user_id VARCHAR(255) NOT NULL,
        source VARCHAR(80),
        raw_payload JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_native_purchase_syncs_user ON native_purchase_syncs(user_id, created_at DESC);
    `);

    await query(client, `
      CREATE TABLE IF NOT EXISTS system_flags (
        key VARCHAR(120) PRIMARY KEY,
        value JSONB NOT NULL DEFAULT '{}',
        description TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await seedSystemFlags(client);
    await query(client, "COMMIT");
    const tables = await query(client, `
      SELECT COUNT(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_type = 'BASE TABLE'
    `);
    console.log(`[DB] WaFli database verified and ready. tables=${tables.rows[0].count}`);
  } catch (error) {
    await query(client, "ROLLBACK").catch(() => {});
    console.error("[DB] init failed:", error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { initDb };
