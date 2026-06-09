const { pool } = require("../config/db");
const { config } = require("../config/env");
const { ApiError } = require("../utils/responses");
const pushService = require("./pushService");

const quotaNotificationKeys = new Set();

async function ensureBalance(userId) {
  await pool.query(`INSERT INTO quota_balances (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
  await resetDueBalanceForUser(userId);
  const result = await pool.query(`SELECT * FROM quota_balances WHERE user_id = $1`, [userId]);
  return result.rows[0];
}

function available(balance) {
  return Math.max(0, Number(balance.included_limit || 0) - Number(balance.used_in_period || 0)) + Number(balance.pack_balance || 0);
}

function usageSummary(balance) {
  const includedLimit = Number(balance.included_limit || 0);
  const usedInPeriod = Number(balance.used_in_period || 0);
  const packBalance = Number(balance.pack_balance || 0);
  const includedRemaining = Math.max(0, includedLimit - usedInPeriod);
  const totalAvailable = includedRemaining + packBalance;
  const usageRatio = includedLimit > 0 ? usedInPeriod / includedLimit : 0;
  return {
    planName: balance.plan_name,
    periodType: balance.period_type,
    includedLimit,
    usedInPeriod,
    includedRemaining,
    packBalance,
    totalAvailable,
    usageRatio,
    warning80: usageRatio >= 0.8 && usageRatio < 1,
    exhausted: totalAvailable <= 0,
    nextResetAt: balance.next_reset_at,
    trialEndsAt: balance.plan_name === "plus_trial" || balance.period_type === "trial" ? balance.next_reset_at : null
  };
}

function publicUsageLedgerRow(row = {}) {
  const {
    input_tokens,
    cached_input_tokens,
    output_tokens,
    total_tokens,
    estimated_cost_usd,
    latency_ms,
    pricing_version,
    cost_estimated,
    ...publicRow
  } = row;
  if (publicRow.metadata && typeof publicRow.metadata === "object" && publicRow.metadata.aiCost) {
    const { aiCost, ...metadata } = publicRow.metadata;
    publicRow.metadata = metadata;
  }
  return publicRow;
}

async function notifyQuotaIfNeeded(userId, usage) {
  const summary = usage?.summary || usageSummary(usage?.balance || {});
  if (!summary) return;
  const resetKey = summary.nextResetAt ? new Date(summary.nextResetAt).toISOString() : "period";
  const type = summary.exhausted ? "quota_exhausted" : summary.warning80 ? "quota_low" : "";
  if (!type) return;
  const key = `${userId}:${type}:${resetKey}`;
  if (quotaNotificationKeys.has(key)) return;
  quotaNotificationKeys.add(key);
  await pushService.notify(userId, type, {
    title: type === "quota_exhausted" ? "Sin generaciones IA" : "Cuota IA casi al límite",
    body: type === "quota_exhausted"
      ? "No quedan generaciones disponibles. Puedes revisar tu plan o comprar un pack."
      : `Te quedan ${summary.totalAvailable} generaciones disponibles en este periodo.`,
    target: "/?screen=plan",
    tag: `quota-${type}-${resetKey}`,
    renotify: false
  }).catch(() => {});
}
async function getUsage(userId) {
  const balance = await ensureBalance(userId);
  const recent = await pool.query(
    `SELECT
       ul.action,
       ul.cost,
       ul.status,
       ul.provider,
       ul.model,
       ul.error_message,
       ul.metadata,
       ul.created_at,
       COALESCE(
         NULLIF(cm.display_name, ''),
         NULLIF(wc.manual_alias, ''),
         NULLIF(wc.whatsapp_name, ''),
         NULLIF(wc.push_name, ''),
         NULLIF(wc.notify_name, ''),
         NULLIF(wc.verified_name, ''),
         NULLIF(cm_alias.display_name, ''),
         NULLIF(wc_alias.manual_alias, ''),
         NULLIF(wc_alias.whatsapp_name, ''),
         NULLIF(wc_alias.push_name, ''),
         NULLIF(wc_alias.notify_name, ''),
         NULLIF(wc_alias.verified_name, '')
       ) AS chat_name,
       COALESCE(cm.phone, wc.phone, cm_alias.phone, wc_alias.phone, alias.phone) AS chat_phone,
       COALESCE(cm.external_chat_id, cm_alias.external_chat_id, alias.canonical_chat_id, ul.metadata->>'chatId') AS resolved_chat_id
     FROM usage_ledger ul
     LEFT JOIN conversation_meta cm
       ON cm.user_id = ul.user_id
      AND cm.external_chat_id = ul.metadata->>'chatId'
     LEFT JOIN whatsapp_contacts wc
       ON wc.user_id = ul.user_id
      AND wc.external_chat_id = ul.metadata->>'chatId'
     LEFT JOIN whatsapp_chat_aliases alias
       ON alias.user_id = ul.user_id
      AND alias.alias_chat_id = ul.metadata->>'chatId'
     LEFT JOIN conversation_meta cm_alias
       ON cm_alias.user_id = ul.user_id
      AND cm_alias.external_chat_id = alias.canonical_chat_id
     LEFT JOIN whatsapp_contacts wc_alias
       ON wc_alias.user_id = ul.user_id
      AND wc_alias.external_chat_id = alias.canonical_chat_id
     WHERE ul.user_id = $1
     ORDER BY ul.created_at DESC
     LIMIT 50`,
    [userId]
  );
  return { balance, available: available(balance), summary: usageSummary(balance), recent: recent.rows.map(publicUsageLedgerRow) };
}

async function assertHasQuota(userId) {
  const balance = await ensureBalance(userId);
  if (available(balance) <= 0) throw new ApiError(402, "quota_exhausted", "No quedan mensajes IA disponibles");
  return balance;
}

async function resetDueBalanceForUser(userId, db = pool) {
  const result = await db.query(
    `UPDATE quota_balances
     SET plan_name = CASE WHEN plan_name = 'plus_trial' OR period_type = 'trial' THEN 'free' ELSE plan_name END,
         included_limit = CASE WHEN plan_name = 'plus_trial' OR period_type = 'trial' THEN $2 ELSE included_limit END,
         used_in_period = 0,
         period_type = CASE WHEN plan_name = 'plus_trial' OR period_type = 'trial' THEN 'day' ELSE period_type END,
         period_started_at = NOW(),
         next_reset_at = CASE
           WHEN plan_name = 'plus_trial' OR period_type = 'trial' THEN date_trunc('day', NOW()) + INTERVAL '1 day'
           WHEN period_type = 'month' THEN date_trunc('month', NOW()) + INTERVAL '1 month'
           ELSE date_trunc('day', NOW()) + INTERVAL '1 day'
         END,
         updated_at = NOW()
     WHERE user_id = $1 AND next_reset_at <= NOW()
     RETURNING *`,
    [userId, config.quota.freeDailyMessages]
  );
  if (result.rows[0]?.plan_name === "free") {
    await db.query(`UPDATE users SET default_plan = 'free', updated_at = NOW() WHERE id = $1 AND default_plan = 'plus_trial'`, [userId]).catch(() => {});
  }
  return result.rows[0] || null;
}

async function consume(userId, { action, provider, model, metadata = {} }) {
  const client = await pool.connect();
  let usage = null;
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO quota_balances (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
    const balanceRes = await client.query(`SELECT * FROM quota_balances WHERE user_id = $1 FOR UPDATE`, [userId]);
    let balance = balanceRes.rows[0];
    if (balance?.next_reset_at && new Date(balance.next_reset_at).getTime() <= Date.now()) {
      balance = await resetDueBalanceForUser(userId, client) || balance;
    }
    let usedInPeriod = Number(balance.used_in_period || 0);
    let packBalance = Number(balance.pack_balance || 0);
    const includedRemaining = Math.max(0, Number(balance.included_limit || 0) - usedInPeriod);
    if (includedRemaining > 0) usedInPeriod += 1;
    else if (packBalance > 0) packBalance -= 1;
    else throw new ApiError(402, "quota_exhausted", "No quedan mensajes IA disponibles");
    await client.query(
      `UPDATE quota_balances SET used_in_period = $2, pack_balance = $3, updated_at = NOW() WHERE user_id = $1`,
      [userId, usedInPeriod, packBalance]
    );
    await client.query(
      `INSERT INTO usage_ledger (user_id, action, cost, status, provider, model, metadata)
       VALUES ($1, $2, 1, 'success', $3, $4, $5::jsonb)`,
      [userId, action, provider, model, JSON.stringify(metadata)]
    );
    await client.query("COMMIT");
    usage = await getUsage(userId);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  notifyQuotaIfNeeded(userId, usage).catch(() => {});
  return usage;
}

async function reserveGeneration(userId, { action, provider, model, metadata = {} }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO quota_balances (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
    const balanceRes = await client.query(`SELECT * FROM quota_balances WHERE user_id = $1 FOR UPDATE`, [userId]);
    let balance = balanceRes.rows[0];
    if (balance?.next_reset_at && new Date(balance.next_reset_at).getTime() <= Date.now()) {
      balance = await resetDueBalanceForUser(userId, client) || balance;
    }

    let usedInPeriod = Number(balance.used_in_period || 0);
    let packBalance = Number(balance.pack_balance || 0);
    const includedRemaining = Math.max(0, Number(balance.included_limit || 0) - usedInPeriod);
    let quotaSource = "included";
    if (includedRemaining > 0) usedInPeriod += 1;
    else if (packBalance > 0) {
      packBalance -= 1;
      quotaSource = "pack";
    } else {
      throw new ApiError(402, "quota_exhausted", "No quedan mensajes IA disponibles");
    }

    await client.query(
      `UPDATE quota_balances SET used_in_period = $2, pack_balance = $3, updated_at = NOW() WHERE user_id = $1`,
      [userId, usedInPeriod, packBalance]
    );
    const ledger = await client.query(
      `INSERT INTO usage_ledger (user_id, action, cost, status, provider, model, metadata)
       VALUES ($1, $2, 1, 'reserved', $3, $4, $5::jsonb)
       RETURNING id`,
      [userId, action, provider, model, JSON.stringify({ ...(metadata || {}), quotaSource })]
    );
    await client.query("COMMIT");
    const quota = await getUsage(userId);
    notifyQuotaIfNeeded(userId, quota).catch(() => {});
    return { reservationId: ledger.rows[0].id, quota };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function finalizeReservation(userId, reservationId, { provider, model, metadata = {}, aiCost = {} }) {
  await pool.query(
    `UPDATE usage_ledger
     SET status = 'success',
         provider = $3,
         model = $4,
         metadata = metadata || $5::jsonb,
         input_tokens = $6,
         cached_input_tokens = $7,
         output_tokens = $8,
         total_tokens = $9,
         estimated_cost_usd = $10,
         latency_ms = $11,
         pricing_version = $12,
         cost_estimated = $13
     WHERE id = $1 AND user_id = $2 AND status = 'reserved'`,
    [
      reservationId,
      userId,
      provider,
      model,
      JSON.stringify(metadata),
      Math.max(0, Number(aiCost.inputTokens || 0)),
      Math.max(0, Number(aiCost.cachedInputTokens || 0)),
      Math.max(0, Number(aiCost.outputTokens || 0)),
      Math.max(0, Number(aiCost.totalTokens || 0)),
      aiCost.estimatedCostUsd === undefined || aiCost.estimatedCostUsd === null ? null : Number(aiCost.estimatedCostUsd || 0),
      aiCost.latencyMs === undefined || aiCost.latencyMs === null ? null : Math.max(0, Number(aiCost.latencyMs || 0)),
      aiCost.pricingVersion || null,
      aiCost.costEstimated === true
    ]
  );
  return getUsage(userId);
}

async function releaseReservation(userId, reservationId, { provider, model, errorMessage }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ledger = await client.query(
      `SELECT metadata FROM usage_ledger WHERE id = $1 AND user_id = $2 AND status = 'reserved' FOR UPDATE`,
      [reservationId, userId]
    );
    const row = ledger.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return;
    }
    const quotaSource = row.metadata?.quotaSource || "included";
    await client.query(`SELECT * FROM quota_balances WHERE user_id = $1 FOR UPDATE`, [userId]);
    if (quotaSource === "pack") {
      await client.query(`UPDATE quota_balances SET pack_balance = pack_balance + 1, updated_at = NOW() WHERE user_id = $1`, [userId]);
    } else {
      await client.query(`UPDATE quota_balances SET used_in_period = GREATEST(0, used_in_period - 1), updated_at = NOW() WHERE user_id = $1`, [userId]);
    }
    await client.query(
      `UPDATE usage_ledger
       SET status = 'failed',
           cost = 0,
           provider = $3,
           model = $4,
           error_message = $5
       WHERE id = $1 AND user_id = $2`,
      [reservationId, userId, provider, model, String(errorMessage || "AI failed").slice(0, 1000)]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function recordFailure(userId, { action, provider, model, errorMessage }) {
  await pool.query(
    `INSERT INTO usage_ledger (user_id, action, cost, status, provider, model, error_message)
     VALUES ($1, $2, 0, 'failed', $3, $4, $5)`,
    [userId, action, provider, model, String(errorMessage || "AI failed").slice(0, 1000)]
  );
}

async function getAiCostDiagnostics({ days = 30 } = {}) {
  const safeDays = Math.min(180, Math.max(1, Number.parseInt(String(days || 30), 10) || 30));
  const result = await pool.query(
    `
      SELECT
        COALESCE(action, 'unknown') AS action,
        COALESCE(provider, 'unknown') AS provider,
        COALESCE(model, 'unknown') AS model,
        COUNT(*)::int AS requests,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::int AS successes,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::int AS failures,
        ROUND(AVG(NULLIF(input_tokens, 0))::numeric, 2) AS avg_input_tokens,
        ROUND(AVG(NULLIF(output_tokens, 0))::numeric, 2) AS avg_output_tokens,
        ROUND(AVG(NULLIF(total_tokens, 0))::numeric, 2) AS avg_total_tokens,
        ROUND(percentile_cont(0.50) WITHIN GROUP (ORDER BY NULLIF(total_tokens, 0))::numeric, 2) AS p50_total_tokens,
        ROUND(percentile_cont(0.75) WITHIN GROUP (ORDER BY NULLIF(total_tokens, 0))::numeric, 2) AS p75_total_tokens,
        ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY NULLIF(total_tokens, 0))::numeric, 2) AS p95_total_tokens,
        ROUND(AVG(NULLIF(latency_ms, 0))::numeric, 2) AS avg_latency_ms,
        ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY NULLIF(latency_ms, 0))::numeric, 2) AS p95_latency_ms,
        COALESCE(SUM(estimated_cost_usd), 0)::numeric(12, 8) AS total_estimated_cost_usd,
        ROUND(AVG(NULLIF(estimated_cost_usd, 0))::numeric, 8) AS avg_estimated_cost_usd,
        SUM(CASE WHEN cost_estimated THEN 1 ELSE 0 END)::int AS estimated_rows,
        MAX(pricing_version) AS pricing_version
      FROM usage_ledger
      WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
      GROUP BY action, provider, model
      ORDER BY total_estimated_cost_usd DESC, requests DESC
    `,
    [safeDays]
  );
  return { days: safeDays, rows: result.rows };
}

async function addPack(userId, amount) {
  await ensureBalance(userId);
  const safeAmount = Number(amount || 0);
  if (safeAmount !== Number(config.quota.topUpPackSize || 50)) throw new ApiError(400, "unsupported_pack", "Este pack no esta disponible en V0");
  await pool.query(`UPDATE quota_balances SET pack_balance = pack_balance + $2, updated_at = NOW() WHERE user_id = $1`, [userId, safeAmount]);
}

async function applyPlan(userId, planName) {
  const normalized = String(planName || "free").toLowerCase();
  if (!["free", "plus", "pro", "plus_trial"].includes(normalized)) throw new ApiError(400, "unsupported_plan", "Este plan no esta disponible en V0");
  const included = normalized === "free"
    ? config.quota.freeDailyMessages
    : normalized === "pro"
      ? config.quota.proMonthlyMessages
      : config.quota.plusMonthlyMessages;
  const periodType = normalized === "free" ? "day" : normalized === "plus_trial" ? "trial" : "month";
  const nextResetSql = periodType === "day"
    ? "date_trunc('day', NOW()) + INTERVAL '1 day'"
    : periodType === "trial"
      ? `NOW() + (${Number(config.quota.trialDays)} * INTERVAL '1 day')`
      : "date_trunc('month', NOW()) + INTERVAL '1 month'";
  const current = await ensureBalance(userId);
  if (
    current?.plan_name === normalized &&
    current?.period_type === periodType &&
    current?.next_reset_at &&
    new Date(current.next_reset_at).getTime() > Date.now()
  ) {
    await pool.query(
      `UPDATE quota_balances SET included_limit = $2, updated_at = NOW() WHERE user_id = $1`,
      [userId, included]
    );
    await pool.query(`UPDATE users SET default_plan = $2, updated_at = NOW() WHERE id = $1`, [userId, normalized]).catch(() => {});
    return;
  }
  await pool.query(
    `UPDATE quota_balances SET plan_name = $2, included_limit = $3, used_in_period = 0, period_type = $4, period_started_at = NOW(), next_reset_at = ${nextResetSql}, updated_at = NOW() WHERE user_id = $1`,
    [userId, normalized, included, periodType]
  );
  await pool.query(`UPDATE users SET default_plan = $2, updated_at = NOW() WHERE id = $1`, [userId, normalized]).catch(() => {});
}

async function resetDueBalances() {
  const result = await pool.query(
    `UPDATE quota_balances
     SET plan_name = CASE WHEN plan_name = 'plus_trial' OR period_type = 'trial' THEN 'free' ELSE plan_name END,
         included_limit = CASE WHEN plan_name = 'plus_trial' OR period_type = 'trial' THEN $1 ELSE included_limit END,
         used_in_period = 0,
         period_type = CASE WHEN plan_name = 'plus_trial' OR period_type = 'trial' THEN 'day' ELSE period_type END,
         period_started_at = NOW(),
         next_reset_at = CASE
           WHEN plan_name = 'plus_trial' OR period_type = 'trial' THEN date_trunc('day', NOW()) + INTERVAL '1 day'
           WHEN period_type = 'month' THEN date_trunc('month', NOW()) + INTERVAL '1 month'
           ELSE date_trunc('day', NOW()) + INTERVAL '1 day'
         END,
         updated_at = NOW()
     WHERE next_reset_at <= NOW()`,
    [config.quota.freeDailyMessages]
  );
  await pool.query(
    `UPDATE users
     SET default_plan = 'free', updated_at = NOW()
     WHERE default_plan = 'plus_trial'
       AND EXISTS (
         SELECT 1 FROM quota_balances q
         WHERE q.user_id = users.id
           AND q.plan_name = 'free'
           AND q.period_type = 'day'
       )`
  ).catch(() => {});
  return result.rowCount || 0;
}

async function startTrialForNewUser(db, userId) {
  const days = Math.max(1, Number(config.quota.trialDays || 7));
  await db.query(
    `INSERT INTO quota_balances (user_id, plan_name, included_limit, used_in_period, pack_balance, period_type, period_started_at, next_reset_at)
     VALUES ($1, 'plus_trial', $2, 0, 0, 'trial', NOW(), NOW() + ($3 * INTERVAL '1 day'))
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, config.quota.plusMonthlyMessages, days]
  );
  await db.query(
    `INSERT INTO plan_subscriptions (user_id, plan_name, status, current_period_start, current_period_end)
     VALUES ($1, 'plus_trial', 'trialing', NOW(), NOW() + ($2 * INTERVAL '1 day'))`,
    [userId, days]
  ).catch(() => {});
  await db.query(`UPDATE users SET default_plan = 'plus_trial', updated_at = NOW() WHERE id = $1`, [userId]).catch(() => {});
}

module.exports = {
  ensureBalance,
  getUsage,
  assertHasQuota,
  consume,
  reserveGeneration,
  finalizeReservation,
  releaseReservation,
  recordFailure,
  getAiCostDiagnostics,
  addPack,
  applyPlan,
  resetDueBalances,
  resetDueBalanceForUser,
  startTrialForNewUser,
  available,
  usageSummary
};
