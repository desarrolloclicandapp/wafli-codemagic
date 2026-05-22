const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeEmail, normalizePhone } = require("../src/utils/normalize");
const { randomToken, hashValue } = require("../src/utils/crypto");
const { sessionIdForUser, normalizeCustomPairingCode } = require("../src/services/whatsappService");
const { anonymize, detectThreadState } = require("../src/services/aiService");
const { calculateAiCost, estimatePromptTokens } = require("../src/services/aiCostService");
const { REGIONAL_VARIANT_CONFIG, VARIANT_PROMPTS, actionPrompt } = require("../src/services/aiPromptRegistry");

test("normalizes email", () => {
  assert.equal(normalizeEmail(" Test@Example.COM "), "test@example.com");
});

test("hash is stable", () => {
  assert.equal(hashValue("abc"), hashValue("abc"));
});

test("random token is url-safe", () => {
  assert.match(randomToken(12), /^[A-Za-z0-9_-]+$/);
});

test("wafli whatsapp session ids are single-user", () => {
  assert.equal(sessionIdForUser(42), "user_42");
});

test("normalizes phone best effort", () => {
  assert.equal(normalizePhone("+34 600 111 222"), "+34600111222");
});

test("baileys custom pairing code must be 8 chars", () => {
  assert.equal(normalizeCustomPairingCode("ab12 cd34"), "AB12CD34");
  assert.throws(() => normalizeCustomPairingCode("123456"), /exactamente 8/);
});

test("ai anonymization masks personal data", () => {
  const result = anonymize("Juan Perez me escribio a juan@example.com y al +595 981 123 456");
  assert.match(result, /\[persona_1\]/);
  assert.match(result, /\[email\]/);
  assert.match(result, /\[telefono\]/);
});

test("ai prompt registry has calibrated spanish variants", () => {  const expectedVariants = [
    "es-AR", "es-BO", "es-CL", "es-CO", "es-CR", "es-CU", "es-DO", "es-EC", "es-ES", "es-GT", "es-HN", "es-MX", "es-NI", "es-PA", "es-PE", "es-PR", "es-PY", "es-SV", "es-US", "es-UY", "es-VE", "es-neutro"
  ];
  assert.deepEqual(Object.keys(VARIANT_PROMPTS).sort(), expectedVariants.sort());
  assert.deepEqual(Object.keys(REGIONAL_VARIANT_CONFIG).sort(), expectedVariants.sort());
  const prompt = actionPrompt("suggest", { spanish_variant: "Argentina", base_tone: "desenfadado" });
  assert.equal(prompt.variant, "es-AR");
  assert.match(prompt.prompt, /español de Argentina/i);
  assert.match(prompt.prompt, /sin prefijos/i);
});

test("ai detects cooled threads", () => {
  const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const state = detectThreadState([{ sender: "me", body: "hola", sent_at: oldDate }]);
  assert.equal(state.cooledThread, true);
  assert.equal(state.waitingForReply, true);
});

test("ai cost uses real OpenAI token usage", () => {
  const result = calculateAiCost({
    model: "gpt-4o-mini",
    usage: {
      prompt_tokens: 1000,
      completion_tokens: 500,
      total_tokens: 1500,
      prompt_tokens_details: { cached_tokens: 200 }
    },
    latencyMs: 1234
  });
  assert.equal(result.inputTokens, 1000);
  assert.equal(result.cachedInputTokens, 200);
  assert.equal(result.outputTokens, 500);
  assert.equal(result.totalTokens, 1500);
  assert.equal(result.estimatedCostUsd, 0.000435);
  assert.equal(result.latencyMs, 1234);
  assert.equal(result.costEstimated, false);
});

test("ai cost falls back to estimated tokens when usage is missing", () => {
  const messages = [
    { role: "system", content: "Responde natural." },
    { role: "user", content: "Hola, que le digo?" }
  ];
  const result = calculateAiCost({
    model: "gpt-4.1-mini",
    usage: null,
    messages,
    outputText: "Decile algo simple."
  });
  assert.equal(result.costEstimated, true);
  assert.ok(result.inputTokens >= estimatePromptTokens(messages));
  assert.ok(result.outputTokens > 0);
  assert.ok(result.estimatedCostUsd > 0);
});
