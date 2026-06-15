const { ACTIVE_PROMPT_VERSION, ACTIVE_PROMPT_VERSION_META } = require("./aiPromptVersionService");

const PROMPT_VERSION = ACTIVE_PROMPT_VERSION;

const REGIONAL_VARIANT_CONFIG = {
  "es-ES": {
    country: "España",
    localeLabel: "España",
    dialect: "español de España",
    treatment: "tuteo natural, claro y directo",
    regionalGuidance: "usa giros cotidianos de España solo si encajan con el historial",
    signals: "vale, genial, planazo, luego, que no es plan, tranqui, mola, buena pinta, apetece",
    examples: "Vale, nos vemos a las 21 entonces; tranqui, descansa un rato y luego vemos; pues mira, me salió bien el chiste; tiene buena pinta",
    avoid: "latinoamericanismos evidentes, tono castizo forzado o expresiones de doblaje",
  },
  "es-MX": {
    country: "México",
    localeLabel: "México",
    dialect: "español de México",
    treatment: "tuteo cercano, amable y respetuoso",
    regionalGuidance: "usa naturalidad mexicana sin llenar la respuesta de modismos",
    signals: "va, sale, ahorita, tranqui, luego, esta bueno, me late, platicar, platillo",
    examples: "Va, nos vemos a las 21; sale, descansa un rato y luego vemos; ahorita lo reviso sin apuro; me late ese plan",
    avoid: "slang forzado, exageraciones regionales o frases actuadas",
  },
  "es-AR": {
    country: "Argentina",
    localeLabel: "Argentina",
    dialect: "español de Argentina",
    treatment: "voseo natural cuando el contexto lo permita",
    regionalGuidance: "usa cadencia argentina sutil y expresiones comúnes sin sobreactuar",
    signals: "vos, dale, tranqui, joya, capaz, pinta, piola",
    examples: "Dale, nos vemos a las 21; tranqui, descansá un rato y después vemos; joya, me salió bien el chiste",
    avoid: "lunfardo excesivo, caricatura rioplatense o chistes regionales automáticos",
  },
  "es-CL": {
    country: "Chile",
    localeLabel: "Chile",
    dialect: "español de Chile",
    treatment: "trato cercano, breve y cotidiano",
    regionalGuidance: "usa chilenismos ligeros solo cuando aporten naturalidad",
    signals: "ya, igual, tranqui, piola, bacán, dale, nomás, cachai, tinca, tincó",
    examples: "Ya, nos vemos a las 21; tranqui, descansa un rato nomás; bacán, me salió piola el chiste; me tincó el lugar",
    avoid: "modismos densos, muletillas repetidas o expresiones difíciles de entender",
  },
  "es-PY": {
    country: "Paraguay",
    localeLabel: "Paraguay",
    dialect: "español de Paraguay",
    treatment: "trato cálido, directo y cotidiano",
    regionalGuidance: "prioriza voseo, sencillez y cadencia paraguaya sutil; no mezcles guaraní salvo que el contexto ya lo use",
    signals: "vos, dale, tranqui, sin drama",
    examples: "Dale, vemos eso con calma; vos decime cuándo te queda bien; tranqui, sin drama",
    avoid: "nomás como muletilla decorativa, copado/copada, piola, joya, jopará forzado, regionalismos inventados o traducciones literales",
  },
  "es-UY": {
    country: "Uruguay",
    localeLabel: "Uruguay",
    dialect: "español de Uruguay",
    treatment: "voseo natural y tono cercano cuando encaje",
    regionalGuidance: "usa una cadencia rioplatense suave sin copiar la variante argentina",
    signals: "dale, tranqui, vos, ta, impecable, capaz, pinta, vamo arriba",
    examples: "Dale, nos vemos a las 21; ta, descansa un rato y después vemos; impecable, me alegra que saliera bien; capaz pinta café esta semana",
    avoid: "lunfardo exagerado, caricatura montevideana o muletillas repetidas",
  },
  "es-CO": {
    country: "Colombia",
    localeLabel: "Colombia",
    dialect: "español de Colombia",
    treatment: "trato amable, claro y cercano",
    regionalGuidance: "usa cortesía y calidez colombiana sin sonar ceremonioso",
    signals: "listo, de una, tranqui, bien, chévere, suave",
    avoid: "regionalismos demasiado locales, acento escrito exagerado o tono de call center",
  },
  "es-PE": {
    country: "Perú",
    localeLabel: "Perú",
    dialect: "español de Perú",
    treatment: "trato cordial, simple y cotidiano",
    regionalGuidance: "usa naturalidad peruana de forma sutil y entendible",
    signals: "ya, tranqui, normal, chévere, al toque, bacán, un toque, de todas",
    examples: "Ya, nos vemos a las 21; tranqui, descansa un toque; chévere, lo reviso al toque; de todas, me parece bien",
    avoid: "modismos regionales cerrados, formalidad excesiva o frases acartonadas",
  },
  "es-VE": {
    country: "Venezuela",
    localeLabel: "Venezuela",
    dialect: "español de Venezuela",
    treatment: "trato cercano, expresivo y natural",
    regionalGuidance: "usa calidez venezolana sin volver la respuesta demasiado intensa",
    signals: "dale, fino, tranqui, chamo, buenísimo, qué bueno, pendiente, de pana",
    examples: "Dale, nos vemos a las 21; fino, descansa un rato; qué bueno que salió bien; quedo pendiente sin apuro",
    avoid: "muletillas forzadas, chistes regionales automáticos o exceso de entusiasmo",
  },
  "es-EC": {
    country: "Ecuador",
    localeLabel: "Ecuador",
    dialect: "español de Ecuador",
    treatment: "trato amable, claro y cotidiano",
    regionalGuidance: "mantén una naturalidad ecuatoriana sutil y fácil de entender",
    signals: "ya, listo, tranqui, super, de una, no hay problema, con calma",
    examples: "Ya, nos vemos a las 21; listo, lo reviso con calma; tranqui, no hay problema; de una, me parece bien",
    avoid: "regionalismos muy cerrados, formalidad innecesaria o tono demasiado neutro",
  },
  "es-BO": {
    country: "Bolivia",
    localeLabel: "Bolivia",
    dialect: "español de Bolivia",
    treatment: "trato respetuoso, cálido y directo",
    regionalGuidance: "usa naturalidad boliviana sin exagerar marcas regionales",
    signals: "ya, dale, tranqui, nomás, con calma, sin problema, ahorita",
    examples: "Ya, nos vemos a las 21; dale, descansa nomás; con calma lo reviso; ahorita veo eso sin problema",
    avoid: "localismos inventados, tono rígido o expresiones poco universales",
  },
  "es-CR": {
    country: "Costa Rica",
    localeLabel: "Costa Rica",
    dialect: "español de Costa Rica",
    treatment: "trato amable, tranquilo y cercano",
    regionalGuidance: "usa calidez costarricense de forma sutil y cotidiana",
    signals: "pura vida, tranqui, todo bien, super, de fijo, con calma, buenísimo",
    examples: "Pura vida, nos vemos a las 21; tranqui, descansa con calma; de fijo lo reviso; todo bien, seguimos luego",
    avoid: "ticosismos forzados, exceso de entusiasmo o frases turísticas",
  },
  "es-DO": {
    country: "República Dominicana",
    localeLabel: "República Dominicana",
    dialect: "español de República Dominicana",
    treatment: "trato cercano, espontáneo y respetuoso",
    regionalGuidance: "usa naturalidad dominicana sin escribir fonéticamente ni exagerar el habla",
    signals: "dale, nítido, tranqui, suave, ta bien, ahora, sin coro, activo",
    examples: "Dale, nos vemos a las 21; nítido, descansa un rato; suave, lo reviso ahora; ta bien, seguimos sin coro",
    avoid: "transcripciones de acento, jerga pesada o caricatura caribeña",
  },
  "es-PA": {
    country: "Panamá",
    localeLabel: "Panamá",
    dialect: "español de Panamá",
    treatment: "trato claro, cercano y cotidiano",
    regionalGuidance: "usa naturalidad panameña sutil y compatible con chat real",
    signals: "dale, listo, tranqui, cool, va, suave, de una, sin problema",
    examples: "Dale, nos vemos a las 21; listo, lo reviso suave; tranqui, sin problema; va, me parece bien",
    avoid: "regionalismos forzados, acento escrito o exceso de muletillas",
  },
  "es-GT": {
    country: "Guatemala",
    localeLabel: "Guatemala",
    dialect: "español de Guatemala",
    treatment: "trato amable, cercano y prudente",
    regionalGuidance: "usa naturalidad guatemalteca de forma ligera y entendible",
    signals: "va, dale, tranqui, buena onda, ahorita, de una, sin pena, con calma",
    examples: "Va, nos vemos a las 21; dale, descansa con calma; buena onda, lo reviso ahorita; sin pena, me avisás",
    avoid: "localismos muy cerrados, formalidad rígida o tono artificial",
  },
  "es-SV": {
    country: "El Salvador",
    localeLabel: "El Salvador",
    dialect: "español de El Salvador",
    treatment: "trato cercano, claro y cotidiano",
    regionalGuidance: "usa naturalidad salvadoreña sin exagerar marcas regionales",
    signals: "va, dale, tranqui, chivo, ahorita, sin pena, con calma, todo bien",
    examples: "Va, nos vemos a las 21; chivo, lo reviso ahorita; tranqui, descansa con calma; sin pena, me avisás",
    avoid: "modismos pesados, acento escrito o frases estereotipadas",
  },
  "es-HN": {
    country: "Honduras",
    localeLabel: "Honduras",
    dialect: "español de Honduras",
    treatment: "trato amable, directo y cotidiano",
    regionalGuidance: "usa naturalidad hondureña de forma sutil y clara",
    signals: "dale, va, tranqui, macizo, ahorita, sin pena, con calma, todo bien",
    examples: "Dale, nos vemos a las 21; va, lo reviso ahorita; tranqui, descansa con calma; macizo, seguimos luego",
    avoid: "regionalismos inventados, muletillas excesivas o tono caricaturesco",
  },
  "es-NI": {
    country: "Nicaragua",
    localeLabel: "Nicaragua",
    dialect: "español de Nicaragua",
    treatment: "trato cercano, natural y respetuoso",
    regionalGuidance: "usa naturalidad nicaragüense sin forzar localismos",
    signals: "dale, va, tranqui, tuanis, ahorita, sin pena, con calma, todo bien",
    examples: "Dale, nos vemos a las 21; tuanis, lo reviso ahorita; tranqui, descansa con calma; va, seguimos luego",
    avoid: "modismos densos, acento escrito o estereotipos regionales",
  },
  "es-CU": {
    country: "Cuba",
    localeLabel: "Cuba",
    dialect: "español de Cuba",
    treatment: "trato cercano, expresivo y natural",
    regionalGuidance: "usa calidez cubana con moderación y claridad",
    signals: "dale, asere, tranqui, qué bueno, ahora, suave, sin problema, buenísimo",
    examples: "Dale, nos vemos a las 21; tranqui, descansa ahora; qué bueno que salió bien; suave, lo reviso sin problema",
    avoid: "transcribir acento, exagerar caribeñismos o sonar teatral",
  },
  "es-PR": {
    country: "Puerto Rico",
    localeLabel: "Puerto Rico",
    dialect: "español de Puerto Rico",
    treatment: "trato cercano, cálido y cotidiano",
    regionalGuidance: "usa naturalidad puertorriqueña sin cargar la respuesta de jerga",
    signals: "dale, brutal, tranqui, corillo, ahora, suave, pendiente, buenísimo",
    examples: "Dale, nos vemos a las 21; brutal, lo reviso ahora; tranqui, descansa suave; quedo pendiente sin problema",
    avoid: "spanglish forzado, acento escrito o caricatura caribeña",
  },
  "es-US": {
    country: "Estados Unidos hispanohablante",
    localeLabel: "Hispanos en Estados Unidos",
    dialect: "español usado por hispanohablantes en Estados Unidos",
    treatment: "trato claro, natural y bicultural cuando el contexto lo permita",
    regionalGuidance: "acepta mezcla cultural o spanglish solo si ya aparece en el historial",
    signals: "dale, tranqui, listo, va, meeting, deck, update, check, pendiente",
    examples: "Dale, te mando el deck antes del meeting; listo, lo reviso con calma; va, quedo pendiente; tranqui, hago el update ahora",
    avoid: "spanglish innecesario, traducciones literales del inglés o tono corporativo",
  },
  "es-neutro": {
    country: "contexto hispanohablante amplio",
    localeLabel: "Español neutro",
    dialect: "español neutro internacional",
    treatment: "tuteo claro, cálido y simple",
    regionalGuidance: "usa vocabulario compartido por la mayoría de países hispanohablantes",
    avoid: "regionalismos marcados, tecnicismos innecesarios o tono corporativo",
  },
};

const VARIANT_PROMPTS = Object.fromEntries(
  Object.entries(REGIONAL_VARIANT_CONFIG).map(([key, config]) => [
    key,
    {
      label: config.localeLabel,
      style: buildRegionalStylePrompt(config),
    },
  ])
);

const VARIANT_ALIASES = {
  es: "es-ES",
  "es-es": "es-ES",
  espana: "es-ES",
  spain: "es-ES",
  castellano: "es-ES",
  "castellano-de-espana": "es-ES",
  "espanol-de-espana": "es-ES",
  "espanol-espana": "es-ES",
  europeo: "es-ES",

  mx: "es-MX",
  méxico: "es-MX",
  "es-mx": "es-MX",
  mexicano: "es-MX",
  mexicana: "es-MX",
  "espanol-de-méxico": "es-MX",
  "espanol-méxico": "es-MX",

  ar: "es-AR",
  argentina: "es-AR",
  "es-ar": "es-AR",
  argentino: "es-AR",
  argentinao: "es-AR",
  "espanol-de-argentina": "es-AR",
  "espanol-argentina": "es-AR",

  cl: "es-CL",
  chile: "es-CL",
  "es-cl": "es-CL",
  chileno: "es-CL",
  chilena: "es-CL",
  "espanol-de-chile": "es-CL",
  "espanol-chile": "es-CL",

  py: "es-PY",
  paraguay: "es-PY",
  "es-py": "es-PY",
  paraguayo: "es-PY",
  paraguaya: "es-PY",
  "espanol-de-paraguay": "es-PY",
  "espanol-paraguay": "es-PY",

  uy: "es-UY",
  uruguay: "es-UY",
  "es-uy": "es-UY",
  uruguayo: "es-UY",
  uruguaya: "es-UY",
  "espanol-de-uruguay": "es-UY",
  "espanol-uruguay": "es-UY",

  co: "es-CO",
  colombia: "es-CO",
  "es-co": "es-CO",
  colombiano: "es-CO",
  colombiana: "es-CO",
  "espanol-de-colombia": "es-CO",
  "espanol-colombia": "es-CO",

  pe: "es-PE",
  peru: "es-PE",
  "es-pe": "es-PE",
  peruano: "es-PE",
  peruana: "es-PE",
  "espanol-de-peru": "es-PE",
  "espanol-peru": "es-PE",

  ve: "es-VE",
  venezuela: "es-VE",
  "es-ve": "es-VE",
  venezolano: "es-VE",
  venezolana: "es-VE",
  "espanol-de-venezuela": "es-VE",
  "espanol-venezuela": "es-VE",

  ec: "es-EC",
  ecuador: "es-EC",
  "es-ec": "es-EC",
  ecuatoriano: "es-EC",
  ecuatoriana: "es-EC",
  "espanol-de-ecuador": "es-EC",
  "espanol-ecuador": "es-EC",

  bo: "es-BO",
  bolivia: "es-BO",
  "es-bo": "es-BO",
  boliviano: "es-BO",
  boliviana: "es-BO",
  "espanol-de-bolivia": "es-BO",
  "espanol-bolivia": "es-BO",

  cr: "es-CR",
  "costa-rica": "es-CR",
  costarica: "es-CR",
  "es-cr": "es-CR",
  costarricense: "es-CR",
  tico: "es-CR",
  tica: "es-CR",
  "espanol-de-costa-rica": "es-CR",

  "do": "es-DO",
  dominicana: "es-DO",
  dominicano: "es-DO",
  "republica-dominicana": "es-DO",
  "rep-dominicana": "es-DO",
  "es-do": "es-DO",
  "espanol-de-republica-dominicana": "es-DO",

  pa: "es-PA",
  panama: "es-PA",
  "es-pa": "es-PA",
  panameno: "es-PA",
  panamena: "es-PA",
  "espanol-de-panama": "es-PA",

  gt: "es-GT",
  guatemala: "es-GT",
  "es-gt": "es-GT",
  guatemalteco: "es-GT",
  guatemalteca: "es-GT",
  "espanol-de-guatemala": "es-GT",

  sv: "es-SV",
  "el-salvador": "es-SV",
  salvador: "es-SV",
  salvadoreno: "es-SV",
  salvadorena: "es-SV",
  "es-sv": "es-SV",
  "espanol-de-el-salvador": "es-SV",

  hn: "es-HN",
  honduras: "es-HN",
  "es-hn": "es-HN",
  hondureno: "es-HN",
  hondurena: "es-HN",
  "espanol-de-honduras": "es-HN",

  ni: "es-NI",
  nicaragua: "es-NI",
  "es-ni": "es-NI",
  nicaraguense: "es-NI",
  "espanol-de-nicaragua": "es-NI",

  cu: "es-CU",
  cuba: "es-CU",
  "es-cu": "es-CU",
  cubano: "es-CU",
  cubana: "es-CU",
  "espanol-de-cuba": "es-CU",

  pr: "es-PR",
  "puerto-rico": "es-PR",
  puertorriqueno: "es-PR",
  puertorriquena: "es-PR",
  boricua: "es-PR",
  "es-pr": "es-PR",
  "espanol-de-puerto-rico": "es-PR",

  us: "es-US",
  usa: "es-US",
  eeuu: "es-US",
  "ee-uu": "es-US",
  "estados-unidos": "es-US",
  "hispanos-en-estados-unidos": "es-US",
  "es-us": "es-US",
  "espanol-de-estados-unidos": "es-US",

  neutro: "es-neutro",
  neutral: "es-neutro",
  "es-neutro": "es-neutro",
  internacional: "es-neutro",
  latinoamerica: "es-neutro",
  latam: "es-neutro",
};

const TONE_PROMPTS = {
  profesional: "agente Profesional: claro, preciso, respetuoso y resolutivo. Suena fiable, humano y directo sin volverse corporativo, frio ni servil. Ideal para jefes, clientes, tareas, acuerdos, informacion pendiente y cierres. Tiene libertad para elegir entre responder directo, ordenar, confirmar, avanzar, acotar opciones, corregir un malentendido o pedir un unico dato indispensable. No repite por defecto formulas tipo 'lo reviso y te confirmo' si puede aportar un siguiente paso mas especifico; tampoco alarga por cortesia si una frase clara basta.",
  ligoteo: "agente Ligoteo: cercano, jugueton y con quimica ligera. Busca crear conexion y manejar conversaciones reales con libertad, no sonar como moderador ni como cierre automatico. Primero responde el gesto humano del ultimo mensaje: ganas de verse, cumplido, duda, broma, pregunta o limite. Si la otra persona dice que tiene ganas de verte, pregunta cuando verse o abre una puerta clara, toma iniciativa con una propuesta natural, un detalle coqueto o un cumplido breve. Puede conversar, jugar, proponer, bromear, provocar suave o bajar intensidad segun el contexto. Busca ser enviable y vivo antes que perfecto; habla como persona, no como analista de la conversacion.",
  amistoso: "agente Amistoso: natural, calido y cotidiano. Suena como alguien cercano que acompana, sostiene y conversa sin empalagar, sin terapia improvisada y sin forzar intensidad. Tiene libertad para elegir entre responder simple, acompanar, bromear suave, distraer, facilitar, proponer algo simple, aliviar carga o respetar espacio. Varía la reacción inicial segun el detalle real: no abras siempre con 'qué bajón', 'tranqui' o lamentos equivalentes. No repite apoyo generico tipo 'aqui estoy' como plantilla, no transforma todo en consejo y no devuelve toda la decision al otro.",
  relajado: "tono tranquilo, amable y de baja intensidad. Responde simple, sin presión ni ansiedad.",
  desenfadado: "tono casual, suelto y humano, como chat real. Natural antes que brillante. Reacciona con complicidad o comentario propio antes que cerrar con una pregunta genérica.",
  picante: "tono juguetón y con chispa ligera, siempre respetuoso, consensuado y no invasivo. La chispa debe ser verbal y sutil, no sexual, no insistente y sin doble sentido barato tipo 'cositas'.",
  intelectual: "tono observador, inteligente y claro, sin sonar académico, solemne ni pretencioso. Aporta una lectura breve o una idea con fondo antes que devolver una pregunta. Evita cierres tipo 'quieres que lo repasemos?' o 'lo vemos desde otro ángulo?' salvo que falte contexto real.",
  directo: "tono claro, breve y decidido. Evita rodeos, adornos, explicaciones innecesarias y preguntas de validación.",
  cercano: "tono cálido, humano y accesible, sin intensidad emocional excesiva ni empalago. Acompaña sin invadir.",
  cuidadoso: "tono suave, prudente y respetuoso para contextos delicados, ambiguos o sensibles. Da espacio explícito, sin presionar ni pedir explicación.",
};
function stripAccents(value = "") {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeKey(value = "") {
  return stripAccents(value)
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");
}

function cleanInlineText(value = "", fallback = "") {
  const text = String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return fallback;
  return text.length > 80 ? `${text.slice(0, 80).trim()}...` : text;
}

function normalizeVariant(value = "") {
  const raw = normalizeKey(value);
  return VARIANT_ALIASES[raw] || "es-neutro";
}

function normalizeTone(value = "") {
  const raw = normalizeKey(value);

  if (["profesional", "professional", "trabajo", "laboral", "cliente", "jefe", "formal"].includes(raw)) return "profesional";
  if (["ligoteo", "flirteo", "flirty", "coqueteo", "coqueto", "coqueta", "cita", "citas"].includes(raw)) return "ligoteo";
  if (["amistoso", "amistosa", "amigo", "amiga", "friend", "friendly", "cotidiano"].includes(raw)) return "amistoso";
  if (["relajado", "relaxed", "tranquilo", "suave", "baja-intensidad"].includes(raw)) return "relajado";
  if (["picante", "jugueton", "juguetona", "spicy", "coqueto", "coqueta", "flirty"].includes(raw)) return "picante";
  if (["intelectual", "smart", "observador", "observadora", "reflexivo", "reflexiva"].includes(raw)) return "intelectual";
  if (["directo", "directa", "breve", "claro", "clara"].includes(raw)) return "directo";
  if (["cercano", "cercana", "cálido", "calida", "warm"].includes(raw)) return "cercano";
  if (["cuidadoso", "cuidadosa", "prudente", "sensible", "delicado", "delicada"].includes(raw)) return "cuidadoso";

  return "desenfadado";
}

function normalizeAction(action = "") {
  const raw = normalizeKey(action || "suggest");

  if (["suggest", "sugerir", "respuesta", "responder", "reply", "answer"].includes(raw)) return "suggest";
  if (["rewrite", "reescribir", "mejorar", "editar", "edit", "polish"].includes(raw)) return "rewrite";
  if (["opener", "abrir", "apertura", "inicio", "icebreaker", "start"].includes(raw)) return "opener";
  if (["reactivate", "reactivar", "retomar", "follow-up", "followup", "reopen"].includes(raw)) return "reactivate";
  if (["analyze", "analizar", "analisis", "lectura", "interpretar"].includes(raw)) return "analyze";
  if (["recommend", "recomendar", "recomendacion", "next-move", "movimiento"].includes(raw)) return "recommend";

  return "suggest";
}

function userAlias(profile = {}) {
  return cleanInlineText(
    profile.alias || profile.display_name || profile.name || profile.full_name,
    "yo"
  );
}

function selectedMessageIsFromUser(state = {}) {
  if (!state.hasQuotedMessage && state.targetMessageSource !== "quoted") return false;
  if (state.quotedMessageFromUser === true) return true;
  const sender = normalizeKey(state.quotedMessageSender || state.targetMessageSender || "");
  return ["usuario", "user", "yo", "me", "mine"].includes(sender);
}

function selectedMessageIsFromContact(state = {}) {
  if (!state.hasQuotedMessage && state.targetMessageSource !== "quoted") return false;
  if (state.quotedMessageFromContact === true) return true;
  const sender = normalizeKey(state.quotedMessageSender || state.targetMessageSender || "");
  return ["contacto", "contact", "match", "them", "otra-persona", "other"].includes(sender);
}

function targetMessageIsFromUser(state = {}) {
  if (selectedMessageIsFromUser(state)) return true;
  if (selectedMessageIsFromContact(state)) return false;
  if (state.hasDraft || state.draft) return true;

  const targetSender = normalizeKey(state.targetMessageSender || "");
  if (["usuario", "user", "yo", "me", "mine"].includes(targetSender)) return true;
  if (["contacto", "contact", "match", "them", "otra-persona", "other"].includes(targetSender)) return false;

  const rawTurn = normalizeKey(state.turno_actual || state.turn_actual || state.last_message_from || state.lastMessageFrom || "");
  if (["usuario", "user", "yo", "me", "mine"].includes(rawTurn)) return true;
  if (["contacto", "contact", "match", "them", "otra-persona", "other"].includes(rawTurn)) return false;

  return Boolean(state.lastMessageFromUser);
}

function lastMessageIsFromUser(state = {}) {
  return targetMessageIsFromUser(state);
}

function isGroupThread(state = {}) {
  const rawType = normalizeKey(state.chat_type || state.chatType || state.thread_type || state.threadType || "");
  return Boolean(state.isGroup || state.groupChat || rawType === "grupo" || rawType === "group");
}

function targetPriorityPrompt(state = {}) {
  const source = normalizeKey(state.targetMessageSource || "");

  if (selectedMessageIsFromContact(state)) {
    return [
      "Objetivo actual: hay un mensaje marcado de otra persona.",
      "Responde ese mensaje desde la voz de la persona usuaria.",
      "Usa el historial solo para entender tono, relacion y contexto; no respondas un mensaje mas viejo ni el último mensaje propio."
    ].join(" ");
  }

  if (selectedMessageIsFromUser(state)) {
    return [
      "Objetivo actual: hay un mensaje marcado que escribio la persona usuaria.",
      "No lo contestes como si fueras la otra persona.",
      "Mejoralo, refuerzalo, aclaralo o propon una continuacion natural segun la accion solicitada."
    ].join(" ");
  }

  if (source === "last-inbound" || source === "last_inbound") {
    return [
      "Objetivo actual: responder al ultimo mensaje dicho por otra persona.",
      "El historial anterior ayuda, pero el foco debe ser ese ultimo mensaje ajeno."
    ].join(" ");
  }

  if (targetMessageIsFromUser(state)) {
    return [
      "Objetivo actual: el ultimo movimiento relevante es de la persona usuaria.",
      "No respondas como si fueras el contacto.",
      "Si se pide sugerir, propone un seguimiento propio, una aclaracion o una forma de abrir de nuevo; si se pide reescribir, mejora la idea propia."
    ].join(" ");
  }

  return [
    "Objetivo actual: responder a la otra persona con una sola propuesta lista para enviar.",
    "Prioriza el último mensaje ajeno y no resumas el historial."
  ].join(" ");
}

// Runtime wingman calibration. This intentionally overrides the older text above
// without changing exported API shape.
Object.assign(REGIONAL_VARIANT_CONFIG, {
  "es-ES": { country: "Espana", localeLabel: "Espana", dialect: "espanol de Espana", treatment: "tuteo natural, claro y directo", regionalGuidance: "usa cadencia espanola actual de chat, sin sonar castizo ni de doblaje", signals: "vale, venga, guay, planazo, me apetece, tiene buena pinta, tranqui, luego", examples: "Vale, lo dejamos para las 21; venga, descansamos un rato y luego vemos; tiene buena pinta ese plan", avoid: "latinoamericanismos evidentes, castizo forzado o expresiones de doblaje" },
  "es-MX": { country: "México", localeLabel: "México", dialect: "espanol de México", treatment: "tuteo cercano, amable y respetuoso", regionalGuidance: "usa naturalidad mexicana cotidiana sin llenar la respuesta de modismos", signals: "va, sale, ahorita, tranqui, luego, me late, platicar, chance", examples: "Va, nos vemos a las 21; sale, descansa un rato y luego vemos; me late ese plan", avoid: "slang forzado, exceso de muletillas o frases actuadas" },
  "es-AR": { country: "Argentina", localeLabel: "Argentina", dialect: "espanol de Argentina", treatment: "voseo natural cuando el contexto lo permita", regionalGuidance: "usa cadencia argentina sutil, directa y de WhatsApp real", signals: "vos, dale, tranqui, joya, capaz, pinta, piola, che", examples: "Dale, nos vemos a las 21; tranqui, descansa un rato y despues vemos; joya, me copa ese plan", avoid: "lunfardo pesado, caricatura rioplatense o exceso de che" },
  "es-CL": { country: "Chile", localeLabel: "Chile", dialect: "espanol de Chile", treatment: "trato cercano, breve y cotidiano", regionalGuidance: "usa chilenismos ligeros solo cuando aporten naturalidad", signals: "ya, igual, tranqui, piola, bacán, dale, nomás, cachai, tinca", examples: "Ya, nos vemos a las 21; tranqui, descansa un rato nomás; me tinca ese lugar", avoid: "modismos densos, muletillas repetidas o acento escrito" },
  "es-PY": { country: "Paraguay", localeLabel: "Paraguay", dialect: "espanol de Paraguay", treatment: "voseo calido, directo y cotidiano", regionalGuidance: "prioriza voseo, sencillez y cadencia paraguaya sutil; no mezcles guarani salvo que el historial ya lo use", signals: "vos, dale, tranqui, sin drama", examples: "Dale, vemos eso con calma; vos decime cuando te queda bien; tranqui, sin drama", avoid: "nomas como muletilla decorativa, copado/copada, piola, joya, jopara forzado, regionalismos inventados o traducciones literales" },
  "es-UY": { country: "Uruguay", localeLabel: "Uruguay", dialect: "espanol de Uruguay", treatment: "voseo natural y tono cercano cuando encaje", regionalGuidance: "usa una cadencia rioplatense suave, mas sobria que argentina", signals: "vos, dale, ta, tranqui, capaz, bien de bien, pinta, bo", examples: "Dale, nos vemos a las 21; ta, descansamos un rato y despues vemos; capaz pinta algo tranqui", avoid: "lunfardo exagerado, caricatura montevideana o bo repetido" },
  "es-CO": { country: "Colombia", localeLabel: "Colombia", dialect: "espanol de Colombia", treatment: "trato amable, claro y cercano", regionalGuidance: "usa calidez colombiana sin sonar ceremonioso ni de atencion al cliente", signals: "listo, de una, tranqui, suave, chévere, parce solo si el historial lo permite", examples: "Listo, nos vemos a las 21; de una, descansa un rato y luego vemos; suena chévere ese plan", avoid: "regionalismos demasiado locales, parce forzado o tono de call center" },
  "es-PE": { country: "Perú", localeLabel: "Perú", dialect: "español de Perú", treatment: "trato cordial, simple y cotidiano", regionalGuidance: "usa naturalidad peruana discreta y entendible", signals: "ya, chévere, bacán, tranqui, normal, al toque, de todas maneras", examples: "Ya, nos vemos a las 21; chévere, me gusta ese plan; bacán, lo reviso al toque; tranqui, normal", avoid: "modismos cerrados, formalidad excesiva o frases acartonadas" },
  "es-VE": { country: "Venezuela", localeLabel: "Venezuela", dialect: "espanol de Venezuela", treatment: "trato cercano, expresivo y natural", regionalGuidance: "usa calidez venezolana sin volver la respuesta intensa", signals: "dale, tranqui, fino, buenísimo, va, chamo solo si el historial lo permite", examples: "Dale, nos vemos a las 21; fino, me gusta ese plan; tranqui, cero rollo", avoid: "muletillas forzadas, exceso de entusiasmo o caricatura" },
  "es-EC": { country: "Ecuador", localeLabel: "Ecuador", dialect: "espanol de Ecuador", treatment: "trato amable, claro y cotidiano", regionalGuidance: "mantiene una naturalidad ecuatoriana sutil y facil de entender", signals: "ya, listo, tranqui, de una, bacán, no más", examples: "Ya, nos vemos a las 21; listo, descansa un rato y luego vemos; bacán ese plan", avoid: "regionalismos cerrados, formalidad innecesaria o tono demasiado neutro" },
  "es-BO": { country: "Bolivia", localeLabel: "Bolivia", dialect: "espanol de Bolivia", treatment: "trato respetuoso, cálido y directo", regionalGuidance: "usa naturalidad boliviana sin exagerar marcas regionales", signals: "ya, listo, tranqui, nomás, de una, está bien", examples: "Ya, nos vemos a las 21; listo, descansa nomás; tranqui, está bien así", avoid: "localismos inventados, tono rígido o exagerar cortesias" },
  "es-CR": { country: "Costa Rica", localeLabel: "Costa Rica", dialect: "espanol de Costa Rica", treatment: "trato amable, tranquilo y cercano", regionalGuidance: "usa calidez costarricense de forma sutil y cotidiana", signals: "pura vida, tuanis, tranqui, listo, de una, suave", examples: "Listo, nos vemos a las 21; pura vida, descansamos un rato y luego vemos; suena tuanis ese plan", avoid: "ticosismos forzados, frases turisticas o pura vida como muletilla" },
  "es-DO": { country: "Republica Dominicana", localeLabel: "Republica Dominicana", dialect: "espanol de Republica Dominicana", treatment: "trato cercano, espontaneo y respetuoso", regionalGuidance: "usa naturalidad dominicana sin escribir foneticamente ni exagerar el habla", signals: "dale, tranqui, nítido, suave, ta bien", examples: "Dale, nos vemos a las 21; nítido, me gusta ese plan; tranqui, cero presion", avoid: "transcribir acento, jerga pesada o caricatura caribena" },
  "es-PA": { country: "Panama", localeLabel: "Panama", dialect: "espanol de Panama", treatment: "trato claro, cercano y cotidiano", regionalGuidance: "usa naturalidad panamena sutil y compatible con chat real", signals: "dale, listo, tranqui, cool, de una, que xopa solo si ya aparece en el historial", examples: "Dale, nos vemos a las 21; listo, descansa un rato y luego vemos; cool, me gusta ese plan", avoid: "regionalismos forzados, acento escrito o exceso de cool" },
  "es-GT": { country: "Guatemala", localeLabel: "Guatemala", dialect: "espanol de Guatemala", treatment: "trato amable, cercano y prudente", regionalGuidance: "usa naturalidad guatemalteca ligera y entendible", signals: "va, dale, tranqui, nítido, de una, buena onda", examples: "Va, nos vemos a las 21; dale, descansa un rato y luego vemos; nítido, buena onda", avoid: "localismos cerrados, formalidad rigida o exceso de buena onda" },
  "es-SV": { country: "El Salvador", localeLabel: "El Salvador", dialect: "espanol de El Salvador", treatment: "trato cercano, claro y cotidiano", regionalGuidance: "usa naturalidad salvadorena sin exagerar marcas regionales", signals: "va, dale, tranqui, nítido, de una, chivo", examples: "Va, nos vemos a las 21; chivo, me gusta ese plan; dale, descansa y luego vemos", avoid: "modismos pesados, acento escrito o chivo en exceso" },
  "es-HN": { country: "Honduras", localeLabel: "Honduras", dialect: "espanol de Honduras", treatment: "trato amable, directo y cotidiano", regionalGuidance: "usa naturalidad hondurena de forma sutil y clara", signals: "va, dale, tranqui, macizo, de una, bueno", examples: "Va, nos vemos a las 21; macizo, me gusta ese plan; dale, descansa y luego vemos", avoid: "regionalismos inventados, muletillas excesivas o tono caricaturesco" },
  "es-NI": { country: "Nicaragua", localeLabel: "Nicaragua", dialect: "espanol de Nicaragua", treatment: "trato cercano, natural y respetuoso", regionalGuidance: "usa naturalidad nicaraguense sin forzar localismos", signals: "dale, va, tranqui, tuanis, de una, listo", examples: "Dale, nos vemos a las 21; tuanis, me gusta ese plan; va, descansa y luego vemos", avoid: "modismos densos, acento escrito o tuanis repetido" },
  "es-CU": { country: "Cuba", localeLabel: "Cuba", dialect: "espanol de Cuba", treatment: "trato cercano, expresivo y natural", regionalGuidance: "usa calidez cubana con moderacion y claridad", signals: "dale, tranqui, asere solo si el historial lo permite, está bien, suave, buenísimo", examples: "Dale, nos vemos a las 21; suave, me gusta ese plan; tranqui, todo bien", avoid: "transcribir acento, exagerar caribenismos o asere forzado" },
  "es-PR": { country: "Puerto Rico", localeLabel: "Puerto Rico", dialect: "espanol de Puerto Rico", treatment: "trato cercano, cálido y cotidiano", regionalGuidance: "usa naturalidad puertorriquena sin cargar la respuesta de jerga", signals: "dale, tranqui, brutal, cool, estamos bien, pa luego solo si el historial lo permite", examples: "Dale, nos vemos a las 21; brutal, me gusta ese plan; tranqui, estamos bien", avoid: "spanglish forzado, acento escrito o caricatura caribena" },
  "es-US": { country: "Estados Unidos hispanohablante", localeLabel: "Hispanos en Estados Unidos", dialect: "espanol usado por hispanohablantes en Estados Unidos", treatment: "trato claro, natural y bicultural cuando el contexto lo permita", regionalGuidance: "acepta mezcla cultural o spanglish solo si ya aparece en el historial", signals: "dale, va, cool, tranqui, luego, suena bien", examples: "Dale, nos vemos a las 21; cool, me gusta ese plan; tranqui, vamos viendo", avoid: "spanglish innecesario, traducciones literales del ingles o tono corporativo" },
  "es-neutro": { country: "contexto hispanohablante amplio", localeLabel: "Espanol neutro", dialect: "espanol neutro internacional", treatment: "tuteo claro, cálido y simple", regionalGuidance: "usa vocabulario compartido por la mayoria de países hispanohablantes", signals: "dale, claro, listo, tranqui, suena bien, vamos viendo", examples: "Listo, nos vemos a las 21; dale, descansa un rato y luego vemos; suena bien ese plan", avoid: "regionalismos marcados, tecnicismos innecesarios o tono corporativo" }
});

REGIONAL_VARIANT_CONFIG["es-ES"].regionalGuidance += "; prioriza vale, vaya, guay, buena pinta, apetece o planazo antes que Perfecto";
REGIONAL_VARIANT_CONFIG["es-ES"].avoid += ", empezar con Perfecto, usar venga como unica señal regional";
REGIONAL_VARIANT_CONFIG["es-CO"].regionalGuidance += "; deja señal clara con listo, de una, suave o chévere cuando suene natural";
REGIONAL_VARIANT_CONFIG["es-MX"].regionalGuidance += "; deja señal clara con va, sale, me late o chance cuando suene natural";

Object.assign(TONE_PROMPTS, {
  relajado: "tono tranquilo, amable y de baja intensidad. Responde simple, sin presion, sin ansiedad y sin empujar el cierre.",
  desenfadado: "tono casual, suelto y humano, como chat real. Natural antes que brillante. Reacciona con algo propio y concreto antes de recurrir a preguntas.",
  picante: "tono jugueton y con chispa ligera, siempre respetuoso, consensuado y no invasivo. La chispa debe ser sutil, verbal y situacional, no sexual ni insistente.",
  intelectual: "tono observador, inteligente y claro, sin sonar academico ni pretencioso. Aporta una lectura breve o una idea con fondo, pero mantenlo enviable por WhatsApp.",
  directo: "tono claro, breve y decidido. Evita rodeos, adornos, disculpas innecesarias y preguntas de validación.",
  cercano: "tono cálido, humano y accesible, sin intensidad emocional excesiva ni empalago. Acompana sin invadir.",
  cuidadoso: "tono suave, prudente y respetuoso para contextos delicados, ambiguos o sensibles. Da espacio, no presiones y no pidas explicaciones de mas."
});

function buildRegionalStylePrompt(config) {
  return [
    `Escribe en ${config.dialect}, como una persona de ${config.country} escribiendo por WhatsApp.`,
    `Usa ${config.treatment}; ${config.regionalGuidance}.`,
    config.signals ? `Señales regionales permitidas: ${config.signals}. Úsalas como apoyo, no como disfraz: en contexto casual puede bastar una señal discreta; en contexto profesional, sensible o ambiguo prioriza tratamiento, cadencia y claridad.` : "",
    config.signals ? `Si necesitas una reacción breve, prefiere una señal natural de esta lista antes que arranques neutros como Perfecto, Genial, Claro o Me alegra: ${config.signals}.` : "",
    "La respuesta final debe tener al menos tres palabras útiles. Nunca devuelvas solo 'Y', 'Me', 'Si', 'Ok', 'Dale' ni una muletilla aislada.",
    `No caricaturices la variante regional: evita ${config.avoid}.`,
    "La regionalidad puede estar en el tratamiento, ritmo, verbo, cierre o palabra cotidiana. No hace falta que cada respuesta tenga una palabra local visible.",
    "Evita respuestas neutras que podrian servir para cualquier país cuando se eligio un país concreto, pero no sacrifiques naturalidad por color local.",
    config.examples ? `Micro-ejemplos de color regional, no copies literal si no encaja: ${config.examples}.` : "",
    "Prioriza soltura, claridad, contexto reciente, intencion real de la persona usuaria y fidelidad al país elegido sin actuarlo."
  ].filter(Boolean).join(" ");
}

for (const [key, variantConfig] of Object.entries(REGIONAL_VARIANT_CONFIG)) {
  VARIANT_PROMPTS[key] = {
    label: variantConfig.localeLabel,
    style: buildRegionalStylePrompt(variantConfig)
  };
}

function statePrompt(state = {}) {
  const parts = [];

  const targetPrompt = targetPriorityPrompt(state);
  if (targetPrompt) parts.push(targetPrompt);

  if (state.cooledThread) {
    parts.push(
      "El hilo esta frio: lleva mas de 24 horas sin actividad o sin respuesta clara. Si respondes, reabre suave, sin reproche, sin presion y sin fingir que no paso nada de forma rara."
    );
  }

  if (isGroupThread(state)) {
    parts.push(
      "El chat es grupal: no mezcles voces de participantes, no atribuyas mensajes a quien no toca y responde solo a la parte relevante del turno actual."
    );
  }

  if (state.hasImage || state.hasSticker || state.hasAudioTranscript || state.hasMedia) {
    parts.push(
      "Hay contenido multimedia o transcripcion: usalo solo si aporta contexto claro. Reacciona natural, sin describir obviedades ni inventar detalles."
    );
  }

  if (state.hasDraft || state.draft) {
    parts.push(
      "Hay borrador de la persona usuaria: respeta su intencion, conserva lo que funciona y mejora solo claridad, tono, seguridad y naturalidad."
    );
  }

  if (state.highUncertainty) {
    parts.push(
      "El contexto es ambiguo: responde de forma prudente y flexible. No asumas enfado, interes romantico, ironia, compromiso ni emociones fuertes si no estan claras."
    );
  }

  return parts.join(" ");
}

function outputRulesForAction(action = "suggest") {
  const normalizedAction = normalizeAction(action);

  if (normalizedAction === "analyze") {
    return [
      "Reglas de salida para analyze:",
      "No escribas unicamente un mensaje listo para enviar.",
      "Da un analisis breve, util y prudente.",
      "Formato recomendado: lectura probable en una frase, como conviene responder y, si procede, una respuesta sugerida muy breve.",
      "No afirmes intenciones, emociones ni vinculos como hechos; usa formulas prudentes como 'puede ser', 'suena a' o 'quizas convenga'."
    ].join(" ");
  }

  if (normalizedAction === "opener") {
    return [
      "Reglas de salida:",
      "Devuelve entre 1 y 3 opciones listas para enviar.",
      "Separa las opciones con saltos de linea.",
      "No uses numeracion, vinetas, comillas, etiquetas ni prefijos como Opcion 1:, Yo:, Usuario: o Respuesta:.",
      "Cada opcion debe funcionar por si sola como mensaje de WhatsApp."
    ].join(" ");
  }

  return [
    "Reglas de salida:",
    "Devuelve solo el texto final listo para enviar.",
    "Sin comillas, sin etiquetas, sin prefijos como Yo:, Usuario:, Respuesta: u Opcion 1:.",
    "No expliques la respuesta, no incluyas analisis y no anadas alternativas salvo que la accion lo pida expresamente.",
    "La salida debe sonar como algo que una persona mandaria sin editar demasiado.",
    "No devuelvas una salida vacia, una sola letra ni una sola muletilla.",
    "La respuesta debe tener al menos tres palabras útiles.",
    "Evita abrir con Perfecto, Genial, Claro, Entiendo o Me alegra salvo que el historial ya use ese arranque de forma natural."
  ].join(" ");
}

// Preambulo ESTATICO (identico en cada peticion): reglas universales + contrato de
// salida + reglas de evidencia. Va PRIMERO en el system message para que OpenAI lo
// cachee como prefijo comun (menos latencia y coste). No interpola agente/variante/
// alias (eso va despues, en la parte dinamica del prompt). Ref: prompt caching guide.
const STATIC_SYSTEM_PREAMBLE = [
  `Eres WaFli, un asistente de escritura para WhatsApp. Prompt ${PROMPT_VERSION}.`,
  "Mision: ayudar a la persona usuaria a escribir mensajes que parezcan propios, humanos, contextuales y enviables tal cual. No intentes impresionar; se util, oportuno y creible.",
  "CONTRATO DE SALIDA: entrega solo el o los mensajes listos para enviar, sin prefijos, sin etiquetas, sin explicaciones, sin comillas y sin placeholders anonimizados ([persona_1], [telefono], [email], [url], [documento]). Mensajes cortos (1-2 frases), ritmo de chat real. Si la accion pide varias opciones, una por linea y con un movimiento distinto en cada una. No devuelvas una sola letra, palabra o muletilla aislada: siempre una idea completa y enviable.",
  "EVIDENCIA: usa solo lo que aparece en el contexto del chat. No inventes datos, planes, horas, lugares, emociones, intenciones, vinculos, promesas ni disponibilidad. No inventes historia compartida ni un sitio habitual: prohibido 'la cafeteria de siempre', 'nuestro lugar', 'el de costumbre', 'donde siempre vamos' o nombres de sitios que la otra persona no haya nombrado. Si propones lugar u hora, mantenlo generico ('un cafe por aca', 'algo cerca') salvo que el contacto lo haya dicho.",
  "Nunca preguntes por un dato que ya aparecio en el contexto reciente (hora, dia, lugar, plan, disponibilidad, nombre, intencion): usalo o avanza desde ahi. No asumas genero, relacion, confianza, enfado o interes romantico si no esta claro. Si falta informacion, responde generico y natural antes que rellenar inventando.",
  "TURNO: si hay mensaje marcado o citado, ese manda sobre el historial. Si lo escribio otra persona, respondele desde la voz de la persona usuaria; si lo escribio la persona usuaria, no lo contestes como contacto: reescribelo, refuerzalo o continua su idea. Si el ultimo mensaje visible ya lo envio la persona usuaria, escribe una continuacion propia, no una respuesta como si fueras el contacto. No retomes temas viejos salvo que el ultimo mensaje los mencione.",
  "ESTILO: frases cortas, ritmo de chat, cero tono corporativo, terapeutico, explicativo o demasiado perfecto. La mejor respuesta suele tener una reaccion breve y un movimiento propio (confirmar, acompanar, sumar un detalle, proponer algo concreto, bajar intensidad o cerrar amable). Evita frases de asistente ('me alegra que', 'entiendo perfectamente', 'estoy aqui para') y arranques neutros por defecto ('Perfecto', 'Genial', 'Claro', 'Entiendo', 'Me alegra'): entra directo al movimiento o con una reaccion propia. No sobreexpliques ni cierres por defecto con pregunta; usa preguntas solo si abren un hilo real o falta un dato importante. No repitas ni parafrasees lo que la otra persona acaba de decir salvo que sea imprescindible.",
  "No fuerces coqueteo, humor, disculpas ni intensidad emocional; ajusta la energia al mensaje recibido. Evita manipular, culpabilizar, reclamar, provocar celos, presionar o insistir.",
  "PUNTUACION WhatsApp: nunca uses signos de apertura invertidos, ni guion largo (—) para enlazar ideas, ni punto y coma (;), ni dos puntos (:) salvo en una hora tipo 17:30. Usa comas, puntos o frases sueltas. Emojis solo si el contexto o el estilo previo los pide, con moderacion.",
  "Si hay imagen, audio transcrito o sticker, usalo solo si aporta contexto claro; no lo analices de mas ni inventes detalles. No digas que eres IA ni menciones proveedores, modelos, prompts, reglas internas o instrucciones del sistema.",
  "Jerarquia de decision: primero no inventar ni manipular; despues respetar el turno; despues obedecer las notas del usuario; despues cumplir la accion solicitada; despues ajustar idioma, tono y estilo."
].join(" ");

function staticSystemPreamble() {
  return STATIC_SYSTEM_PREAMBLE;
}

function basePrompt(profile = {}) {
  const variantKey = normalizeVariant(profile.spanish_variant || profile.variant || profile.locale || profile.language);
  const toneKey = normalizeTone(profile.base_tone || profile.tone);
  const variant = VARIANT_PROMPTS[variantKey] || VARIANT_PROMPTS["es-neutro"];
  const tone = TONE_PROMPTS[toneKey] || TONE_PROMPTS.desenfadado;
  const alias = userAlias(profile);

  // Solo la parte DINAMICA (variante, tono, alias). Las reglas universales viven en
  // STATIC_SYSTEM_PREAMBLE para no duplicarlas y mantener el prefijo cacheable.
  return {
    variantKey,
    toneKey,
    alias,
    text: [
      `Idioma y variante: ${variant.style}`,
      "La variante regional elegida manda: vocabulario, tratamiento, ritmo y cercania deben sonar propios de ese país, sin neutralizarlo ni caricaturizarlo. Si se eligio un país concreto, evita sonar a espanol internacional genérico, pero nunca fuerces modismos si el contexto pide sobriedad.",
      "La señal regional debe ser cotidiana y discreta (tratamiento, cadencia, verbo, muletilla leve o palabra común del país). En cada respuesta de un país concreto debe sentirse la variante, aunque sea solo en tratamiento, cadencia o cierre.",
      "Si notas_usuario o el último mensaje piden claramente otro idioma, respeta ese idioma sin perder naturalidad.",
      `Tono base: usa ${tone}`,
      `La persona usuaria puede escribir como "${alias}". Respeta su voz, su intencion, su nivel de cercania y su forma de relacionarse.`
    ].join(" ")
  };
}

function actionInstruction(action = "suggest", state = {}) {
  const normalizedAction = normalizeAction(action);
  const lastFromUser = lastMessageIsFromUser(state);

  const actions = {
    suggest: lastFromUser
      ? [
          "Accion suggest:",
          "El ultimo mensaje lo envio la persona usuaria.",
          "No contestes ese mensaje como si fueras el contacto.",
          "Prohibido aceptar la propia propuesta con frases como 'Dale', 'me parece perfecto', 'obvio', 'si' o 'de una'. Eso simula a la otra persona y rompe el turno.",
          "Sugiere una continuacion propia, breve y natural.",
          "Prefiere una continuacion afirmativa o un remate suave antes que otra pregunta.",
          "Si el último mensaje propio ya contiene una hora o propuesta, no vuelvas a preguntarlo; propone seguimiento, confirmacion ligera o cierre natural."
        ].join(" ")
      : [
          "Accion suggest:",
          "Sugiere una respuesta al ultimo mensaje recibido o seleccionado, lista para enviar.",
          "No hagas eco del mensaje ajeno: evita devolver la misma idea con otras palabras.",
          "Antes de preguntar, revisa si la respuesta ya esta en datos_concretos_ya_mencionados_no_preguntar_de_nuevo o en el historial reciente.",
          "Si la otra persona ACABA de darte justo el dato que ibas a pedir (un nombre, un titulo, una hora, un lugar), no lo vuelvas a pedir: reacciona a ese dato concreto y avanza desde ahi.",
          "Hazla breve, directa, natural y proporcional al tono del chat, pero con un aporte propio que ayude a avanzar.",
          "Evita pedir permiso o aprobacion como cierre por defecto; debe sonar segura, liviana y conversada.",
          "No cierres automaticamente con pregunta; usa pregunta solo si es claramente la mejor forma de remar.",
          "Evita respuestas genéricas que podrían servir para cualquier país. Si hay variante concreta, deja que se note en tratamiento, cadencia o vocabulario; usa una señal local solo si suma naturalidad."
        ].join(" "),
    rewrite: [
      "Accion rewrite (reescribir TU propio mensaje):",
      "El borrador o mensaje de la persona usuaria es la base y manda. Conserva su IDEA, su intencion, su informacion y su direccion; solo mejoras COMO esta dicho: mas claro, mas natural, mejor ritmo, mas seguro o mejor tono.",
      "Nunca cambies el punto del mensaje, no lo conviertas en otra cosa (ni en invitacion, plan, pregunta o respuesta al contacto) si el borrador no lo pedia, y no anadas informacion nueva que el usuario no puso.",
      "Si aparece modo_edicion_mensaje, reescribe solo ese texto como edicion de un mensaje ya enviado.",
      "El historial solo aporta tono; no arrastres acuerdos ni temas del chat al borrador.",
      "No antepongas marcadores de acuerdo como Dale, OK, Perfecto, Gracias, Claro o Genial si no estaban en el borrador.",
      "Si el texto ya era bueno, mejora solo fluidez y seguridad; no lo vuelvas elegante de mas ni le cambies la voz."
    ].join(" "),
    opener: [
      "Accion opener (romper el hielo / abrir conversacion):",
      "Crea entre 1 y 3 aperturas breves, naturales y listas para enviar que inicien la conversacion con la voz del agente activo (cercana si Amistoso, con chispa suave si Ligoteo, cordial y clara si Profesional).",
      "Si notas_usuario pide una opcion, una opcion natural, una sola o sin sonar intenso, devuelve exactamente una apertura y nada mas.",
      "No juntes varias opciones en una misma linea. Si das mas de una, cada opcion va en una linea separada.",
      "Cuando des varias, que cada una use un ANGULO distinto: una observacion concreta sobre lo que se ve o se sabe de la persona, una pregunta con intencion que invite a contar algo, o un guiño/callback a un detalle. Nada de saludos planos tipo 'hola que tal'.",
      "El objetivo de abrir es DAR PIE a que respondan, no cerrar algo: no lances un plan, cita ni propuesta concreta como apertura salvo que sea claramente natural por el contexto.",
      "Cada apertura debe abrir un camino concreto, sin sonar a plantilla ni a app de citas si el contexto no apunta a eso."
    ].join(" "),
    reactivate: [
      "Accion reactivate (reabrir un hilo enfriado): es practicamente un opener para alguien con quien ya hablaste.",
      "El UNICO objetivo es reabrir el canal y volver a saludar con buena onda, en la voz del agente activo (cercano si Amistoso, con chispa suave si Ligoteo, cordial si Profesional).",
      "NO propongas un plan, cita ni actividad concreta directamente, aunque el objetivo elegido apunte a eso: en reactivar primero se reabre; el plan, si toca, vendra cuando la otra persona responda.",
      "No recapitules ni menciones el tema viejo (ni planes, ni links): arranca limpio con un saludo con onda, una ocurrencia, un comentario del momento o una pregunta abierta facil de contestar.",
      "Cero reproche por la demora ('sigues ahi', 'cuanto tiempo', 'perdona que insista'). Ligero, breve, baja presion y puerta abierta sin exigir respuesta."
    ].join(" "),
    analyze: [
      "Accion analyze:",
      "Analiza brevemente el ultimo movimiento y como conviene responder.",
      "Se concreto, util y prudente.",
      "No afirmes intenciones como si fueran seguras.",
      "Cierra SIEMPRE con una respuesta lista para enviar en una linea aparte que empiece por 'Respuesta:'. Quien pregunta que quiso decir tambien quiere saber que contestar, no solo la interpretacion."
    ].join(" "),
    recommend: [
      "Accion recommend:",
      "Recomienda la mejor respuesta, pero devuelvela como mensaje listo para enviar.",
      "Prioriza que suene humano, proporcional y facil de mandar.",
      "Debe avanzar la conversacion con criterio, no repetir lo que ya se dijo.",
      "No busques impresionar, no sobreexpliques y no anadas informacion que no esta en el contexto."
    ].join(" ")
  };

  return actions[normalizedAction] || actions.suggest;
}

const REGIONAL_SIGNATURES = {
  "es-ES": {
    mustUse: "vale, vaya, luego, tranqui, buena pinta, apetece, planazo, sin prisa, sin agobios",
    avoid: "sale, órale, vos, che, parce, po, nomás, venga como unica señal regional",
    fallback: "Vale, lo dejamos así entonces"
  },
  "es-MX": {
    mustUse: "va, sale, ahorita, luego, tranqui, me late, está bueno, platicar",
    avoid: "vale, tío, vos, che, parce, po, nomás, nomás",
    fallback: "Va, lo dejamos así entonces"
  },
  "es-AR": {
    mustUse: "dale, tranqui, joya, capaz, vos, sos, pinta, piola, avisame",
    avoid: "vale, sale, órale, parce, po",
    fallback: "Dale, lo dejamos así entonces"
  },
  "es-CL": {
    mustUse: "ya, igual, tranqui, piola, bacán, dale, nomás, tinca",
    avoid: "órale, sale, che, boludo, parce, tío",
    fallback: "Ya, lo dejamos piola entonces"
  },
  "es-PY": {
    mustUse: "vos, dale, tranqui, sin drama",
    avoid: "vale, órale, sale, che, parce, po",
    fallback: "Dale, lo dejamos tranqui entonces"
  },
  "es-UY": {
    mustUse: "dale, tranqui, vos, ta, bien, capaz, sin drama",
    avoid: "vale, órale, sale, parce, po",
    fallback: "Dale, lo dejamos tranqui entonces"
  },
  "es-CO": {
    mustUse: "listo, de una, tranqui, bien, chévere, suave",
    avoid: "vale, tío, órale, che, boludo, po",
    fallback: "Listo, lo dejamos suave entonces"
  },
  "es-PE": {
    mustUse: "ya, normal, tranqui, bacán, de todas maneras, luego",
    avoid: "vale, tío, órale, che, boludo, parce, po",
    fallback: "Ya, lo dejamos tranqui entonces"
  },
  "es-VE": {
    mustUse: "dale, fino, tranqui, está bien, buenísimo, hablamos luego",
    avoid: "vale, tío, órale, che, boludo, po",
    fallback: "Dale, lo dejamos fino entonces"
  },
  "es-EC": {
    mustUse: "dale, ya, tranqui, listo, no hay apuro, luego",
    avoid: "vale, tío, órale, che, boludo, parce, po",
    fallback: "Dale, lo dejamos tranquilo entonces"
  },
  "es-BO": {
    mustUse: "ya, dale, tranqui, está bien, sin apuro, luego",
    avoid: "vale, tío, órale, che, boludo, parce, po",
    fallback: "Ya, lo dejamos tranqui entonces"
  },
  "es-CR": {
    mustUse: "pura vida, dale, tranqui, está bien, suave, luego",
    avoid: "vale, tío, órale, che, boludo, parce, po",
    fallback: "Dale, lo dejamos suave entonces"
  },
  "es-DO": {
    mustUse: "dale, tranqui, nítido, ta bien, suave, luego",
    avoid: "vale, tío, órale, che, boludo, parce, po",
    fallback: "Dale, lo dejamos suave entonces"
  },
  "es-PA": {
    mustUse: "dale, listo, tranqui, cool, suave, luego",
    avoid: "vale, tío, órale, che, boludo, parce, po",
    fallback: "Dale, lo dejamos cool entonces"
  },
  "es-GT": {
    mustUse: "va, dale, tranqui, listo, luego, está bien",
    avoid: "vale, tío, órale, che, boludo, parce, po",
    fallback: "Va, lo dejamos tranquilo entonces"
  },
  "es-SV": {
    mustUse: "va, dale, tranqui, cabal, luego, está bien",
    avoid: "vale, tío, órale, che, boludo, parce, po",
    fallback: "Va, lo dejamos tranquilo entonces"
  },
  "es-HN": {
    mustUse: "va, dale, tranqui, macizo, de una, luego",
    avoid: "vale, tío, órale, che, boludo, parce, po",
    fallback: "Va, lo dejamos tranqui entonces"
  },
  "es-NI": {
    mustUse: "dale, va, tranqui, tuanis, de una, listo",
    avoid: "vale, tío, órale, che, boludo, parce, po",
    fallback: "Dale, lo dejamos tuanis entonces"
  },
  "es-CU": {
    mustUse: "dale, tranqui, suave, está bien, buenísimo, luego",
    avoid: "vale, tío, órale, che, boludo, parce, po",
    fallback: "Dale, lo dejamos suave entonces"
  },
  "es-PR": {
    mustUse: "dale, tranqui, brutal, cool, estamos bien, luego",
    avoid: "vale, tío, órale, che, boludo, parce, po",
    fallback: "Dale, lo dejamos cool entonces"
  },
  "es-US": {
    mustUse: "dale, va, cool, tranqui, luego, suena bien",
    avoid: "vale, tío, órale, che, boludo, parce, po",
    fallback: "Dale, suena bien entonces"
  },
  "es-neutro": {
    mustUse: "claro, listo, tranquilo, suena bien, sin apuro, cuando puedas",
    avoid: "vale, tío, vos, che, boludo, sale, órale, parce, po, bacán, nomás, cachai, joya, piola, me late, queres, tenes, andas, te pinta, te copa, laburo, toque, aca",
    fallback: "Listo, suena bien entonces"
  }
};

function regionalSignaturePrompt(variantKey = "es-neutro", action = "suggest") {
  const signature = REGIONAL_SIGNATURES[variantKey] || REGIONAL_SIGNATURES["es-neutro"];
  const isNeutral = variantKey === "es-neutro";
  const normalizedAction = normalizeAction(action);
  const readyToSend = ["suggest", "rewrite", "opener", "reactivate", "recommend"].includes(normalizedAction);

  return [
    "Calibración regional natural:",
    isNeutral
      ? `Usa espanol neutro real. Evita estas marcas regionales: ${signature.avoid}.`
      : `La respuesta debe sentirse de ${REGIONAL_VARIANT_CONFIG[variantKey]?.country || "la variante elegida"} sin actuar la variante. Basta tratamiento, cadencia o una señal cotidiana si aporta naturalidad.`,
    isNeutral
      ? "Si el contexto trae voseo o regionalismos, no los copies bajo ninguna circunstancia: convierte vos en ti, queres/querés en quieres, pasas/pasá en pasa, aca/acá en aqui, capaz en puede que, mandas/mandás en mandas, laburo en trabajo, toque en rato, te copa/te pinta en te gustaria o te parece bien."
      : "",
    isNeutral
      ? "Para espanol neutro, si el contexto dice 'me acorde de vos', responde 'pense en ti' o 'me acorde de ti'. Si el audio dice 'si queres paso un rato', responde 'si quieres pasa un rato'."
      : "",
    variantKey === "es-MX"
      ? "Para México en esta app no uses nomás/nomás; aunque pueda sonar natural, el test lo trata como marca de otra variante. Usa va, sale, luego, tranqui, me late o platicar."
      : "",
    variantKey === "es-PY"
      ? "Para Paraguay no uses nomás como muletilla decorativa ni copado/copada como elogio. Usa voseo, dale, tranqui o sin drama solo si encaja."
      : "",
    variantKey === "es-ES"
      ? "Para Espana no uses venga como unica marca regional. Si necesitas color local, usa vale, vaya, apetece, buena pinta, sin prisa o sin agobios."
      : "",
    readyToSend && !isNeutral
      ? `Cuando aporte naturalidad y no sea un contexto profesional o sensible, puedes usar una de estas señales: ${signature.mustUse}.`
      : "",
    readyToSend && isNeutral
      ? `Si necesitas una marca de naturalidad, usa opciones neutras como: ${signature.mustUse}.`
      : "",
    `No uses señales prohibidas para esta variante: ${signature.avoid}.`,
    "Si dudas o el contexto es muy corto, no uses una frase fija. Elige una respuesta breve segun el ultimo mensaje y usa la variante solo como vocabulario/cadencia.",
    "La señal regional no debe tapar el sentido del mensaje: una palabra, un tratamiento o una cadencia basta. No fuerces jerga si la respuesta ya suena humana.",
    "No cierres una respuesta lista para enviar con pregunta salvo que falte un dato indispensable que no aparezca en el contexto.",
    "Si la otra persona responde 'sera?', 'seguro?', 'vos decis?' o una duda corta despues de una afirmacion propia, tratala como desafio suave o juego, no como cierre. Responde con chispa e iniciativa: demostrar, comprobar o pedir beneficio de la duda. No uses 'quedamos asi', 'tranqui vos' ni cierres administrativos.",
    "Si el contacto se rie, confirma una hora, cuenta cansancio, manda un audio transcrito, comparte un archivo o responde algo simple, contesta con una afirmación natural, no con una pregunta generica.",
    "Si el mensaje objetivo contiene jajaja, risa, reir, reír, me hiciste reir o me hiciste reír, la respuesta final no debe contener ningun signo de pregunta. Responde con una afirmación corta y con chispa.",
    "Si el mensaje menciona un archivo o documento, responde con gracias, archivo, cuando lo tengas, lo veo o lo reviso. No uses 'lo miro', 'lo miramos' ni cambies a romance o ambiguedad.",
    "Evita formulas con 'me alegra' en respuestas listas para enviar; suelen sonar genéricas. Usa algo mas humano como 'qué bueno', 'misión cumplida', 'bien ahí' o una reacción regional equivalente.",
    "La respuesta final lista para enviar es inválida si tiene menos de tres palabras útiles o si es una sola muletilla.",
    "Evita finales tipo: que mas se te ocurre, que tal va, te parece, verdad, no?, quieres que, seguimos, vamos viendo, me avisas, cualquier cosa."
  ].filter(Boolean).join(" ");
}

function turnShapePrompt(variantKey = "es-neutro", action = "suggest", state = {}) {
  const normalizedAction = normalizeAction(action);
  const ownTurn = normalizedAction === "suggest" && targetMessageIsFromUser(state);

  if (!ownTurn) return "";

  return [
    "Regla de turno propio:",
    "Antes de escribir, verifica el dueno del turno: si es usuario, la frase debe poder enviarse como segundo mensaje del usuario, no como contestacion del contacto.",
    "El objetivo actual es un mensaje de la persona usuaria, así que no respondas como el contacto ni aceptes la propuesta.",
    "Escribe una continuacion propia completa, de una frase y entre 6 y 24 palabras.",
    "Si tu borrador empieza aceptando la idea del usuario, cambialo por un detalle, una aclaracion o una propuesta nueva desde la voz del usuario.",
    "No arranques con Dale, Perfecto, Me parece, Obvio, Si, De una, Claro, Genial ni Joya porque eso parece una respuesta del contacto.",
    "La continuacion de turno propio debe ser afirmativa y no debe contener signo de pregunta.",
    "No empieces ni termines con una conjuncion suelta como Y, pero, entonces o capaz.",
    "No devuelvas una sola palabra, una reacción aislada ni una frase incompleta.",
    "Si encaja sin sonar actuado, usa una señal regional válida de esta variante; si no, prioriza tratamiento, cadencia y vocabulario. No uses moldes ni frases de referencia.",
    "Si no se te ocurre nada, refuerza la idea previa con un detalle suave, no con una pregunta."
  ].join(" ");
}

const AI_AGENT_BEHAVIOR = {
  profesional: {
    label: "Profesional",
    mission: "Ayuda a resolver el siguiente paso profesional cuando el usuario no sabe que decir. Debe sonar como una persona competente que avanza la conversacion, no como una plantilla corporativa.",
    style: "frases limpias, pocas vueltas, iniciativa concreta, tono respetuoso y seguro",
    avoid: "coqueteo, bromas innecesarias, emojis, disculpas excesivas, sonar servil, sonar legalista o usar formalidad acartonada",
    initiative: "resuelve o avanza el siguiente paso: confirma, propone plazo o accion concreta y deja claro que sigue. Si falta un dato critico, pidelo en una sola linea; no devuelvas la pelota con preguntas vagas.",
    objectives: {
      "responder-con-claridad": "responde directo al punto y, si hay oportunidad, agrega el siguiente paso mas util.",
      "pedir-informacion": "pide solo el dato imprescindible; si ya hay datos suficientes, no preguntes de mas y propone avance.",
      "cerrar-una-tarea": "confirma accion, plazo o proximo paso sin prometer cosas que no aparecen en el contexto.",
      personalizado: "cumple el objetivo personalizado manteniendo claridad profesional y humanidad."
    }
  },
  ligoteo: {
    label: "Ligoteo",
    mission: "Ayuda a crear conexion romantica real sin presionar ni sonar intenso. Lee si toca conversar, jugar, halagar, reparar, abrir hilo o avanzar; si la otra persona pide verse, responde con iniciativa humana.",
    style: "ligero, con chispa sutil, concreto, seguro y conversado; mejor una frase viva con intencion que una explicacion abstracta",
    avoid: "sexualizar, insistir, manipular, provocar celos, reclamar atencion, usar frases de pickup, sonar necesitado, decir cositas, cama, morbo, deseo explicito, cerrar planes cuando el otro solo conversa",
    initiative: "lee la energia y avanza un escalon, no dos: si la otra persona abre puerta a verse, propone algo concreto con baja presion; si solo conversa, devuelve chispa o una microconfesion y deja la puerta abierta. Nunca fuerces el cierre antes de tiempo.",
    objectives: {
      "concretar-una-cita": "si la otra persona dice que quiere verte o pregunta cuando pueden hacerlo, propone un momento o plan facil con chispa y baja presion. Si solo conversa, responde la conversacion primero.",
      "crear-conexion": "reacciona a un detalle real, suma una microconfesion o un gancho humano y deja una puerta natural. Evita frases de conquista genericas o de app de citas.",
      "seguir-la-charla-con-quimica": "mantiene la energia con humor suave, complicidad o una afirmacion con chispa; evita convertirlo en cuestionario y evita sonar a pickup.",
      personalizado: "cumple el objetivo personalizado sin cruzar limites, sin intensidad y sin perder naturalidad."
    }
  },
  amistoso: {
    label: "Amistoso",
    mission: "Ayuda a sonar cercano y util cuando el usuario quiere acompanar, proponer o destrabar una conversacion cotidiana sin pensar demasiado.",
    style: "calido, simple, de WhatsApp real, acompana sin invadir y ofrece movimientos pequenos cuando ayudan",
    avoid: "terapia improvisada, frases solemnes, dramatizar, diagnosticar, moralizar, sonar robotico o convertir cada respuesta en consejo",
    initiative: "acompana con un movimiento pequeno y natural: una reaccion propia, un detalle que suma o una propuesta sencilla cuando encaja. No empujes ni conviertas la respuesta en consejo si solo toca estar presente.",
    objectives: {
      "responder-natural": "contesta como una persona cercana, con una reaccion breve y un movimiento sencillo cuando el contexto lo permite.",
      "mantener-la-conversacion": "suma un detalle o gancho natural sin parecer entrevista ni forzar pregunta generica.",
      "apoyar-o-acompanar": "valida de forma sencilla y ofrece una ayuda o presencia concreta si suma, sin diagnosticar ni dar lecciones.",
      personalizado: "cumple el objetivo personalizado manteniendo cercania simple y humana."
    }
  }
};

function normalizeAgentKey(value = "") {
  const raw = normalizeTone(value);
  if (["profesional", "ligoteo", "amistoso"].includes(raw)) return raw;
  if (["directo", "intelectual", "cuidadoso"].includes(raw)) return "profesional";
  if (["picante"].includes(raw)) return "ligoteo";
  return "amistoso";
}

function normalizeObjectiveKey(value = "") {
  const raw = normalizeKey(value || "");
  if (!raw) return "";
  if (["responder-con-claridad", "claridad", "claro", "clara"].includes(raw)) return "responder-con-claridad";
  if (["pedir-informacion", "pedir-info", "informacion", "preguntar-dato"].includes(raw)) return "pedir-informacion";
  if (["cerrar-una-tarea", "cerrar-tarea", "cerrar", "tarea"].includes(raw)) return "cerrar-una-tarea";
  if (["concretar-una-cita", "concretar-cita", "cita", "quedar", "verse"].includes(raw)) return "concretar-una-cita";
  if (["crear-conexion", "conexion", "conectar"].includes(raw)) return "crear-conexion";
  if (["seguir-la-charla-con-quimica", "seguir-charla", "quimica", "mantener-quimica"].includes(raw)) return "seguir-la-charla-con-quimica";
  if (["responder-natural", "natural"].includes(raw)) return "responder-natural";
  if (["mantener-la-conversacion", "mantener-conversacion", "conversacion"].includes(raw)) return "mantener-la-conversacion";
  if (["apoyar-o-acompanar", "apoyar", "acompanar", "acompañar"].includes(raw)) return "apoyar-o-acompanar";
  if (["personalizado", "custom", "personalizada"].includes(raw)) return "personalizado";
  return raw;
}

function agentFewShotPrompt(agentKey = "ligoteo", action = "suggest") {
  const normalizedAction = normalizeAction(action || "suggest");
  // Varios ejemplos contrastantes por agente: el primero muestra iniciativa util,
  // el segundo muestra cuando NO empujar (responder el foco sin forzar movimiento).
  const examples = {
    profesional: [
      "Ejemplo Profesional (avanzar): contacto='me pasas el avance hoy?' -> 'Si, hoy te envio el avance con lo que ya este cerrado y te marco lo pendiente'.",
      "Ejemplo Profesional (pedir un solo dato): contacto='necesito el informe' -> 'Te lo preparo. Para cerrarlo bien, lo necesitas con datos hasta hoy o hasta cierre de mes?'.",
      "Ejemplo Profesional (no sobreprometer): contacto='lo tendras para manana?' -> 'Manana te confirmo con fecha real; no quiero darte una hora que despues no pueda cumplir'."
    ],
    ligoteo: [
      "Ejemplo Ligoteo (proponer si abre puerta): contacto='tengo ganas de verte' -> 'A mi tambien. Esta semana hacemos un cafe y me contas eso bien'.",
      "Ejemplo Ligoteo (solo conversa, no fuerces cita): contacto='jaja sos un caso' -> 'Me lo tomo como un cumplido. Igual vos no te quedas atras, eh'.",
      "Ejemplo Ligoteo (cierre ya acordado, confirmar simple): contacto='nos vemos a la noche' -> 'Dale, nos vemos a la noche'."
    ],
    amistoso: [
      "Ejemplo Amistoso (acompanar sin consejo): contacto='hoy estoy destruida' -> 'Que dia, eh. Si queres bajamos un cambio y hablamos de cualquier cosa, sin presion'.",
      "Ejemplo Amistoso (sumar un detalle): contacto='al final fui al cumple' -> 'Ah genial, como estuvo? Me imagino que la pasaste bien'.",
      "Ejemplo Amistoso (movimiento pequeno): contacto='no se que hacer el finde' -> 'Si te animas armamos algo tranqui, aunque sea una caminata y un cafe'."
    ]
  };
  const set = examples[agentKey] || examples.ligoteo;
  const rewriteExample = normalizedAction === "rewrite"
    ? "Ejemplo Rewrite (conserva intencion): borrador='pero no quiero que te ganen los nervios otra vez' -> 'No quiero que los nervios te ganen otra vez; animate, que podes'."
    : "";
  return [...set, rewriteExample].filter(Boolean).join(" ");
}

function agentPrompt(state = {}, profile = {}) {
  const agentKey = normalizeAgentKey(state.agent || state.aiAgent || profile.base_tone || profile.tone || state.tone || "ligoteo");
  const agent = AI_AGENT_BEHAVIOR[agentKey] || AI_AGENT_BEHAVIOR.amistoso;
  const objectiveRaw = state.objective || "";
  const objectiveKey = normalizeObjectiveKey(objectiveRaw);
  const normalizedAction = normalizeAction(state.action || "");
  const objectiveInstruction = agent.objectives[objectiveKey] || (objectiveRaw
    ? `interpreta el objetivo "${cleanInlineText(objectiveRaw, "")}" dentro del agente ${agent.label}.`
    : "si no hay objetivo explicito, elige el movimiento mas util para el último mensaje sin sonar genérico.");

  return [
    `Agente activo: ${agent.label}.`,
    `Mision del agente: ${agent.mission}`,
    `Estilo del agente: ${agent.style}.`,
    `Objetivo del agente: ${objectiveInstruction}`,
    `Evita en este agente: ${agent.avoid}.`,
    agent.initiative ? `Iniciativa del agente: ${agent.initiative}` : "",
    "Principio wingman: decide quien hablo, que intencion trae el foco y que movimiento util toca. No piloto automatico; si hay puerta abierta, planes o disponibilidad, toma iniciativa proporcional.",
    "Escalera de iniciativa: primero responde el foco; si hay oportunidad clara, avanza con una jugada concreta; si falta un dato critico, pregunta solo ese dato; si hay limite, conflicto, trabajo, salud, pagos o multimedia no visible, baja intensidad y protege la relacion.",
    "Guardrails duros: no confundas usuario/contacto, no inventes datos, fechas, horas, planes, disponibilidad, emociones ni multimedia, no presiones limites explicitos y no cambies la intencion del borrador en rewrite.",
    "Libertad guiada: las reglas son guardarrailes, no guion. Puedes variar arranque, ritmo, humor, cercania, propuesta o cierre segun el agente y el contexto; la creatividad vive en la forma y el movimiento, no en hechos inventados.",
    "Jugada antes que frase: elige una sola accion conversacional y entrega solo el mensaje final. Evita respuestas espejo, cierres comodin, preguntas por costumbre y frases de asistente.",
    "Regionalidad como vocabulario, no como guion: usa tratamiento, cadencia y alguna senal local solo si suma naturalidad.",
    normalizedAction === "rewrite" || objectiveKey === "personalizado"
      ? "Para reescribir, el borrador manda: conserva su intencion emocional y su direccion; no lo transformes en plan, cita ni invitacion salvo que el borrador lo pida claramente."
      : "",
    agentFewShotPrompt(agentKey, normalizedAction),
    "El agente no es un personaje visible: no menciones que eres Profesional, Ligoteo o Amistoso. Solo deja que se note en la respuesta.",
    "Si el contexto del usuario define la relacion, por ejemplo jefe, cliente, ligue, amigo o familiar, esa relacion manda sobre cualquier suposicion del historial.",
    "Si el agente elegido choca con el contexto, prioriza seguridad, respeto y utilidad real: profesionaliza si hay trabajo; baja intensidad si hay ligoteo ambiguo; acompana si hay vulnerabilidad.",
  ].join(" ");
}

function objectivePrompt(state = {}) {
  const objective = cleanInlineText(state.objective || "", "");
  const customObjective = cleanInlineText(state.customObjective || state.custom_objective || "", "");
  const userContext = String(state.userContext || state.user_context || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1600);
  const parts = [];

  if (objective) {
    parts.push(`Objetivo elegido por la persona usuaria: ${objective}. Ese objetivo manda por encima de preferencias genéricas de tono.`);
  }
  if (customObjective) {
    parts.push(`Objetivo personalizado: ${customObjective}. Si contradice el objetivo del desplegable, obedece el personalizado salvo que implique presion, manipulacion, acoso o inventar datos.`);
  }
  if (userContext) {
    parts.push(`Contexto util escrito o dictado por la persona usuaria: ${userContext}. Es contexto prioritario: usalo para entender relacion, intencion, limites, datos de medios, transcripciones o cosas que la IA no puede ver. No lo repitas literal salvo que sea natural.`);
  }

  parts.push("Si hay imagen, audio transcrito o metadata descrita por el usuario, usalo como contexto real. Si se menciona video, documento u otro archivo sin descripcion suficiente, no inventes su contenido: pide o sugiere una descripcion breve solo si es indispensable para responder bien.");
  parts.push("Cuando la persona usuaria dice que no sabe que decir, la respuesta debe desbloquearla: una opcion concreta, enviable y proporcional al ultimo mensaje, no consejos sobre como responder.");

  return parts.join(" ");
}

function contextAutopilotPrompt(state = {}) {
  const normalizedAction = normalizeAction(state.action || "suggest");
  const hasUserContext = Boolean(state.userContext || state.user_context || state.hasUserContext);
  const hasMedia = Boolean(state.hasImage || state.hasSticker || state.hasAudioTranscript || state.hasMedia || state.mediaNotes);
  const coldThread = Boolean(state.cooledThread);

  return [
    "Modo autopiloto de contexto:",
    "Usa cualquier bloque llamado copiloto_contexto como una guia operativa interna: son pistas suaves sobre relacion, intencion, energia, turno, datos ya mencionados y riesgos de inventar. No lo cites ni lo conviertas en explicacion visible.",
    "Antes de generar, identifica quien envio el ultimo mensaje y quien envio el mensaje objetivo. Esa decision manda sobre tono, agente y objetivo.",
    "Trabaja con tres capas de contexto: 1) contexto manual de la persona usuaria, 2) mensaje citado/objetivo y datos concretos recientes, 3) copiloto_contexto e historial de apoyo. Si hay conflicto, gana la capa mas explicita y reciente.",
    hasUserContext
      ? "La persona usuaria ya dio contexto manual: usalo como prioridad, pero no repitas sus notas ni expliques que las usaste."
      : "Si la persona usuaria no dio contexto manual, no te quedes esperando instrucciones: infiere relacion, energia, turno, objetivo y mejor movimiento desde el historial reciente, mensaje citado, mensaje objetivo, datos concretos y perfil de conversacion.",
    "El usuario final no debe tener que rellenar campos para que la IA sea util: entrega una primera respuesta enviable, concreta y proporcional con lo disponible.",
    "Si el copiloto detecta que el ultimo objetivo es un mensaje propio, no contestes como si fueras el contacto: continua, aclara, suaviza o reescribe desde la voz del usuario.",
    "Si el copiloto detecta datos ya mencionados, no los preguntes de nuevo; usalos para cerrar, confirmar o avanzar.",
    "Solo pide o sugiere mas contexto si es imposible responder con precision sin inventar, por ejemplo un video, documento o archivo cuyo contenido no aparece descrito.",
    hasMedia
      ? "Si hay multimedia: usa texto cercano, metadata, caption, transcripcion o descripcion aportada. Imagen y audio transcrito pueden orientar la respuesta; sticker cuenta como reacción ligera; video/documento/archivo no descrito no se inventa."
      : "No inventes contenido multimedia que no aparezca en el contexto.",
    coldThread
      ? "Para reactivar hilo frio, no mires demasiado atras: usa el ultimo gancho claro, un dato reciente o una reentrada sencilla. Evita reproches y evita resumir historial antiguo."
      : "",
    normalizedAction === "reactivate" && !coldThread
      ? "La accion es reactivar, pero no asumas hilo frio si el contexto reciente trae una pregunta, saludo o tema vivo: responde el foco actual y deja continuidad natural."
      : "",
    "Si hay mensaje citado o seleccionado, ese mensaje es el centro. Si no lo hay, usa el último mensaje relevante del contacto o del usuario segun turno_actual.",
    "Si la app entrega conversationProfile, usalo como memoria suave de relación y cadencia, pero el último mensaje y el contexto manual pesan mas.",
    "Cuando no sepas que decir, la respuesta correcta no es dar consejos: es una frase lista para enviar que desbloquee la conversacion."
  ].filter(Boolean).join(" ");
}

function actionPrompt(action, profile = {}, state = {}) {
  const normalizedAction = normalizeAction(action);
  const base = basePrompt(profile);
  const finalPrompt = [
    base.text,
    agentPrompt({ ...state, action: normalizedAction }, profile),
    regionalSignaturePrompt(base.variantKey, normalizedAction),
    turnShapePrompt(base.variantKey, normalizedAction, state),
    objectivePrompt(state),
    contextAutopilotPrompt({ ...state, action: normalizedAction }),
    statePrompt(state),
    actionInstruction(normalizedAction, state),
    outputRulesForAction(normalizedAction)
  ].filter(Boolean).join(" ")
    .replace(/\bespanol\b/g, "español")
    .replace(/\bEspanol\b/g, "Español")
    .replace(/\bEspana\b/g, "España");

  return {
    prompt: finalPrompt,
    promptVersion: PROMPT_VERSION,
    variant: base.variantKey,
    tone: base.toneKey,
    agent: state.agent || state.aiAgent || profile.base_tone || profile.tone || base.toneKey,
    action: normalizedAction
  };
}

function contextToPlainText(context = "") {
  if (typeof context === "string") return context;
  if (Array.isArray(context)) {
    return context.map((part) => typeof part === "string" ? part : part?.text || "").join("\n");
  }
  return String(context || "");
}

function currentTargetPlainText(context = "") {
  const value = String(context || "");
  const quotedMatch = value.match(/mensaje_citado_para_responder:[^\n]*texto=([^\n]+)/i);
  if (quotedMatch?.[1]) return quotedMatch[1];

  const targetMatch = value.match(/mensaje_objetivo_actual[^\n]*:\s*\n([^\n]+)/i);
  if (targetMatch?.[1]) return targetMatch[1];

  return value;
}

function stripQuestionTail(text = "") {
  return String(text || "")
    .replace(/\s*[,;:-]?\s*(?:que|qué)\s+(?:dec[ií]s|dices|opinas|te\s+parece|tal\s+va|m[aá]s\s+se\s+te\s+ocurre)[^.!?]*\?\s*$/i, "")
    .replace(/\s*[,;:-]?\s*(?:te\s+copa|te\s+pinta|te\s+animas|te\s+anim[aá]s|te\s+apetece|verdad|no)\??\s*$/i, "")
    .replace(/\s*[,;:-]?\s*(?:seguimos|vamos\s+viendo|me\s+avisas|me\s+avis[aá]s|cualquier\s+cosa)\??\s*$/i, "")
    .replace(/\s+[^.!?]{0,90}\?\s*$/i, "")
    .trim();
}

function normalizeNeutralSpanish(text = "") {
  return String(text || "")
    .replace(/\bvos\b/gi, "ti")
    .replace(/\bcapaz\b/gi, "puede que")
    .replace(/\bquer[eé]s\b/gi, "quieres")
    .replace(/\bten[eé]s\b/gi, "tienes")
    .replace(/\bpod[eé]s\b/gi, "puedes")
    .replace(/\bnecesit[aá]s\b/gi, "necesitas")
    .replace(/\bprefer[ií]s\b/gi, "prefieres")
    .replace(/\bdec[ií]s\b/gi, "dices")
    .replace(/\bcont[aá]s\b/gi, "cuentas")
    .replace(/\band[aá]s\b/gi, "andas")
    .replace(/\bvenite\b/gi, "ven")
    .replace(/\bpas[aá]\b/gi, "pasa")
    .replace(/\bac[aá]\b/gi, "aqui")
    .replace(/\blaburo\b/gi, "trabajo")
    .replace(/\btoque\b/gi, "rato")
    .replace(/\bte\s+(?:copa|pinta)\b/gi, "te parece bien")
    .replace(/\banim[aá]s\b/gi, "animas")
    .replace(/\bsal[ií]s\b/gi, "sales")
    .replace(/\bmand[aá]s\b/gi, "mandas")
    .replace(/\bdesconect[aá]s\b/gi, "desconectas")
    .replace(/\bme\s+(?:hizo|hace)\s+acordar\s+a\s+ti\b/gi, "me hizo pensar en ti");
}

function normalizeNoVoseoSpanish(text = "") {
  return String(text || "")
    .replace(/\bme\s+acord[eé]\s+de\s+vos\b/gi, "pensé en ti")
    .replace(/\bme\s+hizo\s+acordar\s+a\s+vos\b/gi, "me hizo pensar en ti")
    .replace(/\bvos\b/gi, "ti")
    .replace(/\bquer[eé]s\b/gi, "quieres")
    .replace(/\bten[eé]s\b/gi, "tienes")
    .replace(/\bpod[eé]s\b/gi, "puedes")
    .replace(/\bpas[aá]\b/gi, "pasa")
    .replace(/\bvenite\b/gi, "ven");
}

const REGIONAL_OUTPUT_SIGNALS = {
  "es-ES": /\b(?:vale|vaya|luego|tranqui|planazo|apetece|buena pinta|sin prisa|sin agobios|que no es plan|mola|menudo)\b/i,
  "es-MX": /\b(?:va|sale|ahorita|luego|tranqui|me late|platicar|platillo|est[a?]\s+bueno)\b/i,
  "es-AR": /\b(?:vos|dale|tranqui|joya|capaz|pinta|piola|sos|che|avisame|quer[e?]s|ac[a?])\b/i,
  "es-CL": /\b(?:ya|igual|tranqui|piola|bac[a?]n|dale|nom[a?]s|cach[e?]|tinca|tinc[o?]|pod[i?]s)\b/i,
  "es-PY": /\b(?:vos|tranqui|dale|sin drama|quer[e?]s|ten[e?]s|pod[e?]s)\b/i,
  "es-UY": /\b(?:dale|vos|ta|tranqui|impecable|capaz|pinta|vamo arriba)\b/i,
  "es-CO": /\b(?:listo|de una|tranqui|bien|ch[e?]vere|suave)\b/i,
  "es-PE": /\b(?:ya|tranqui|normal|chévere|ch[e?]vere|al toque|bacán|un toque|de todas)\b/i,
  "es-VE": /\b(?:dale|fino|tranqui|chamo|buenísimo|pendiente|de pana)\b/i,
  "es-EC": /\b(?:ya|listo|tranqui|super|de una|con calma|no hay problema)\b/i,
  "es-BO": /\b(?:ya|dale|tranqui|nom[a?]s|con calma|ahorita|sin problema)\b/i,
  "es-CR": /\b(?:pura vida|tranqui|todo bien|super|de fijo|con calma|buenísimo)\b/i,
  "es-DO": /\b(?:dale|nítido|n[i?]tido|tranqui|suave|ta bien|activo)\b/i,
  "es-PA": /\b(?:dale|listo|tranqui|cool|va|suave|de una|sin problema)\b/i,
  "es-GT": /\b(?:va|dale|tranqui|buena onda|ahorita|sin pena|con calma)\b/i,
  "es-SV": /\b(?:va|dale|tranqui|chivo|ahorita|sin pena|con calma)\b/i,
  "es-HN": /\b(?:dale|va|tranqui|macizo|ahorita|sin pena|con calma)\b/i,
  "es-NI": /\b(?:dale|va|tranqui|tuanis|ahorita|sin pena|con calma)\b/i,
  "es-CU": /\b(?:dale|asere|tranqui|qué bueno|ahora|suave|sin problema)\b/i,
  "es-PR": /\b(?:dale|brutal|tranqui|corillo|ahora|suave|pendiente)\b/i,
  "es-US": /\b(?:dale|tranqui|listo|va|meeting|deck|update|check|pendiente)\b/i
};

const REGIONAL_OUTPUT_PREFIX = {
  "es-ES": "Vale",
  "es-MX": "Va",
  "es-AR": "Tranqui",
  "es-CL": "Ya",
  "es-PY": "Tranqui",
  "es-CO": "Listo",
  "es-UY": "Ta",
  "es-PE": "Ya",
  "es-VE": "Dale",
  "es-EC": "Ya",
  "es-BO": "Ya",
  "es-CR": "Pura vida",
  "es-DO": "Dale",
  "es-PA": "Dale",
  "es-GT": "Va",
  "es-SV": "Va",
  "es-HN": "Dale",
  "es-NI": "Dale",
  "es-CU": "Dale",
  "es-PR": "Dale",
  "es-US": "Dale"
};

function safeLeadingPrefix(variantKey = "es-neutro") {
  if (variantKey === "es-ES") return "Vale";
  if (variantKey === "es-MX") return "Va";
  if (variantKey === "es-AR" || variantKey === "es-PY" || variantKey === "es-UY") return "Dale";
  return REGIONAL_OUTPUT_PREFIX[variantKey] || "Listo";
}

function shouldForceRegionalCue({ variantKey, toneKey, normalizedAction, state = {}, plainContext = "", text = "" } = {}) {
  const signalRegex = REGIONAL_OUTPUT_SIGNALS[variantKey];
  if (!signalRegex || variantKey === "es-neutro" || signalRegex.test(text)) return false;
  if (!["suggest", "rewrite", "reactivate", "recommend", "opener"].includes(normalizedAction)) return false;
  if (state.regionalSignalOptional) return false;

  const agentKey = normalizeAgentKey(state.agent || state.aiAgent || state.base_tone || state.tone || toneKey);
  if (agentKey === "profesional" || ["profesional", "directo", "intelectual", "cuidadoso"].includes(toneKey)) return false;

  if (/\b(?:cliente|jefe|jefa|proveedor|presupuesto|contrato|cl[aá]usula|informe|factura|reuni[oó]n|entrega|soporte|proyecto|tarea|archivo|documento|legal|pago|pagos)\b/i.test(plainContext)) {
    return false;
  }

  return true;
}

function addRegionalCue(text = "", variantKey = "es-neutro") {
  const prefix = safeLeadingPrefix(variantKey);
  if (!prefix) return text;
  return `${prefix}, ${String(text || "").replace(/^[,.;:\s]+/, "")}`.trim();
}

function regionalMissionSmileText(variantKey = "es-neutro") {
  if (variantKey === "es-ES") return "Jajaja, vaya, me gusta haberte sacado esa sonrisa";
  if (variantKey === "es-MX") return "Jajaja, me late haberte sacado una sonrisa as\u00ed";
  if (variantKey === "es-AR") return "Jajaja, qu\u00e9 peligro, con vos es f\u00e1cil hacerte re\u00edr as\u00ed";
  if (variantKey === "es-CL") return "Jajaja, bac\u00e1n sacarte una sonrisa as\u00ed";
  if (variantKey === "es-CO") return "Jajaja, me gusta sacarte esa risa";
  if (variantKey === "es-PY") return "Jajaja, me gusta sacarte una sonrisa as\u00ed";
  return "Jajaja, me gusta sacarte una sonrisa as\u00ed";
}

function isIncompleteAiText(text = "") {
  const value = String(text || "").trim();
  if (!value) return true;
  return (
    /\b(?:hace\s+cu[a\u00e1]nto\s+que\s+no|cu[a\u00e1]nto\s+que\s+no)\s*$/i.test(value) ||
    /\b(?:con|de|del|para|por|y|o|pero|que|qu[e\u00e9]|si|no|cuando|cu[a\u00e1]ndo|donde|d[o\u00f3]nde|como|c[o\u00f3]mo|cuanto|cu[a\u00e1]nto|hace|mejor|m[a\u00e1]s|algo|un|una|buen|buena|lo|la|el|los|las)[.!?]?\s*$/i.test(value)
  );
}

function compactMultipleOpenerOptions(text = "") {
  const value = String(text || "").trim();
  if (!value) return value;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 18) return value;
  const parts = value
    .split(/(?<=[?!.])\s+(?=[A-Z\u00c1\u00c9\u00cd\u00d3\u00da\u00d1\u00bf])/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return value;
  while (
    parts.length > 1 &&
    /^(?:ey|hey|hola|buenas|plan\s+para\s+hoy|qu[e\u00e9]\s+tal|hola,\s*qu[e\u00e9]\s+tal|ey,\s*qu[e\u00e9]\s+tal)[?!.,\s]*$/i.test(parts[0])
  ) {
    parts.shift();
  }
  const first = parts[0];
  if (first.split(/\s+/).filter(Boolean).length >= 5) return first;
  if (parts[1] && parts[1].split(/\s+/).filter(Boolean).length >= 5) return parts[1];
  return value;
}

function normalizePrefixCapitalization(text = "") {
  return String(text || "").replace(/^(Vale|Va|Ya|Dale|Tranqui|Listo|Ta|Pura vida),\s+([A-Z\u00c1\u00c9\u00cd\u00d3\u00da\u00d1])/u, (match, prefix, first) => {
    return `${prefix}, ${String(first || "").toLocaleLowerCase("es")}`;
  });
}

function capitalizeFirstText(text = "") {
  return String(text || "").replace(/^([a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1])/u, (match, first) => String(first || "").toLocaleUpperCase("es"));
}

function normalizeLateSpanishArtifacts(text = "", { normalizedAction = "suggest", variantKey = "es-neutro" } = {}) {
  let value = String(text || "")
    .replace(/\bme\s+acord[e\u00e9]\s+de\s+t[u\u00fa](?=$|[\s,.;:?!])/gi, "me acord\u00e9 de ti")
    .replace(/\bme\s+hizo\s+acordar\s+a\s+t[i\u00ed](?=$|[\s,.;:?!])/gi, "me hizo pensar en ti")
    .replace(/\bme\s+acord[o\u00f3]\s+de\s+t[i\u00ed](?=$|[\s,.;:?!])/gi, "me hizo pensar en ti")
    .replace(/\bme\s+record[o\u00f3]\s+a\s+t[i\u00ed](?=$|[\s,.;:?!])/gi, "me hizo pensar en ti")
    .replace(/\bme\s+record[o\u00f3]\s+de\s+t[i\u00ed](?=$|[\s,.;:?!])/gi, "me hizo pensar en ti")
    .replace(/\bpensar\s+en\s+t[u\u00fa](?=$|[\s,.;:?!])/gi, "pensar en ti")
    .replace(/\bpens[e\u00e9]\s+en\s+t[u\u00fa](?=$|[\s,.;:?!])/gi, "pens\u00e9 en ti")
    .replace(/\ba\s+puro\s+puro\s+/gi, "a ")
    .replace(/\bqu[e\u00e9]\s+bueno\s+de\s+haber\s+logrado\b/gi, "qu\u00e9 bueno haber logrado")
    .replace(/\bmisi[o\u00f3]n\s+cumplida\s+entonces[!.]?\s*misi[o\u00f3]n\s+cumplida\.?/gi, "misi\u00f3n cumplida entonces.");
  if (normalizedAction === "opener") {
    value = value
      .replace(/^(?:(Vale|Va|Ya|Dale|Tranqui|Listo),\s*)?hola,\s*qu[e\u00e9]\s+tal\??\s*/i, (match, prefix) => prefix ? `${prefix}, ` : "")
      .replace(/\bqu[e\u00e9]\s+tal\s+si\s+/gi, "");
  }
  if (variantKey === "es-neutro") {
    value = value
      .replace(/\bpas[a\u00e1](?=$|[\s,.;:?!])/gi, "pasa")
      .replace(/\bquer[e\u00e9]s(?=$|[\s,.;:?!])/gi, "quieres")
      .replace(/\bsegu[i\u00ed](?=$|[\s,.;:?!])/gi, "sigue");
  }
  return value;
}

function completeAiFallback({ variantKey = "es-neutro", normalizedAction = "suggest", toneKey = "" } = {}) {
  return "";
}

function normalizePostprocessQualityText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s,.;:!?-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripRepeatedOpeningPhrase(text = "") {
  const value = String(text || "").trim();
  const match = value.match(/^(.{2,70}?)([,;:.!?])\s*\1\b\s*/i);
  if (!match) return value;
  const phrase = match[1].trim();
  if (phrase.split(/\s+/).filter(Boolean).length > 6) return value;
  return `${phrase} ${value.slice(match[0].length).trimStart()}`.replace(/\s+/g, " ").trim();
}

function stripProfessionalCasualTail(text = "", { toneKey = "", context = "" } = {}) {
  const value = String(text || "").trim();
  if (toneKey !== "profesional") return value;
  const normalizedContext = normalizePostprocessQualityText(`${context} ${value}`);
  const seriousContext = /\b(?:cliente|jefe|jefa|proveedor|contrato|presupuesto|factura|pago|pagos|cobro|precio|documento|archivo|tarea|deadline|entrega|reunion|reuniones|trabajo|laboral|soporte|incidencia)\b/i.test(normalizedContext);
  if (!seriousContext) return value;
  return value
    .replace(/\s*(?:[.!?]\s*)?(?:suave|tranqui|tranquilo|tranquila|nomas|nom[a\u00e1]s|de una|dale)\.?\s*$/i, "")
    .replace(/[,\s]+$/g, "")
    .trim();
}

function replyMoveSignature(value = "") {
  const text = normalizePostprocessQualityText(value);
  if (/\b(?:tomamos\s+algo|tomar\s+algo|cafe|quedamos|vernos|nos\s+vemos|esta\s+semana|segunda\s+parte|seguimos\s+en\s+persona)\b/i.test(text)) return "date_plan";
  if (/\b(?:lo\s+reviso|te\s+confirmo|te\s+envio|te\s+lo\s+paso|lo\s+dejo\s+listo|propuesta|presupuesto|viernes|hoy)\b/i.test(text)) return "professional_commit";
  if (/\b(?:descansa|te\s+leo|aca\s+estoy|aqui\s+estoy|te\s+acompan|sin\s+prisa|sin\s+apuro)\b/i.test(text)) return "support";
  if (/\b(?:caminamos|comemos|damos\s+una\s+vuelta|pedimos\s+algo|desconectamos)\b/i.test(text)) return "simple_plan";
  if (/\b(?:whatsapp|una\s+vez|view\s+once|lo\s+miro)\b/i.test(text)) return "media_review";
  return "";
}

function stripStaleContextForDecision(plainContext = "", state = {}) {
  const text = String(plainContext || "");
  const target = currentTargetPlainText(text);
  const hasTarget = Boolean(target || /\b(?:ultimo_mensaje_de_otra_persona|mensaje_objetivo_actual|last_inbound|last_outbound)\b/i.test(text) || state.targetMessageId || state.targetMessageSource || state.targetMessageSender);
  const staleLineRe = /\b(?:historial[_\s]+de[_\s]+apoyo[_\s]+menos[_\s]+importante|contexto[_\s]+antiguo|mensaje[_\s]+viejo|stale|old[_\s]+context|respuesta[_\s]+anterior|previous[_\s]+generated|generated[_\s]+before|no[_\s]+usar[_\s]+para[_\s]+responder|solo[_\s]+referencia)\b/i;
  if (!hasTarget || !staleLineRe.test(text)) return text;
  return text
    .split(/\r?\n/)
    .filter((line) => !staleLineRe.test(line))
    .join("\n")
    .trim();
}

function analyzeContextFreedom({ action = "suggest", toneKey = "", variantKey = "es-neutro", plainContext = "", state = {}, previousGeneratedText = "" } = {}) {
  const normalizedAction = normalizeAction(action);
  const contextText = normalizePostprocessQualityText(plainContext);
  const effectiveContextText = stripStaleContextForDecision(plainContext, state);
  const effectiveText = normalizePostprocessQualityText(effectiveContextText);
  const lastFromUser = Boolean(state.lastMessageFromUser || state.last_message_from_user || state.targetMessageSender === "me" || state.targetMessageSource === "last_outbound");
  const hasPrevious = Boolean(String(previousGeneratedText || "").trim());
  const staleSignals = [];
  if (/\b(?:historial[_\s]+de[_\s]+apoyo[_\s]+menos[_\s]+importante|contexto[_\s]+antiguo|mensaje[_\s]+viejo|stale|old[_\s]+context|solo[_\s]+referencia)\b/i.test(plainContext) || /\b(?:historial\s+de\s+apoyo\s+menos\s+importante|contexto\s+antiguo|mensaje\s+viejo|stale|old\s+context|solo\s+referencia)\b/i.test(contextText)) staleSignals.push("stale_context_tag");
  if (/\b(?:respuesta[_\s]+anterior|previous[_\s]+generated|generated[_\s]+before)\b/i.test(plainContext) || /\b(?:respuesta\s+anterior|previous\s+generated|generated\s+before)\b/i.test(contextText)) staleSignals.push("previous_generation_context");

  const riskSignals = [];
  if (/\b(?:prefiero\s+no|no\s+quiero|necesito\s+espacio|limite|l[i\u00ed]mite|sin\s+presion|sin\s+presi[o\u00f3]n|celos|reclamar)\b/i.test(effectiveText)) riskSignals.push("relationship_boundary");
  if (/\b(?:cliente|jefe|jefa|contrato|presupuesto|factura|pago|cobro|documento|archivo|soporte|incidencia|legal|privacidad)\b/i.test(effectiveText) || toneKey === "profesional") riskSignals.push("precision_required");
  if (/\b(?:view\s+once|una\s+sola\s+visualizacion|no\s+disponible\s+para\s+ia|no\s+disponible\s+para\s+wafli)\b/i.test(effectiveText)) riskSignals.push("media_not_visible");

  let opportunity = "continue";
  if (toneKey === "ligoteo" && /\b(?:planes|esta\s+noche|salir|tomar\s+algo|me\s+ha\s+gustado\s+verte|ganas\s+de\s+hablar|cita|quedar|vernos)\b/i.test(effectiveText)) opportunity = "romantic_open_door";
  else if (toneKey === "profesional" && /\b(?:viernes|hoy|propuesta|presupuesto|entrega|plazo|listo|preparad[oa]|puedes\s+tener|lo\s+puedes\s+tener)\b/i.test(effectiveText)) opportunity = "professional_commitment";
  else if (toneKey === "amistoso" && /\b(?:cansad[oa]|agotad[oa]|mal\s+d[i\u00ed]a|no\s+s[e\u00e9]\s+qu[e\u00e9]\s+hacer|aburrid[oa]|baj[o\u00f3]n)\b/i.test(effectiveText)) opportunity = "friendly_support";
  else if (normalizedAction === "reactivate" && (state.cooledThread || /\b(?:estado_hilo:\s*frio|estado_hilo:\s*fr[i\u00ed]o|frio=true|fr[i\u00ed]o=true|hilo\s+frio|hilo\s+fr[i\u00ed]o)\b/i.test(plainContext))) opportunity = "reactivate_thread";
  else if (lastFromUser) opportunity = "own_turn_continuation";

  let freedomLevel = "medium";
  if (riskSignals.length) freedomLevel = "low";
  else if (["romantic_open_door", "friendly_support", "reactivate_thread"].includes(opportunity)) freedomLevel = "high";

  let responseMove = state.responseMove || state.response_move || state.contextCopilotHints?.responseMove || "";
  if (!responseMove) {
    responseMove = {
      romantic_open_door: "take_soft_initiative",
      professional_commitment: "commit_next_step",
      friendly_support: "support_or_simple_plan",
      reactivate_thread: "reopen_with_specific_hook",
      own_turn_continuation: "continue_own_message"
    }[opportunity] || "respond_contextually";
  }

  const previousMove = replyMoveSignature(previousGeneratedText);
  return {
    version: "context-freedom-v1",
    freedomLevel,
    riskLevel: riskSignals.length ? "high" : "normal",
    opportunity,
    responseMove,
    turnOwner: lastFromUser ? "user" : "contact",
    staleContextPolicy: staleSignals.length ? "prefer_current_target_ignore_stale" : "normal",
    staleSignals,
    riskSignals,
    effectiveContextText,
    regenerationStrategy: hasPrevious ? "change_structure_or_move" : "normal",
    previousMove,
    shouldAvoidPreviousMove: hasPrevious && Boolean(previousMove) && freedomLevel !== "low",
    variantKey
  };
}

function alternateForRepeatedMove(finalText = "", contextFreedom = {}, { toneKey = "", variantKey = "es-neutro", plainContext = "" } = {}) {
  const currentMove = replyMoveSignature(finalText);
  if (!contextFreedom.shouldAvoidPreviousMove || !currentMove || currentMove !== contextFreedom.previousMove) return finalText;
  const text = normalizePostprocessQualityText(plainContext);
  if (toneKey === "ligoteo" && currentMove === "date_plan") {
    if (/\besta\s+noche\b/i.test(text)) {
      return variantKey === "es-ES"
        ? "Me apetece verte. Buscamos un sitio tranquilo y arrancamos con una copa"
        : "Me dan ganas de verte. Buscamos un lugar tranqui y arrancamos con algo simple";
    }
    return variantKey === "es-ES"
      ? "Me dejaste con ganas de segunda parte. Esta semana nos vemos y lo seguimos en persona"
      : "Me dejaste con ganas de segunda parte. Esta semana nos vemos y seguimos en persona";
  }
  if (toneKey === "profesional" && currentMove === "professional_commit") {
    if (/\bviernes\b/i.test(text)) return "S\u00ed, lo dejo listo para el viernes y te aviso cuando est\u00e9 enviado.";
    if (/\bhoy\b/i.test(text)) return "Lo dejo avanzado hoy y te paso la propuesta antes de cerrar el d\u00eda.";
  }
  if (toneKey === "amistoso" && currentMove === "support") {
    return ["es-AR", "es-PY", "es-UY"].includes(variantKey)
      ? "Te leo cuando quieras, sin apuro; no ten\u00e9s que resolver todo hoy"
      : "Te leo cuando quieras, sin prisa; no tienes que resolver todo hoy";
  }
  return finalText;
}

function postprocessAiText(rawText = "", { variant = "es-neutro", action = "suggest", tone = "", state = {}, context = "" } = {}) {
  const normalizedAction = normalizeAction(action);
  const variantKey = normalizeVariant(variant);

  // Soltura: solo limpieza segura y estructural. El estilo, la regionalidad y el
  // movimiento conversacional los decide el prompt + el modelo; ya no reescribimos
  // frases concretas ni aplicamos fallbacks prefabricados (eso homogeneizaba todo).
  // La calidad se mide aparte en aiQualityService (scoring/flags) sin mutar el texto.
  let text = String(rawText || "").trim();
  if (!text) return text;

  // Quitar comillas envolventes y etiquetas/prefijos de asistente.
  text = text
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, "")
    .replace(/^(?:respuesta(?:\s+sugerida)?|mensaje(?:\s+sugerido)?|sugerencia|aqu[ií] tienes|te sugiero(?:\s+responder)?|opci[oó]n\s*\d*)\s*[:\-]\s*/i, "")
    .trim();

  // Evitar arranque duplicado ("Hola, hola ...").
  text = stripRepeatedOpeningPhrase(text);

  // Regla dura de producto: nunca signos de apertura invertidos en la salida.
  text = text.replace(/[¿¡]/g, "");

  // Arreglos gramaticales ligeros (no cambian intencion ni contenido).
  text = normalizeLateSpanishArtifacts(text, { normalizedAction, variantKey });

  // Puntuacion de WhatsApp: fuera guion largo (—), punto y coma (;) y dos puntos
  // de enlace (no horas). gpt-5 abusa del guion largo y suena a IA. analyze se
  // excluye porque usa "Respuesta:" como etiqueta estructural.
  if (normalizedAction !== "analyze") {
    text = text
      .replace(/\s*[—–‒―]\s*/g, ", ")
      .replace(/\s+-\s+/g, ", ")
      .replace(/\s*;\s*/g, ", ")
      .replace(/(?<!\d)\s*:\s*(?!\d)/g, ", ")
      .replace(/\s+([,.!?])/g, "$1")
      .replace(/,\s*([.!?])/g, "$1")
      .replace(/(?:,\s*){2,}/g, ", ")
      .replace(/^\s*,\s*/, "")
      .trim();
  }

  // Red de seguridad anti-fabricacion: quita referencias a una historia/lugar
  // compartido inventado ("de siempre", "donde siempre", "nuestro cafe"...) SOLO si
  // no aparecen en el contexto. Si el contacto lo nombro, se respeta.
  if (normalizedAction !== "analyze") {
    const plainCtx = contextToPlainText(context).toLowerCase();
    const groundedSharedPlace = /de siempre|de costumbre|donde siempre|nuestro (?:lugar|sitio|cafe|caf[eé]|bar)/i.test(plainCtx);
    if (!groundedSharedPlace) {
      text = text
        .replace(/\s*,?\s*donde\s+siempre(?:\s+(?:vamos|nos\s+vemos))?/gi, "")
        .replace(/\s+de\s+siempre\b/gi, "")
        .replace(/\s+de\s+costumbre\b/gi, "")
        .replace(/\bnuestro\s+(lugar|sitio|cafe|caf[eé]|bar)\b/gi, "un $1")
        .replace(/\s+([,.!?])/g, "$1")
        .replace(/(?:,\s*){2,}/g, ", ")
        .replace(/\s{2,}/g, " ")
        .trim();
    }
  }

  // Para openers con varias frases largas, quedarnos con una opcion limpia.
  if (normalizedAction === "opener") {
    text = compactMultipleOpenerOptions(text);
  }

  // Capitalizacion y normalizacion final de espacios.
  text = normalizePrefixCapitalization(text)
    .replace(/\s{2,}/g, " ")
    .trim();

  return capitalizeFirstText(text);
}

function turnGuardPrompt(context = "", state = {}) {
  const rawContext = String(context || "");
  const plainContext = contextToPlainText(rawContext);
  const toneKey = normalizeTone(state.agent || state.tone || state.base_tone || "");
  const focusLine = rawContext
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse()
    .find((line) => /^(?:ultimo_mensaje_de_otra_persona|last_inbound|contacto:)\b/i.test(line)) || "";
  const guard = [];

  if (/\bmensaje_base\s*:/i.test(rawContext) && /\b(?:nervios|nervios[oa]|atrev|animes?|animarte|anim[a\u00e1]s?|atrevas?)\b/i.test(rawContext)) {
    guard.push("Reescritura: conserva la intencion sobre nervios/atreverse/animarse. No la conviertas en una cita generica, plan nuevo ni frase de cierre si el borrador no lo pide.");
  }

  if (/\b(?:qu[e\u00e9]\s+tal\s+est[a\u00e1]s|que\s+tal\s+estas|c[o\u00f3]mo\s+est[a\u00e1]s|como\s+estas|c[o\u00f3]mo\s+and[a\u00e1]s|como\s+andas)\b/i.test(focusLine)) {
    guard.push("El ultimo contacto pregunto como estas. Responde esa pregunta primero. No vuelvas a saludar, no cambies de tema y no recicles una frase bonita anterior.");
  }
  if (/\b(?:estoy|ando|ac[a\u00e1]\s+estoy)\s+(?:estudiando|trabajando|repasando|preparando)\b|\b(?:para\s+mi\s+clase|para\s+clase|examen|parcial|reuni[o\u00f3]n)\b/i.test(focusLine)) {
    guard.push("El ultimo contacto esta estudiando/trabajando/concentrado. No preguntes materia, tema, clase, reunion ni que le tiene concentrado. No digas aplicada/o, nota, sacar 10, seguro te va bien ni te distraigo. Respeta su actividad y deja una respuesta ligera.");
  }
  if (toneKey === "ligoteo" && /\b(?:algo\s+como\s+qu[e\u00e9]|como\s+qu[e\u00e9]|qu[e\u00e9]\s+plan|que\s+plan|pero\s+qu[e\u00e9]\s+cosa|pero\s+que\s+cosa)\b/i.test(focusLine)) {
    guard.push("El ultimo contacto pidio un plan concreto. Elige una sola accion facil. No uses podriamos, menu de opciones, algun sitio agradable, lo que prefieras ni frases abstractas sin plan.");
  }
  if (toneKey === "amistoso" && /\b(?:hola|qu[e\u00e9]\s+haces|que\s+haces|qu[e\u00e9]\s+tal)\b/i.test(focusLine)) {
    guard.push("El ultimo contacto hizo una apertura amistosa. Responde como persona cercana. No uses lenguaje de soporte, no digas listo para ayudar ni listo para charlar.");
  }
  if (toneKey === "profesional" && /\b(?:informe|revisar|revisarlo|antes\s+de\s+las\s+15|plazo|entrega)\b/i.test(focusLine || plainContext)) {
    guard.push("El ultimo foco es una tarea profesional. Responde con accion y siguiente paso. No preguntes por correo, llamada, formato, puntos clave ni documento completo si no falta ese dato.");
  }

  if (!guard.length) return "";
  return [
    "turn_guard=activo",
    "turn_guard_priority=obligatorio; si contradice estilo, gana turn_guard",
    `turn_focus=${focusLine || "auto"}`,
    ...guard,
    "turn_guard_rule=no escribas desde estas lineas; usalas para decidir. La respuesta final debe ser nueva, natural y lista para enviar."
  ].join("\n");
}

module.exports = {
  PROMPT_VERSION,
  PROMPT_VERSION_META: ACTIVE_PROMPT_VERSION_META,
  VARIANT_PROMPTS,
  analyzeContextFreedom,
  REGIONAL_VARIANT_CONFIG,
  buildRegionalStylePrompt,
  TONE_PROMPTS,
  AI_AGENT_BEHAVIOR,
  normalizeVariant,
  normalizeTone,
  normalizeAgentKey,
  normalizeAction,
  userAlias,
  staticSystemPreamble,
  basePrompt,
  statePrompt,
  outputRulesForAction,
  actionInstruction,
  actionPrompt,
  turnGuardPrompt,
  postprocessAiText
};
