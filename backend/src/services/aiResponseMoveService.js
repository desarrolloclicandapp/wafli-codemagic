"use strict";

const STOP_WORDS = new Set([
  "que",
  "para",
  "pero",
  "con",
  "por",
  "una",
  "uno",
  "los",
  "las",
  "del",
  "estoy",
  "esta",
  "este",
  "eso",
  "asi",
  "como",
  "todo",
  "algo",
  "bien",
  "dale"
]);

function stripAccents(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeSignalText(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contextToText(input, depth = 0) {
  if (!input || depth > 4) return "";
  if (typeof input === "string") return input;
  if (typeof input === "number" || typeof input === "boolean") return String(input);
  if (Array.isArray(input)) {
    return input.map((item) => contextToText(item, depth + 1)).filter(Boolean).join("\n");
  }
  if (typeof input === "object") {
    const priorityKeys = [
      "content",
      "text",
      "body",
      "message",
      "caption",
      "transcript",
      "summary",
      "quotedMessage",
      "mediaContext"
    ];
    const parts = [];
    for (const key of priorityKeys) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        const value = contextToText(input[key], depth + 1);
        if (value) parts.push(value);
      }
    }
    if (parts.length) return parts.join("\n");
    try {
      return JSON.stringify(input);
    } catch (_) {
      return "";
    }
  }
  return "";
}

function previousGeneratedTextFromPayload(payload = {}) {
  const candidates = [
    payload.previousGeneratedText,
    payload.lastGeneratedText,
    payload.generatedText,
    payload.previousText,
    payload.lastSuggestion,
    payload.previousSuggestion,
    payload.metadata && payload.metadata.previousGeneratedText,
    payload.metadata && payload.metadata.lastGeneratedText
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.replace(/\s+/g, " ").trim().slice(0, 800);
    }
  }
  return "";
}

function normalizedTokens(value) {
  return normalizeSignalText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function normalizedSimilarity(a, b) {
  const left = new Set(normalizedTokens(a));
  const right = new Set(normalizedTokens(b));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  const union = new Set([...left, ...right]).size || 1;
  return Number((shared / union).toFixed(2));
}

function normalizeAgent(agent) {
  const value = normalizeSignalText(agent);
  if (value.includes("ligoteo") || value.includes("coqueteo") || value.includes("flirt")) return "ligoteo";
  if (value.includes("amistoso") || value.includes("amigo")) return "amistoso";
  return "profesional";
}

const AGENT_DECISION_ARCHITECTURE = Object.freeze({
  profesional: Object.freeze({
    mission: "resolver_con_siguiente_paso_claro",
    defaultOutcome: "accion_profesional_concreta",
    moveBank: Object.freeze([
      "confirmar_compromiso",
      "pedir_dato_indispensable",
      "asumir_siguiente_paso",
      "cerrar_acuerdo",
      "ordenar_prioridad",
      "suavizar_friccion",
      "dar_avance_sin_pedir_permiso",
      "proponer_dos_rutas_si_hay_incertidumbre",
      "resumir_y_dejar_accion"
    ]),
    guardrails: Object.freeze([
      "no_servilismo",
      "no_mascara_casual",
      "pedir_solo_el_dato_indispensable",
      "no_inventar_documentos_ni_acuerdos",
      "no_repetir_lo_reviso_y_te_confirmo_por_defecto"
    ]),
    creativePrinciples: Object.freeze([
      "elige entre ordenar, resolver, acotar, confirmar o pedir un dato unico segun el caso",
      "usa verbos de accion concretos del chat, no cierre corporativo automatico",
      "varia estructura: una frase directa, dos pasos breves o cierre accionable segun convenga"
    ]),
    freedom: Object.freeze({
      allowed: "ordenar prioridades, proponer el siguiente paso, compactar informacion y elegir una estructura nueva cada vez",
      blocked: "prometer plazos, entregables o acuerdos que no aparecen en el contexto; reciclar cierre profesional generico"
    }),
    healthContract: Object.freeze([
      "aportar avance real aunque la respuesta sea breve",
      "si hay incertidumbre, acotar la decision en vez de delegarla entera",
      "preferir precision util sobre cordialidad de relleno"
    ])
  }),
  ligoteo: Object.freeze({
    mission: "crear_quimica_y_avanzar_sin_presionar",
    defaultOutcome: "avance_natural_de_baja_presion",
    moveBank: Object.freeze([
      "aceptar_y_proponer_plan",
      "coquetear_con_gancho",
      "bajar_presion_sin_apagarse",
      "recuperar_hilo_con_detalle",
      "respetar_limite",
      "subir_iniciativa_si_hay_oportunidad",
      "dar_detalle_del_plan",
      "adaptar_plan_a_limite",
      "responder_pregunta_personal_sin_forzar_cita",
      "cambiar_de_ritmo_si_hay_repeticion",
      "dejar_gancho_sin_convertirlo_en_cita",
      "responder_con_observacion_original"
    ]),
    guardrails: Object.freeze([
      "no_disponibilidad_pasiva",
      "no_pregunta_generica",
      "no_intensidad_excesiva",
      "respetar_limites_y_tiempos",
      "no_reinvitar_si_hay_limite",
      "no_convertir_toda_charla_en_cita",
      "no_reciclar_tomamos_algo_seguimos_con_calma",
      "no_repetir_muletillas_de_baja_presion"
    ]),
    creativePrinciples: Object.freeze([
      "responde primero al ultimo mensaje real antes de intentar avanzar",
      "si hay oportunidad, elige una jugada fresca: detalle, humor suave, reto pequeno, plan concreto o retirada elegante",
      "al regenerar cambia la jugada o la imagen, no solo sinonimos"
    ]),
    freedom: Object.freeze({
      allowed: "variar chispa, arranque, energia, imagen verbal y propuesta concreta si hay oportunidad",
      blocked: "reciclar formulas de cita, repetir cierres de baja presion, inventar intimidad o presionar"
    }),
    healthContract: Object.freeze([
      "responder al ultimo mensaje antes de intentar avanzar",
      "si hay quimica, elegir una jugada fresca: humor suave, detalle, reto pequeno, propuesta o retirada elegante",
      "si hay limite o cansancio, bajar intensidad sin apagar la conversacion ni insistir",
      "no convertir cada intercambio en cierre de cita; si la otra persona conversa, conversa primero",
      "ante saludos, preguntas simples o disponibilidad actual, responder vivo y abrir hilo, no disculparse ni cerrar",
      "si ya hay plan acordado, no seguir cerrando; sumar cercania, anticipacion o un detalle ligero"
    ])
  }),
  amistoso: Object.freeze({
    mission: "acompanar_y_desbloquear_sin_sonar_terapeuta",
    defaultOutcome: "apoyo_o_plan_simple",
    moveBank: Object.freeze([
      "acompanar_sin_interrogar",
      "proponer_plan_simple",
      "validar_y_bajar_carga",
      "ofrecer_presencia_concreta",
      "cerrar_con_calma",
      "hacer_facil_responder",
      "distraer_con_algo_ligero",
      "dar_permiso_para_no_responder",
      "convertir_bajon_en_paso_pequeno"
    ]),
    guardrails: Object.freeze([
      "no_voz_de_terapia",
      "no_devolver_toda_la_decision",
      "no_interrogatorio",
      "no_asumir_intimidad_en_grupos",
      "no_repetir_aqui_estoy_como_formula",
      "no_frases_motivacionales_de_manual"
    ]),
    creativePrinciples: Object.freeze([
      "elige entre acompanar, distraer, facilitar, proponer algo simple o dejar una puerta abierta",
      "usa detalles cotidianos del chat para sonar cercano, no soporte generico",
      "si la persona cierra, respeta el cierre sin convertirlo en charla larga"
    ]),
    freedom: Object.freeze({
      allowed: "acompanar con naturalidad, proponer algo facil, aliviar carga o dejar una puerta simple con forma nueva",
      blocked: "diagnosticar, motivar de manual, repetir apoyo generico o convertir todo en plan"
    }),
    healthContract: Object.freeze([
      "hacer facil responder sin convertir todo en pregunta",
      "si la persona esta mal, acompanar con algo concreto o cotidiano",
      "si la persona cierra, respetar el cierre con calidez breve"
    ])
  })
});

function architectureForAgent(agentKey) {
  return AGENT_DECISION_ARCHITECTURE[agentKey] || AGENT_DECISION_ARCHITECTURE.profesional;
}

function detectTurnOwner(metadata = {}) {
  const sender = normalizeSignalText(metadata.targetMessageSender || metadata.lastMessageSender || metadata.sender || "");
  const owner = normalizeSignalText(metadata.turnOwner || "");
  if (owner === "user" || owner === "me" || owner === "yo") return "user";
  if (owner === "contact" || owner === "other" || owner === "contacto") return "contact";
  if (sender === "me" || sender === "yo" || sender === "user") return "user";
  if (sender === "contact" || sender === "contacto" || sender === "other") return "contact";
  if (metadata.lastMessageFromUser || metadata.targetMessageFromUser) return "user";
  if (metadata.lastMessageFromContact || metadata.targetMessageFromContact) return "contact";
  return "unknown";
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function currentFocusFromContext(rawContext = "", metadata = {}) {
  const metadataFocus = contextToText(metadata.targetMessage || metadata.targetMessageText || metadata.currentMessage);
  if (metadataFocus) return metadataFocus;

  const value = String(rawContext || "");
  const quotedMatch = value.match(/mensaje_citado_para_responder:[^\n]*texto=([^\n]+)/i);
  if (quotedMatch?.[1]) return quotedMatch[1];

  const targetMatch = value.match(/mensaje_objetivo_actual[^\n]*:\s*\n([^\n]+)/i);
  if (targetMatch?.[1]) return targetMatch[1];

  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(?:response_move_layer|ai_decision_context|contexto_|metadata_|perfil_|historial_|mensajes?_recientes|chat_id|user_id)\b/i.test(line));
  if (lines.length > 3) {
    return lines.slice(-6).join("\n");
  }

  return value;
}

function rewriteDraftFromContext(rawContext = "", metadata = {}) {
  const metadataDraft = contextToText(
    metadata.draft ||
    metadata.userDraft ||
    metadata.baseMessage ||
    metadata.messageBase ||
    metadata.rewriteDraft
  );
  if (metadataDraft) return metadataDraft;

  const value = String(rawContext || "");
  const patterns = [
    /(?:borrador_usuario|mensaje_base_usuario|texto_base_usuario|draft_usuario|idea_base_usuario_no_enviada)\s*:\s*([^\n]+)/i,
    /(?:mensaje\s+base|borrador|reescribir)\s*:\s*([^\n]+)/i
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function decision({ situation, responseMove, initiativeLevel = "medium", flags = [], instruction = "", riskLevel = "normal", questionPolicy = "question_only_if_needed", decisionPath = [], requiredOutcome = "" }) {
  return {
    situation,
    responseMove,
    initiativeLevel,
    flags,
    instruction,
    riskLevel,
    questionPolicy,
    decisionPath,
    requiredOutcome
  };
}

function detectResponseMove({
  action = "suggest",
  agent,
  objective,
  context,
  metadata = {},
  previousGeneratedText = ""
} = {}) {
  const rawContext = contextToText(context);
  const rewriteDraftText = action === "rewrite" ? rewriteDraftFromContext(rawContext, metadata) : "";
  const currentText = normalizeSignalText([
    currentFocusFromContext(rawContext, metadata),
    rewriteDraftText,
    contextToText(metadata.quotedMessage),
    contextToText(metadata.mediaContext)
  ].filter(Boolean).join("\n"));
  const text = normalizeSignalText([
    rawContext,
    contextToText(metadata.quotedMessage),
    contextToText(metadata.mediaContext),
    objective
  ].filter(Boolean).join("\n"));
  const signalText = currentText || text;
  const actionKey = normalizeSignalText(action) || "suggest";
  const agentKey = normalizeAgent(agent || metadata.agent || metadata.tone);
  const turnOwner = detectTurnOwner(metadata);
  const flags = [];
  const decisionPath = [`agent:${agentKey}`, `action:${actionKey}`];
  const architecture = architectureForAgent(agentKey);

  const invitationTonight = agentKey === "ligoteo"
    && hasAny(signalText, [/\b(esta noche|hoy|mas tarde|al rato|despues)\b/])
    && hasAny(signalText, [/\b(planes|tenes planes|tienes planes|salir|hacer algo|tomar algo|vernos)\b/]);
  const openRomanticDoor = agentKey === "ligoteo"
    && hasAny(signalText, [/\b(ganas de hablar|ganas de verte|me gusto verte|me ha gustado verte|tomamos algo|seguimos hablando|seguimos charlando)\b/]);
  const playfulDoubt = agentKey === "ligoteo"
    && hasAny(signalText, [/\b(sera|seguro|ah si|asi nomas|en serio|de verdad)\b/]);
  const apologyOrDelay = agentKey === "ligoteo"
    && hasAny(signalText, [/\b(perdon|disculpa|se me fue|no pude|colgue|tarde|demore|demora|ocupad[oa])\b/]);
  const boundarySignal = agentKey === "ligoteo"
    && hasAny(signalText, [/\b(no quiero|prefiero no|no puedo|otro momento|mas adelante|no me apetece|no tengo ganas|mejor otro dia|mejor otro d[ií]a)\b/]);
  const pressureBoundarySignal = agentKey === "ligoteo"
    && hasAny(signalText, [/\b(no quiero salir|no quiero quedar|no quiero vernos|no puedo|no estoy libre|no me presiones|no me presion[eé]s|no es buen dia|no es buen día|hoy no|ahora no|solo que no me presiones)\b/]);
  const softCloseSignal = agentKey === "ligoteo"
    && hasAny(signalText, [/\b(cuidate|cuídate|hablamos luego|hablamos despues|hablamos después|nos hablamos|hasta luego|me voy|chau|adios|adiós)\b/]);
  const noAlcoholPreference = agentKey === "ligoteo"
    && hasAny(signalText, [/\b(no tomo alcohol|no bebo alcohol|no bebo|no tomo|sin alcohol|no alcohol|no me gusta tomar)\b/]);
  const asksPlanDetails = agentKey === "ligoteo"
    && hasAny(signalText, [/\b(algo como que|como que|como qu[eé]|que cosa|qu[eé] cosa|que plan|qu[eé] plan|a donde|adonde|donde|d[oó]nde)\b/]);
  const personalSmallTalkQuestion = agentKey === "ligoteo"
    && hasAny(signalText, [/\b(que me contas de tu dia|que me cuentas de tu dia|que contas de tu dia|que cuentas de tu dia|como estuvo tu dia|que tal tu dia|que andas haciendo|que haces hoy|y vos)\b/]);
  const noJealousGoal = agentKey === "ligoteo"
    && hasAny(text, [/\b(celos|celoso|celosa|reclamar|sin reclamar|sin sonar celoso|sin sonar celosa)\b/]);
  const laughterOrCompliment = agentKey === "ligoteo"
    && hasAny(text, [/\b(jaja|jajaja|risa|reir|sonrisa|me hiciste reir|me caes bien|me caiste bien|lindo|linda|guapo|guapa)\b/]);
  const professionalTask = agentKey === "profesional"
    && hasAny(text, [/\b(cliente|jefe|presupuesto|pago|factura|documento|reunion|tarea|entrega|plazo|confirmar|revisar)\b/]);
  const professionalConflict = agentKey === "profesional"
    && hasAny(text, [/\b(reclamo|molest|queja|incidencia|urgente|fallo|error|problema|no llego|no funciona)\b/]);
  const friendNeedsPlan = agentKey === "amistoso"
    && hasAny(text, [/\b(no se que hacer|que hacemos|hacemos algo|planes|acompanas|necesito ayuda|estoy bajon|estoy mal)\b/]);
  const friendNeedsSupport = agentKey === "amistoso"
    && hasAny(text, [/\b(mal dia|mal d[ií]a|no fue mi mejor dia|no fue mi mejor d[ií]a|agotad[oa]|cansad[oa]|molid[oa]|triste|bajon|baj[oó]n)\b/]);
  const friendNeedsSpace = agentKey === "amistoso"
    && hasAny(text, [/\b(no tengo ganas de hablar|prefiero no hablar|no quiero hablar|hoy no puedo hablar|necesito espacio|dejame descansar|d[eé]jame descansar)\b/]);
  const mediaContext = Boolean(metadata.hasMedia || metadata.mediaContext || metadata.hasImage || metadata.hasVideo || metadata.hasDocument || metadata.hasAudio || text.includes("view once") || text.includes("ver una vez"));
  const viewOnceContext = text.includes("view once") || text.includes("ver una vez") || text.includes("una sola visualizacion");
  const coldThread = actionKey.includes("reactivate") || metadata.isColdThread || metadata.threadState === "cold";
  const rewriteChallengeIntent = actionKey === "rewrite"
    && hasAny(normalizeSignalText(rewriteDraftText || rawContext), [/\b(nervios|atrev|anim|miedo|verg[uü]enza|valor|coraje|ganen)\b/]);
  const rewritePlanDriftRisk = actionKey === "rewrite"
    && rewriteChallengeIntent
    && agentKey === "ligoteo";

  let selected = null;
  if (actionKey === "rewrite") {
    selected = decision({
      situation: "rewrite_user_draft",
      responseMove: "rewrite_preserve_user_intent",
      initiativeLevel: "medium",
      flags: ["rewrite_preserve_draft", "history_style_only", rewriteChallengeIntent ? "rewrite_preserve_challenge_intent" : ""].filter(Boolean),
      instruction:
        rewritePlanDriftRisk
          ? "Reescribe solo el borrador del usuario. Conserva la provocacion suave sobre nervios/atreverse/animarse. No lo conviertas en invitacion, plan, cita, disponibilidad ni cierre romantico si el borrador no lo pide."
          : "Reescribe solo el borrador del usuario. Conserva su intencion, su destinatario y su energia; el historial solo aporta tono/contexto y no puede convertir el borrador en una respuesta nueva, una cita o un plan si el borrador no lo pide.",
      questionPolicy: "avoid_question",
      decisionPath: [...decisionPath, "action:rewrite", "source:draft"],
      requiredOutcome: "misma_intencion_mejor_redactada"
    });
  } else if (actionKey === "suggest" && turnOwner === "user") {
    selected = decision({
      situation: "own_message_followup",
      responseMove: "continue_or_reinforce_own_message",
      initiativeLevel: "medium",
      flags: ["own_turn_requires_followup"],
      instruction: "Do not answer the user as if you were the contact. Continue, clarify or reinforce the user's own message.",
      questionPolicy: "avoid_question",
      decisionPath: [...decisionPath, "turn:user"]
    });
  } else if (viewOnceContext) {
    selected = decision({
      situation: "view_once_media",
      responseMove: "defer_to_whatsapp_without_inventing",
      initiativeLevel: "low",
      flags: ["media_requires_whatsapp_review", "media_requires_no_invention"],
      instruction: "Say the media must be checked in WhatsApp and do not describe its content.",
      riskLevel: "high",
      questionPolicy: "avoid_question",
      decisionPath: [...decisionPath, "media:view_once"]
    });
  } else if (pressureBoundarySignal || softCloseSignal || boundarySignal) {
    selected = decision({
      situation: pressureBoundarySignal || softCloseSignal ? "romantic_boundary_or_soft_close" : "romantic_boundary_or_low_energy",
      responseMove: "respect_boundary_with_warmth",
      initiativeLevel: "low",
      flags: ["respect_boundary", "avoid_pressure", "avoid_reopen_question", "no_reinvite_after_refusal"],
      instruction: "Respect the boundary warmly. If the contact said no, no puedo, no quiero salir, no me presiones, or closed with hablamos luego/cuidate, do not propose meeting, do not ask if they are free, and do not reopen the plan. Answer any small-talk briefly or close warmly.",
      riskLevel: pressureBoundarySignal || softCloseSignal ? "high" : "medium",
      questionPolicy: "avoid_question",
      decisionPath: [...decisionPath, "risk:boundary", pressureBoundarySignal ? "boundary:explicit_no" : "", softCloseSignal ? "boundary:soft_close" : ""].filter(Boolean),
      requiredOutcome: pressureBoundarySignal || softCloseSignal ? "respeto_sin_reinvitar_ni_presionar" : "calma_respeto_y_puerta_abierta"
    });
  } else if (noAlcoholPreference) {
    selected = decision({
      situation: "romantic_plan_constraint",
      responseMove: "adapt_plan_to_boundary_or_preference",
      initiativeLevel: "medium",
      flags: ["respect_preference", "avoid_alcohol_plan", "no_pressure"],
      instruction: "Acknowledge the preference without making it a big deal. If a plan still fits, offer a simple non-alcohol option like cafe, walk, food, dessert or just chatting; do not repeat tomar algo as alcohol and do not pressure.",
      riskLevel: "medium",
      questionPolicy: "avoid_question_after_proposal",
      decisionPath: [...decisionPath, "preference:no_alcohol"],
      requiredOutcome: "plan_o_respuesta_sin_alcohol_y_sin_presion"
    });
  } else if (asksPlanDetails) {
    selected = decision({
      situation: "plan_detail_requested",
      responseMove: "give_one_specific_plan_option",
      initiativeLevel: "high",
      flags: ["needs_specific_plan", "avoid_repeating_previous_invite"],
      instruction: "The contact is asking what the plan is. Do not repeat the same invitation. Give one concrete, easy option with a small detail, and keep it low pressure.",
      questionPolicy: "avoid_question_after_proposal",
      decisionPath: [...decisionPath, "opportunity:plan_detail_requested"],
      requiredOutcome: "opcion_concreta_sin_repetir_invitacion"
    });
  } else if (personalSmallTalkQuestion) {
    selected = decision({
      situation: "personal_small_talk_question",
      responseMove: "answer_personal_question_with_light_hook",
      initiativeLevel: "medium",
      flags: ["answer_question_first", "avoid_forced_date_plan"],
      instruction: "Answer the personal small-talk question first from the user's voice. Add a light hook or warmth if useful, but do not force a date plan unless the current message explicitly asks for one.",
      questionPolicy: "avoid_generic_question",
      decisionPath: [...decisionPath, "conversation:personal_question"],
      requiredOutcome: "respuesta_a_la_pregunta_con_gancho_ligero"
    });
  } else if (noJealousGoal && apologyOrDelay) {
    selected = decision({
      situation: "delay_without_reclaim",
      responseMove: "reassure_without_reclaiming",
      initiativeLevel: "medium",
      flags: ["avoid_jealousy", "avoid_reclaim", "delay_needs_low_pressure"],
      instruction: "Reassure without asking who, why or details. Keep the door open with low pressure.",
      riskLevel: "medium",
      questionPolicy: "avoid_question",
      decisionPath: [...decisionPath, "risk:no_jealous", "signal:delay"]
    });
  } else if (apologyOrDelay) {
    selected = decision({
      situation: "late_reply_or_apology",
      responseMove: "keep_door_open_after_delay",
      initiativeLevel: "medium",
      flags: ["delay_needs_low_pressure", "avoid_generic_question"],
      instruction: "The contact apologized for replying late. First normalize the delay with a natural phrase like 'no pasa nada', 'cero drama' or 'tranqui'. Then leave one easy path to continue with warmth or light chemistry. Do not complain, do not ask why, do not jump to a date plan.",
      riskLevel: "medium",
      questionPolicy: "avoid_question",
      decisionPath: [...decisionPath, "signal:delay"]
    });
  } else if (invitationTonight) {
    selected = decision({
      situation: "invitation_tonight",
      responseMove: "accept_and_propose_specific_plan",
      initiativeLevel: "high",
      flags: ["open_invitation_opportunity"],
      instruction: "Do not only say availability. Accept the opening and propose a concrete low pressure plan.",
      questionPolicy: "avoid_question_after_proposal",
      decisionPath: [...decisionPath, "opportunity:invitation_tonight"],
      requiredOutcome: "plan_concreto_de_baja_presion"
    });
  } else if (openRomanticDoor) {
    selected = decision({
      situation: "open_romantic_door",
      responseMove: "propose_low_pressure_date",
      initiativeLevel: "high",
      flags: ["romantic_open_door"],
      instruction: "Move the conversation forward with a natural, low pressure invitation.",
      questionPolicy: "avoid_question_after_proposal",
      decisionPath: [...decisionPath, "opportunity:romantic_open_door"]
    });
  } else if (playfulDoubt) {
    selected = decision({
      situation: "playful_doubt",
      responseMove: "playful_reassure_with_hook",
      initiativeLevel: "medium",
      flags: ["playful_doubt_opportunity"],
      instruction: "Answer the doubt playfully and add one small hook, without overexplaining.",
      questionPolicy: "avoid_generic_question",
      decisionPath: [...decisionPath, "opportunity:playful_doubt"]
    });
  } else if (laughterOrCompliment) {
    selected = decision({
      situation: "laughter_or_compliment",
      responseMove: "build_connection_with_specific_reaction",
      initiativeLevel: "medium",
      flags: ["connection_opportunity", "avoid_interview"],
      instruction: "React to the laugh or compliment with a specific human beat. Do not turn it into an interview.",
      questionPolicy: "avoid_generic_question",
      decisionPath: [...decisionPath, "opportunity:laughter_or_compliment"]
    });
  } else if (professionalConflict) {
    selected = decision({
      situation: "professional_friction",
      responseMove: "acknowledge_and_take_ownership",
      initiativeLevel: "high",
      flags: ["professional_risk", "needs_clear_next_step"],
      instruction: "Acknowledge the issue, take the next step, and avoid defensiveness.",
      riskLevel: "high",
      questionPolicy: "ask_only_indispensable_detail",
      decisionPath: [...decisionPath, "risk:professional_friction"]
    });
  } else if (professionalTask) {
    selected = decision({
      situation: "professional_task",
      responseMove: "commit_next_step",
      initiativeLevel: "high",
      flags: ["professional_next_step_needed"],
      instruction: "Resolve with a clear next step, asking only for the indispensable detail if needed.",
      questionPolicy: "ask_only_indispensable_detail",
      decisionPath: [...decisionPath, "opportunity:professional_task"]
    });
  } else if (coldThread) {
    selected = decision({
      situation: "cold_thread",
      responseMove: "soft_reopen_with_one_hook",
      initiativeLevel: "medium",
      flags: ["cold_thread_needs_hook"],
      instruction: "Reopen softly with one relevant hook and no generic check-in.",
      questionPolicy: "one_specific_hook_max",
      decisionPath: [...decisionPath, "action:reactivate_or_cold"]
    });
  } else if (friendNeedsPlan) {
    selected = decision({
      situation: "friend_needs_plan",
      responseMove: "make_simple_low_effort_plan",
      initiativeLevel: "high",
      flags: ["friend_needs_concrete_plan"],
      instruction: "Offer one simple concrete option instead of returning the decision to the other person.",
      questionPolicy: "avoid_question_after_proposal",
      decisionPath: [...decisionPath, "opportunity:friend_needs_plan"],
      requiredOutcome: "opcion_simple_y_facil_de_aceptar"
    });
  } else if (friendNeedsSpace) {
    selected = decision({
      situation: "friend_needs_space",
      responseMove: "respect_space_and_stay_available",
      initiativeLevel: "low",
      flags: ["friend_needs_space", "avoid_interrogatory_support"],
      instruction: "Respect the need for space with a warm, short line. Prefer wording like 'tomate el tiempo que necesites', 'te leo cuando quieras' or 'aca estoy sin presionarte'. Do not ask what happened, do not use therapy voice, and avoid generic support formulas like 'si me necesitas'.",
      riskLevel: "medium",
      questionPolicy: "avoid_question",
      decisionPath: [...decisionPath, "support:friend_needs_space"],
      requiredOutcome: "presencia_sin_presion"
    });
  } else if (friendNeedsSupport) {
    selected = decision({
      situation: "friend_needs_support",
      responseMove: "support_then_offer_simple_presence",
      initiativeLevel: "medium",
      flags: ["friend_needs_support", "avoid_therapy_voice"],
      instruction: "Acknowledge the feeling and offer simple presence or one small practical next step.",
      riskLevel: "medium",
      questionPolicy: "avoid_generic_question",
      decisionPath: [...decisionPath, "support:friend_needs_support"]
    });
  } else if (mediaContext) {
    selected = decision({
      situation: "media_context",
      responseMove: "respond_only_to_visible_media_context",
      initiativeLevel: "low",
      flags: ["media_requires_no_invention"],
      instruction: "Use only visible metadata or user-provided media context; never invent what is inside media.",
      riskLevel: "medium",
      questionPolicy: "ask_only_if_media_description_needed",
      decisionPath: [...decisionPath, "media:descriptor"]
    });
  }

  if (!selected) {
    selected = decision({
      situation: "general_reply",
      responseMove: "useful_contextual_reply",
      initiativeLevel: "medium",
      flags,
      instruction: "Choose the most useful next message for the current chat, not just a polite reaction.",
      decisionPath: [...decisionPath, "fallback:general"]
    });
  }

  const instructionByMove = {
  rewrite_preserve_user_intent:
    "Respeta el borrador como fuente principal: mejora claridad, naturalidad y fuerza, pero no respondas al contacto ni cambies de tema. No recicles planes, citas o frases del historial si no estan en el borrador.",
    accept_and_propose_specific_plan: "Do not only say availability. Accept the opening and propose a concrete low pressure plan.",
    propose_low_pressure_date: "Move the conversation forward with a natural, low pressure invitation.",
    playful_reassure_with_hook: "Answer the doubt playfully and add one small hook, without overexplaining.",
    reassure_without_reclaiming: "Reassure without asking who, why or details. Keep the door open with low pressure.",
    keep_door_open_after_delay: "For a late reply or apology, first say no pasa nada, cero drama or tranqui, then leave an easy warm path to continue. Do not ask why and do not jump to a date plan.",
    build_connection_with_specific_reaction: "React to the laugh or compliment with a specific human beat. Do not turn it into an interview.",
    acknowledge_and_take_ownership: "Acknowledge the issue, take the next step, and avoid defensiveness.",
    support_then_offer_simple_presence: "Acknowledge the feeling and offer simple presence or one small practical next step.",
    respect_boundary_with_warmth: "Respect the boundary warmly. Do not insist, bargain or ask a new plan immediately.",
    respect_space_and_stay_available: "Respect the need for space with a warm, short line like tomar tiempo, te leo cuando quieras or aca estoy sin presionarte. Do not interrogate and avoid generic support formulas.",
    defer_to_whatsapp_without_inventing: "Say the media must be checked in WhatsApp and do not describe its content.",
    commit_next_step: "Resolve with a clear next step, asking only for the indispensable detail if needed.",
    make_simple_low_effort_plan: "Offer one simple concrete option instead of returning the decision to the other person.",
    respond_only_to_visible_media_context: "Use only visible metadata or user-provided media context; never invent what is inside media.",
    soft_reopen_with_one_hook: "Reopen softly with one relevant hook and no generic check-in.",
    continue_or_reinforce_own_message: "Do not answer the user as if you were the contact. Continue, clarify or reinforce the user's own message.",
    adapt_plan_to_boundary_or_preference: "Respect the preference and adapt naturally. Do not make alcohol, pressure or refusal the center.",
    give_one_specific_plan_option: "Give one concrete plan option instead of repeating the invitation.",
    answer_personal_question_with_light_hook: "Answer the question first, then add one light hook without forcing a date.",
    useful_contextual_reply: "Choose the most useful next message for the current chat, not just a polite reaction."
  };

  return {
    situation: selected.situation,
    responseMove: selected.responseMove,
    initiativeLevel: selected.initiativeLevel,
    turnOwner,
    riskLevel: selected.riskLevel,
    questionPolicy: selected.questionPolicy,
    decisionPath: selected.decisionPath,
    agentMission: architecture.mission,
    agentGuardrails: architecture.guardrails,
    agentMoveBank: architecture.moveBank,
    agentCreativePrinciples: architecture.creativePrinciples,
    agentFreedom: architecture.freedom,
    agentHealthContract: architecture.healthContract,
    requiredOutcome: selected.requiredOutcome || architecture.defaultOutcome,
    missedOpportunityFlags: selected.flags,
    responseMoveInstruction: selected.instruction || instructionByMove[selected.responseMove],
    latestMessagePolicy: "si_hay_mensaje_marcado_ese_manda; si_no_priorizar_ultimo_mensaje_accionable_no_historial_antiguo",
    creativeVarietyPolicy: "si una frase o jugada ya aparecio antes, cambia la intencion, la estructura y el ritmo; elimina muletillas si solo alargan",
    responseHealthTarget: "respuesta_enviable_con_valor_contextual_frescura_y_cero_invencion",
    internalPlanningPolicy: "decide internamente en este orden: a quien respondes, que quiere el ultimo mensaje o marcado, que toca hacer ahora, que no conviene forzar, que valor nuevo aporta y que forma suena humana; entrega solo el mensaje final",
    ruleWeightPolicy: "si una regla generica choca con el ultimo mensaje claro, gana el ultimo mensaje siempre que no haya riesgo; no uses reglas como plantilla de texto",
    previousGeneratedText: previousGeneratedText || null,
    hasPreviousGeneratedText: Boolean(previousGeneratedText),
    regenerationSimilarity: 0
  };
}

function responseMovePrompt(state = {}) {
  if (!state.responseMove && !state.situation) return "";
  const flags = Array.isArray(state.missedOpportunityFlags)
    ? state.missedOpportunityFlags.join(",")
    : "";
  const freedom = state.agentFreedom && typeof state.agentFreedom === "object" ? state.agentFreedom : null;
  return [
    "response_move_layer:",
    `turn_owner=${state.turnOwner || "unknown"}`,
    `situation=${state.situation || "general_reply"}`,
    `response_move=${state.responseMove || "useful_contextual_reply"}`,
    `initiative_level=${state.initiativeLevel || "medium"}`,
    `risk_level=${state.riskLevel || "normal"}`,
    `question_policy=${state.questionPolicy || "question_only_if_needed"}`,
    state.agentMission ? `agent_mission=${state.agentMission}` : "",
    Array.isArray(state.agentGuardrails) && state.agentGuardrails.length ? `agent_guardrails=${state.agentGuardrails.join(",")}` : "",
    Array.isArray(state.agentMoveBank) && state.agentMoveBank.length ? `agent_move_bank=${state.agentMoveBank.join(",")}` : "",
    Array.isArray(state.agentCreativePrinciples) && state.agentCreativePrinciples.length ? `agent_creative_principles=${state.agentCreativePrinciples.join(" | ")}` : "",
    Array.isArray(state.agentHealthContract) && state.agentHealthContract.length ? `agent_health_contract=${state.agentHealthContract.join(" | ")}` : "",
    freedom?.allowed ? `agent_freedom_allowed=${freedom.allowed}` : "",
    freedom?.blocked ? `agent_freedom_blocked=${freedom.blocked}` : "",
    state.latestMessagePolicy ? `latest_message_policy=${state.latestMessagePolicy}` : "",
    state.creativeVarietyPolicy ? `creative_variety_policy=${state.creativeVarietyPolicy}` : "",
    state.responseHealthTarget ? `response_health_target=${state.responseHealthTarget}` : "",
    state.internalPlanningPolicy ? `internal_planning_policy=${state.internalPlanningPolicy}` : "",
    state.ruleWeightPolicy ? `rule_weight_policy=${state.ruleWeightPolicy}` : "",
    state.requiredOutcome ? `required_outcome=${state.requiredOutcome}` : "",
    `instruction=${state.responseMoveInstruction || "Choose the most useful next message."}`,
    Array.isArray(state.decisionPath) && state.decisionPath.length ? `decision_path=${state.decisionPath.join(" > ")}` : "",
    flags ? `opportunity_flags=${flags}` : ""
  ].filter(Boolean).join("\n");
}

module.exports = {
  AGENT_DECISION_ARCHITECTURE,
  contextToText,
  detectResponseMove,
  normalizedSimilarity,
  previousGeneratedTextFromPayload,
  responseMovePrompt
};
