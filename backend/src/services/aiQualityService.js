const { normalizedSimilarity, responseMovePrompt } = require("./aiResponseMoveService");

const PROMPT_VARIANT_V1 = "quality-safe-v1";
const PROMPT_VARIANT = "quality-safe-v2";

const MOJIBAKE_RE = /(?:\u00c3|\u00c2|\u00e2[\u0080-\u009f]|\ufffd)/;
const ASSISTANT_PHRASE_RE = /\b(?:como asistente|soy una ia|no puedo enviar|aqui tienes|te sugiero responder|podrias decir|respuesta sugerida|mensaje sugerido)\b/i;
const PLACEHOLDER_RE = /\[(?:persona_\d+|telefono|email|url|documento|nombre|fecha|hora|lugar)\]/i;
const GENERIC_CLOSER_RE = /\b(?:que te parece|como lo ves|que opinas|si quieres|si queres|si te parece|cualquier cosa|avisame|me avisas)\??$/i;
const EMPTY_POLITE_RE = /^(?:perfecto|genial|vale|dale|ok|sale|va|joya|de una)[,.!\s]*$/i;
const RISK_CONTEXT_RE = /\b(?:cliente|jefe|jefa|proveedor|contrato|presupuesto|factura|pago|cobro|precio|legal|reclamo|soporte|incidencia|urgente|deadline|ansiedad|triste|duelo|hospital|enfermo|ruptura|conflicto)\b/i;
const PROFESSIONAL_CONTEXT_RE = /\b(?:cliente|jefe|jefa|proveedor|contrato|presupuesto|factura|pago|pagos|cobro|precio|documento|archivo|tarea|deadline|entrega|reunion|reuniones|trabajo|laboral|soporte|incidencia)\b/i;
const PROFESSIONAL_CASUAL_TAIL_RE = /(?:^|[.!?]\s*)(?:suave|tranqui|tranquilo|tranquila|nomas|nom[a\u00e1]s|de una|dale)\.?$/i;
const STIFF_HUMAN_RHYTHM_RE = /\b(?:procedamos|estimado usuario|estimada usuaria|en conclusion|por consiguiente|me complace informarte|permiteme indicarte|agradezco de antemano)\b/i;
const AWKWARD_SPANISH_RE = /\b(?:listo\s+oro|jajaja\s+sale|ni\s+nada\s+sale|a\s+m[i\u00ed]\s+tambi[e\u00e9]n\s+(?:de\s+)?que|a\s+m[i\u00ed]\s+tambi[e\u00e9]n\s+que\s+te\s+haya\s+pasado|qu[e\u00e9]\s+bueno\s+de\s+que|yo\s+tambi[e\u00e9]n\.\s*si\s+te\s+apetece|qu[e\u00e9]\s+tomamos\s+algo|luego\s+ya\s+qu[e\u00e9]\s+apetece|descanso\s+bien\s+merecido|hablamos\s+aqu[i\u00ed]\s+estoy|te\s+merec[e\u00e9]s\s+un\s+buen|puede\s+que\s+nos\s+damos|seguir\s+haciendo|no\s+m[a\u00e1]s\s+cuando|vos\s+dale,?\s+qu[e\u00e9]\s+plan|aqu[i\u00ed]\s+estoy\s+piola\s+para|risas\s+suaves|suave\s+la\s+vibra|sonrisa\s+hoy,\s*suave|cuando\s+te\s+r[i\u00ed]o|me\s+encanta\s+cuando\s+te\s+r[i\u00ed]o)\b|\?\s*apetece\.?$|^(?:le|dale|va|sale|vale),?\s*jajaja\b|^le[,!.]?\s/i;
const PASSIVE_NO_INITIATIVE_RE = /\b(?:no se|no tengo planes|no tenia planes|no tengo nada (?:planeado|previsto)|estoy libre|libre esta noche|esta noche estoy libre|esta noche me viene bien|t[u\u00fa]\s+qu[e\u00e9]\s+opinas|vos que opinas|vos decime|t[u\u00fa] dime|decime que|dime que|qu[e\u00e9]\s+opinas|qu[e\u00e9]\s+te parece|quer[e\u00e9]s que te pase|quieres que te pase|quer[e\u00e9]s que armemos|quieres que armemos|prefer[i\u00ed]s|prefieres|alguna idea|alg[u\u00fa]n lugar|podemos buscar algo|ver qu[e\u00e9] pinta|como quieras|si quieres|si queres|si quer[e\u00e9]s|depende de ti|lo que prefieras)\b/i;
const INITIATIVE_OPPORTUNITY_CONTEXT_RE = /\b(?:planes|plan|esta noche|hoy|salir|hacer algo|tomar algo|quedar|vernos|puedes tener|puedes enviar|plazo|entrega|propuesta|revision|revisar|no se que hacer|no s[e\u00e9] que hacer|acompanar|ayuda)\b/i;
const PLAYFUL_DOUBT_CONTEXT_RE = /\b(?:ser[a\u00e1]\?|seguro\?|vos dec[i\u00ed]s\?|tu dices\?|t[u\u00fa] dices\?|en serio\?)\b/i;
const PLAYFUL_DOUBT_BAD_RESPONSE_RE = /\b(?:quedamos as[i\u00ed]|quedamos asi|entonces quedamos|queda as[i\u00ed]|queda asi|tranqui vos|tranquilo vos|tranquila vos)\b/i;
const OWN_TURN_CONTACT_REPLY_RE =
  /^(?:dale|perfecto|me parece(?:\s+\w+)?|obvio|s[i\u00ed]|si|de una|claro|genial|joya|sale|va|vale|ok|esta bien|est[a\u00e1] bien|entonces quedamos|quedamos as[i\u00ed]|quedamos asi)[,!.]?(?:\s+|$)/i;
const LOW_VALUE_OPENING_RE =
  /^(?:dale|vale|va|sale|listo|ya|claro|genial|perfecto|de una|joya)[,!.]\s+/i;
const TEMPLATE_COMMA_OPENING_RE =
  /^(?:dale|vale|va|sale|listo|ya|claro|genial|perfecto|bueno|tranqui|ok|de una|joya|fino|macizo|pura vida)[,]\s+\S+/i;
const GENERIC_QUESTION_TAIL_RE =
  /\b(?:que opinas|que te parece|como lo ves|como va todo|c[o\u00f3]mo va todo|tu que|vos que|te va|te apetece|te pinta|si quieres|si queres|alguna idea|algun lugar|algun plan)\??$/i;
const CONCRETE_MOVE_RE =
  /\b(?:tomamos|tomar algo|cafe|caf[e\u00e9]|cenamos|comemos|damos una vuelta|quedamos|nos vemos|arrancamos|arrancar|paso|pasa|te mando|te envio|te env[i\u00edo]|lo reviso|lo confirmo|lo tengo listo|te lo paso|acompa[n\u00f1]o|cuenta conmigo|voy avanzando|lo preparo)\b/i;
const OPPORTUNITY_CONTEXT_RE =
  /\b(?:esta noche|planes|plan|salir|tomar algo|cita|nos vemos|me gust[o\u00f3] verte|ganas de hablar|ser[a\u00e1]\??|quedamos|viernes|presupuesto|informe|archivo|foto|imagen|audio|mal d[i\u00ed]a|no fue mi mejor d[i\u00ed]a|no s[e\u00e9] qu[e\u00e9] hacer|se me fue el tiempo)\b/i;
const ACTIONLESS_REPLY_RE =
  /^(?:suena bien|me gusta|me alegro|tranqui|no pasa nada|todo bien|perfecto|claro|ok|vale|dale|va|sale)(?:[.!]|\s|$)/i;
const CANNED_REWRITE_REPLY_RE =
  /\b(?:esta noche me viene bien|si te va,\s*tomamos algo|hagamos algo sencillo:?\s*tomamos algo|tomamos algo y dejamos que la charla haga el resto|dejamos que la charla haga el resto|seguimos charlando un rato|a mi tambien me quedaron ganas|a m[i\u00ed] tambi[e\u00e9]n me quedaron ganas|seguimos con calma)\b/i;
const STALE_CONTEXT_ECHO_RE =
  /\b(?:dudando de m[i\u00ed]|haciendo m[e\u00e9]rito|me quedaron ganas de seguir hablando|tomamos algo esta semana|dejamos que la charla haga el resto)\b/i;
const OVERSAFE_LOW_VALUE_RE =
  /\b(?:cuando quieras seguimos|cuando puedas seguimos|me cuentas luego|ya me dices|lo vemos luego|vemos que sale|vemos qu[e\u00e9] sale|como prefieras|lo que te venga bien)\b/i;
const LENGTHENING_FILLER_RE =
  /\b(?:con calma|sin prisa|sin apuro|sin vueltas|toda la onda|cuando puedas|cuando quieras)\b/i;
const CANNED_DATE_PLAN_RE =
  /\b(?:me apetece verte\.?\s*tomamos algo|tomamos algo luego y dejamos|dejamos que la noche arranque|seguimos la charla con calma|esta semana nos tomamos ese caf[e\u00e9]|(?:esta semana\s+)?(?:nos\s+)?tomamos algo(?:\s+esta semana)?\s+y\s+seguimos\s+(?:la charla|con calma)|tomamos algo y seguimos con calma|si est[a\u00e1]s libre.*(?:nos vemos|armamos).*algo sencillo)\b/i;
const OVERCLOSING_FLIRT_RE =
  /\b(?:queda\s+entonces|d[i\u00ed]a\s+y\s+hora|lo\s+dejamos\s+cerrado|toda\s+la\s+onda|sin\s+vueltas|sin\s+apuro|seguimos\s+cuando\s+puedas)\b/i;
const ACTIVE_FLIRT_CHAT_CONTEXT_RE =
  /\b(?:hola|holaa|guap[oa]|c[o\u00f3]mo\s+est[a\u00e1]s|qu[e\u00e9]\s+tal\s+est[a\u00e1]s|puedo\s+ahora|no\s+quier[e\u00e9]s\s+hablar|no\s+quer[e\u00e9]s\s+hablar|yo\s+tambi[e\u00e9]n\s+espero|me\s+viene\s+bien\s+ma[n\u00f1]ana|ma[n\u00f1]ana\s+a\s+la\s+noche|y\s+qu[e\u00e9]\s+me\s+cuentas\s+de\s+tu\s+d[i\u00ed]a)\b/i;
const ABSTRACT_FLIRT_META_RE =
  /\b(?:hay\s+algo\s+ah[i\u00ed]|esa\s+onda|sin\s+forzarlo|para\s+seguir\s+sin|puerta\s+natural|tension\s+amable)\b/i;
const DIRECT_MEET_ASK_CONTEXT_RE =
  /\b(?:tengo\s+ganas\s+de\s+verte|quiero\s+verte|cu[a\u00e1]ndo\s+podemos|cuando\s+podemos|cu[a\u00e1]ndo\s+nos\s+vemos|cuando\s+nos\s+vemos|ganas\s+de\s+verte)\b/i;
const WRONG_SMILE_ATTRIBUTION_RE =
  /\b(?:haberte\s+sacado\s+(?:una\s+)?sonrisa|sacarte\s+(?:una\s+)?sonrisa|hacerte\s+re[i\u00ed]r|mantener\s+el\s+nivel|misi[o\u00f3]n\s+cumplida)\b/i;
const OWN_SMILE_CONTEXT_RE =
  /\b(?:ultimo_mensaje_enviado_por_usuario|last_outbound|yo:)[\s\S]{0,240}\b(?:me\s+vas\s+a\s+sacar\s+(?:una\s+)?sonrisa|sacarme\s+(?:una\s+)?sonrisa|sonrisa\s+todo\s+el\s+d[i\u00ed]a)\b/i;
const CONTACT_LAUGH_CONTEXT_RE =
  /\b(?:ultimo_mensaje_de_otra_persona|last_inbound|contacto:)[\s\S]{0,200}\b(?:jaja|risa|me\s+hiciste\s+re[i\u00ed]r|me\s+sacaste\s+(?:una\s+)?sonrisa|me\s+hiciste\s+sonre[i\u00ed]r)\b/i;
const MANNERS_CORRECTION_CONTEXT_RE =
  /\b(?:sos|eres|eres\s+t[u\u00fa]|sos\s+vos|t[u\u00fa]\s+eres|vos\s+sos)\s+(?:vos\s+)?(?:el|la|quien)?\s*(?:que\s+)?(?:tiene|ten[e\u00e9]s|debe|debes)\s+que\s+recuperar\s+(?:los\s+)?modales\b|\b(?:d[o\u00f3]nde|donde)\s+quedaron\s+(?:tus|tu)\s+modales\b|\b(?:sal[u\u00fa]dame|saludame)\s+primero\b|\b(?:yo|ya)\s+te\s+salud[e\u00e9]\s+primero\b/i;
const WRONG_MANNERS_ATTRIBUTION_RE =
  /\b(?:recuper[a\u00e1]s|recuperas|recuper[e\u00e9]s|recuperes)\s+(?:esos|los|tus)?\s*modales\b|\b(?:encuentro|vernos|nos\s+vemos|en\s+persona|esta\s+semana|armando\s+ese\s+encuentro|vamos\s+armando)\b/i;
const CLOSE_OR_BOUNDARY_TARGET_CONTEXT_RE =
  /\b(?:ultimo_mensaje_de_otra_persona|last_inbound|contacto:)[\s\S]{0,220}\b(?:cu[i\u00ed]date|cuidate|hablamos\s+luego|hablamos\s+despu[e\u00e9]s|hasta\s+luego|me\s+voy|no\s+quiero\s+salir|no\s+quiero|no\s+puedo|no\s+estoy\s+libre|no\s+me\s+presiones|prefiero\s+no|necesito\s+espacio|otro\s+d[i\u00ed]a|hoy\s+no)\b/i;
const PUSH_AFTER_CLOSE_RE =
  /\b(?:nos\s+vemos|vernos|encuentro|esta\s+semana|hoy|ma[n\u00f1]ana|armamos|vamos|salimos|juntamos|quedamos|tomamos|cenamos|paso\s+a\s+buscar|pasarte\s+a\s+buscar)\b/i;
const CONNECTION_DATE_DRIFT_RE =
  /\b(?:tomamos algo|tomar algo|esta semana|esta noche|nos vemos|quedamos|salimos|salir|caf[e\u00e9]|cafe|copa|cenamos|comemos|plan tranqui|algo tranqui|algo sencillo)\b/i;
const ROMANTIC_BOUNDARY_CONTEXT_RE =
  /\b(?:no quiero salir|no quiero quedar|no quiero vernos|no puedo|no estoy libre|no me presiones|no me presion[e\u00e9]s|solo que no me presiones|prefiero no|no quiero|hoy no|ahora no|no es buen d[i\u00ed]a|no es buen dia|cuidate|cu[i\u00ed]date|hablamos luego|hablamos despu[e\u00e9]s|hablamos despues|nos hablamos|hasta luego|me voy|chau|adios|adi[o\u00f3]s)\b/i;
const PLAN_AFTER_BOUNDARY_RE =
  /\b(?:si est[a\u00e1]s libre|si estas libre|nos vemos|quedamos|tomamos algo|tomar algo|salir|te paso a buscar|armamos algo|hacemos algo|una vuelta|algo sencillo|plan tranqui|plan tranquilo|esta noche|esta semana)\b/i;
const SOFT_CLOSE_CONTEXT_RE =
  /\b(?:cuidate|cu[i\u00ed]date|hablamos luego|hablamos despu[e\u00e9]s|hablamos despues|nos hablamos|hasta luego|me voy|chau|adios|adi[o\u00f3]s)\b/i;
const SMALL_TALK_DAY_CONTEXT_RE =
  /\b(?:que me contas de tu d[i\u00ed]a|qu[e\u00e9] me cuentas de tu d[i\u00ed]a|que tal tu d[i\u00ed]a|qu[e\u00e9] tal tu d[i\u00ed]a|como estuvo tu d[i\u00ed]a|c[o\u00f3]mo estuvo tu d[i\u00ed]a)\b/i;
const CURRENT_INVITATION_CONTEXT_RE =
  /\b(?:esta\s+noche\s+(?:ten[e\u00e9]s|tienes)\s+planes|(?:ten[e\u00e9]s|tienes)\s+planes|est[a\u00e1]s\s+libre|estas\s+libre|ganas\s+de\s+vernos|cu[a\u00e1]ndo\s+podemos|cuando\s+podemos)\b/i;
const BOUNDARY_REOPEN_RE =
  /\b(?:hay\s+algo\s+ah[i\u00ed]|esa\s+onda|seguir\s+sin\s+forzarlo|me\s+gusta\s+hablar|seguimos\s+hablando|me\s+quedo\s+por\s+ac[a\u00e1]|charlar\s+sin\s+apuro)\b/i;
const CONTACT_SIMPLE_CONFIRMATION_CONTEXT_RE =
  /\b(?:ultimo_mensaje_de_otra_persona|last_inbound|contacto:)[^\n]{0,100}\b(?:genial|perfecto|listo|vale|dale|ok|de\s+una|me\s+parece\s+(?:bien|muy\s+buena\s+idea)|nos\s+vemos|te\s+veo)\b/i;
const MEETING_TIME_CONTEXT_RE =
  /\b(?:para\s+las|a\s+las|las)\s+([01]?\d|2[0-3])(?::([0-5]\d))?\b/i;
const MEETING_WINDOW_CONTEXT_RE =
  /\b(?:esta\s+noche|a\s+la\s+noche|hoy\s+a\s+la\s+noche|mas\s+tarde|m[a\u00e1]s\s+tarde)\b/i;
const MEETING_CONFIRMATION_OUTPUT_RE =
  /\b(?:20|19|21|22|nos\s+vemos|queda|listo|confirmad|perfecto|genial)\b/i;
const OVERDONE_MEETING_CONFIRMATION_RE =
  /\b(?:voy\s+preparando\s+las\s+ganas|buena\s+charla\s+tranqui|vos\s+tranqui|va\s+a\s+estar\s+bueno\s+el\s+encuentro|ganas\s+para\s+una\s+buena\s+charla|tranqui[\s\S]{0,90}\btranqui|encuentro)\b/i;
const CONTACT_WORKING_CONTEXT_RE =
  /\b(?:ultimo_mensaje_de_otra_persona|last_inbound|contacto:)[\s\S]{0,300}\b(?:estoy|ando|sigo|me\s+encuentro|ahora\s+mismo\s+estoy)\s+(?:ahora\s+mismo\s+)?(?:trabajando|en\s+el\s+trabajo|laburando|en\s+el\s+laburo|ocupad[oa])\b/i;
const CONTACT_WORKING_BAD_ATTRIBUTION_RE =
  /\b(?:me\s+rob[a\u00e1]s|me\s+robas|robarme)\s+(?:un\s+poco\s+de\s+)?(?:tiempo|rato)\b|\ben\s+medio\s+de\s+(?:mi\s+)?(?:laburo|trabajo)\b/i;
const CONTACT_INITIAL_GREETING_CONTEXT_RE =
  /\b(?:ultimo_mensaje_de_otra_persona|last_inbound|contacto:)[^\n]{0,180}\b(?:hola+|buenas|buen\s+d[i\u00ed]a|buenas\s+tardes|buenas\s+noches|qu[e\u00e9]\s+tal|c[o\u00f3]mo\s+est[a\u00e1]s|como\s+estas)\b/i;
const USER_GREETING_CONTEXT_RE =
  /\b(?:ultimo_mensaje_enviado_por_usuario|last_outbound|usuario:|yo:)[^\n]{0,180}\b(?:hola+|buenas|buen\s+d[i\u00ed]a|buenas\s+tardes|buenas\s+noches|qu[e\u00e9]\s+tal|c[o\u00f3]mo\s+est[a\u00e1]s|como\s+estas)\b/i;
const OUTPUT_GREETING_RE =
  /^(?:hola+|buenas|buen\s+d[i\u00ed]a|buenas\s+tardes|buenas\s+noches)\b/i;
const CONTACT_DELAY_APOLOGY_CONTEXT_RE =
  /\b(?:ultimo_mensaje_de_otra_persona|last_inbound|contacto:)[\s\S]{0,220}\b(?:perd[o\u00f3]n|perdon|disculpa|se\s+me\s+fue\s+el\s+d[i\u00ed]a|no\s+pude\s+responder|tard[e\u00e9]|demor[e\u00e9])\b/i;
const DELAY_PRESSURE_REPLY_RE =
  /\b(?:me\s+dejaste|te\s+extra[n\u00f1]e|te\s+extra\u00f1e|necesito|pendiente\s+de\s+ti|por\s+qu[e\u00e9]\s+no\s+respondiste|por\s+que\s+no\s+respondiste)\b/i;
const CONTACT_LAUGH_CURRENT_CONTEXT_RE =
  /\b(?:ultimo_mensaje_de_otra_persona|last_inbound|contacto:)[\s\S]{0,180}\b(?:jaja|risa|re[i\u00ed]r|sonrisa|me\s+hiciste\s+re[i\u00ed]r)\b/i;
const LAUGH_TO_PLAN_DRIFT_RE =
  /\b(?:me\s+gusta\s+el\s+plan|armamos|plan\s+simple|tomamos|quedamos|nos\s+vemos|dejamos\s+que\s+la\s+charla|charla\s+fluya)\b/i;
const AUDIO_TRANSCRIPT_CONTEXT_RE =
  /\bAudio\s+de\s+(?:contacto|la\s+otra\s+persona|otra\s+persona)[^\n:]*transcrito:\s*([^\n]+)/i;
const AUDIO_TRANSCRIPT_IGNORED_RE =
  /\b(?:lo\s+escucho|la\s+escucho|lo\s+miro|lo\s+veo|la\s+miro|la\s+veo)\s+en\s+WhatsApp\b/i;
const VIEW_ONCE_UNHELPFUL_TAIL_RE =
  /\b(?:avisame|av[i\u00ed]same|si la viste|si lo viste|si lo ves|si la ves|cuando la viste|cuando lo viste|cuando la veas|cuando lo veas|me cont[a\u00e1]s|me cuentas|quer[e\u00e9]s que te la reenv[i\u00ed]e|quieres que te la reenv[i\u00ed]e|reenv[i\u00ed]e)\b/i;
const GROUP_INVITE_CONTEXT_RE =
  /\b(?:quien se apunta|qui[e\u00e9]n se apunta|quien se suma|qui[e\u00e9]n se suma|se apunta a comer|se suma a comer|comer algo despues|comer algo despu[e\u00e9]s)\b/i;
const GROUP_INVITE_CLEAR_REPLY_RE =
  /\b(?:me apunto|me sumo|puedo|voy|dale|cuenten conmigo|comer|despu[e\u00e9]s|despues|m[a\u00e1]s tarde)\b/i;
const LOW_PRESSURE_FORMULA_RE =
  /\b(?:sin vueltas|sin apuro|sin apuros|sin apurarte|sin apurarnos|sin prisa|sin presi[o\u00f3]n|con calma|tranqui|tranquilo|tranquila|sin drama|cuando quieras|cuando puedas|algo sencillo|algo tranqui|nada complicado|sin complicarlo|sin complicarnos)\b/gi;
const SPECIFIC_WEEKDAY_RE =
  /\b(?:lunes|martes|mi[e\u00e9]rcoles|jueves|viernes|s[a\u00e1]bado|domingo)\b/gi;
const SPECIFIC_CLOCK_RE =
  /\b(?:a|para|sobre|tipo|antes de|despu[e\u00e9]s de)\s+las?\s+(?:[01]?\d|2[0-3])(?::[0-5]\d)?\b/gi;
const MEDIA_UNAVAILABLE_CONTEXT_RE =
  /\b(?:view once|ver una vez|una sola visualizaci[o\u00f3]n|una sola visualizacion|no disponible|no se lee|no se interpreta|descriptor|no visible|revisar en whatsapp|mirar en whatsapp)\b/i;
const UNSUPPORTED_MEDIA_CLAIM_RE =
  /\b(?:se ve|se aprecia|aparece|sale(?:s|n)?|en la foto|en el video|la imagen muestra|el video muestra|claramente|la vi|lo vi|est[a\u00e1] buena|bonita foto|lindo paisaje|se nota que)\b/i;
const REPEATED_CASUAL_WORD_RE =
  /\b(tranqui|suave)\b[\s\S]{0,80}\b\1\b/i;
const PATTERNED_REPLY_RE =
  /^(?:claro|genial|perfecto|bueno|ok|de una|joya)[,!.]\s+[^\n]{12,}$/i;
const RECYCLED_DATE_STRUCTURE_RE =
  /\b(?:tomamos algo|tomar algo|seguimos (?:charlando|hablando)|seguimos con calma|dejamos que (?:la charla|la noche)|esta semana|esta noche)\b/i;
const REWRITE_DRAFT_CONTEXT_RE =
  /(?:borrador_usuario|mensaje_base_usuario|texto_base_usuario|draft_usuario|idea_base_usuario_no_enviada)\s*:\s*([^\n]+)/i;
const REWRITE_DRAFT_STOPWORDS = new Set([
  "pero", "para", "como", "cuando", "donde", "porque", "aunque", "este", "esta", "esto", "estos", "estas",
  "algo", "todo", "toda", "todos", "todas", "mucho", "poco", "bien", "mal", "decir", "mensaje",
  "quiero", "quieres", "queres", "usar", "reescribir", "mejorar", "hacer", "hace", "tengo", "tienes",
  "tenes", "dame", "dime", "solo", "solamente", "tambien", "mismo", "misma", "sobre", "desde",
  "hasta", "con", "sin", "los", "las", "una", "uno", "unos", "unas", "que", "del", "por",
  "mas", "muy", "ese", "esa", "eso", "ahi", "aqui", "alli"
]);

const SPANISH_NATURALNESS_RULES = [
  { flag: "english_calque_aplicar_a", regex: /\baplicar\s+a\b/i },
  { flag: "english_calque_en_orden_de", regex: /\ben\s+orden\s+de\b/i },
  { flag: "false_friend_eventualmente", regex: /\beventualmente\b/i },
  { flag: "false_friend_actualmente", regex: /\bactualmente\b/i },
  { flag: "false_friend_realizar", regex: /\brealizar(?:me|te|se|nos|lo|la|los|las)?\b/i },
  { flag: "stiff_translation_siendo_que", regex: /\bsiendo\s+que\b/i },
  { flag: "stiff_translation_hacer_sentido", regex: /\bhace\s+sentido\b/i },
  { flag: "ai_filler_me_alegra", regex: /\bme\s+alegra\s+(?:mucho\s+)?(?:que|saber)\b/i },
  { flag: "ai_filler_espero_que_te_encuentres_bien", regex: /\bespero\s+que\s+te\s+encuentres\s+bien\b/i },
  { flag: "ai_filler_no_dudes", regex: /\bno\s+dudes\s+en\s+(?:contactarme|decirme|avisarme)\b/i }
];

const AGENT_RULES = {
  profesional: {
    label: "Profesional",
    must: "claridad, siguiente paso, precision, cero servilismo",
    avoid: ["servilismo", "disculpa excesiva", "entusiasmo falso", "relleno"],
    cringe: /\b(?:mil disculpas|quedo atento a cualquier cosa|super encantado|con mucho gusto siempre|a tu entera disposicion)\b/i
  },
  ligoteo: {
    label: "Ligoteo",
    must: "quimica suave, respeto, baja presion, avance natural",
    avoid: ["intensidad rara", "sexualizar", "presionar", "poesia forzada"],
    cringe: /\b(?:princesa|preciosa|mi amor|beb[eé]|eres perfecta|me muero por ti|destino|alma gemela)\b/i
  },
  amistoso: {
    label: "Amistoso",
    must: "cercania cotidiana, apoyo real, cero terapia artificial",
    avoid: ["terapia de manual", "drama", "frases motivacionales", "diagnosticar"],
    cringe: /\b(?:valida tus emociones|estoy aqui para sostenerte|tu proceso|sanar|energia del universo|resiliencia)\b/i
  }
};

const DIALECT_RULES = {
  "es-ES": {
    label: "Espana",
    allowed: /\b(?:vale|apetece|quedar|curro|tio|tia|mola|genial)\b/i,
    forbidden: /\b(?:vos|queres|dale|sale|che|boludo|platicar|ahorita|parce|bacano|po|weon|vaina)\b/i
  },
  "es-MX": {
    label: "Mexico",
    allowed: /\b(?:va|sale|ahorita|platicar|me late|tranqui)\b/i,
    forbidden: /\b(?:vos|queres|vale|che|boludo|parce|bacano|po|weon|tio|tia)\b/i
  },
  "es-AR": {
    label: "Argentina",
    allowed: /\b(?:vos|queres|dale|che|posta|tranqui)\b/i,
    forbidden: /\b(?:vale|apetece|sale|ahorita|platicar|parce|bacano|po|weon|tio|tia)\b/i
  },
  "es-UY": {
    label: "Uruguay",
    allowed: /\b(?:vos|queres|dale|tranqui|ta)\b/i,
    forbidden: /\b(?:vale|apetece|sale|ahorita|platicar|parce|bacano|po|weon|tio|tia)\b/i
  },
  "es-PY": {
    label: "Paraguay",
    allowed: /\b(?:vos|queres|dale|tranqui)\b/i,
    forbidden: /\b(?:vale|apetece|sale|ahorita|platicar|parce|bacano|po|weon|tio|tia|copad[oa]s?|piola|joya|posta|bolud[oa]s?|nom[aá]s)\b/i
  },
  "es-CO": {
    label: "Colombia",
    allowed: /\b(?:parce|bacano|listo|de una|tranqui)\b/i,
    forbidden: /\b(?:vos|queres|vale|che|boludo|ahorita|po|weon|tio|tia)\b/i
  },
  "es-CL": {
    label: "Chile",
    allowed: /\b(?:po|bacan|tranqui|dale)\b/i,
    forbidden: /\b(?:vos|queres|vale|che|boludo|ahorita|platicar|parce|tio|tia)\b/i
  },
  "es-PE": {
    label: "Peru",
    allowed: /\b(?:normal|tranqui|listo)\b/i,
    forbidden: /\b(?:vos|queres|vale|che|boludo|ahorita|platicar|parce|po|weon|tio|tia)\b/i
  },
  "es-VE": {
    label: "Venezuela",
    allowed: /\b(?:chamo|vaina|tranqui|dale)\b/i,
    forbidden: /\b(?:vos|queres|vale|che|boludo|ahorita|platicar|parce|po|weon|tio|tia)\b/i
  },
  "es-EC": {
    label: "Ecuador",
    allowed: /\b(?:listo|ya|de una|tranqui|bac[a\u00e1]n)\b/i,
    forbidden: /\b(?:vale|sale|che|bolud[oa]s?|parce|po|we[o\u00f3]n|t[i\u00ed]o|t[i\u00ed]a)\b/i,
  },
  "es-BO": {
    label: "Bolivia",
    allowed: /\b(?:ya|dale|tranqui|de una)\b/i,
    forbidden: /\b(?:vale|sale|che|bolud[oa]s?|parce|po|we[o\u00f3]n|t[i\u00ed]o|t[i\u00ed]a)\b/i,
  },
  "es-CR": {
    label: "Costa Rica",
    allowed: /\b(?:dale|pura vida|tranqui|de una)\b/i,
    forbidden: /\b(?:vale|sale|che|bolud[oa]s?|parce|po|we[o\u00f3]n|t[i\u00ed]o|t[i\u00ed]a)\b/i,
  },
  "es-GT": {
    label: "Guatemala",
    allowed: /\b(?:va|dale|tranqui|de una)\b/i,
    forbidden: /\b(?:vale|sale|che|bolud[oa]s?|parce|po|we[o\u00f3]n|t[i\u00ed]o|t[i\u00ed]a)\b/i,
  },
  "es-SV": {
    label: "El Salvador",
    allowed: /\b(?:va|dale|tranqui|de una)\b/i,
    forbidden: /\b(?:vale|sale|che|bolud[oa]s?|parce|po|we[o\u00f3]n|t[i\u00ed]o|t[i\u00ed]a)\b/i,
  },
  "es-HN": {
    label: "Honduras",
    allowed: /\b(?:va|dale|tranqui|de una)\b/i,
    forbidden: /\b(?:vale|sale|che|bolud[oa]s?|parce|po|we[o\u00f3]n|t[i\u00ed]o|t[i\u00ed]a)\b/i,
  },
  "es-NI": {
    label: "Nicaragua",
    allowed: /\b(?:dale|tranqui|de una)\b/i,
    forbidden: /\b(?:vale|sale|che|bolud[oa]s?|parce|po|we[o\u00f3]n|t[i\u00ed]o|t[i\u00ed]a)\b/i,
  },
  "es-PA": {
    label: "Panama",
    allowed: /\b(?:dale|listo|tranqui|de una)\b/i,
    forbidden: /\b(?:vale|sale|vos|quer[e\u00e9]s|ten[e\u00e9]s|pod[e\u00e9]s|che|bolud[oa]s?|parce|po|we[o\u00f3]n|t[i\u00ed]o|t[i\u00ed]a)\b/i,
  },
  "es-DO": {
    label: "Republica Dominicana",
    allowed: /\b(?:dale|tranqui|de una)\b/i,
    forbidden: /\b(?:vale|sale|vos|quer[e\u00e9]s|ten[e\u00e9]s|pod[e\u00e9]s|che|bolud[oa]s?|parce|po|we[o\u00f3]n|t[i\u00ed]o|t[i\u00ed]a)\b/i,
  },
  "es-CU": {
    label: "Cuba",
    allowed: /\b(?:dale|tranqui|de una)\b/i,
    forbidden: /\b(?:vale|sale|vos|quer[e\u00e9]s|ten[e\u00e9]s|pod[e\u00e9]s|che|bolud[oa]s?|parce|po|we[o\u00f3]n|t[i\u00ed]o|t[i\u00ed]a)\b/i,
  },
  "es-PR": {
    label: "Puerto Rico",
    allowed: /\b(?:dale|tranqui|de una)\b/i,
    forbidden: /\b(?:vale|sale|vos|quer[e\u00e9]s|ten[e\u00e9]s|pod[e\u00e9]s|che|bolud[oa]s?|parce|po|we[o\u00f3]n|t[i\u00ed]o|t[i\u00ed]a)\b/i,
  },
  "es-US": {
    label: "Estados Unidos",
    allowed: /\b(?:ok|dale|tranqui|de una)\b/i,
    forbidden: /\b(?:vale|sale|vos|quer[e\u00e9]s|ten[e\u00e9]s|pod[e\u00e9]s|che|bolud[oa]s?|parce|po|we[o\u00f3]n|t[i\u00ed]o|t[i\u00ed]a)\b/i,
  },
  "es-neutro": {
    label: "Neutro",
    allowed: null,
    forbidden: /\b(?:vos|queres|vale|che|boludo|ahorita|parce|bacano|po|weon|tio|tia|chamo|vaina)\b/i
  }
};

function normalizeAgentKey(value = "") {
  const safe = String(value || "").trim().toLowerCase();
  if (safe.includes("prof")) return "profesional";
  if (safe.includes("lig") || safe.includes("flirt") || safe.includes("cita")) return "ligoteo";
  if (safe.includes("amist") || safe.includes("amig")) return "amistoso";
  return "amistoso";
}

function normalizeVariantKey(value = "") {
  const safe = String(value || "").trim();
  return DIALECT_RULES[safe] ? safe : "es-neutro";
}

function textFromContext(context = "") {
  if (typeof context === "string") return context;
  try {
    return JSON.stringify(context);
  } catch (_) {
    return "";
  }
}

function normalizeQualityText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s,.;:!?-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contextHasFact(context = "", fact = "") {
  const normalizedContext = normalizeQualityText(context);
  const normalizedFact = normalizeQualityText(fact);
  if (!normalizedFact) return false;
  if (normalizedContext.includes(normalizedFact)) return true;
  const factNumbers = normalizedFact.match(/\b\d{1,2}(?:\s\d{2})?\b/g) || [];
  return factNumbers.some((number) => normalizedContext.includes(number));
}

function unsupportedSpecificFactFlags(text = "", context = "") {
  const value = String(text || "");
  const flags = [];
  for (const match of value.matchAll(SPECIFIC_WEEKDAY_RE)) {
    if (!contextHasFact(context, match[0])) flags.push("unsupported_weekday_reference");
  }
  for (const match of value.matchAll(SPECIFIC_CLOCK_RE)) {
    if (!contextHasFact(context, match[0])) flags.push("unsupported_clock_reference");
  }
  return [...new Set(flags)];
}

function hasUnsupportedMediaClaim(text = "", metadata = {}, context = "") {
  const combinedContext = `${textFromContext(context)} ${metadata.situation || ""} ${metadata.responseMove || ""}`;
  if (!MEDIA_UNAVAILABLE_CONTEXT_RE.test(combinedContext)) return false;
  return UNSUPPORTED_MEDIA_CLAIM_RE.test(String(text || ""));
}

function hasStaleContextEcho(text = "", metadata = {}, context = "") {
  const value = String(text || "");
  if (!STALE_CONTEXT_ECHO_RE.test(value)) return false;
  const rawContext = textFromContext(context);
  const hasHistoryEvidence = Boolean(
    metadata.previousGeneratedText ||
    metadata.lastGeneratedText ||
    metadata.previousGeneratedTexts ||
    metadata.previousGeneratedTextHistory ||
    /\b(?:historial|mensajes?_recientes|previous|generaci[o\u00f3]n_anterior|respuesta_anterior|sugerencia_anterior)\b/i.test(rawContext)
  );
  if (!hasHistoryEvidence) return false;
  const current = normalizeQualityText([
    metadata.targetMessage,
    metadata.targetMessageText,
    metadata.currentMessage,
    metadata.quotedMessage,
    metadata.draft,
    metadata.userDraft
  ].filter(Boolean).join(" "));
  const fallbackContext = normalizeQualityText(context);
  const activeContext = current || fallbackContext.slice(-700);
  const normalizedValue = normalizeQualityText(value);
  if (/\b(dudando de mi|haciendo merito)\b/.test(normalizedValue)) {
    return !/\b(sera|seguro|dudando|merito|en serio|de verdad)\b/.test(activeContext);
  }
  if (/\b(me quedaron ganas de seguir hablando|tomamos algo esta semana|dejamos que la charla haga el resto)\b/.test(normalizedValue)) {
    return !/\b(ganas de hablar|me gusto verte|me ha gustado verte|tomamos algo|cita|plan|vernos|quedar|me parece buen plan)\b/.test(activeContext);
  }
  return false;
}

function hasOversafeLowValueReply(text = "", metadata = {}, context = "") {
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  const value = String(text || "");
  if (!OVERSAFE_LOW_VALUE_RE.test(value)) return false;
  const combined = `${metadata.situation || ""} ${metadata.responseMove || ""} ${metadata.objective || ""} ${textFromContext(context)}`;
  if (agentKey === "profesional" && PROFESSIONAL_CONTEXT_RE.test(combined)) {
    return !CONCRETE_MOVE_RE.test(value);
  }
  if (INITIATIVE_OPPORTUNITY_CONTEXT_RE.test(combined) || OPPORTUNITY_CONTEXT_RE.test(combined)) {
    return !CONCRETE_MOVE_RE.test(value);
  }
  return false;
}

function hasOverclosingFlirtReply(text = "", metadata = {}, context = "") {
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  if (agentKey !== "ligoteo") return false;
  const value = String(text || "");
  if (!OVERCLOSING_FLIRT_RE.test(value)) return false;
  const combined = `${metadata.situation || ""} ${metadata.responseMove || ""} ${metadata.objective || ""} ${textFromContext(context)}`;
  return ACTIVE_FLIRT_CHAT_CONTEXT_RE.test(combined) || /\b(?:crear-conexion|seguir-la-charla|mantener|conversation|flow|active)\b/i.test(combined);
}

function hasLengtheningFiller(text = "", metadata = {}, context = "") {
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  const value = String(text || "");
  if (!LENGTHENING_FILLER_RE.test(value)) return false;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= 9) return false;
  const contextText = `${metadata.situation || ""} ${metadata.responseMove || ""} ${metadata.objective || ""} ${textFromContext(context)}`;
  if (
    agentKey === "ligoteo" &&
    CONCRETE_MOVE_RE.test(value) &&
    /\b(?:me\s+gust[o\u00f3]\s+verte|me\s+ha\s+gustado\s+verte|ganas\s+de\s+verte|quiero\s+verte|tengo\s+ganas\s+de\s+verte)\b/i.test(contextText)
  ) {
    return false;
  }
  if (
    String(metadata.action || "").toLowerCase() === "rewrite" &&
    /\bpara\s+que\s+lo\s+revises\s+con\s+calma\b/i.test(value)
  ) {
    return false;
  }
  const fillerIsJustified = /\b(?:limite|l[i\u00ed]mite|presion|presi[o\u00f3]n|no\s+me\s+presiones|no\s+puedo|no\s+quiero|cansad[oa]|agotad[oa]|espacio|demor|tard|perd[o\u00f3]n|disculpa|d[i\u00ed]a\s+pesado|dia\s+pesado|mal\s+d[i\u00ed]a|baj[o\u00f3]n)\b/i.test(contextText);
  return !fillerIsJustified;
}

function hasAbstractFlirtMetaReply(text = "", metadata = {}, context = "") {
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  if (agentKey !== "ligoteo") return false;
  const value = String(text || "");
  if (!ABSTRACT_FLIRT_META_RE.test(value)) return false;
  const combined = `${metadata.situation || ""} ${metadata.responseMove || ""} ${metadata.objective || ""} ${textFromContext(context)}`;
  return DIRECT_MEET_ASK_CONTEXT_RE.test(combined) || ACTIVE_FLIRT_CHAT_CONTEXT_RE.test(combined);
}

function hasWrongSmileAttribution(text = "", metadata = {}, context = "") {
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  if (agentKey !== "ligoteo") return false;
  const value = String(text || "");
  if (!WRONG_SMILE_ATTRIBUTION_RE.test(value)) return false;
  const contextText = textFromContext(context);
  return OWN_SMILE_CONTEXT_RE.test(contextText) && !CONTACT_LAUGH_CONTEXT_RE.test(contextText);
}

function hasWrongMannersAttribution(text = "", metadata = {}, context = "") {
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  if (agentKey !== "ligoteo") return false;
  const contextText = textFromContext(context);
  if (!MANNERS_CORRECTION_CONTEXT_RE.test(contextText)) return false;
  const value = String(text || "");
  if (!WRONG_MANNERS_ATTRIBUTION_RE.test(value)) return false;
  return !/\b(?:ten[e\u00e9]s\s+raz[o\u00f3]n|tienes\s+raz[o\u00f3]n|me\s+toca\s+a\s+m[i\u00ed]|mis\s+modales|perd[o\u00f3]n|hola)\b/i.test(value);
}

function hasContactWorkingAttributionIssue(text = "", metadata = {}, context = "") {
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  if (agentKey !== "ligoteo") return false;
  const contextText = textFromContext(context);
  if (!CONTACT_WORKING_CONTEXT_RE.test(contextText)) return false;
  return CONTACT_WORKING_BAD_ATTRIBUTION_RE.test(String(text || ""));
}

function hasMissedInitialGreeting(text = "", metadata = {}, context = "") {
  const contextText = textFromContext(context);
  const lastContactLine = String(context || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse()
    .find((line) => /^(?:contacto:|ultimo_mensaje_de_otra_persona|last_inbound)\b/i.test(line)) || contextText;
  if (!CONTACT_INITIAL_GREETING_CONTEXT_RE.test(lastContactLine)) return false;
  if (USER_GREETING_CONTEXT_RE.test(contextText)) return false;
  return !OUTPUT_GREETING_RE.test(String(text || "").trim());
}

function hasDelayPressureReply(text = "", metadata = {}, context = "") {
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  if (agentKey !== "ligoteo") return false;
  const contextText = textFromContext(context);
  if (!CONTACT_DELAY_APOLOGY_CONTEXT_RE.test(contextText)) return false;
  return DELAY_PRESSURE_REPLY_RE.test(String(text || ""));
}

function hasLaughToPlanDrift(text = "", metadata = {}, context = "") {
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  if (agentKey !== "ligoteo") return false;
  const contextText = textFromContext(context);
  if (!CONTACT_LAUGH_CURRENT_CONTEXT_RE.test(contextText)) return false;
  return LAUGH_TO_PLAN_DRIFT_RE.test(String(text || ""));
}

function hasIgnoredAudioTranscript(text = "", metadata = {}, context = "") {
  const contextText = textFromContext(context);
  if (!AUDIO_TRANSCRIPT_CONTEXT_RE.test(contextText)) return false;
  return AUDIO_TRANSCRIPT_IGNORED_RE.test(String(text || ""));
}

function hasWeakMeetingConfirmation(text = "", metadata = {}, context = "") {
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  if (agentKey !== "ligoteo") return false;
  const contextText = textFromContext(context);
  if (!CONTACT_SIMPLE_CONFIRMATION_CONTEXT_RE.test(contextText)) return false;
  if (!MEETING_TIME_CONTEXT_RE.test(contextText) && !MEETING_WINDOW_CONTEXT_RE.test(contextText)) return false;
  return !MEETING_CONFIRMATION_OUTPUT_RE.test(String(text || ""));
}

function hasOverdoneMeetingConfirmation(text = "", metadata = {}, context = "") {
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  if (agentKey !== "ligoteo") return false;
  const contextText = textFromContext(context);
  if (!CONTACT_SIMPLE_CONFIRMATION_CONTEXT_RE.test(contextText)) return false;
  if (!MEETING_TIME_CONTEXT_RE.test(contextText) && !MEETING_WINDOW_CONTEXT_RE.test(contextText)) return false;
  const value = String(text || "").trim();
  const words = value.split(/\s+/).filter(Boolean);
  return OVERDONE_MEETING_CONFIRMATION_RE.test(value) || (
    words.length >= 16 &&
    /\bnos\s+vemos\b/i.test(value) &&
    /\b(?:tranqui|charla|ganas|encuentro|va\s+a\s+estar\s+bueno)\b/i.test(value)
  );
}

function hasPushAfterCloseOrBoundary(text = "", metadata = {}, context = "") {
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  if (agentKey !== "ligoteo") return false;
  const focus = latestContactFocusLine(context);
  if (CURRENT_INVITATION_CONTEXT_RE.test(focus)) return false;
  return currentContactHasBoundary(context) && (PUSH_AFTER_CLOSE_RE.test(String(text || "")) || BOUNDARY_REOPEN_RE.test(String(text || "")));
}

function hasRomanticBoundaryContext(metadata = {}, context = "") {
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  if (agentKey !== "ligoteo") return false;
  const focus = latestContactFocusLine(context);
  if (CURRENT_INVITATION_CONTEXT_RE.test(focus)) return false;
  if (currentContactHasBoundary(context)) return true;
  const combined = `${metadata.situation || ""} ${metadata.responseMove || ""} ${metadata.objective || ""}`;
  return ROMANTIC_BOUNDARY_CONTEXT_RE.test(combined);
}

function hasPlanAfterBoundary(text = "", metadata = {}, context = "") {
  if (!hasRomanticBoundaryContext(metadata, context)) return false;
  return PLAN_AFTER_BOUNDARY_RE.test(String(text || ""));
}

function hasViewOnceUnhelpfulTail(text = "", metadata = {}, context = "") {
  const combined = `${metadata.situation || ""} ${metadata.responseMove || ""} ${textFromContext(context)}`;
  if (!MEDIA_UNAVAILABLE_CONTEXT_RE.test(combined)) return false;
  return VIEW_ONCE_UNHELPFUL_TAIL_RE.test(String(text || ""));
}

function hasGroupInviteIssue(text = "", metadata = {}, context = "") {
  const contextText = textFromContext(context);
  const value = String(text || "");
  if (!GROUP_INVITE_CONTEXT_RE.test(contextText)) return false;
  if (/\b(?:hacemos|hagamos|armamos|nadie se queda fuera|quien se suma|qui[e\u00e9]n se suma)\b/i.test(value)) return true;
  return !/\b(?:me apunto|me sumo|puedo|voy|cuenten conmigo|yo puedo|yo me sumo)\b/i.test(value);
}

function lowPressureFormulas(value = "") {
  const matches = String(value || "").match(LOW_PRESSURE_FORMULA_RE) || [];
  return [...new Set(matches.map((item) => normalizeQualityText(item)).filter(Boolean))];
}

function lowPressureFormulaContext(metadata = {}, context = "") {
  return [
    textFromContext(context),
    metadata.previousGeneratedText,
    metadata.lastGeneratedText,
    ...referenceList(metadata.previousGeneratedTexts),
    ...referenceList(metadata.previousGeneratedTextHistory)
  ].filter(Boolean).join("\n");
}

function hasLowPressureFormulaOveruse(text = "", metadata = {}, context = "") {
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  if (agentKey !== "ligoteo") return false;
  const outputFormulas = lowPressureFormulas(text);
  if (!outputFormulas.length) return false;
  const formulaContext = lowPressureFormulaContext(metadata, context);
  const contextFormulaCount = (String(formulaContext || "").match(LOW_PRESSURE_FORMULA_RE) || []).length;
  const contextFormulas = lowPressureFormulas(formulaContext);
  if (!contextFormulas.length) return false;
  if (outputFormulas.some((formula) => contextFormulas.includes(formula))) return true;
  return contextFormulaCount >= 2;
}

function stripOverusedLowPressureFormula(text = "", metadata = {}, context = "") {
  if (!hasLowPressureFormulaOveruse(text, metadata, context)) return String(text || "").trim();
  const cleaned = String(text || "")
    .replace(/\s+y\s+sin\s+(?:vueltas|apuro|prisa|presi[o\u00f3]n)\b/gi, "")
    .replace(/,\s*sin\s+(?:vueltas|apuro|prisa|presi[o\u00f3]n)\b/gi, "")
    .replace(/\s+sin\s+(?:vueltas|apuro|prisa|presi[o\u00f3]n)\b/gi, "")
    .replace(/\s+con calma\b/gi, "")
    .replace(/,\s*(?:tranqui|tranquilo|tranquila)\b/gi, "")
    .replace(/\s+(?:tranqui|tranquilo|tranquila)\b/gi, "")
    .replace(/\s*,?\s+nada complicado\b/gi, "")
    .replace(/\s*,?\s+algo sencillo\b/gi, "")
    .replace(/\s*,?\s+algo tranqui\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/,\s*\./g, ".")
    .trim();
  return cleaned || String(text || "").trim();
}

function styleChunks(value = "") {
  return String(value || "")
    .split(/[\n.!?;]+|,\s+(?=\S)/)
    .map((part) => part.trim())
    .filter((part) => part.split(/\s+/).filter(Boolean).length >= 4)
    .filter((part) => part.length >= 18 && part.length <= 110)
    .filter((part) => !/\b(?:lunes|martes|mi[e\u00e9]rcoles|jueves|viernes|s[a\u00e1]bado|domingo|hoy|ma[n\u00f1]ana|ayer)\b/i.test(part))
    .filter((part) => !/\b\d{1,2}(?::\d{2})?\b/.test(part))
    .map((part) => normalizeQualityText(part))
    .filter(Boolean);
}

function styleChunkHistory(metadata = {}, context = "") {
  return [
    metadata.previousGeneratedText,
    metadata.lastGeneratedText,
    ...referenceList(metadata.previousGeneratedTexts),
    ...referenceList(metadata.previousGeneratedTextHistory),
    textFromContext(context)
  ].filter(Boolean).join("\n");
}

function repeatedStyleChunkFromHistory(text = "", metadata = {}, context = "") {
  const outputChunks = styleChunks(text);
  if (!outputChunks.length) return false;
  const historyChunks = styleChunks(styleChunkHistory(metadata, context));
  if (!historyChunks.length) return false;
  return outputChunks.some((chunk) =>
    historyChunks.some((previous) => chunk === previous || normalizedSimilarity(chunk, previous) >= 0.86)
  );
}

function styleRecyclingFallback(metadata = {}, context = "") {
  const contextText = textFromContext(context);
  const timeMatch = contextText.match(/\b(?:a\s+las?\s+|para\s+las?\s+|sobre\s+las?\s+|tipo\s+)?([01]?\d|2[0-3])(?::([0-5]\d))?\b/i);
  if (timeMatch) {
    const time = `${timeMatch[1]}${timeMatch[2] ? `:${timeMatch[2]}` : ""}`;
    return `Perfecto, queda para las ${time}.`;
  }
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  if (agentKey === "profesional") return "Perfecto, queda confirmado.";
  if (agentKey === "ligoteo") return "Perfecto, me gusta el plan.";
  return "Perfecto, seguimos con eso.";
}

function stripRepeatedStyleChunk(text = "", metadata = {}, context = "") {
  if (!repeatedStyleChunkFromHistory(text, metadata, context)) return String(text || "").trim();
  let value = String(text || "").trim();
  for (const rawChunk of String(text || "").split(/(?<=[.!?;])\s+|,\s+(?=\S)/)) {
    const normalizedChunk = normalizeQualityText(rawChunk);
    if (!normalizedChunk || styleChunks(rawChunk).length === 0) continue;
    const repeated = styleChunks(styleChunkHistory(metadata, context))
      .some((previous) => normalizedChunk === previous || normalizedSimilarity(normalizedChunk, previous) >= 0.86);
    if (!repeated) continue;
    const next = value
      .replace(rawChunk, "")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.!?])/g, "$1")
      .replace(/^[,\s]+|[,\s]+$/g, "")
      .trim();
    if (next.split(/\s+/).filter(Boolean).length >= 3) value = next;
  }
  if (repeatedStyleChunkFromHistory(value, metadata, context)) {
    return styleRecyclingFallback(metadata, context);
  }
  return value || styleRecyclingFallback(metadata, context) || String(text || "").trim();
}

function groupInviteFallback(metadata = {}, context = "") {
  const contextText = textFromContext(context);
  if (/\b(?:despues|despu[e\u00e9]s|mas tarde|m[a\u00e1]s tarde)\b/i.test(contextText)) {
    return "Me apunto, puedo m\u00e1s tarde para comer algo.";
  }
  return "Me apunto para comer algo.";
}

function romanticBoundaryFallback(metadata = {}, context = "") {
  const variantKey = normalizeVariantKey(metadata.variant || metadata.locale || metadata.spanishVariant || metadata.languageVariant);
  const contextText = textFromContext(context);
  if (SOFT_CLOSE_CONTEXT_RE.test(contextText)) {
    return ["es-AR", "es-PY", "es-UY"].includes(variantKey)
      ? "Dale, cuidate. Hablamos luego."
      : "Cu\u00eddate. Hablamos luego.";
  }
  if (SMALL_TALK_DAY_CONTEXT_RE.test(contextText)) {
    return ["es-AR", "es-PY", "es-UY"].includes(variantKey)
      ? "Hoy bastante tranquilo por mi lado. Descans\u00e1 y hablamos luego."
      : "Hoy tranquilo por mi lado. Descansa y hablamos luego.";
  }
  if (["es-AR", "es-PY", "es-UY"].includes(variantKey)) {
    return "Sin presi\u00f3n. Descans\u00e1 y hablamos cuando est\u00e9s con ganas.";
  }
  return "Sin presi\u00f3n. Descansa y hablamos cuando tengas ganas.";
}

function mediaUnavailableFallback(metadata = {}, context = "") {
  const variantKey = normalizeVariantKey(metadata.variant || metadata.locale || metadata.spanishVariant || metadata.languageVariant);
  const contextText = textFromContext(context);
  if (/\b(?:documento|pdf|contrato|archivo)\b/i.test(contextText)) {
    return variantKey === "es-MX"
      ? "Lo reviso en WhatsApp y te confirmo cuando lo vea bien"
      : "Lo reviso en WhatsApp y te confirmo cuando lo vea bien";
  }
  if (/\b(?:audio|nota de voz)\b/i.test(contextText)) {
    return "Lo escucho en WhatsApp y te digo";
  }
  if (/\b(?:foto|imagen)\b/i.test(contextText)) {
    return "La miro en WhatsApp y te digo";
  }
  return "Lo miro en WhatsApp y te digo";
}

function visibleMeetingFactFallback(text = "", metadata = {}, context = "") {
  const contextText = textFromContext(context);
  if (!/\b(?:contenido_multimedia|imagen|captura|foto)\b/i.test(contextText)) return null;
  if (!/\b(?:reuni[o\u00f3]n|meeting|calendario|reserva)\b/i.test(contextText)) return null;
  const dayMatch = contextText.match(SPECIFIC_WEEKDAY_RE);
  const timeMatch = contextText.match(/\b(?:a\s+las?\s+|para\s+las?\s+|sobre\s+las?\s+|tipo\s+)?([01]?\d|2[0-3])(?::([0-5]\d))?\b/i);
  const day = dayMatch?.[0]?.toLowerCase();
  const time = timeMatch ? `${timeMatch[1]}${timeMatch[2] ? `:${timeMatch[2]}` : ""}` : "";
  if (!day && !time) return null;
  const normalizedOutput = normalizeQualityText(text);
  const hasDay = day ? normalizedOutput.includes(normalizeQualityText(day)) : true;
  const hasTime = time ? normalizedOutput.includes(normalizeQualityText(time)) || normalizedOutput.includes(normalizeQualityText(time.replace(/^0/, ""))) : true;
  if (hasDay && hasTime && /\b(?:confirm|reuni[o\u00f3]n|horario|list[oa])\b/i.test(String(text || ""))) return null;
  const dayPart = day ? ` del ${day}` : "";
  const timePart = time ? ` a las ${time}` : "";
  return `Confirmo entonces la reuni\u00f3n${dayPart}${timePart}.`;
}

function hasRepeatedPhrase(text = "") {
  const normalized = normalizeQualityText(text);
  if (!normalized) return false;

  const parts = normalized
    .split(/[,;:.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const firstWords = parts[0].split(/\s+/).filter(Boolean);
    if (firstWords.length <= 6 && parts[0] === parts[1]) return true;
  }

  const words = normalized.replace(/[,;:.!?-]+/g, " ").split(/\s+/).filter(Boolean);
  for (let size = 2; size <= 6; size += 1) {
    if (words.length >= size * 2) {
      const first = words.slice(0, size).join(" ");
      const second = words.slice(size, size * 2).join(" ");
      if (first && first === second) return true;
    }
  }

  return false;
}

function stripRepeatedOpeningPhrase(text = "") {
  const value = String(text || "").trim();
  const match = value.match(/^(.{2,70}?)([,;:.!?])\s*\1\b\s*/i);
  if (!match) return value;
  const phrase = match[1].trim();
  if (phrase.split(/\s+/).filter(Boolean).length > 6) return value;
  return `${phrase} ${value.slice(match[0].length).trimStart()}`.replace(/\s+/g, " ").trim();
}

function hasTemplateCommaOpening(text = "", metadata = {}, context = "") {
  const value = String(text || "").trim();
  if (!TEMPLATE_COMMA_OPENING_RE.test(value)) return false;
  return value.split(/\s+/).filter(Boolean).length >= 5;
}

function hasLowInitiativeOpportunity(text = "", metadata = {}, context = "") {
  const value = String(text || "").trim();
  if (!value) return false;
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  const contextText = textFromContext(context);
  if (!OPPORTUNITY_CONTEXT_RE.test(contextText)) return false;
  if (CONCRETE_MOVE_RE.test(value)) return false;
  if (agentKey === "profesional" && /\b(?:hoy|ma[n\u00f1]ana|viernes|antes de|te confirmo|te aviso|queda|sigo|seguimos|pendiente)\b/i.test(value)) return false;
  if (agentKey === "ligoteo" && /\b(?:esta semana|esta noche|un rato|sin presi[o\u00f3]n|sin prisa|con calma|cuando puedas|nos ponemos al corriente)\b/i.test(value)) return false;
  if (agentKey === "amistoso" && /\b(?:descansa|te acompa[n\u00f1]o|cuenta conmigo|vemos con calma|hagamos|vamos|puedo pasar|ac[a\u00e1] estoy)\b/i.test(value)) return false;
  return ACTIONLESS_REPLY_RE.test(value) || hasGenericQuestionTail(value);
}

function stripTemplateCommaOpening(text = "", metadata = {}, context = "") {
  const value = String(text || "").trim();
  if (!hasTemplateCommaOpening(value, metadata, context)) return value;
  const cleaned = value.replace(TEMPLATE_COMMA_OPENING_RE, (match) => {
    const afterComma = match.replace(/^[^,]+,\s*/, "");
    return afterComma;
  }).trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned;
}

function lowValuePatternedOpeningMatch(text = "", metadata = {}, context = "") {
  const value = String(text || "").trim();
  const match = value.match(/^(dale|vale|va|sale|listo|ya|claro|genial|perfecto|bueno|ok|de una|joya)[,!.]\s+(.+)$/i);
  if (!match) return null;
  const rest = String(match[2] || "").trim();
  if (rest.split(/\s+/).filter(Boolean).length < 4) return null;
  const combined = `${metadata.responseMove || ""} ${metadata.situation || ""} ${metadata.objective || ""} ${textFromContext(context)}`;
  const isPureConfirmation = /\b(?:confirmar|hora acordada|a las\s+\d{1,2}|nos vemos|quedamos|queda confirmado|confirmo)\b/i.test(combined)
    && /^(?:a las\s+\d{1,2}|ah[i\u00ed]|nos vemos|queda|quedamos|te confirmo|lo confirmo)\b/i.test(rest);
  if (isPureConfirmation) return null;
  return match;
}

function hasLowValuePatternedOpening(text = "", metadata = {}, context = "") {
  return Boolean(lowValuePatternedOpeningMatch(text, metadata, context));
}

function stripLowValuePatternedOpening(text = "", metadata = {}, context = "") {
  const value = String(text || "").trim();
  const match = lowValuePatternedOpeningMatch(value, metadata, context);
  if (!match) return value;
  const rest = String(match[2] || "").trim();
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

function hasProfessionalCasualTail(text = "", metadata = {}, context = "") {
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  if (agentKey !== "profesional") return false;
  const combinedContext = `${text || ""} ${textFromContext(context)} ${metadata.situation || ""} ${metadata.objective || ""} ${metadata.relationshipType || ""}`;
  const seriousContext = PROFESSIONAL_CONTEXT_RE.test(combinedContext) || shouldReduceRegionality(metadata, context);
  return seriousContext && PROFESSIONAL_CASUAL_TAIL_RE.test(String(text || "").trim());
}

function hasPassiveNoInitiative(text = "", metadata = {}, context = "") {
  const value = String(text || "");
  if (!PASSIVE_NO_INITIATIVE_RE.test(value)) return false;
  const contextText = textFromContext(context);
  if (!INITIATIVE_OPPORTUNITY_CONTEXT_RE.test(contextText)) return false;
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  if (agentKey === "profesional" && /\b(?:opinion|qu[e\u00e9] opinas|qu[e\u00e9] te parece)\b/i.test(value)) return true;
  if (agentKey === "ligoteo" && /\b(?:planes|esta noche|salir|tomar algo|vernos)\b/i.test(contextText)) return true;
  if (agentKey === "amistoso" && /\b(?:no se que hacer|no s[e\u00e9] que hacer|acompanar|ayuda|plan)\b/i.test(contextText)) return true;
  return /\b(?:qu[e\u00e9] opinas|qu[e\u00e9] te parece|como quieras|si quieres|si queres|lo que prefieras)\b/i.test(value);
}

function hasPlayfulDoubtContext(metadata = {}, context = "") {
  const combined = `${metadata.situation || ""} ${metadata.objective || ""} ${metadata.relationshipType || ""} ${textFromContext(context)}`;
  return PLAYFUL_DOUBT_CONTEXT_RE.test(combined);
}

function hasBadPlayfulDoubtResponse(text = "", metadata = {}, context = "") {
  return hasPlayfulDoubtContext(metadata, context) && PLAYFUL_DOUBT_BAD_RESPONSE_RE.test(String(text || ""));
}

function hasCannedDatePlan(text = "", metadata = {}, context = "") {
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  const action = String(metadata.action || "").toLowerCase();
  if (action && !["suggest", "reactivate", "opener"].includes(action)) return false;
  const combined = `${metadata.responseMove || ""} ${metadata.objective || ""} ${metadata.situation || ""} ${textFromContext(context)}`;
  const looksLikeFlirtContext = /\b(?:ligoteo|cita|planes|plan|esta noche|tomar algo|caf[e\u00e9]|ganas de hablar|quimica|qu[i\u00ed]mica|coqueteo)\b/i.test(combined);
  if (agentKey !== "ligoteo" && !looksLikeFlirtContext) return false;
  if (!looksLikeFlirtContext) return false;
  return CANNED_DATE_PLAN_RE.test(String(text || ""));
}

function hasPrematureConnectionDatePlan(text = "", metadata = {}, context = "") {
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  if (agentKey !== "ligoteo") return false;
  const action = String(metadata.action || "").toLowerCase();
  if (action && !["suggest", "reactivate", "opener"].includes(action)) return false;
  const objective = String(metadata.objective || "");
  if (/\b(?:concretar\s+(?:una\s+)?cita|cita|plan|quedar|tomar algo|caf[e\u00e9]|cafe)\b/i.test(objective)) return false;
  const combined = `${metadata.responseMove || ""} ${objective} ${metadata.situation || ""}`;
  const isConnectionMove = /\b(?:build_connection_with_specific_reaction|crear conexi[o\u00f3]n|crear conexion|conectar|qu[i\u00ed]mica)\b/i.test(combined);
  if (!isConnectionMove) return false;
  return CONNECTION_DATE_DRIFT_RE.test(String(text || ""));
}

function freshFallbackOption(options = [], metadata = {}, context = "") {
  const pool = options.map((item) => String(item || "").trim()).filter(Boolean);
  if (!pool.length) return "";
  const historyParts = [
    metadata.previousGeneratedText,
    metadata.generatedTextForAntiRepeat,
    metadata.lastGeneratedText,
    ...(Array.isArray(metadata.recentGeneratedTexts) ? metadata.recentGeneratedTexts : [])
  ].filter(Boolean);
  const history = normalizeQualityText(historyParts.join(" "));
  const candidates = pool.filter((option) => {
    const normalized = normalizeQualityText(option);
    const lead = normalized.split(/\s+/).slice(0, 5).join(" ");
    return !history || (!history.includes(normalized) && (!lead || !history.includes(lead)));
  });
  const usable = candidates.length ? candidates : pool;
  const seed = normalizeQualityText(`${context} ${metadata.objective || ""} ${metadata.situation || ""} ${history.length}`);
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash * 31) + seed.charCodeAt(index)) >>> 0;
  }
  return usable[hash % usable.length];
}

function connectionReactionFallback(metadata = {}, context = "") {
  const contextText = textFromContext(context);
  const focus = latestContactFocusLine(context);
  if (
    !CURRENT_INVITATION_CONTEXT_RE.test(focus) &&
    /\b(?:no\s+puedo|no\s+estoy\s+libre|no\s+quiero\s+salir|no\s+me\s+presiones|cu[i\u00ed]date|cuidate|hablamos\s+luego|hablamos\s+despu[e\u00e9]s|hasta\s+luego)\b/i.test(contextText)
  ) {
    return closeOrBoundaryFallback(metadata, context);
  }
  if (currentContactHasBoundary(context)) {
    return closeOrBoundaryFallback(metadata, context);
  }
  if (OWN_SMILE_CONTEXT_RE.test(contextText) && !CONTACT_LAUGH_CONTEXT_RE.test(contextText)) {
    return smileAttributionFallback(metadata, context);
  }
  if (/\bpizzer[i\u00ed]a\b/i.test(contextText)) {
    return "Me gusta ese plan. A la noche en la pizzer\u00eda de la esquina me viene bien.";
  }
  if (/\b(?:re[i\u00ed]r|risa|jaja|sonrisa)\b/i.test(contextText)) {
    return freshFallbackOption([
      "Jajaja, entonces ya arranco con ventaja.",
      "Me gusta que la charla venga con esa sonrisa.",
      "Así da gusto seguir hablando, con esa risa de por medio."
    ], metadata, contextText);
  }
  if (/\b(?:foto|imagen|guap|bonit|lind)\b/i.test(contextText)) {
    return freshFallbackOption([
      "Así sí dan ganas de seguir la charla.",
      "Me gusta esa energía, se nota incluso por mensaje.",
      "Con ese arranque me dejás fácil seguirte el juego."
    ], metadata, contextText);
  }
  return freshFallbackOption([
    "Me gusta por dónde viene la charla.",
    "Hay algo ahí para seguirlo bien.",
    "Me dejaste una buena excusa para seguir hablando."
  ], metadata, contextText);
}

function smileAttributionFallback(metadata = {}, context = "") {
  const contextText = textFromContext(context);
  if (/\bpizzer[i\u00ed]a\b/i.test(contextText)) {
    return "Me gusta ese plan. A la noche en la pizzer\u00eda de la esquina me viene bien.";
  }
  if (DIRECT_MEET_ASK_CONTEXT_RE.test(contextText)) {
    return freshFallbackOption([
      "A mí también me dan ganas de verte. Pongamos día y lo hacemos fácil.",
      "Me gusta que lo digas así. Busquemos un momento y nos vemos.",
      "Entonces no lo dejemos solo en ganas: vemos cuándo nos queda bien."
    ], metadata, contextText);
  }
  return freshFallbackOption([
    "Me gusta ese plan. Lo dejamos así.",
    "Entonces va por ahí.",
    "Me sirve, sigamos desde eso."
  ], metadata, contextText);
}

function mannersAttributionFallback(metadata = {}) {
  const variantKey = normalizeVariantKey(metadata.variant || metadata.locale || metadata.spanishVariant || metadata.languageVariant);
  return variantKey === "es-ES"
    ? "Tienes raz\u00f3n, me toca a m\u00ed. Prometo recuperar los modales: hola, qu\u00e9 gusto leerte."
    : "Ten\u00e9s raz\u00f3n, me toca a m\u00ed. Prometo recuperar los modales: hola, qu\u00e9 gusto leerte.";
}

function contactWorkingFallback(metadata = {}) {
  const variantKey = normalizeVariantKey(metadata.variant || metadata.locale || metadata.spanishVariant || metadata.languageVariant);
  if (variantKey === "es-ES") {
    return "Me gusta que aun trabajando me hagas un hueco. Prometo ser una distracci\u00f3n decente.";
  }
  if (["es-AR", "es-PY", "es-UY"].includes(variantKey)) {
    return "Me gusta que igual te hagas un hueco para hablar conmigo. Te robo un ratito y despu\u00e9s te dejo seguir.";
  }
  return "Me gusta que aun trabajando me hagas un hueco. Te distraigo un rato y despu\u00e9s te dejo seguir.";
}

function initialGreetingFallback(metadata = {}) {
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  const variantKey = normalizeVariantKey(metadata.variant || metadata.locale || metadata.spanishVariant || metadata.languageVariant);
  if (agentKey === "profesional") {
    return variantKey === "es-ES"
      ? "Hola, todo bien. Dime, \u00bfqu\u00e9 necesitas?"
      : "Hola, todo bien. Decime, \u00bfqu\u00e9 necesit\u00e1s?";
  }
  if (agentKey === "ligoteo") {
    return variantKey === "es-ES"
      ? "Hola, qu\u00e9 gusto leerte. Todo bien, \u00bfy t\u00fa qu\u00e9 tal?"
      : "Hola, qu\u00e9 gusto leerte. Todo bien, \u00bfy vos qu\u00e9 cont\u00e1s?";
  }
  return variantKey === "es-ES"
    ? "Hola, todo bien por aqu\u00ed. \u00bfT\u00fa qu\u00e9 tal?"
    : "Hola, todo bien por ac\u00e1. \u00bfVos qu\u00e9 cont\u00e1s?";
}

function delayApologyFallback(metadata = {}) {
  const variantKey = normalizeVariantKey(metadata.variant || metadata.locale || metadata.spanishVariant || metadata.languageVariant);
  if (variantKey === "es-ES") {
    return freshFallbackOption([
      "Me alegra leerte ahora. Seguimos desde aquí.",
      "Me viene bien que hayas vuelto a aparecer.",
      "Ahora sí, te leo."
    ], metadata);
  }
  if (["es-VE", "es-CO", "es-PA", "es-DO", "es-CU", "es-PR"].includes(variantKey)) {
    return freshFallbackOption([
      "Me alegra leerte ahora. Seguimos por aquí.",
      "Ahora sí, te leo.",
      "Qué bueno que apareciste."
    ], metadata);
  }
  return freshFallbackOption([
    "Me alegra leerte ahora. Seguimos por acá.",
    "Ahora sí, te leo.",
    "Qué bueno que apareciste."
  ], metadata);
}

function laughConnectionFallback(metadata = {}) {
  const variantKey = normalizeVariantKey(metadata.variant || metadata.locale || metadata.spanishVariant || metadata.languageVariant);
  if (variantKey === "es-AR") {
    return "Jajaja, entonces anoto ese talento a mi favor.";
  }
  if (variantKey === "es-ES") {
    return "Jajaja, entonces ya tengo un talento nuevo para presumir.";
  }
  return "Jajaja, entonces ese talento cuenta a mi favor.";
}

function audioTranscriptFallback(metadata = {}, context = "") {
  const contextText = textFromContext(context);
  const transcript = (contextText.match(AUDIO_TRANSCRIPT_CONTEXT_RE)?.[1] || "").trim();
  const variantKey = normalizeVariantKey(metadata.variant || metadata.locale || metadata.spanishVariant || metadata.languageVariant);
  if (/\b(?:agotad|cansad|saturad|tarde|pega|trabajo|no\s+puedo\s+m[a\u00e1]s)\b/i.test(transcript)) {
    return variantKey === "es-CL"
      ? "Ya, suena a que quedaste agotada. Descansa hoy, que la pega puede esperar un rato."
      : "Suena a que quedaste agotada. Descansa hoy, que ya fue bastante.";
  }
  return transcript
    ? "Te entiendo. Lo que contaste suena importante, vamos con calma."
    : "Te entiendo. Vamos con calma.";
}

function meetingConfirmationFallback(metadata = {}, context = "") {
  const contextText = textFromContext(context);
  const match = contextText.match(MEETING_TIME_CONTEXT_RE);
  const time = match ? `${match[1]}${match[2] ? `:${match[2]}` : ""}` : "";
  const variantKey = normalizeVariantKey(metadata.variant || metadata.locale || metadata.spanishVariant || metadata.languageVariant);
  if (!time && /\b(?:a\s+la\s+noche|hoy\s+a\s+la\s+noche)\b/i.test(contextText)) {
    return variantKey === "es-PY" ? "Dale, nos vemos a la noche." : "Genial, nos vemos a la noche.";
  }
  if (!time && /\besta\s+noche\b/i.test(contextText)) {
    return variantKey === "es-PY" ? "Dale, nos vemos esta noche." : "Genial, nos vemos esta noche.";
  }
  if (!time && /\b(?:mas\s+tarde|m[a\u00e1]s\s+tarde)\b/i.test(contextText)) {
    return variantKey === "es-PY" ? "Dale, nos vemos mas tarde." : "Genial, nos vemos mas tarde.";
  }
  return time ? `Genial, nos vemos a las ${time}.` : "Genial, nos vemos entonces.";
}

function closeOrBoundaryFallback(metadata = {}, context = "") {
  const contextText = textFromContext(context);
  if (/\b(?:cu[i\u00ed]date|cuidate|hablamos\s+luego|hablamos\s+despu[e\u00e9]s|hasta\s+luego|me\s+voy)\b/i.test(contextText)) {
    return freshFallbackOption([
      "Dale, cuidate. Hablamos luego.",
      "Va, cuidate. Te leo después.",
      "Está bien, que te vaya bien."
    ], metadata, contextText);
  }
  return freshFallbackOption([
    "Te entiendo, no insisto.",
    "Está bien, respeto eso.",
    "Va, lo dejamos ahí por ahora."
  ], metadata, contextText);
}

function cannedDatePlanFallback(metadata = {}, context = "") {
  const variantKey = normalizeVariantKey(metadata.variant || metadata.locale || metadata.spanishVariant || metadata.languageVariant);
  const combined = `${metadata.situation || ""} ${metadata.objective || ""} ${textFromContext(context)}`;
  const when = /\b(?:esta noche|hoy)\b/i.test(combined) ? "esta noche" : "esta semana";
  if (/\b(?:ganas de hablar|me ha gustado verte|nos vimos|me quede con ganas|me qued[e\u00e9] con ganas)\b/i.test(combined)) {
    return freshFallbackOption([
      "Me quedé igual, con ganas de seguir. Busquemos un rato esta semana.",
      "A mí también me quedó esa sensación. Lo seguimos en persona esta semana.",
      "Entonces dejemos una segunda parte pendiente para esta semana."
    ], metadata, combined);
  }
  if (["es-AR", "es-PY", "es-UY"].includes(variantKey)) {
    return when === "esta noche"
      ? freshFallbackOption([
          "Hoy podemos hacer algo simple: una vuelta corta y vemos qué pinta.",
          "Si te queda bien hoy, nos cruzamos un rato y seguimos hablando.",
          "Hoy da para vernos un rato, sin hacerlo enorme."
        ], metadata, combined)
      : freshFallbackOption([
          "Esta semana podemos vernos un rato y seguir la charla en persona.",
          "Busquemos un hueco esta semana y lo seguimos cara a cara.",
          "Dejemos una segunda parte para esta semana."
        ], metadata, combined);
  }
  return when === "esta noche"
    ? freshFallbackOption([
        "Hoy podemos hacer algo simple: una cena tranquila o una vuelta corta.",
        "Si te va hoy, nos vemos un rato y dejamos que fluya.",
        "Hoy puede salir un plan fácil, sin montarlo demasiado."
      ], metadata, combined)
    : freshFallbackOption([
        "Esta semana podemos vernos un rato y seguir la charla en persona.",
        "Busquemos un hueco esta semana y lo seguimos cara a cara.",
        "Dejemos una segunda parte para esta semana."
      ], metadata, combined);
}

function stripProfessionalCasualTail(text = "", metadata = {}, context = "") {
  const value = String(text || "").trim();
  if (!hasProfessionalCasualTail(value, metadata, context)) return value;
  return value
    .replace(/\s*(?:[.!?]\s*)?(?:suave|tranqui|tranquilo|tranquila|nomas|nom[a\u00e1]s|de una|dale)\.?\s*$/i, "")
    .replace(/[,\s]+$/g, "")
    .trim();
}

function stripValidationQuestionTail(text = "") {
  return String(text || "")
    .replace(/\s*,?\s*(?:quer[e\u00e9]s|quieres|te parece|te pinta|te va|va|te anim[a\u00e1]s|te copas)\??\s*$/i, "")
    .replace(/[,\s]+$/g, "")
    .trim();
}

function repairPlayfulDoubtResponse(text = "", metadata = {}, context = "") {
  const value = String(text || "").trim();
  if (!hasBadPlayfulDoubtResponse(value, metadata, context)) return value;
  const cleaned = value
    .replace(/\b(?:entonces\s+)?quedamos\s+as[i\u00ed]\b/gi, "")
    .replace(/\btranqui\s+vos\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[,.;:\s]+|[,.;:\s]+$/g, "")
    .trim();
  return cleaned || value;
}

function isOwnTurn(metadata = {}) {
  const sender = String(metadata.targetMessageSender || metadata.turnOwner || "").toLowerCase();
  return sender === "me" || sender === "user" || sender === "usuario" || metadata.lastMessageFromUser === true;
}

function hasOwnTurnContactReply(text = "", metadata = {}) {
  return isOwnTurn(metadata) && OWN_TURN_CONTACT_REPLY_RE.test(String(text || "").trim());
}

function repairOwnTurnContactReply(text = "", metadata = {}) {
  const value = String(text || "").trim();
  if (!hasOwnTurnContactReply(value, metadata)) return value;
  const cleaned = value
    .replace(OWN_TURN_CONTACT_REPLY_RE, "")
    .replace(/\s+/g, " ")
    .replace(/^[,.;:\s]+|[,.;:\s]+$/g, "")
    .trim();
  return cleaned || value;
}

function capitalizeFirst(text = "") {
  return String(text || "").replace(/^([a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1])/u, (letter) => letter.toUpperCase());
}

function hasLowValueOpening(text = "", metadata = {}, context = "") {
  const value = String(text || "").trim();
  if (!LOW_VALUE_OPENING_RE.test(value)) return false;
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  const contextText = textFromContext(context);
  return (
    agentKey === "ligoteo" ||
    agentKey === "profesional" ||
    INITIATIVE_OPPORTUNITY_CONTEXT_RE.test(contextText)
  );
}

function stripLowValueOpening(text = "", metadata = {}, context = "") {
  const value = String(text || "").trim();
  if (!hasLowValueOpening(value, metadata, context)) return value;
  return capitalizeFirst(value.replace(LOW_VALUE_OPENING_RE, "").trim());
}

function hasGenericQuestionTail(text = "", metadata = {}, context = "") {
  const value = String(text || "").trim();
  if (!GENERIC_QUESTION_TAIL_RE.test(value)) return false;
  const focusLine = latestContactFocusLine(context);
  const initialGreetingContext = CONTACT_INITIAL_GREETING_CONTEXT_RE.test(focusLine);
  const contextText = textFromContext(context);
  const hasClearOpportunity = OPPORTUNITY_CONTEXT_RE.test(contextText) || INITIATIVE_OPPORTUNITY_CONTEXT_RE.test(contextText);
  const hasHumanOpening = value.split(/\s+/).filter(Boolean).length >= 7 && /^(?:hola|buenas|qu[e\u00e9]\s+lindo|qu[e\u00e9]\s+alegr[i\u00eda]|me\s+alegra|gracias|ac[a\u00e1]|aqu[i\u00ed]|estoy)\b/i.test(value);
  if (initialGreetingContext && hasHumanOpening && !hasClearOpportunity) return false;
  return true;
}

function referenceList(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function latestContactFocusLine(context = "") {
  const lines = textFromContext(context)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (/^(?:ultimo_mensaje_de_otra_persona|last_inbound|contacto:)\b/i.test(lines[index])) {
      return lines[index];
    }
  }
  return "";
}

function currentContactHasBoundary(context = "") {
  const focus = latestContactFocusLine(context);
  if (focus) {
    if (CURRENT_INVITATION_CONTEXT_RE.test(focus)) return false;
    if (ROMANTIC_BOUNDARY_CONTEXT_RE.test(focus)) return true;
  }
  const contextText = textFromContext(context);
  return CLOSE_OR_BOUNDARY_TARGET_CONTEXT_RE.test(contextText) || ROMANTIC_BOUNDARY_CONTEXT_RE.test(contextText);
}

function maxSimilarityToList(text = "", values = []) {
  return referenceList(values).reduce((max, value) => {
    const candidate = String(value || "").trim();
    if (!candidate) return max;
    return Math.max(max, normalizedSimilarity(text, candidate));
  }, 0);
}

function regenerationSimilarity(text = "", metadata = {}) {
  return maxSimilarityToList(text, [
    metadata.previousGeneratedText,
    metadata.lastGeneratedText,
    ...referenceList(metadata.previousGeneratedTexts),
    ...referenceList(metadata.previousGeneratedTextHistory)
  ]);
}

function structureSignature(value = "") {
  const text = normalizeQualityText(value);
  if (!text) return "";
  const firstWords = text.split(/\s+/).slice(0, 5).join(" ");
  if (/\b(?:tomamos algo|tomar algo|cafe|copa|cenamos|nos vemos|quedamos|esta semana|esta noche)\b/i.test(text)) return `date_plan:${firstWords}`;
  if (/\b(?:lo reviso|te confirmo|te envio|te mando|lo tengo listo|propuesta|presupuesto|archivo)\b/i.test(text)) return `professional_step:${firstWords}`;
  if (/\b(?:descansa|te leo|cuenta conmigo|aca estoy|aqui estoy|sin apuro|sin prisa)\b/i.test(text)) return `support:${firstWords}`;
  if (/\b(?:jajaja|beneficio de la duda|me hiciste reir|sonrisa|merito)\b/i.test(text)) return `playful:${firstWords}`;
  return `general:${firstWords}`;
}

function repeatedPhraseFromHistory(text = "", metadata = {}) {
  const value = normalizeQualityText(text);
  if (!value) return false;
  const references = [
    metadata.previousGeneratedText,
    metadata.lastGeneratedText,
    ...referenceList(metadata.previousGeneratedTexts),
    ...referenceList(metadata.previousGeneratedTextHistory)
  ].map(normalizeQualityText).filter(Boolean);
  const words = value.split(/\s+/).filter(Boolean);
  for (let size = 4; size <= 7; size += 1) {
    for (let index = 0; index + size <= words.length; index += 1) {
      const phrase = words.slice(index, index + size).join(" ");
      if (phrase.length < 18) continue;
      if (references.some((reference) => reference.includes(phrase))) return true;
    }
  }
  return false;
}

function hasSameStructureAsPrevious(text = "", metadata = {}) {
  const signature = structureSignature(text);
  if (!signature) return false;
  const references = [
    metadata.previousGeneratedText,
    metadata.lastGeneratedText,
    ...referenceList(metadata.previousGeneratedTexts),
    ...referenceList(metadata.previousGeneratedTextHistory)
  ].filter(Boolean);
  return references.some((reference) => {
    const referenceSignature = structureSignature(reference);
    if (!referenceSignature) return false;
    if (signature === referenceSignature) return true;
    return signature.split(":")[0] === referenceSignature.split(":")[0] && normalizedSimilarity(text, reference) >= 0.42;
  });
}

function recentOwnMessageSimilarity(text = "", metadata = {}) {
  return maxSimilarityToList(text, [
    ...referenceList(metadata.recentOwnTextsForQuality),
    ...referenceList(metadata.recentUserTextsForQuality),
    ...referenceList(metadata.doNotRepeatTexts)
  ]);
}

function hasSameAsPrevious(text = "", metadata = {}) {
  const hasGenerationHistory = Boolean(
    metadata.isRegeneration ||
    metadata.hasPreviousGeneratedText ||
    metadata.previousGeneratedText ||
    metadata.lastGeneratedText ||
    referenceList(metadata.previousGeneratedTexts).length ||
    referenceList(metadata.previousGeneratedTextHistory).length
  );
  if (!hasGenerationHistory) return false;
  return regenerationSimilarity(text, metadata) >= 0.62 || hasSameStructureAsPrevious(text, metadata) || repeatedPhraseFromHistory(text, metadata);
}

function hasSameAsRecentOwnText(text = "", metadata = {}) {
  return recentOwnMessageSimilarity(text, metadata) >= 0.68;
}

function draftFromRewriteContext(context = "") {
  const value = textFromContext(context);
  const match = value.match(REWRITE_DRAFT_CONTEXT_RE);
  return match ? String(match[1] || "").trim() : "";
}

function rewriteDraftKeywords(draft = "") {
  return normalizeQualityText(draft)
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !REWRITE_DRAFT_STOPWORDS.has(word))
    .slice(0, 14);
}

function hasRewriteDraftDrift(text = "", metadata = {}, context = "") {
  if (String(metadata.action || "").toLowerCase() !== "rewrite") return false;
  const draft = metadata.draft || metadata.userDraft || metadata.currentDraftText || draftFromRewriteContext(context);
  const keywords = rewriteDraftKeywords(draft);
  if (keywords.length < 2) return false;
  const output = normalizeQualityText(text);
  if (!output) return true;
  const hits = keywords.filter((word) => {
    const stem = word.length > 6 ? word.slice(0, 6) : word;
    return output.includes(word) || output.includes(stem);
  }).length;
  return hits / keywords.length < 0.25;
}

function rewriteDraftNeedsAssertiveNudge(context = "", metadata = {}) {
  const draft = metadata.draft || metadata.userDraft || metadata.currentDraftText || draftFromRewriteContext(context);
  const normalized = normalizeQualityText(draft);
  return /\bnervios?\b/.test(normalized) && /\b(?:atrev\w*|anim\w*|dar el paso)\b/.test(normalized);
}

function faithfulRewriteFallback(metadata = {}, context = "") {
  const variantKey = normalizeVariantKey(metadata.variant || metadata.locale || metadata.spanishVariant || metadata.languageVariant);
  if (!rewriteDraftNeedsAssertiveNudge(context, metadata)) return "";
  if (["es-AR", "es-PY", "es-UY"].includes(variantKey)) {
    return "No dejes que te ganen los nervios otra vez; animate a dar el paso.";
  }
  return "No dejes que te ganen los nervios otra vez; an\u00edmate a dar el paso.";
}

function shouldRepairRewriteFidelity(text = "", metadata = {}, context = "") {
  if (String(metadata.action || "").toLowerCase() !== "rewrite") return false;
  if (!rewriteDraftNeedsAssertiveNudge(context, metadata)) return false;
  return CANNED_REWRITE_REPLY_RE.test(text) || RECYCLED_DATE_STRUCTURE_RE.test(text) || hasRewriteDraftDrift(text, metadata, context);
}

function hasConcreteMove(text = "") {
  return CONCRETE_MOVE_RE.test(String(text || ""));
}

function hasMissedOpportunity(text = "", metadata = {}, context = "") {
  const value = String(text || "").trim();
  const move = String(metadata.responseMove || "");
  const contextText = textFromContext(context);
  if (!move) return false;
  if (move === "rewrite_preserve_user_intent") {
    return hasRewriteDraftDrift(value, metadata, context) || CANNED_REWRITE_REPLY_RE.test(value);
  }
  if (move === "accept_and_propose_specific_plan") {
    return !hasConcreteMove(value) || hasPassiveNoInitiative(value, metadata, contextText) || hasGenericQuestionTail(value);
  }
  if (move === "propose_low_pressure_date") {
    return !hasConcreteMove(value) || hasGenericQuestionTail(value);
  }
  if (move === "commit_next_step") {
    return hasGenericQuestionTail(value) || !hasConcreteMove(value);
  }
  if (move === "make_simple_low_effort_plan") {
    return hasGenericQuestionTail(value) || !hasConcreteMove(value);
  }
  if (move === "reassure_without_reclaiming") {
    return hasGenericQuestionTail(value) || /\b(?:con qui[e\u00e9]n|por qu[e\u00e9]|que hicieron|qu[e\u00e9] hicieron|como estuvo|c[o\u00f3]mo estuvo|me dejaste|reclamo|celos)\b/i.test(value);
  }
  if (move === "keep_door_open_after_delay") {
    return hasGenericQuestionTail(value) || /\b(?:por qu[e\u00e9] no|me dejaste|pendiente de ti|necesito|qu[e\u00e9] tal estuvo tu d[i\u00eda])\b/i.test(value);
  }
  if (move === "playful_reassure_with_hook") {
    return /\b(?:premio|cu[a\u00e1]l\s+ser[a\u00e1]|quedamos as[i\u00ed]|quedamos asi|entonces quedamos|tranqui vos)\b/i.test(value);
  }
  if (move === "build_connection_with_specific_reaction") {
    return hasGenericQuestionTail(value) || hasPrematureConnectionDatePlan(value, metadata, context) || /\b(?:qu[e\u00e9] m[a\u00e1]s cuentas|qu[e\u00e9] tal tu d[i\u00eda]|entrevista|lista de favoritos|me gane un lugar|me gan[e\u00e9] un lugar|cuando te r[i\u00ed]o|me encanta cuando te r[i\u00ed]o)\b/i.test(value);
  }
  if (move === "acknowledge_and_take_ownership") {
    return !/\b(?:reviso|lo reviso|lo miro|corrijo|te confirmo|lo soluciono|avanzo|me encargo|siguiente paso|hoy|ma[n\u00f1]ana)\b/i.test(value) || /\b(?:no es mi culpa|deber[i\u00edas]|te dije|ya te dije)\b/i.test(value);
  }
  if (move === "support_then_offer_simple_presence") {
    return /\b(?:terapia|diagn[o\u00f3]stico|tienes que|ten[e\u00e9]s que|superarlo|qu[e\u00e9] tal va)\b/i.test(value);
  }
  if (move === "respect_boundary_with_warmth") {
    return hasPlanAfterBoundary(value, metadata, context) || hasGenericQuestionTail(value) || /\b(?:insisto|venga|aunque sea|solo un rato|por favor|te paso a buscar|no seas asi|no seas as[i\u00ed])\b/i.test(value);
  }
  if (move === "respect_space_and_stay_available") {
    return hasGenericQuestionTail(value) || /\b(?:qu[e\u00e9] paso|cu[e\u00e9]ntame|cuentame|por qu[e\u00e9]|terapia|diagn[o\u00f3]stico|tienes que|ten[e\u00e9]s que)\b/i.test(value);
  }
  if (move === "defer_to_whatsapp_without_inventing") {
    return !/\b(?:whatsapp|lo miro|la miro|reviso en whatsapp|abro en whatsapp)\b/i.test(value) || /\b(?:se ve|sale una persona|claramente|en la foto|en el video)\b/i.test(value);
  }
  if (move === "continue_or_reinforce_own_message") {
    return hasOwnTurnContactReply(value, metadata);
  }
  return false;
}

function repairMissedOpportunity(text = "", metadata = {}, context = "") {
  const move = String(metadata.responseMove || "");
  const value = String(text || "").trim();
  if (move === "accept_and_propose_specific_plan") {
    if (
      /\b(?:me\s+gusta\s+el\s+plan|lo\s+hacemos\s+con\s+calma|sin\s+presi[o\u00f3]n)\b/i.test(value)
      && !/\b(?:tomamos|tomar algo|esta semana|esta noche|nos vemos|quedamos|caf[e\u00e9]|cafe)\b/i.test(value)
    ) {
      const variantKey = normalizeVariantKey(metadata.variant || metadata.locale || metadata.spanishVariant || metadata.languageVariant);
      if (variantKey === "es-ES") return "A m\u00ed tambi\u00e9n me gust\u00f3 verte. Esta semana buscamos un sitio tranquilo y seguimos sin prisa.";
      if (variantKey === "es-MX") return "A m\u00ed tambi\u00e9n me gust\u00f3 verte. Esta semana armamos algo tranquilo y seguimos sin presi\u00f3n.";
      return "A m\u00ed tambi\u00e9n me gust\u00f3 verte. Esta semana buscamos un plan tranquilo y seguimos sin prisa.";
    }
    return value;
  }
  if (move === "propose_low_pressure_date") {
    return value;
  }
  if (move === "commit_next_step") {
    return value;
  }
  if (move === "make_simple_low_effort_plan") {
    return value;
  }
  if (move === "reassure_without_reclaiming") {
    return value;
  }
  if (move === "keep_door_open_after_delay") {
    return value;
  }
  if (move === "playful_reassure_with_hook") {
    return value;
  }
  if (move === "build_connection_with_specific_reaction") {
    if (hasPrematureConnectionDatePlan(value, metadata, context)) {
      return connectionReactionFallback(metadata, context);
    }
    return value;
  }
  if (move === "acknowledge_and_take_ownership") {
    return value;
  }
  if (move === "support_then_offer_simple_presence") {
    return value;
  }
  if (move === "respect_boundary_with_warmth") {
    return value;
  }
  if (move === "respect_space_and_stay_available") {
    return value;
  }
  if (move === "defer_to_whatsapp_without_inventing") {
    return value;
  }
  if (move === "continue_or_reinforce_own_message") {
    return repairOwnTurnContactReply(text, metadata, context);
  }
  return value;
}

function detectMojibake(value = "") {
  return MOJIBAKE_RE.test(String(value || ""));
}

function detectDialectWarnings(text = "", variant = "es-neutro") {
  const variantKey = normalizeVariantKey(variant);
  const rules = DIALECT_RULES[variantKey] || DIALECT_RULES["es-neutro"];
  const warnings = [];
  if (rules.forbidden && rules.forbidden.test(text)) {
    warnings.push(`dialect_leak_${variantKey}`);
  }
  return warnings;
}

function detectSpanishNaturalnessFlags(text = "") {
  const value = String(text || "");
  return SPANISH_NATURALNESS_RULES
    .filter((rule) => rule.regex.test(value))
    .map((rule) => rule.flag);
}

function shouldReduceRegionality(metadata = {}, context = "") {
  return Boolean(
    RISK_CONTEXT_RE.test(String(metadata.situation || "")) ||
    RISK_CONTEXT_RE.test(String(metadata.relationshipType || "")) ||
    RISK_CONTEXT_RE.test(String(metadata.objective || "")) ||
    RISK_CONTEXT_RE.test(textFromContext(context))
  );
}

function compactQualityText(value = "", maxLength = 260) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function qualityPolicyPrompt(action = "suggest", metadata = {}) {
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  const agent = AGENT_RULES[agentKey] || AGENT_RULES.amistoso;
  const variantKey = normalizeVariantKey(metadata.variant);
  const dialect = DIALECT_RULES[variantKey] || DIALECT_RULES["es-neutro"];
  const recentGeneratedRefs = [
    ...referenceList(metadata.previousGeneratedTexts),
    ...referenceList(metadata.previousGeneratedTextHistory)
  ].map((value) => compactQualityText(value, 220)).filter(Boolean).slice(-5);
  const sharedDecisionContract = metadata.aiDecisionContext
    ? [
        `Contrato compartido activo: ${metadata.aiDecisionContext.version}.`,
        "Calidad valida que contexto, response_move, agente y preferencias no se contradigan.",
        `preference_adapter=${metadata.aiDecisionContext.preferenceAdapter?.role || "style_support_only"}`,
        `prevention_contract=${(metadata.aiDecisionContext.preventionContract || []).join(",")}`
      ].join("\n")
    : "";
  return [
    `calidad_wafli_prompt_variant=${PROMPT_VARIANT}`,
    `compatibilidad_prompt_anterior=${PROMPT_VARIANT_V1}`,
    "Entrega solo un mensaje listo para enviar por WhatsApp.",
    "Debe aportar algo util y contextual: avanzar, aclarar, suavizar, cerrar, bromear o acompanar; no repitas lo obvio.",
    `Agente ${agent.label}: ${agent.must}. Evita: ${agent.avoid.join(", ")}.`,
    `Variante: ${dialect.label}. Prioriza tratamiento, cadencia y vocabulario natural; no mezcles variantes.`,
    "Guardrails criticos: no inventar hechos, fechas, horas, acuerdos, disponibilidad, emociones ni contenido multimedia; respetar limites explicitos; no confundir quien habla; no cambiar la intencion del rewrite.",
    "Libertad creativa: varia forma, ritmo, microgancho, iniciativa y estructura. Si una regla generica choca con el foco claro del chat, gana el foco salvo riesgo alto.",
    "No uses frases de asistente, prefijos, placeholders, explicaciones ni salida con varias alternativas salvo que la accion lo pida.",
    responseMovePrompt(metadata),
    sharedDecisionContract,
    metadata.previousGeneratedText ? `Regeneracion: evita repetir esta propuesta anterior: ${compactQualityText(metadata.previousGeneratedText)}.` : "",
    recentGeneratedRefs.length ? `Memoria anti-reciclaje del chat: no reutilices estas propuestas recientes ni su estructura:\n${recentGeneratedRefs.join("\n")}` : "",
    "Si hay una oportunidad clara, toma iniciativa proporcional en vez de devolver la decision al usuario.",
    action === "reactivate" ? "Para reactivar: una entrada breve, sin reproche ni mirar demasiado atras." : "",
    action === "rewrite" ? "Para reescribir: conserva la intencion del borrador y mejora naturalidad." : ""
  ].filter(Boolean).join("\n");
}

function scoreDimensions(text = "", metadata = {}, context = "") {
  const value = String(text || "").trim();
  const words = value.split(/\s+/).filter(Boolean);
  const naturalnessFlags = detectSpanishNaturalnessFlags(value);
  const dialectWarnings = detectDialectWarnings(value, metadata.variant);
  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  const agent = AGENT_RULES[agentKey] || AGENT_RULES.amistoso;
  const nonObviousValue = nonObviousValueScore(value, context);
  const assistantPenalty = ASSISTANT_PHRASE_RE.test(value) || PLACEHOLDER_RE.test(value) ? 35 : 0;
  const genericPenalty = GENERIC_CLOSER_RE.test(value) || EMPTY_POLITE_RE.test(value) ? 25 : 0;
  const lengthPenalty = words.length < 3 ? 40 : words.length > 90 ? 25 : 0;
  const riskMode = shouldReduceRegionality(metadata, context);
  const dialectPenalty = dialectWarnings.length ? (riskMode ? 6 : 24) : 0;
  const agentPenalty = agent.cringe.test(value) ? 30 : 0;
  const naturalnessPenalty = Math.min(40, naturalnessFlags.length * 12);
  const repeatedPenalty = hasRepeatedPhrase(value) ? 22 : 0;
  const professionalTailPenalty = hasProfessionalCasualTail(value, metadata, context) ? 26 : 0;
  const initiativePenalty = hasPassiveNoInitiative(value, metadata, context) ? 28 : 0;
  const missedOpportunityPenalty = hasMissedOpportunity(value, metadata, context) ? 24 : 0;
  const genericQuestionPenalty = hasGenericQuestionTail(value) ? 12 : 0;
  const sameAsPreviousPenalty = hasSameAsPrevious(value, metadata) ? 22 : 0;
  const sameStructurePenalty = hasSameStructureAsPrevious(value, metadata) ? 18 : 0;
  const phraseRecyclePenalty = repeatedPhraseFromHistory(value, metadata) ? 18 : 0;
  const lowPressureFormulaPenalty = hasLowPressureFormulaOveruse(value, metadata, context) ? 30 : 0;
  const styleFormulaPenalty = repeatedStyleChunkFromHistory(value, metadata, context) ? 16 : 0;
  const playfulDoubtPenalty = hasBadPlayfulDoubtResponse(value, metadata, context) ? 35 : 0;
  const ownTurnPenalty = hasOwnTurnContactReply(value, metadata) ? 36 : 0;
  const lowValueOpeningPenalty = hasLowValueOpening(value, metadata, context) ? 12 : 0;
  const templateOpeningPenalty = hasTemplateCommaOpening(value, metadata, context) ? 10 : 0;
  const lowInitiativeOpportunityPenalty = hasLowInitiativeOpportunity(value, metadata, context) ? 18 : 0;
  const awkwardSpanishPenalty = AWKWARD_SPANISH_RE.test(value) ? 22 : 0;
  const rhythmPenalty = STIFF_HUMAN_RHYTHM_RE.test(value) ? 18 : 0;
  const rewriteDriftPenalty = hasRewriteDraftDrift(value, metadata, context) ? 34 : 0;
  const rewriteCannedPenalty =
    String(metadata.action || "").toLowerCase() === "rewrite" && CANNED_REWRITE_REPLY_RE.test(value) ? 34 : 0;
  const unsupportedFactPenalty = Math.min(45, unsupportedSpecificFactFlags(value, context).length * 22);
  const unsupportedMediaPenalty = hasUnsupportedMediaClaim(value, metadata, context) ? 45 : 0;
  const boundaryPressurePenalty = hasPlanAfterBoundary(value, metadata, context) ? 55 : 0;
  const staleContextPenalty = hasStaleContextEcho(value, metadata, context) ? 34 : 0;
  const oversafePenalty = hasOversafeLowValueReply(value, metadata, context) ? 18 : 0;
  const overclosingFlirtPenalty = hasOverclosingFlirtReply(value, metadata, context) ? 28 : 0;
  const lengtheningFillerPenalty = hasLengtheningFiller(value, metadata, context) ? 14 : 0;
  const abstractFlirtMetaPenalty = hasAbstractFlirtMetaReply(value, metadata, context) ? 30 : 0;

  return {
    utility: Math.max(0, Math.min(100, nonObviousValue - initiativePenalty - missedOpportunityPenalty - genericQuestionPenalty - playfulDoubtPenalty - ownTurnPenalty - lowValueOpeningPenalty - templateOpeningPenalty - lowInitiativeOpportunityPenalty - awkwardSpanishPenalty - sameStructurePenalty - phraseRecyclePenalty - lowPressureFormulaPenalty - styleFormulaPenalty - rewriteDriftPenalty - rewriteCannedPenalty - unsupportedFactPenalty - unsupportedMediaPenalty - boundaryPressurePenalty - staleContextPenalty - oversafePenalty - overclosingFlirtPenalty - lengtheningFillerPenalty - abstractFlirtMetaPenalty)),
    naturalness: Math.max(0, 100 - naturalnessPenalty - assistantPenalty - genericPenalty - repeatedPenalty - rhythmPenalty - awkwardSpanishPenalty - Math.round(initiativePenalty / 2) - Math.round(missedOpportunityPenalty / 2) - Math.round(playfulDoubtPenalty / 2) - ownTurnPenalty - lowValueOpeningPenalty - templateOpeningPenalty - lowInitiativeOpportunityPenalty - sameAsPreviousPenalty - sameStructurePenalty - phraseRecyclePenalty - lowPressureFormulaPenalty - styleFormulaPenalty - Math.round(rewriteDriftPenalty / 2) - Math.round(rewriteCannedPenalty / 2) - unsupportedFactPenalty - unsupportedMediaPenalty - boundaryPressurePenalty - staleContextPenalty - oversafePenalty - Math.round(overclosingFlirtPenalty / 2) - lengtheningFillerPenalty - abstractFlirtMetaPenalty),
    dialectFit: Math.max(0, 100 - dialectPenalty),
    agentFit: Math.max(0, 100 - agentPenalty - professionalTailPenalty - missedOpportunityPenalty - playfulDoubtPenalty - ownTurnPenalty - rewriteDriftPenalty - rewriteCannedPenalty - Math.round(unsupportedFactPenalty / 2) - Math.round(unsupportedMediaPenalty / 2) - boundaryPressurePenalty - overclosingFlirtPenalty),
    clarity: Math.max(0, 100 - lengthPenalty - assistantPenalty - Math.round(repeatedPenalty / 2) - genericQuestionPenalty - Math.round(unsupportedFactPenalty / 2) - Math.round(unsupportedMediaPenalty / 2) - Math.round(boundaryPressurePenalty / 2) - Math.round(overclosingFlirtPenalty / 2)),
    brevity: Math.max(0, words.length <= 36 ? 100 : words.length <= 60 ? 78 : 48)
  };
}

function aggregateScore(dimensions = {}) {
  const weights = {
    utility: 0.24,
    naturalness: 0.22,
    dialectFit: 0.18,
    agentFit: 0.14,
    clarity: 0.14,
    brevity: 0.08
  };
  return Math.round(Object.entries(weights).reduce((sum, [key, weight]) => {
    return sum + (Number(dimensions[key] || 0) * weight);
  }, 0));
}

function nonObviousValueScore(text = "", context = "") {
  const cleanText = String(text || "").toLowerCase();
  const cleanContext = textFromContext(context).toLowerCase();
  const words = cleanText.split(/\s+/).filter((word) => word.length > 4);
  if (!words.length) return 0;
  const repeated = words.filter((word) => cleanContext.includes(word)).length;
  const uniqueRatio = 1 - repeated / words.length;
  const hasAction = /\b(?:quedamos|confirmo|mando|envio|reviso|vemos|tomamos|hablamos|seguimos|te digo|pasame|pasa|descansa|cuenta conmigo)\b/i.test(text);
  return Math.max(0, Math.min(100, Math.round(uniqueRatio * 65 + (hasAction ? 35 : 10))));
}

function evaluateAiResponse(text = "", metadata = {}, context = "") {
  const value = String(text || "").trim();
  const words = value.split(/\s+/).filter(Boolean);
  const flags = [];
  const spanishNaturalnessFlags = detectSpanishNaturalnessFlags(value);
  if (!value) flags.push("empty");
  if (words.length < 3) flags.push("too_short");
  if (words.length > 90) flags.push("too_long");
  if (EMPTY_POLITE_RE.test(value)) flags.push("empty_polite");
  if (GENERIC_CLOSER_RE.test(value)) flags.push("generic_closer");
  if (ASSISTANT_PHRASE_RE.test(value)) flags.push("assistant_phrase");
  if (PLACEHOLDER_RE.test(value)) flags.push("placeholder");
  if (detectMojibake(value)) flags.push("mojibake");
  if (hasRepeatedPhrase(value)) {
    flags.push("repeated_phrase");
    flags.push("awkward_duplicate");
  }
  if (STIFF_HUMAN_RHYTHM_RE.test(value)) flags.push("low_human_rhythm");
  if (AWKWARD_SPANISH_RE.test(value)) flags.push("awkward_spanish_particle");
  if (REPEATED_CASUAL_WORD_RE.test(value)) flags.push("repeated_casual_word");
  if (PATTERNED_REPLY_RE.test(value)) flags.push("patterned_reply");
  if (hasCannedDatePlan(value, metadata, context)) flags.push("canned_date_plan");
  if (hasPrematureConnectionDatePlan(value, metadata, context)) {
    flags.push("connection_to_date_drift");
    if (!flags.includes("missed_opportunity")) flags.push("missed_opportunity");
  }
  if (hasLowPressureFormulaOveruse(value, metadata, context)) {
    flags.push("low_pressure_formula_overuse");
    flags.push("overused_low_pressure_filler");
    if (!flags.includes("patterned_reply")) flags.push("patterned_reply");
  }
  if (repeatedStyleChunkFromHistory(value, metadata, context)) {
    flags.push("style_formula_recycling");
    if (!flags.includes("patterned_reply")) flags.push("patterned_reply");
  }
  const unsupportedFactFlags = unsupportedSpecificFactFlags(value, context);
  if (unsupportedFactFlags.length) {
    flags.push(...unsupportedFactFlags);
    flags.push("hallucination_risk");
  }
  if (hasUnsupportedMediaClaim(value, metadata, context)) {
    flags.push("unsupported_media_claim");
    flags.push("hallucination_risk");
  }
  if (hasViewOnceUnhelpfulTail(value, metadata, context)) {
    flags.push("view_once_unhelpful_tail");
  }
  if (hasPlanAfterBoundary(value, metadata, context)) {
    flags.push("pressure_after_boundary");
    flags.push("ignored_romantic_boundary");
    flags.push("repeated_invite_after_refusal");
    flags.push("forced_plan_after_no");
  }
  if (hasStaleContextEcho(value, metadata, context)) {
    flags.push("stale_context_echo");
    flags.push("phrase_recycling");
  }
  if (hasOversafeLowValueReply(value, metadata, context)) {
    flags.push("oversafe_low_value_reply");
    flags.push("no_actionable_value");
  }
  if (hasOverclosingFlirtReply(value, metadata, context)) {
    flags.push("overclosing_flirt_reply");
    flags.push("no_actionable_value");
    if (!flags.includes("missed_opportunity")) flags.push("missed_opportunity");
  }
  if (hasLengtheningFiller(value, metadata, context)) {
    flags.push("lengthening_filler");
    if (!flags.includes("low_human_rhythm")) flags.push("low_human_rhythm");
  }
  if (hasAbstractFlirtMetaReply(value, metadata, context)) {
    flags.push("abstract_flirt_meta_reply");
    flags.push("no_actionable_value");
    if (!flags.includes("missed_opportunity")) flags.push("missed_opportunity");
  }
  if (hasGroupInviteIssue(value, metadata, context)) {
    flags.push("group_invite_unclear");
  }

  const agentKey = normalizeAgentKey(metadata.agent || metadata.tone);
  const agent = AGENT_RULES[agentKey] || AGENT_RULES.amistoso;
  if (agent.cringe.test(value)) flags.push(`agent_cringe_${agentKey}`);
  if (hasProfessionalCasualTail(value, metadata, context)) flags.push("professional_casual_tail");
  if (hasPassiveNoInitiative(value, metadata, context)) {
    flags.push("passive_no_initiative");
    flags.push("passive_reply");
  }
  if (hasGenericQuestionTail(value, metadata, context)) flags.push("generic_question_tail");
  if (hasMissedOpportunity(value, metadata, context)) flags.push("missed_opportunity");
  if (hasSameAsPrevious(value, metadata)) {
    flags.push("same_as_previous");
    if (referenceList(metadata.previousGeneratedTexts).length || referenceList(metadata.previousGeneratedTextHistory).length) {
      flags.push("same_as_recent_generation");
    }
  }
  if (hasSameStructureAsPrevious(value, metadata)) flags.push("same_structure_as_previous");
  if (repeatedPhraseFromHistory(value, metadata)) flags.push("phrase_recycling");
  if (hasSameAsRecentOwnText(value, metadata)) flags.push("same_as_recent_user_message");
  if (String(metadata.action || "").toLowerCase() === "rewrite" && CANNED_REWRITE_REPLY_RE.test(value)) {
    flags.push("rewrite_canned_reply");
    if (!flags.includes("wrong_rewrite_focus")) flags.push("wrong_rewrite_focus");
  }
  if (shouldRepairRewriteFidelity(value, metadata, context)) {
    flags.push("rewrite_needs_fidelity_repair");
    if (!flags.includes("wrong_rewrite_focus")) flags.push("wrong_rewrite_focus");
  }
  if (hasRewriteDraftDrift(value, metadata, context)) {
    flags.push("rewrite_drift");
    flags.push("wrong_rewrite_focus");
  }
  if (hasBadPlayfulDoubtResponse(value, metadata, context)) flags.push("playful_doubt_bad_closure");
  if (hasWrongSmileAttribution(value, metadata, context)) {
    flags.push("wrong_smile_attribution");
    flags.push("wrong_turn_owner");
    flags.push("stale_context_echo");
  }
  if (hasWrongMannersAttribution(value, metadata, context)) {
    flags.push("wrong_manners_attribution");
    flags.push("wrong_turn_owner");
    flags.push("missed_correction_repair");
  }
  if (hasContactWorkingAttributionIssue(value, metadata, context)) {
    flags.push("wrong_contact_working_attribution");
    flags.push("wrong_turn_owner");
    flags.push("speaker_fact_confusion");
  }
  if (hasMissedInitialGreeting(value, metadata, context)) {
    flags.push("missed_initial_greeting");
    flags.push("wrong_conversation_phase");
  }
  if (hasDelayPressureReply(value, metadata, context)) {
    flags.push("delay_pressure_reply");
    flags.push("wrong_conversation_phase");
  }
  if (hasLaughToPlanDrift(value, metadata, context)) {
    flags.push("laugh_to_plan_drift");
    flags.push("connection_to_date_drift");
  }
  if (hasIgnoredAudioTranscript(value, metadata, context)) {
    flags.push("ignored_audio_transcript");
    flags.push("wrong_media_context");
  }
  if (hasWeakMeetingConfirmation(value, metadata, context)) {
    flags.push("weak_meeting_confirmation");
    flags.push("wrong_conversation_phase");
  }
  if (hasOverdoneMeetingConfirmation(value, metadata, context)) {
    flags.push("overdone_meeting_confirmation");
    if (!flags.includes("lengthening_filler")) flags.push("lengthening_filler");
  }
  if (hasPushAfterCloseOrBoundary(value, metadata, context)) {
    flags.push("push_after_close_or_boundary");
    flags.push("missed_boundary");
  }
  if (hasOwnTurnContactReply(value, metadata)) {
    flags.push("own_turn_contact_reply");
    flags.push("wrong_turn_owner");
  }
  if (hasLowValueOpening(value, metadata, context)) flags.push("low_value_opening");
  if (hasTemplateCommaOpening(value, metadata, context)) flags.push("template_comma_opening");
  if (hasLowInitiativeOpportunity(value, metadata, context)) {
    flags.push("low_initiative_opportunity");
    flags.push("no_actionable_value");
  }

  const dialectWarnings = detectDialectWarnings(value, metadata.variant);
  const riskMode = shouldReduceRegionality(metadata, context);
  if (riskMode && dialectWarnings.length) flags.push("regionality_reduced_context");
  const nonObviousValue = nonObviousValueScore(value, context);
  if (nonObviousValue < 35) {
    flags.push("low_non_obvious_value");
    flags.push("no_actionable_value");
  }

  const dimensions = scoreDimensions(value, metadata, context);
  let score = aggregateScore(dimensions);
  score -= flags.length * 9;
  if (flags.includes("assistant_phrase")) score -= 20;
  if (flags.includes("generic_closer")) score -= 10;
  if (flags.includes("empty_polite")) score -= 15;
  if (flags.includes("repeated_phrase")) score -= 18;
  if (flags.includes("professional_casual_tail")) score -= 22;
  if (flags.includes("passive_no_initiative")) score -= 24;
  if (flags.includes("passive_reply")) score -= 16;
  if (flags.includes("missed_opportunity")) score -= 26;
  if (flags.includes("generic_question_tail")) score -= 14;
  if (flags.includes("same_as_previous")) score -= 22;
  if (flags.includes("same_as_recent_generation")) score -= 18;
  if (flags.includes("same_structure_as_previous")) score -= 16;
  if (flags.includes("phrase_recycling")) score -= 18;
  if (flags.includes("same_as_recent_user_message")) score -= 26;
  if (flags.includes("rewrite_drift")) score -= 30;
  if (flags.includes("wrong_rewrite_focus")) score -= 16;
  if (flags.includes("rewrite_canned_reply")) score -= 30;
  if (flags.includes("wrong_smile_attribution")) score -= 34;
  if (flags.includes("wrong_manners_attribution")) score -= 34;
  if (flags.includes("wrong_contact_working_attribution")) score -= 34;
  if (flags.includes("missed_initial_greeting")) score -= 24;
  if (flags.includes("delay_pressure_reply")) score -= 24;
  if (flags.includes("laugh_to_plan_drift")) score -= 28;
  if (flags.includes("ignored_audio_transcript")) score -= 34;
  if (flags.includes("weak_meeting_confirmation")) score -= 20;
  if (flags.includes("overdone_meeting_confirmation")) score -= 30;
  if (flags.includes("push_after_close_or_boundary")) score -= 34;
  if (flags.includes("own_turn_contact_reply")) score -= 30;
  if (flags.includes("wrong_turn_owner")) score -= 18;
  if (flags.includes("no_actionable_value")) score -= 12;
  if (flags.includes("low_value_opening")) score -= 10;
  if (flags.includes("template_comma_opening")) score -= 12;
  if (flags.includes("patterned_reply")) score -= 8;
  if (flags.includes("canned_date_plan")) score -= 36;
  if (flags.includes("connection_to_date_drift")) score -= 24;
  if (flags.includes("low_pressure_formula_overuse")) score -= 28;
  if (flags.includes("overused_low_pressure_filler")) score -= 18;
  if (flags.includes("style_formula_recycling")) score -= 16;
  if (flags.includes("pressure_after_boundary")) score -= 44;
  if (flags.includes("ignored_romantic_boundary")) score -= 24;
  if (flags.includes("repeated_invite_after_refusal")) score -= 28;
  if (flags.includes("forced_plan_after_no")) score -= 20;
  if (flags.includes("stale_context_echo")) score -= 34;
  if (flags.includes("oversafe_low_value_reply")) score -= 18;
  if (flags.includes("overclosing_flirt_reply")) score -= 28;
  if (flags.includes("lengthening_filler")) score -= 14;
  if (flags.includes("abstract_flirt_meta_reply")) score -= 30;
  if (flags.includes("view_once_unhelpful_tail")) score -= 18;
  if (flags.includes("group_invite_unclear")) score -= 14;
  if (flags.includes("hallucination_risk")) score -= 34;
  if (flags.includes("unsupported_media_claim")) score -= 28;
  if (flags.includes("unsupported_weekday_reference")) score -= 18;
  if (flags.includes("unsupported_clock_reference")) score -= 18;
  if (flags.includes("awkward_spanish_particle")) score -= 20;
  if (flags.includes("repeated_casual_word")) score -= 12;
  if (flags.includes("low_human_rhythm")) score -= 12;
  score -= dialectWarnings.length * (riskMode ? 4 : 12);
  score -= spanishNaturalnessFlags.length * 8;
  if (words.length >= 3 && words.length <= 36) score += 5;
  if (nonObviousValue >= 60) score += 8;
  score = Math.max(0, Math.min(100, score));

  return {
    promptVariant: PROMPT_VARIANT,
    score,
    dimensions,
    flags,
    dialectWarnings,
    spanishNaturalnessFlags,
    agentFit: flags.some((flag) => flag.startsWith("agent_cringe_")) ? "weak" : "ok",
    nonObviousValue,
    regenerationSimilarity: regenerationSimilarity(value, metadata),
    recentOwnMessageSimilarity: recentOwnMessageSimilarity(value, metadata),
    reducedRegionality: riskMode
  };
}

function useContextualLightRepairMode(metadata = {}) {
  const version = String(metadata.promptProfileVersion || "");
  const intent = String(metadata.intent || "");
  const riskLevel = String(metadata.riskLevel || "");
  if (!version.includes("wafli-contextual-intent")) return false;
  if (riskLevel === "high") return false;
  return ![
    "boundary_rejection",
    "unavailable_media",
    "own_message_continuation"
  ].includes(intent);
}

function applyQualityPostprocess(text = "", metadata = {}, context = "") {
  let value = String(text || "").trim();
  const postprocessFlags = [];
  const flagOnlyRepairMode = useContextualLightRepairMode(metadata);
  const variantKey = normalizeVariantKey(metadata.variant || metadata.locale || metadata.spanishVariant || metadata.languageVariant);
  value = value
    .replace(/^(?:respuesta sugerida|mensaje sugerido|aqui tienes|te sugiero responder)[:\-\s]+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  value = stripRepeatedOpeningPhrase(value);
  if (hasTemplateCommaOpening(value, metadata, context) && flagOnlyRepairMode) {
    postprocessFlags.push("template_comma_opening_flagged_without_repair");
  } else {
    value = stripTemplateCommaOpening(value, metadata, context);
  }
  if ((PATTERNED_REPLY_RE.test(value) || hasLowValuePatternedOpening(value, metadata, context)) && flagOnlyRepairMode) {
    postprocessFlags.push("patterned_reply_flagged_without_repair");
  } else {
    value = stripLowValuePatternedOpening(value, metadata, context);
  }
  if (hasUnsupportedMediaClaim(value, metadata, context)) {
    value = mediaUnavailableFallback(metadata, context);
  }
  if (hasViewOnceUnhelpfulTail(value, metadata, context)) {
    value = mediaUnavailableFallback(metadata, context);
  }
  value = visibleMeetingFactFallback(value, metadata, context) || value;
  if (hasPlanAfterBoundary(value, metadata, context)) {
    value = romanticBoundaryFallback(metadata, context);
  }
  if (hasGroupInviteIssue(value, metadata, context)) {
    if (flagOnlyRepairMode) postprocessFlags.push("group_invite_issue_flagged_without_repair");
    else value = groupInviteFallback(metadata, context);
  }
  if (hasPrematureConnectionDatePlan(value, metadata, context)) {
    if (flagOnlyRepairMode) postprocessFlags.push("connection_to_date_drift_flagged_without_repair");
    else value = connectionReactionFallback(metadata, context);
  }
  if (hasWrongSmileAttribution(value, metadata, context)) {
    value = smileAttributionFallback(metadata, context);
  }
  if (hasWrongMannersAttribution(value, metadata, context)) {
    value = mannersAttributionFallback(metadata);
  }
  if (hasContactWorkingAttributionIssue(value, metadata, context)) {
    value = contactWorkingFallback(metadata);
  }
  if (hasMissedInitialGreeting(value, metadata, context)) {
    if (flagOnlyRepairMode) postprocessFlags.push("missed_initial_greeting_flagged_without_repair");
    else value = initialGreetingFallback(metadata);
  }
  if (hasDelayPressureReply(value, metadata, context)) {
    if (flagOnlyRepairMode) postprocessFlags.push("delay_pressure_reply_flagged_without_repair");
    else value = delayApologyFallback(metadata);
  }
  if (hasLaughToPlanDrift(value, metadata, context)) {
    if (flagOnlyRepairMode) postprocessFlags.push("laugh_to_plan_drift_flagged_without_repair");
    else value = laughConnectionFallback(metadata);
  }
  if (hasIgnoredAudioTranscript(value, metadata, context)) {
    value = audioTranscriptFallback(metadata, context);
  }
  if (hasWeakMeetingConfirmation(value, metadata, context)) {
    value = meetingConfirmationFallback(metadata, context);
  }
  if (hasOverdoneMeetingConfirmation(value, metadata, context)) {
    value = meetingConfirmationFallback(metadata, context);
  }
  if (hasPushAfterCloseOrBoundary(value, metadata, context)) {
    value = closeOrBoundaryFallback(metadata, context);
  }
  if (hasCannedDatePlan(value, metadata, context) && !flagOnlyRepairMode) {
    value = cannedDatePlanFallback(metadata, context) || value;
  } else if (hasCannedDatePlan(value, metadata, context)) {
    postprocessFlags.push("canned_date_plan_flagged_without_fallback");
  }
  if (hasLowPressureFormulaOveruse(value, metadata, context)) {
    if (flagOnlyRepairMode) postprocessFlags.push("low_pressure_formula_overuse_flagged_without_repair");
    else value = stripOverusedLowPressureFormula(value, metadata, context);
  }
  if (repeatedStyleChunkFromHistory(value, metadata, context)) {
    if (flagOnlyRepairMode) postprocessFlags.push("style_formula_recycling_flagged_without_repair");
    else value = stripRepeatedStyleChunk(value, metadata, context);
  }
  value = value
    .replace(/\blisto\s+oro\b/gi, "es oro")
    .replace(/\bjajaja\s+sale,\s*/gi, "jajaja, ")
    .replace(/\bni\s+nada\s+sale,\s*/gi, "ni nada, ")
    .replace(/\bqu[e\u00e9]\s+bueno\s+de\s+que\b/gi, "Qu\u00e9 bueno que")
    .replace(/\ba\s+m[i\u00ed]\s+tambi[e\u00e9]n\s+(?:de\s+)?que\s+te\s+(?:haya\s+)?(?:apeteciera|apetezca|gustara|gustase|molara|molase|encantara|encantase),?\s*/gi, "A m\u00ed tambi\u00e9n me gust\u00f3. ")
    .replace(/\ba\s+m[i\u00ed]\s+tambi[e\u00e9]n\s+(?:de\s+)?que\s+te\s+haya\s+(?:molado|encantado),?\s*/gi, "A m\u00ed tambi\u00e9n me gust\u00f3. ")
    .replace(/\ba\s+m[i\u00ed]\s+tambi[e\u00e9]n\s+de\s+que\s+te\s+haya\s+gustado,?\s*/gi, "A m\u00ed tambi\u00e9n me gust\u00f3. ")
    .replace(/\ba\s+m[i\u00ed]\s+tambi[e\u00e9]n\s+que\s+te\s+haya\s+gustado,?\s*/gi, "A m\u00ed tambi\u00e9n me gust\u00f3. ")
    .replace(/\ba\s+m[i\u00ed]\s+tambi[e\u00e9]n\s+que\s+te\s+haya\s+pasado,?\s*/gi, "A m\u00ed tambi\u00e9n me gust\u00f3. ")
    .replace(/\b(A\s+m[i\u00ed]\s+tambi[e\u00e9]n\s+me\s+gust[o\u00f3]\.?)\s*yo\s+tambi[e\u00e9]n\.?\s*si\s+te\s+apetece,?\s*/gi, "$1 ")
    .replace(/\byo\s+tambi[e\u00e9]n\.?\s*si\s+te\s+apetece,?\s*/gi, "")
    .replace(/^\s*le,\s*pues\s+/i, "")
    .replace(/^\s*le,\s*/i, "")
    .replace(/^\s*pues\s+/i, "")
    .replace(/^\s*tranqui,\s+podemos\b(?=[\s\S]{0,120}\btranqui\b)/i, "Podemos")
    .replace(/\ba\s+m[i\u00ed]\s+tambi[e\u00e9]n\s+que\s+te\s+apetezca,?\s*/gi, "A mi tambien me apetece. ")
    .replace(/\ba\s+m[i\u00ed]\s+tambi[e\u00e9]n\s+de\s+que\s+te\s+haya\s+hecho\s+pensar\b/gi, "Me quede pensando en eso tambien")
    .replace(/\bA\s+mi\s+tambien\s+me\s+gusto\.\s+A\s+mi\s+tambien\s+me\s+/gi, "A m\u00ed tambi\u00e9n me gust\u00f3. Me ")
    .replace(/^(A\s+m[i\u00ed]\s+tambi[e\u00e9]n)[,.\s]+A\s+m[i\u00ed]\s+tambi[e\u00e9]n\s+me\s+/i, "$1 me ")
    .replace(/\.\s+quedamos\b/gi, ". Quedamos")
    .replace(/\.\s+esta\s+semana\b/gi, ". Esta semana")
    .replace(/\bqu[e\u00e9]\s+tomamos\s+algo\b/gi, "tomamos algo")
    .replace(/\bluego\s+ya\s+qu[e\u00e9]\s+apetece\s+hacer\b/gi, "luego vemos que apetece hacer")
    .replace(/\?\s*Apetece\.?$/i, ".")
    .replace(/\s+Apetece\.?$/i, "")
    .replace(/\bte\s+merec[e\u00e9]s\s+un\s+buen\.?$/i, variantKey === "es-AR" ? "te merec\u00e9s un buen descanso" : "te mereces un buen descanso")
    .replace(/\bdescanso\s+bien\s+merecido\b/gi, "descanso merecido")
    .replace(/\bhablamos\s+aqu[i\u00ed]\s+estoy\b/gi, "hablamos. Estoy")
    .replace(/\balgun\b/gi, "alg\u00fan")
    .replace(/\bpuede\s+que\s+nos\s+damos\b/gi, "podemos darnos")
    .replace(/\bcon\s+ganas\s+de\s+seguir\s+haciendo\.?$/gi, "con ganas de seguir intentando")
    .replace(/\bno\s+m[a\u00e1]s\s+cuando\b/gi, "cuando")
    .replace(/\s+vos\s+dale,?\s+qu[e\u00e9]\s+plan\b/gi, "")
    .replace(/\baqu[i\u00ed]\s+estoy\s+piola\s+para\b/gi, "aqui estoy para")
    .replace(/\s+y\.$/i, ".")
    .trim();
  if (normalizeAgentKey(metadata.agent || metadata.tone) === "ligoteo" && /\b(?:demor|tard|perd[o\u00f3]n|perdon|no pude|contestar|responder|ocupad[oa])\b/i.test(textFromContext(context))) {
    value = value
      .replace(/\bno te preocupes,\s*esas cosas pasan,\s*/i, "No pasa nada. ")
      .replace(/,\s*c[o\u00f3]mo va todo\??$/i, ". Cuando puedas seguimos con calma")
      .replace(/\.\s*c[o\u00f3]mo va todo\??$/i, ". Cuando puedas seguimos con calma")
      .trim();
  }
  if (shouldRepairRewriteFidelity(value, metadata, context)) {
    value = faithfulRewriteFallback(metadata, context) || value;
  }
  if (hasLowValueOpening(value, metadata, context) && flagOnlyRepairMode) {
    postprocessFlags.push("low_value_opening_flagged_without_repair");
  } else {
    value = stripLowValueOpening(value, metadata, context);
  }
  if (hasProfessionalCasualTail(value, metadata, context) && flagOnlyRepairMode) {
    postprocessFlags.push("professional_casual_tail_flagged_without_repair");
  } else {
    value = stripProfessionalCasualTail(value, metadata, context);
  }
  if (hasGenericQuestionTail(value, metadata, context) && flagOnlyRepairMode) {
    postprocessFlags.push("generic_question_tail_flagged_without_repair");
  } else {
    value = stripValidationQuestionTail(value);
  }
  if (hasBadPlayfulDoubtResponse(value, metadata, context) && flagOnlyRepairMode) {
    postprocessFlags.push("playful_doubt_bad_closure_flagged_without_repair");
  } else {
    value = repairPlayfulDoubtResponse(value, metadata, context);
  }
  value = repairOwnTurnContactReply(value, metadata);
  if (hasMissedOpportunity(value, metadata, context) && flagOnlyRepairMode) {
    postprocessFlags.push("missed_opportunity_flagged_without_repair");
  } else {
    value = repairMissedOpportunity(value, metadata, context);
  }
  value = value
    .replace(/^\s*le,\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return {
    text: value,
    postprocessFlags,
    repairMode: flagOnlyRepairMode ? "flag_only" : "critical",
    quality: evaluateAiResponse(value, metadata, context)
  };
}

module.exports = {
  PROMPT_VARIANT,
  PROMPT_VARIANT_V1,
  detectMojibake,
  detectDialectWarnings,
  detectSpanishNaturalnessFlags,
  hasRepeatedPhrase,
  shouldReduceRegionality,
  qualityPolicyPrompt,
  evaluateAiResponse,
  applyQualityPostprocess
};
