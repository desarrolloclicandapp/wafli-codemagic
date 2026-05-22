const PRICING_VERSION = "openai-pricing-2026-05-13";
const TOKENS_PER_CHAR_FALLBACK = 0.25;
const TOKENS_PER_QUOTA_GENERATION = 4000;

const OPENAI_TEXT_PRICES_PER_1M = {
  "gpt-4o-mini": { input: 0.15, cachedInput: 0.075, output: 0.6 },
  "gpt-4.1-mini": { input: 0.4, cachedInput: 0.1, output: 1.6 },
  "gpt-5-mini": { input: 0.25, cachedInput: 0.025, output: 2 },
  "gpt-5.4-mini": { input: 0.75, cachedInput: 0.075, output: 4.5 },
};

function normalizeModelId(model = "") {
  const value = String(model || "").trim().toLowerCase();
  if (!value) return "";
  if (OPENAI_TEXT_PRICES_PER_1M[value]) return value;
  if (value.startsWith("gpt-4o-mini")) return "gpt-4o-mini";
  if (value.startsWith("gpt-4.1-mini")) return "gpt-4.1-mini";
  if (value.startsWith("gpt-5-mini")) return "gpt-5-mini";
  if (value.startsWith("gpt-5.4-mini")) return "gpt-5.4-mini";
  return value;
}

function getModelPricing(model = "") {
  return OPENAI_TEXT_PRICES_PER_1M[normalizeModelId(model)] || null;
}

function contentLength(value) {
  if (!value) return 0;
  if (typeof value === "string") return value.length;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + contentLength(item), 0);
  if (typeof value === "object") {
    if (typeof value.text === "string") return value.text.length;
    if (typeof value.content === "string") return value.content.length;
    if (value.type === "image_url" || value.image_url) return 1000;
    return Object.values(value).reduce((sum, item) => sum + contentLength(item), 0);
  }
  return String(value).length;
}

function estimateTokensFromChars(chars = 0) {
  const value = Number(chars || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(1, Math.ceil(value * TOKENS_PER_CHAR_FALLBACK));
}

function estimatePromptTokens(messages = []) {
  if (!Array.isArray(messages)) return 0;
  const chars = messages.reduce((sum, message) => {
    return sum + contentLength(message?.role) + contentLength(message?.content);
  }, 0);
  return estimateTokensFromChars(chars);
}

function readUsageNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return Math.round(number);
  }
  return null;
}

function normalizeUsage(usage = {}, fallback = {}) {
  const inputTokens = readUsageNumber(usage.input_tokens, usage.prompt_tokens);
  const cachedInputTokens = readUsageNumber(
    usage.input_tokens_details?.cached_tokens,
    usage.prompt_tokens_details?.cached_tokens,
    usage.cached_input_tokens
  ) || 0;
  const outputTokens = readUsageNumber(usage.output_tokens, usage.completion_tokens);
  const estimatedInputTokens = estimatePromptTokens(fallback.messages) || estimateTokensFromChars(contentLength(fallback.inputText));
  const estimatedOutputTokens = estimateTokensFromChars(contentLength(fallback.outputText));
  const safeInputTokens = inputTokens ?? estimatedInputTokens;
  const safeOutputTokens = outputTokens ?? estimatedOutputTokens;
  const totalTokens = readUsageNumber(usage.total_tokens) ?? safeInputTokens + safeOutputTokens;
  const estimated = inputTokens === null || outputTokens === null;

  return {
    inputTokens: safeInputTokens,
    cachedInputTokens: Math.min(cachedInputTokens, safeInputTokens),
    outputTokens: safeOutputTokens,
    totalTokens,
    estimated,
  };
}

function roundUsd(value = 0) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Number(number.toFixed(8));
}

function quotaEquivalentGenerations(totalTokens = 0) {
  const tokens = Number(totalTokens || 0);
  if (!Number.isFinite(tokens) || tokens <= 0) return 1;
  return Math.max(1, Math.ceil(tokens / TOKENS_PER_QUOTA_GENERATION));
}

function calculateAiCost({ model, usage = {}, messages = [], inputText = "", outputText = "", latencyMs = null } = {}) {
  const pricing = getModelPricing(model);
  const normalized = normalizeUsage(usage || {}, { messages, inputText, outputText });
  const billableInputTokens = Math.max(0, normalized.inputTokens - normalized.cachedInputTokens);
  const cost = pricing
    ? (
      (billableInputTokens * pricing.input) +
      (normalized.cachedInputTokens * pricing.cachedInput) +
      (normalized.outputTokens * pricing.output)
    ) / 1_000_000
    : 0;

  return {
    model: String(model || ""),
    pricingVersion: PRICING_VERSION,
    pricingKnown: Boolean(pricing),
    inputTokens: normalized.inputTokens,
    cachedInputTokens: normalized.cachedInputTokens,
    outputTokens: normalized.outputTokens,
    totalTokens: normalized.totalTokens,
    quotaEquivalentGenerations: quotaEquivalentGenerations(normalized.totalTokens),
    estimatedCostUsd: roundUsd(cost),
    latencyMs: Number.isFinite(Number(latencyMs)) ? Math.max(0, Math.round(Number(latencyMs))) : null,
    costEstimated: normalized.estimated || !pricing,
  };
}

function combineAiCosts(costs = []) {
  const items = costs.filter(Boolean);
  if (!items.length) return calculateAiCost();
  const totalTokens = items.reduce((sum, item) => sum + Number(item.totalTokens || 0), 0);
  return {
    model: items[0].model || "",
    pricingVersion: items[0].pricingVersion || PRICING_VERSION,
    pricingKnown: items.every((item) => item.pricingKnown),
    inputTokens: items.reduce((sum, item) => sum + Number(item.inputTokens || 0), 0),
    cachedInputTokens: items.reduce((sum, item) => sum + Number(item.cachedInputTokens || 0), 0),
    outputTokens: items.reduce((sum, item) => sum + Number(item.outputTokens || 0), 0),
    totalTokens,
    quotaEquivalentGenerations: quotaEquivalentGenerations(totalTokens),
    estimatedCostUsd: roundUsd(items.reduce((sum, item) => sum + Number(item.estimatedCostUsd || 0), 0)),
    latencyMs: items.reduce((sum, item) => sum + Number(item.latencyMs || 0), 0),
    costEstimated: items.some((item) => item.costEstimated),
  };
}

module.exports = {
  PRICING_VERSION,
  TOKENS_PER_QUOTA_GENERATION,
  OPENAI_TEXT_PRICES_PER_1M,
  normalizeModelId,
  getModelPricing,
  estimateTokensFromChars,
  estimatePromptTokens,
  quotaEquivalentGenerations,
  normalizeUsage,
  calculateAiCost,
  combineAiCosts,
};
