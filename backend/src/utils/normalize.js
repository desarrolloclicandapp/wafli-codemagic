const { parsePhoneNumberFromString } = require("libphonenumber-js");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizePhone(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  const parsed = parsePhoneNumberFromString(raw.startsWith("+") ? raw : `+${raw.replace(/\D/g, "")}`);
  if (parsed && parsed.isValid()) return parsed.number;
  const digits = raw.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function getRequestIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || String(req.headers["x-real-ip"] || req.ip || req.socket?.remoteAddress || "unknown").trim();
}

module.exports = { normalizeEmail, normalizePhone, getRequestIp };
