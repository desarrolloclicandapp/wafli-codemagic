const crypto = require("crypto");
const { config } = require("../config/env");
const { ApiError } = require("../utils/responses");
const { normalizeEmail } = require("../utils/normalize");

const jwksCache = new Map();
const CLOCK_SKEW_SECONDS = 60;

const PROVIDERS = {
  google: {
    jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
    issuers: ["accounts.google.com", "https://accounts.google.com"],
    algorithms: ["RS256"],
    audiences: () => config.oauth.googleClientIds
  },
  apple: {
    jwksUrl: "https://appleid.apple.com/auth/keys",
    issuers: ["https://appleid.apple.com"],
    algorithms: ["RS256", "ES256"],
    audiences: () => config.oauth.appleClientIds
  }
};

function decodeJwtPart(part) {
  return JSON.parse(Buffer.from(String(part || ""), "base64url").toString("utf8"));
}

function splitJwt(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new ApiError(401, "invalid_oauth_token", "Token de proveedor invalido");
  return {
    header: decodeJwtPart(parts[0]),
    payload: decodeJwtPart(parts[1]),
    signingInput: `${parts[0]}.${parts[1]}`,
    signature: Buffer.from(parts[2], "base64url")
  };
}

function maxAgeMs(cacheControl) {
  const match = String(cacheControl || "").match(/max-age=(\d+)/i);
  return match ? Number(match[1]) * 1000 : 60 * 60 * 1000;
}

async function getJwks(provider, providerConfig) {
  const cached = jwksCache.get(provider);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;

  const response = await fetch(providerConfig.jwksUrl);
  if (!response.ok) throw new ApiError(503, "oauth_jwks_unavailable", "No pudimos validar el proveedor de acceso");
  const body = await response.json();
  const keys = Array.isArray(body.keys) ? body.keys : [];
  jwksCache.set(provider, { keys, expiresAt: Date.now() + maxAgeMs(response.headers.get("cache-control")) });
  return keys;
}

function verifySignature(header, signingInput, signature, jwk) {
  const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const data = Buffer.from(signingInput);
  if (header.alg === "RS256") return crypto.verify("RSA-SHA256", data, key, signature);
  if (header.alg === "ES256") return crypto.verify("sha256", data, { key, dsaEncoding: "ieee-p1363" }, signature);
  return false;
}

function audienceAllowed(aud, allowedAudiences) {
  const values = Array.isArray(aud) ? aud : [aud];
  return values.some((value) => allowedAudiences.includes(String(value || "")));
}

function emailVerified(value) {
  return value === true || String(value).toLowerCase() === "true";
}

async function verifyProviderIdToken(provider, idToken, options = {}) {
  const normalizedProvider = String(provider || "").trim().toLowerCase();
  const providerConfig = PROVIDERS[normalizedProvider];
  if (!providerConfig) throw new ApiError(400, "unsupported_oauth_provider", "Proveedor de acceso no soportado");

  const allowedAudiences = providerConfig.audiences();
  if (!allowedAudiences.length) {
    throw new ApiError(503, "oauth_provider_not_configured", `Configura el client_id de ${normalizedProvider}`);
  }

  const parsed = splitJwt(idToken);
  if (!providerConfig.algorithms.includes(parsed.header.alg)) {
    throw new ApiError(401, "invalid_oauth_token", "Algoritmo de token no soportado");
  }

  const keys = await getJwks(normalizedProvider, providerConfig);
  const jwk = keys.find((key) => key.kid === parsed.header.kid && (!key.alg || key.alg === parsed.header.alg));
  if (!jwk || !verifySignature(parsed.header, parsed.signingInput, parsed.signature, jwk)) {
    throw new ApiError(401, "invalid_oauth_token", "Firma de proveedor invalida");
  }

  const now = Math.floor(Date.now() / 1000);
  if (!providerConfig.issuers.includes(String(parsed.payload.iss || ""))) {
    throw new ApiError(401, "invalid_oauth_issuer", "Emisor de proveedor invalido");
  }
  if (!audienceAllowed(parsed.payload.aud, allowedAudiences)) {
    throw new ApiError(401, "invalid_oauth_audience", "Token emitido para otro cliente");
  }
  if (!parsed.payload.exp || now > Number(parsed.payload.exp) + CLOCK_SKEW_SECONDS) {
    throw new ApiError(401, "expired_oauth_token", "Token de proveedor expirado");
  }
  if (parsed.payload.nbf && now + CLOCK_SKEW_SECONDS < Number(parsed.payload.nbf)) {
    throw new ApiError(401, "invalid_oauth_token", "Token de proveedor aun no valido");
  }
  if (options.nonce && parsed.payload.nonce !== options.nonce) {
    throw new ApiError(401, "invalid_oauth_nonce", "Nonce de proveedor invalido");
  }

  return {
    provider: normalizedProvider,
    subject: String(parsed.payload.sub || ""),
    email: normalizeEmail(parsed.payload.email),
    emailVerified: emailVerified(parsed.payload.email_verified),
    displayName: parsed.payload.name || "",
    avatarUrl: parsed.payload.picture || "",
    claims: parsed.payload
  };
}

module.exports = { verifyProviderIdToken };
