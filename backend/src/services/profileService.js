const { pool } = require("../config/db");
const { ApiError } = require("../utils/responses");

async function getProfile(userId) {
  const result = await pool.query(
    `SELECT u.id, u.email, u.phone, u.status, u.onboarding_status, u.default_plan,
            p.alias, p.spanish_variant, p.base_tone, p.ui_language,
            p.profile_completed, p.spanish_variant_completed, p.base_tone_completed
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0];
}

async function updateProfile(userId, data = {}) {
  const hasAlias = Object.prototype.hasOwnProperty.call(data, "alias");
  const hasSpanishVariant =
    Object.prototype.hasOwnProperty.call(data, "spanishVariant") ||
    Object.prototype.hasOwnProperty.call(data, "spanish_variant");
  const hasBaseTone =
    Object.prototype.hasOwnProperty.call(data, "baseTone") ||
    Object.prototype.hasOwnProperty.call(data, "base_tone");
  const hasUiLanguage =
    Object.prototype.hasOwnProperty.call(data, "uiLanguage") ||
    Object.prototype.hasOwnProperty.call(data, "ui_language");

  const alias = hasAlias ? String(data.alias || "").trim() || null : null;
  const spanishVariant = hasSpanishVariant
    ? String(data.spanishVariant || data.spanish_variant || "Neutro").trim()
    : "Neutro";
  const baseTone = hasBaseTone
    ? String(data.baseTone || data.base_tone || "Desenfadado").trim()
    : "Desenfadado";
  const uiLanguage = hasUiLanguage
    ? String(data.uiLanguage || data.ui_language || "ES").trim().toUpperCase()
    : "ES";

  await pool.query(
    `INSERT INTO user_profiles (
       user_id, alias, spanish_variant, base_tone, ui_language,
       spanish_variant_completed, base_tone_completed, profile_completed, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $7, $8, ($7 AND $8), NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       alias = CASE WHEN $6 THEN EXCLUDED.alias ELSE user_profiles.alias END,
       spanish_variant = CASE WHEN $7 THEN EXCLUDED.spanish_variant ELSE user_profiles.spanish_variant END,
       base_tone = CASE WHEN $8 THEN EXCLUDED.base_tone ELSE user_profiles.base_tone END,
       ui_language = CASE WHEN $9 THEN EXCLUDED.ui_language ELSE user_profiles.ui_language END,
       spanish_variant_completed = user_profiles.spanish_variant_completed OR EXCLUDED.spanish_variant_completed,
       base_tone_completed = user_profiles.base_tone_completed OR EXCLUDED.base_tone_completed,
       profile_completed = (
         (user_profiles.spanish_variant_completed OR EXCLUDED.spanish_variant_completed)
         AND
         (user_profiles.base_tone_completed OR EXCLUDED.base_tone_completed)
       ),
       updated_at = NOW()`,
    [userId, alias, spanishVariant, baseTone, uiLanguage, hasAlias, hasSpanishVariant, hasBaseTone, hasUiLanguage]
  );
  await updateOnboardingStatus(userId);
  return getProfile(userId);
}

async function acceptLegal(userId, reqBody = {}, meta = {}) {
  if (!reqBody.isAdult) throw new ApiError(400, "adult_required", "Debes confirmar que eres mayor de edad");
  await pool.query(
    `INSERT INTO legal_acceptances (user_id, terms_version, privacy_version, is_adult, ip_address, user_agent)
     VALUES ($1, $2, $3, TRUE, $4, $5)`,
    [userId, reqBody.termsVersion || "v0", reqBody.privacyVersion || "v0", meta.ipAddress || null, meta.userAgent || null]
  );
  await updateOnboardingStatus(userId);
}

async function getOnboardingStatus(userId) {
  const result = await pool.query(
    `SELECT u.onboarding_status,
            EXISTS(SELECT 1 FROM legal_acceptances l WHERE l.user_id = u.id AND l.is_adult = TRUE) AS legal_done,
            (
              COALESCE(p.spanish_variant_completed, FALSE)
              OR u.onboarding_status = 'complete'
            ) AS spanish_variant_done,
            (
              COALESCE(p.base_tone_completed, FALSE)
              OR u.onboarding_status = 'complete'
            ) AS base_tone_done,
            EXISTS(SELECT 1 FROM whatsapp_connections w WHERE w.user_id = u.id AND w.status = 'connected') AS whatsapp_done
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  const row = result.rows[0];
  const profileDone = Boolean(row.spanish_variant_done && row.base_tone_done);
  const nextStep = !row.legal_done
    ? "legal"
    : !row.spanish_variant_done
      ? "spanish_variant"
      : !row.base_tone_done
        ? "tone"
        : !row.whatsapp_done
          ? "whatsapp"
          : "complete";
  return {
    status: row.onboarding_status,
    legalDone: row.legal_done,
    profileDone,
    spanishVariantDone: row.spanish_variant_done,
    baseToneDone: row.base_tone_done,
    whatsappDone: row.whatsapp_done,
    nextStep,
  };
}

async function updateOnboardingStatus(userId) {
  const status = await getOnboardingStatus(userId);
  const complete = status.legalDone && status.profileDone && status.whatsappDone;
  await pool.query(`UPDATE users SET onboarding_status = $2, updated_at = NOW() WHERE id = $1`, [userId, complete ? "complete" : "pending"]);
}

module.exports = { getProfile, updateProfile, acceptLegal, getOnboardingStatus, updateOnboardingStatus };
