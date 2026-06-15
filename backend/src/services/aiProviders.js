const OpenAI = require("openai");
const { config } = require("../config/env");

let toFile = OpenAI.toFile || null;
try {
  if (!toFile) toFile = require("openai/uploads").toFile;
} catch (_) {}

let openaiClient = null;

function extensionForMime(mimeType = "") {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  return "bin";
}

function getOpenAIClient() {
  if (!config.openai.apiKey) return null;
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  return openaiClient;
}

function configuredProviderName() {
  return String(config.ai?.provider || "openai").trim().toLowerCase();
}

// Modelos de razonamiento (familia gpt-5 y o-series) solo aceptan la temperatura
// por defecto; enviar un valor distinto devuelve 400. Los detectamos para omitir
// el parametro de forma proactiva.
function modelOnlySupportsDefaultTemperature(model = "") {
  return /^(?:gpt-5|o1|o3|o4)/i.test(String(model || "").trim());
}

// Los modelos de razonamiento aceptan reasoning_effort; los demas lo rechazan.
function modelSupportsReasoningEffort(model = "") {
  return /^(?:gpt-5|o1|o3|o4)/i.test(String(model || "").trim());
}

// El parametro verbosity es de la familia gpt-5.
function modelSupportsVerbosity(model = "") {
  return /^gpt-5/i.test(String(model || "").trim());
}

// Memoria en proceso de modelos que rechazaron temperature/reasoning_effort/verbosity,
// para no repetir la llamada fallida en peticiones posteriores.
const modelsRejectingTemperature = new Set();
const modelsRejectingReasoningEffort = new Set();
const modelsRejectingVerbosity = new Set();

function isUnsupportedVerbosityError(error) {
  const status = error?.status || error?.response?.status;
  const message = String(error?.message || error?.error?.message || "").toLowerCase();
  return (status === 400 || status === 422) && message.includes("verbosity");
}

function isUnsupportedTemperatureError(error) {
  const status = error?.status || error?.response?.status;
  const message = String(error?.message || error?.error?.message || "").toLowerCase();
  return (status === 400 || status === 422) && message.includes("temperature");
}

function isUnsupportedReasoningEffortError(error) {
  const status = error?.status || error?.response?.status;
  const message = String(error?.message || error?.error?.message || "").toLowerCase();
  return (status === 400 || status === 422) && message.includes("reasoning");
}

function getTextProvider() {
  const provider = configuredProviderName();
  if (provider !== "openai") {
    return {
      provider,
      model: config.openai.model,
      configured: false,
      async complete() {
        const error = new Error(`AI provider '${provider}' is not implemented yet.`);
        error.code = "ai_provider_not_implemented";
        throw error;
      },
      async transcribeAudio() {
        return "";
      }
    };
  }

  const client = getOpenAIClient();
  return {
    provider: "openai",
    model: config.openai.model,
    configured: Boolean(client),
    async complete({ messages, temperature = 0.7, model = config.openai.model, reasoningEffort = config.openai.reasoningEffort, verbosity = config.openai.verbosity }) {
      if (!client) {
        const error = new Error("El servicio de IA no esta configurado.");
        error.code = "ai_not_configured";
        throw error;
      }
      const selectedModel = String(model || config.openai.model || "").trim() || config.openai.model;
      const startedAt = Date.now();
      const effort = String(reasoningEffort || "").trim().toLowerCase();
      const verb = String(verbosity || "").trim().toLowerCase();

      // Estado de parametros opcionales; cada uno se desactiva si el modelo lo rechaza.
      const apply = {
        temperature: !modelOnlySupportsDefaultTemperature(selectedModel) && !modelsRejectingTemperature.has(selectedModel),
        reasoning: Boolean(effort) && modelSupportsReasoningEffort(selectedModel) && !modelsRejectingReasoningEffort.has(selectedModel),
        verbosity: Boolean(verb) && modelSupportsVerbosity(selectedModel) && !modelsRejectingVerbosity.has(selectedModel)
      };
      const buildRequest = () => {
        const request = { model: selectedModel, messages };
        if (apply.temperature) request.temperature = temperature;
        if (apply.reasoning) request.reasoning_effort = effort;
        if (apply.verbosity) request.verbosity = verb;
        return request;
      };

      // Reintenta hasta descartar el parametro conflictivo (max 3 reintentos, uno por param).
      let completion;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          completion = await client.chat.completions.create(buildRequest(), { timeout: config.openai.timeoutMs });
          break;
        } catch (error) {
          if (apply.reasoning && isUnsupportedReasoningEffortError(error)) {
            modelsRejectingReasoningEffort.add(selectedModel); apply.reasoning = false; continue;
          }
          if (apply.verbosity && isUnsupportedVerbosityError(error)) {
            modelsRejectingVerbosity.add(selectedModel); apply.verbosity = false; continue;
          }
          if (apply.temperature && isUnsupportedTemperatureError(error)) {
            modelsRejectingTemperature.add(selectedModel); apply.temperature = false; continue;
          }
          throw error;
        }
      }
      return {
        text: completion.choices?.[0]?.message?.content || "",
        usage: completion.usage || null,
        latencyMs: Date.now() - startedAt,
        raw: {
          id: completion.id || null,
          model: completion.model || selectedModel,
          created: completion.created || null,
          systemFingerprint: completion.system_fingerprint || null,
          temperatureApplied: apply.temperature,
          reasoningEffortApplied: apply.reasoning ? effort : null,
          verbosityApplied: apply.verbosity ? verb : null
        }
      };
    },
    async transcribeAudio(mediaRow) {
      if (!client?.audio?.transcriptions?.create || !toFile || !mediaRow?.data) return "";
      const mimeType = mediaRow.mime_type || "audio/ogg";
      const fileName = mediaRow.file_name || `audio.${extensionForMime(mimeType)}`;
      const file = await toFile(mediaRow.data, fileName, { type: mimeType });
      const result = await client.audio.transcriptions.create({
        model: config.openai.transcriptionModel,
        file
      }, {
        timeout: config.openai.timeoutMs
      });
      return result.text?.trim() || "";
    }
  };
}

module.exports = { getTextProvider, extensionForMime };
