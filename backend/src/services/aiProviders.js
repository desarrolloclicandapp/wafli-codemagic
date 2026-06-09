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
    async complete({ messages, temperature = 0.7, model = config.openai.model }) {
      if (!client) {
        const error = new Error("El servicio de IA no esta configurado.");
        error.code = "ai_not_configured";
        throw error;
      }
      const selectedModel = String(model || config.openai.model || "").trim() || config.openai.model;
      const startedAt = Date.now();
      const completion = await client.chat.completions.create({
        model: selectedModel,
        temperature,
        messages
      }, {
        timeout: config.openai.timeoutMs
      });
      return {
        text: completion.choices?.[0]?.message?.content || "",
        usage: completion.usage || null,
        latencyMs: Date.now() - startedAt,
        raw: {
          id: completion.id || null,
          model: completion.model || selectedModel,
          created: completion.created || null,
          systemFingerprint: completion.system_fingerprint || null
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
