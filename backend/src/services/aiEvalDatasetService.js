const SAFE_REPORT_METADATA_KEYS = new Set([
  "source",
  "action",
  "chatId",
  "agent",
  "objective",
  "variant",
  "promptVersion",
  "promptVersionSource",
  "promptVersionRequested",
  "promptVersionFallbackUsed",
  "promptVariant",
  "decisionContextVersion",
  "preferenceAdapterRole",
  "decisionPreventionContract",
  "responseMove",
  "initiativeLevel",
  "turnOwner",
  "questionPolicy",
  "riskLevel",
  "missedOpportunityFlags",
  "qualityFlags",
  "dialectWarnings",
  "spanishNaturalnessFlags",
  "humanReplyScore",
  "humanReplyDimensions",
  "agentFit",
  "nonObviousValue",
  "regenerationSimilarity",
  "objectiveSource",
  "intensity",
  "situation",
  "relationshipType",
  "usedConversationProfile",
  "hasQuotedMessage",
  "hasMediaContext",
  "wasEditedBeforeReport",
  "wasEditedBeforeSend",
  "reportedTextLength",
  "noteLength"
]);

const REASON_EXPECTATIONS = {
  not_helpful: { expectedFlags: ["no_actionable_value", "low_human_rhythm"] },
  wrong_context: { expectedFlags: ["wrong_turn_owner", "missed_opportunity"] },
  sounds_ai: { expectedFlags: ["assistant_phrase", "low_human_rhythm", "repeated_phrase"] },
  wrong_variant: { expectedDialectWarning: true },
  invented: { expectedFlags: ["invented_or_unsupported"], expectedNaturalnessFlag: true },
  wrong_tone: { expectedFlags: ["professional_casual_tail", "agent_mismatch"] },
  incorrect: { expectedFlags: ["wrong_turn_owner", "invented_or_unsupported"] },
  unsafe: { expectedFlags: ["unsafe_or_pressure"] },
  privacy: { expectedFlags: ["privacy_risk"] },
  spam: { expectedFlags: ["spammy_or_salesy"] },
  other: {}
};

function cleanText(value = "", maxLength = 6000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function anonymizeReportText(value = "") {
  return cleanText(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[telefono]")
    .replace(/\b\d{6,}\b/g, "[numero]")
    .replace(/\b[A-Z0-9]{10,}\b/g, "[id]");
}

function sanitizeReportMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const safe = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_REPORT_METADATA_KEYS.has(key)) continue;
    if (value === undefined) continue;
    safe[key] = value;
  }
  return safe;
}

function expectedFromReason(reason = "other") {
  return REASON_EXPECTATIONS[reason] || REASON_EXPECTATIONS.other;
}

function buildReportEvalCase(report = {}, index = 0) {
  const reason = cleanText(report.reason || report.report_reason || "other", 80) || "other";
  const action = cleanText(report.action || report.ai_action || report.metadata?.action || "unknown", 60) || "unknown";
  const generatedText = anonymizeReportText(report.generatedText || report.generated_text || report.text || "");
  const note = anonymizeReportText(report.note || report.report_note || "").slice(0, 1200);
  const metadata = sanitizeReportMetadata({
    ...(report.metadata || {}),
    action
  });
  return {
    id: report.id ? `report_${report.id}` : `report_fixture_${index + 1}`,
    name: cleanText(report.name || `${reason}_${action}_${index + 1}`, 120),
    source: report.fromDb ? "db_report" : "fixture",
    action,
    reason,
    input: [
      `reported_reason=${reason}`,
      `action=${action}`,
      note ? `user_note=${note}` : "",
      metadata.agent ? `agent=${metadata.agent}` : "",
      metadata.variant ? `variant=${metadata.variant}` : ""
    ].filter(Boolean).join("\n"),
    actualOutput: generatedText,
    metadata,
    expected: expectedFromReason(reason)
  };
}

function summarizeEvalCases(cases = []) {
  const summary = {
    total: cases.length,
    byReason: {},
    byAgent: {},
    byVariant: {},
    fromDb: 0
  };
  for (const item of cases) {
    summary.byReason[item.reason] = (summary.byReason[item.reason] || 0) + 1;
    const agent = item.metadata?.agent || "unknown";
    const variant = item.metadata?.variant || "unknown";
    summary.byAgent[agent] = (summary.byAgent[agent] || 0) + 1;
    summary.byVariant[variant] = (summary.byVariant[variant] || 0) + 1;
    if (item.source === "db_report") summary.fromDb += 1;
  }
  return summary;
}

module.exports = {
  SAFE_REPORT_METADATA_KEYS,
  REASON_EXPECTATIONS,
  anonymizeReportText,
  sanitizeReportMetadata,
  expectedFromReason,
  buildReportEvalCase,
  summarizeEvalCases
};
