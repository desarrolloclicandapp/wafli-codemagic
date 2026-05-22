const EMAIL_RE = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g;
const URL_RE = /\bhttps?:\/\/[^\s]+|\bwww\.[^\s]+/gi;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;
const DNI_RE = /\b(?:dni|cedula|ci|pasaporte|passport|id)\s*[:#-]?\s*[A-Z0-9.-]{5,}\b/gi;
const NAME_RE = /\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2}\b/g;

const COMMON_WORDS = new Set([
  "Audio",
  "Archivo",
  "Borrador",
  "Chat",
  "Contenido",
  "Mensaje",
  "Notas",
  "Tono",
  "WhatsApp",
  "WaFli"
]);

function maskNames(text) {
  const aliases = new Map();
  let index = 1;
  return String(text || "").replace(NAME_RE, (match) => {
    const firstWord = match.split(/\s+/)[0];
    if (COMMON_WORDS.has(firstWord)) return match;
    if (!aliases.has(match)) {
      aliases.set(match, `[persona_${index}]`);
      index += 1;
    }
    return aliases.get(match);
  });
}

function anonymize(text = "") {
  return maskNames(String(text || ""))
    .replace(EMAIL_RE, "[email]")
    .replace(URL_RE, "[url]")
    .replace(DNI_RE, "[documento]")
    .replace(PHONE_RE, "[telefono]");
}

function cleanGeneratedText(text = "") {
  let value = String(text || "")
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim();

  for (let i = 0; i < 4; i += 1) {
    const next = value
      .replace(/^(yo|usuario|user|wa?fli|respuesta|sugerencia|mensaje|opcion\s*\d*)\s*[:.-]\s*/i, "")
      .trim();
    if (next === value) break;
    value = next;
  }

  return value;
}

module.exports = { anonymize, cleanGeneratedText };
