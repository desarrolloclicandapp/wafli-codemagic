function inc(target, key, amount = 1) {
  const safeKey = String(key || "unknown");
  target[safeKey] = (target[safeKey] || 0) + amount;
}

function scoreBucket(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "unknown";
  if (value >= 85) return "good";
  if (value >= 70) return "watch";
  if (value >= 50) return "weak";
  return "bad";
}

function qualityEventFromGeneration({ action = "unknown", metadata = {}, quality = {}, reportReason = null } = {}) {
  const flags = Array.isArray(quality.flags) ? quality.flags : Array.isArray(metadata.qualityFlags) ? metadata.qualityFlags : [];
  const dialectWarnings = Array.isArray(quality.dialectWarnings) ? quality.dialectWarnings : Array.isArray(metadata.dialectWarnings) ? metadata.dialectWarnings : [];
  const naturalnessFlags = Array.isArray(quality.spanishNaturalnessFlags) ? quality.spanishNaturalnessFlags : Array.isArray(metadata.spanishNaturalnessFlags) ? metadata.spanishNaturalnessFlags : [];
  return {
    action: metadata.action || action,
    agent: metadata.agent || metadata.tone || "unknown",
    variant: metadata.variant || metadata.promptVariant || "unknown",
    responseMove: metadata.responseMove || "unknown",
    situation: metadata.situation || "unknown",
    turnOwner: metadata.turnOwner || "unknown",
    initiativeLevel: metadata.initiativeLevel || "unknown",
    questionPolicy: metadata.questionPolicy || "unknown",
    riskLevel: metadata.riskLevel || "unknown",
    reportReason,
    score: quality.score ?? metadata.humanReplyScore ?? null,
    scoreBucket: scoreBucket(quality.score ?? metadata.humanReplyScore),
    flags,
    dialectWarnings,
    naturalnessFlags
  };
}

function summarizeQualityEvents(events = []) {
  const summary = {
    total: events.length,
    byAction: {},
    byAgent: {},
    byVariant: {},
    byResponseMove: {},
    bySituation: {},
    byTurnOwner: {},
    byInitiativeLevel: {},
    byQuestionPolicy: {},
    byRiskLevel: {},
    byScoreBucket: {},
    byFlag: {},
    byDialectWarning: {},
    byNaturalnessFlag: {},
    byReportReason: {}
  };
  for (const event of events) {
    inc(summary.byAction, event.action);
    inc(summary.byAgent, event.agent);
    inc(summary.byVariant, event.variant);
    inc(summary.byResponseMove, event.responseMove);
    inc(summary.bySituation, event.situation);
    inc(summary.byTurnOwner, event.turnOwner);
    inc(summary.byInitiativeLevel, event.initiativeLevel);
    inc(summary.byQuestionPolicy, event.questionPolicy);
    inc(summary.byRiskLevel, event.riskLevel);
    inc(summary.byScoreBucket, event.scoreBucket);
    if (event.reportReason) inc(summary.byReportReason, event.reportReason);
    for (const flag of event.flags || []) inc(summary.byFlag, flag);
    for (const warning of event.dialectWarnings || []) inc(summary.byDialectWarning, warning);
    for (const flag of event.naturalnessFlags || []) inc(summary.byNaturalnessFlag, flag);
  }
  return summary;
}

module.exports = {
  scoreBucket,
  qualityEventFromGeneration,
  summarizeQualityEvents
};
