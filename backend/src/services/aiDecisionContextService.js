"use strict";

const { normalizeProfile } = require("./conversationProfileService");

const DECISION_CONTEXT_VERSION = "ai-decision-context-v2";

function clean(value = "", max = 220) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeAgent(agent = "") {
  const value = clean(agent).toLowerCase();
  if (value.includes("ligoteo") || value.includes("flirt") || value.includes("coqueteo")) return "Ligoteo";
  if (value.includes("amistoso") || value.includes("amigo")) return "Amistoso";
  return "Profesional";
}

function manualProfileSummary(profile = {}) {
  const normalized = normalizeProfile(profile);
  const manual = normalized.manual || {};
  const style = normalized.style || {};
  const fields = [];
  if (manual.relationshipType && manual.relationshipType !== "auto") fields.push(`relacion=${manual.relationshipType}`);
  if (manual.intensity && manual.intensity !== "auto") fields.push(`intensidad=${manual.intensity}`);
  if (manual.addressMode && manual.addressMode !== "auto") fields.push(`trato=${manual.addressMode}`);
  if (manual.initiativeLevel && manual.initiativeLevel !== "auto") fields.push(`iniciativa=${manual.initiativeLevel}`);
  if (style.messageLength) fields.push(`longitud_habitual=${style.messageLength}`);
  if (style.cadence) fields.push(`cadencia=${style.cadence}`);
  if (style.treatment) fields.push(`trato_detectado=${style.treatment}`);
  if (manual.notes) fields.push(`notas=${clean(manual.notes, 180)}`);
  return fields;
}

function normalizeText(value = "") {
  return clean(value, 800).toLowerCase();
}

function detectEvidenceDiscipline({ action = "suggest", payload = {}, contextMetadata = {}, responseMoveState = {} } = {}) {
  const actionKey = clean(action, 40).toLowerCase();
  const situation = normalizeText(responseMoveState.situation || contextMetadata.situation);
  const riskLevel = normalizeText(responseMoveState.riskLevel || contextMetadata.riskLevel || "normal");
  const responseMove = normalizeText(responseMoveState.responseMove || contextMetadata.responseMove);
  const mediaText = normalizeText([
    contextMetadata.mediaContext,
    contextMetadata.mediaNotes,
    contextMetadata.mediaAttached,
    payload.mediaContext,
    payload.quotedMessage
  ].filter(Boolean).join(" "));
  const hasMedia = Boolean(
    contextMetadata.hasMedia ||
    contextMetadata.mediaAttached ||
    payload.mediaContext ||
    /media|imagen|foto|video|audio|documento|sticker|view once|ver una vez|una sola visualizacion/.test(`${situation} ${responseMove} ${mediaText}`)
  );
  const unavailableMedia = /view once|ver una vez|una sola visualizacion|no disponible|no se lee|no se interpreta|descriptor/.test(mediaText);
  const strictRisk = riskLevel === "high" || /professional_friction|view_once|media_context|boundary|space|rewrite/.test(`${situation} ${responseMove}`);
  const mode = unavailableMedia
    ? "visible_or_whatsapp_only"
    : hasMedia
      ? "metadata_and_transcript_only"
      : strictRisk
        ? "facts_first_soft_inference"
        : "facts_plus_creative_inference";
  const creativeScope = actionKey === "rewrite"
    ? "mejorar redaccion, ritmo, claridad y fuerza del borrador sin cambiar su intencion"
    : strictRisk
      ? "ordenar, suavizar, aclarar y elegir el siguiente paso sin agregar hechos nuevos"
      : "variar arranque, ritmo, microgancho, calidez e iniciativa proporcional sin inventar datos";
  return {
    mode,
    factRule: "horas, dias, lugares, acuerdos, contenido multimedia, nombres y promesas deben venir del chat, del contexto manual o de metadata visible",
    inferenceRule: "puede inferir intencion, energia o oportunidad solo como lectura suave; no la declare como hecho si no esta escrito",
    creativeScope,
    forbidden: [
      "inventar contenido de imagen/video/audio/documento",
      "inventar horarios, dias, lugares o acuerdos",
      "reciclar respuestas previas como si fueran nuevas",
      "convertir ejemplos internos en plantilla literal"
    ],
    mediaRequiresNoInvention: hasMedia,
    unavailableMedia
  };
}

function buildFreedomContract({ action = "suggest", agent = "Profesional", responseMoveState = {}, evidenceDiscipline = {} } = {}) {
  const actionKey = clean(action, 40).toLowerCase();
  const agentKey = normalizeAgent(agent);
  const riskLevel = clean(responseMoveState.riskLevel || "normal", 40).toLowerCase();
  const responseMove = clean(responseMoveState.responseMove || "useful_contextual_reply", 80);
  const highFreedomMoves = new Set([
    "accept_and_propose_specific_plan",
    "propose_low_pressure_date",
    "build_connection_with_specific_reaction",
    "playful_reassure_with_hook",
    "make_simple_low_effort_plan",
    "soft_reopen_with_one_hook",
    "give_one_specific_plan_option",
    "answer_personal_question_with_light_hook",
    "useful_contextual_reply",
    "continue_or_reinforce_own_message",
    "rewrite_preserve_user_intent"
  ]);
  const lowFreedom = riskLevel === "high" || evidenceDiscipline.unavailableMedia;
  const mode = lowFreedom
    ? "bounded"
    : actionKey === "rewrite"
      ? "creative_fidelity"
    : highFreedomMoves.has(responseMove)
      ? "creative_contextual"
      : "balanced";
  const agentFreedom = {
    Profesional: "puede elegir estructura clara, orden de prioridades, cierre accionable y microtono humano; no debe adornar, servilizar ni prometer cosas no confirmadas",
    Ligoteo: "puede jugar con chispa, ritmo, imagen verbal y propuesta concreta; no debe reciclar citas genericas, perseguir cada mensaje hacia una cita ni presionar",
    Amistoso: "puede sonar cercano, distraer, proponer algo facil o acompanar; no debe hacer terapia, motivar de manual ni devolver toda la decision"
  }[agentKey] || "puede variar voz y ritmo sin inventar hechos";
  return {
    mode,
    responseMove,
    agentFreedom,
    allowed: [
      "cambiar arranque y estructura",
      "elegir una jugada conversacional compatible con response_move",
      "usar una reaccion humana breve si aporta naturalidad",
      "proponer un siguiente paso solo cuando el contexto lo permite",
      "responder la pregunta actual antes de intentar avanzar",
      "adaptar un plan a preferencias o limites sin convertirlo en drama",
      "crear una frase nueva desde la intencion del chat, no desde ejemplos internos",
      "si existe texto previo o regeneracion, cambiar jugada, imagen o estructura",
      "mantener detalles vivos del mensaje actual aunque el historial tenga senales antiguas",
      "usar una salida menos perfecta pero mas humana si eso evita sonar a plantilla"
    ],
    blocked: [
      "frases comodin repetidas",
      "plantillas cerradas",
      "preguntas para evitar decidir",
      "hechos concretos no soportados por evidencia",
      "copiar micro-ejemplos del prompt como salida literal",
      "reciclar la ultima sugerencia con pequenas variaciones",
      "reactivar chistes, dudas o planes de mensajes antiguos si el ultimo mensaje ya cambio de tema",
      "convertir reescrituras en planes romanticos cuando el borrador solo pide tono o fuerza"
    ],
    shapeGuidance: [
      "no seguir siempre el patron 'muletilla, oracion'",
      "puede ser una frase corta, dos frases naturales o una respuesta con detalle concreto",
      "evitar repetir el mismo cierre emocional, profesional o de baja presion",
      "si hay riesgo de plantilla, elimina la muletilla inicial y empieza por el contenido"
    ],
    qualityTarget: "maximizar health score: utilidad, naturalidad, frescura, ajuste al agente, claridad, evidencia y variante regional",
    decisionStyle: "usar principios positivos y contexto actual antes que una lista de prohibiciones; las reglas son guardarrailes, no guion",
    contextUsePolicy: "mensaje marcado > ultimo mensaje accionable > contexto automatico del chat > contexto opcional del usuario > historial antiguo",
    planningChecklist: [
      "si hay mensaje marcado, responder a ese mensaje; si no, responder al ultimo mensaje accionable",
      "usar el historial solo para desambiguar, nunca para revivir un tema viejo que el ultimo mensaje ya supero",
      "identificar el ultimo mensaje accionable",
      "elegir la jugada conversacional antes de redactar",
      "aportar un valor nuevo o un avance real",
      "decidir si toca conversar, sostener tension, reparar, preguntar algo humano o cerrar un plan",
      "evitar cerrar un plan si la otra persona solo esta charlando o abriendo tema",
      "omitir muletillas iniciales o finales si no aportan tono ni informacion",
      "dejar que el modelo elija la forma final: respuesta directa, reaccion breve, pregunta viva, avance o cierre",
      "verificar que no se recicla una frase reciente",
      "verificar que no se inventan hechos, horarios, lugares ni multimedia"
    ],
    healthyFreedom: "la libertad esta en la forma, el ritmo, el gancho, la iniciativa, la brevedad y la capacidad de seguir conversando; la evidencia, los limites, el mensaje marcado y el turno no se negocian"
  };
}

function buildAiDecisionContext({
  action = "suggest",
  payload = {},
  profile = {},
  contextMetadata = {},
  responseMoveState = {},
  promptConfig = null
} = {}) {
  const agent = normalizeAgent(
    contextMetadata.agent ||
    payload.agent ||
    payload.aiAgent ||
    payload.tone ||
    promptConfig?.agent ||
    promptConfig?.tone ||
    profile.base_tone
  );
  const objective = clean(
    contextMetadata.objective ||
    payload.objective ||
    payload.customObjective ||
    "Auto",
    120
  ) || "Auto";
  const variant = clean(promptConfig?.variant || contextMetadata.variant || profile.spanish_variant || payload.variant || "es-neutro", 40);
  const contactProfile = manualProfileSummary(contextMetadata.conversationProfile || contextMetadata.aiProfile || {});
  const userVoice = [
    profile.spanish_variant ? `variante_preferida=${clean(profile.spanish_variant, 40)}` : "",
    profile.base_tone ? `tono_base=${clean(profile.base_tone, 40)}` : "",
    payload.userContext ? `contexto_extra_usuario=${clean(payload.userContext, 140)}` : ""
  ].filter(Boolean);
  const preferenceAdapter = {
    role: "style_support_only",
    rule: "Las preferencias del usuario y del contacto ajustan voz, trato, longitud e intensidad; no cambian la jugada principal, seguridad ni turno.",
    userVoice,
    contactProfile,
    usedConversationProfile: Boolean(contextMetadata.usedConversationProfile || contactProfile.length)
  };
  const preventionContract = [
    "no_respuesta_generica",
    "no_pregunta_comodin",
    "no_disponibilidad_pasiva",
    "no_hechos_sin_soporte",
    "no_inventar_multimedia",
    "no_plantillas_fijas",
    "no_responder_al_usuario_como_contacto",
    "no_romper_variante_regional",
    "libertad_creativa_con_evidencia",
    "regenerar_distinto_si_hay_texto_previo"
  ];
  const evidenceDiscipline = detectEvidenceDiscipline({
    action,
    payload,
    contextMetadata,
    responseMoveState
  });
  const freedomContract = buildFreedomContract({
    action,
    agent,
    responseMoveState,
    evidenceDiscipline
  });
  return {
    version: DECISION_CONTEXT_VERSION,
    action,
    agent,
    objective,
    variant,
    turnOwner: responseMoveState.turnOwner || contextMetadata.turnOwner || "unknown",
    situation: responseMoveState.situation || contextMetadata.situation || "general_reply",
    responseMove: responseMoveState.responseMove || contextMetadata.responseMove || "useful_contextual_reply",
    initiativeLevel: responseMoveState.initiativeLevel || contextMetadata.initiativeLevel || "medium",
    riskLevel: responseMoveState.riskLevel || contextMetadata.riskLevel || "normal",
    questionPolicy: responseMoveState.questionPolicy || contextMetadata.questionPolicy || "question_only_if_needed",
    agentMission: responseMoveState.agentMission || contextMetadata.agentMission || "",
    agentGuardrails: responseMoveState.agentGuardrails || contextMetadata.agentGuardrails || [],
    requiredOutcome: responseMoveState.requiredOutcome || contextMetadata.requiredOutcome || "",
    decisionPath: responseMoveState.decisionPath || contextMetadata.decisionPath || [],
    preferenceAdapter,
    preventionContract,
    evidenceDiscipline,
    freedomContract,
    feedbackLoop: {
      reportable: true,
      reportToRegression: "Todo reporte IA recurrente debe convertirse en fixture/eval antes de cambiar prompts de forma amplia."
    },
    freshnessContract: {
      latestMessageFirst: true,
      rule: "El ultimo mensaje accionable manda sobre senales antiguas del historial. El historial sirve para tono y continuidad, no para revivir una respuesta vieja.",
      staleContextRule: "Si una palabra o broma aparece solo en mensajes antiguos y no en el turno actual, no la uses como eje de la respuesta."
    }
  };
}

function aiDecisionContextPrompt(decisionContext = {}) {
  if (!decisionContext || typeof decisionContext !== "object") return "";
  const pref = decisionContext.preferenceAdapter || {};
  const userVoice = Array.isArray(pref.userVoice) && pref.userVoice.length ? pref.userVoice.join("; ") : "auto";
  const contactProfile = Array.isArray(pref.contactProfile) && pref.contactProfile.length ? pref.contactProfile.join("; ") : "auto";
  const guardrails = Array.isArray(decisionContext.agentGuardrails) ? decisionContext.agentGuardrails.join(",") : "";
  const prevention = Array.isArray(decisionContext.preventionContract) ? decisionContext.preventionContract.join(",") : "";
  const path = Array.isArray(decisionContext.decisionPath) ? decisionContext.decisionPath.join(" > ") : "";
  const evidence = decisionContext.evidenceDiscipline || {};
  const freedom = decisionContext.freedomContract || {};
  const freshness = decisionContext.freshnessContract || {};
  return [
    `ai_decision_context=${decisionContext.version || DECISION_CONTEXT_VERSION}`,
    `decision_action=${decisionContext.action || "suggest"}`,
    `decision_agent=${decisionContext.agent || "Profesional"}`,
    `decision_objective=${decisionContext.objective || "Auto"}`,
    `decision_variant=${decisionContext.variant || "es-neutro"}`,
    `decision_turn_owner=${decisionContext.turnOwner || "unknown"}`,
    `decision_situation=${decisionContext.situation || "general_reply"}`,
    `decision_response_move=${decisionContext.responseMove || "useful_contextual_reply"}`,
    `decision_initiative=${decisionContext.initiativeLevel || "medium"}`,
    `decision_risk=${decisionContext.riskLevel || "normal"}`,
    `decision_question_policy=${decisionContext.questionPolicy || "question_only_if_needed"}`,
    decisionContext.agentMission ? `decision_agent_mission=${decisionContext.agentMission}` : "",
    guardrails ? `decision_agent_guardrails=${guardrails}` : "",
    decisionContext.requiredOutcome ? `decision_required_outcome=${decisionContext.requiredOutcome}` : "",
    path ? `decision_path=${path}` : "",
    `preference_adapter=${pref.role || "style_support_only"}`,
    `preference_rule=${pref.rule || "Las preferencias ajustan estilo, no la jugada principal."}`,
    `user_voice_support=${userVoice}`,
    `contact_profile_support=${contactProfile}`,
    `prevention_contract=${prevention}`,
    evidence.mode ? `evidence_mode=${evidence.mode}` : "",
    evidence.factRule ? `evidence_fact_rule=${evidence.factRule}` : "",
    evidence.inferenceRule ? `evidence_inference_rule=${evidence.inferenceRule}` : "",
    evidence.creativeScope ? `creative_scope=${evidence.creativeScope}` : "",
    Array.isArray(evidence.forbidden) && evidence.forbidden.length ? `evidence_forbidden=${evidence.forbidden.join(",")}` : "",
    freedom.mode ? `freedom_mode=${freedom.mode}` : "",
    freedom.agentFreedom ? `agent_creative_freedom=${freedom.agentFreedom}` : "",
    Array.isArray(freedom.allowed) && freedom.allowed.length ? `freedom_allowed=${freedom.allowed.join(",")}` : "",
    Array.isArray(freedom.blocked) && freedom.blocked.length ? `freedom_blocked=${freedom.blocked.join(",")}` : "",
    Array.isArray(freedom.shapeGuidance) && freedom.shapeGuidance.length ? `freedom_shape_guidance=${freedom.shapeGuidance.join(" | ")}` : "",
    freedom.qualityTarget ? `quality_target=${freedom.qualityTarget}` : "",
    freedom.decisionStyle ? `decision_style=${freedom.decisionStyle}` : "",
    freedom.contextUsePolicy ? `context_use_policy=${freedom.contextUsePolicy}` : "",
    Array.isArray(freedom.planningChecklist) && freedom.planningChecklist.length ? `planning_checklist=${freedom.planningChecklist.join(" | ")}` : "",
    freedom.healthyFreedom ? `healthy_freedom=${freedom.healthyFreedom}` : "",
    freshness.rule ? `freshness_rule=${freshness.rule}` : "",
    freshness.staleContextRule ? `stale_context_rule=${freshness.staleContextRule}` : "",
    "Regla de interaccion entre capas: evidencia limita hechos; mensaje marcado o ultimo mensaje decide el foco; contexto y response_move aportan señales, no plantillas; agente decide internamente como cumplirlo con libertad de forma; preferencias solo ajustan voz; calidad bloquea salidas genericas, recicladas, inventadas, largas o sin avance.",
    "No uses banco de frases: no copies ejemplos ni respuestas de seguridad. Genera una respuesta nueva desde el ultimo foco real del chat.",
    "Prioridad del ultimo foco: pregunta directa se responde directo; actividad del contacto se respeta sin entrevista; plan pedido se concreta en una sola opcion; entorno profesional se resuelve sin abrir canales innecesarios.",
    "Prohibido si el ultimo foco es estudio/trabajo: preguntar materia, preguntar tema, elogiar como aplicado/a, prometer notas/resultados o ofrecer distraccion. Prohibido si piden plan: menu de opciones, podria/podriamos, algun sitio agradable o devolver la decision.",
    "Autoseleccion interna: antes de responder, imagina 3 opciones distintas, descarta cualquiera que viole turn_guard, evidencia, remitentes o tono, y entrega solo la mejor. No muestres las opciones ni el analisis.",
    "Autocheck final obligatorio: si tu respuesta contiene una palabra o estructura prohibida por turn_guard, reescribela mentalmente antes de entregarla. La respuesta final no debe depender de postprocesado.",
    "Modo una sola llamada: escribe tu mejor respuesta final en este intento. No dependas de reparaciones posteriores, no dejes placeholders, no entregues frases incompletas y no recicles una formula esperando que otro paso la corrija."
  ].filter(Boolean).join("\n");
}

module.exports = {
  DECISION_CONTEXT_VERSION,
  buildAiDecisionContext,
  aiDecisionContextPrompt
};
