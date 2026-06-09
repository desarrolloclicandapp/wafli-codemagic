"use strict";

const STABLE_PROMPT_VERSION = "wafli-es-wingman-v1.0.0";

const KNOWN_PROMPT_VERSIONS = Object.freeze({
  "wafli-es-wingman-v1.0.0": Object.freeze({
    label: "stable",
    description: "Stable WaFli Spanish wingman prompt"
  })
});

const PROMPT_VERSION_ALIASES = Object.freeze({
  stable: STABLE_PROMPT_VERSION,
  current: STABLE_PROMPT_VERSION,
  default: STABLE_PROMPT_VERSION,
  "wafli-stable": STABLE_PROMPT_VERSION
});

function requestedPromptVersionFromEnv(env = process.env) {
  if (env.WAFLI_AI_PROMPT_VERSION) {
    return { requested: String(env.WAFLI_AI_PROMPT_VERSION || "").trim(), source: "WAFLI_AI_PROMPT_VERSION" };
  }
  if (env.AI_PROMPT_VERSION) {
    return { requested: String(env.AI_PROMPT_VERSION || "").trim(), source: "AI_PROMPT_VERSION" };
  }
  return { requested: "", source: "default" };
}

function resolveAiPromptVersion(input, source = "manual") {
  const requested = String(input || "").trim();
  if (!requested) {
    return {
      version: STABLE_PROMPT_VERSION,
      requested: null,
      source,
      fallbackUsed: false,
      label: KNOWN_PROMPT_VERSIONS[STABLE_PROMPT_VERSION].label
    };
  }

  const alias = PROMPT_VERSION_ALIASES[requested.toLowerCase()];
  const canonical = alias || requested;
  if (KNOWN_PROMPT_VERSIONS[canonical]) {
    return {
      version: canonical,
      requested,
      source,
      fallbackUsed: false,
      label: KNOWN_PROMPT_VERSIONS[canonical].label
    };
  }

  return {
    version: STABLE_PROMPT_VERSION,
    requested,
    source,
    fallbackUsed: true,
    label: KNOWN_PROMPT_VERSIONS[STABLE_PROMPT_VERSION].label
  };
}

const envSelection = requestedPromptVersionFromEnv();
const ACTIVE_PROMPT_VERSION_META = Object.freeze(resolveAiPromptVersion(envSelection.requested, envSelection.source));
const ACTIVE_PROMPT_VERSION = ACTIVE_PROMPT_VERSION_META.version;

module.exports = {
  ACTIVE_PROMPT_VERSION,
  ACTIVE_PROMPT_VERSION_META,
  KNOWN_PROMPT_VERSIONS,
  STABLE_PROMPT_VERSION,
  resolveAiPromptVersion,
  requestedPromptVersionFromEnv
};
