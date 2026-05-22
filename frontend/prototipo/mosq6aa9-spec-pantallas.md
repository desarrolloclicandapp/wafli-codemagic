# WaFli · Spec funcional de pantallas (V0/V1)

> Spec funcional/UX visual para diseño y maquetación. Layouts ASCII, componentes y comportamiento de cada pantalla.
> **Para arquitectura operativa completa** (entidades P/M/S/F/T/E/R/V/N, reglas, validaciones, flujos críticos): ver [`spec-funcional.md`](./spec-funcional.md).
> Acompaña a [decisiones-producto.md](../decisiones-producto.md).
> Aplica a la web app PWA mobile-first del V0 y se extiende al V1 nativo iOS/Android.
> Última actualización: 2026-05-04 (recalibrado tras decisiones cerradas — sin QR, conversaciones favoritas, copy empático para pausas).

---

## Índice

- [0. Convenciones y arquitectura UI](#0--convenciones-y-arquitectura-ui)
- [1. Onboarding](#1--onboarding)
- [2. App principal · conversaciones](#2--app-principal--conversaciones)
- [3. Generación de sugerencias (núcleo)](#3--generación-de-sugerencias-núcleo)
- [4. Cuota y monetización](#4--cuota-y-monetización)
- [5. Configuración](#5--configuración)
- [6. Push notifications](#6--push-notifications)
- [7. Estados de sistema](#7--estados-de-sistema)
- [8. Decisiones de diseño asumidas (a confirmar)](#8--decisiones-de-diseño-asumidas-a-confirmar)

---

## 0 · Convenciones y arquitectura UI

### 0.1 Stack y plataforma
- Web app PWA mobile-first.
- Breakpoints: `mobile` <768px (default), `tablet` 768-1024px, `desktop` >1024px.
- En desktop la app se centra en columna estilo "móvil ampliado" (max 480px ancho útil) con sidebar opcional. Toda la UX se piensa primero en mobile, desktop es derivado.
- Service worker activo desde primer load (PWA installable).

### 0.2 Navegación principal
- **Mobile**: bottom navigation con 3 ítems fijos:
  1. **Chats** (home — lista de conversaciones)
  2. **Plan** (cuota + facturación)
  3. **Ajustes** (configuración)
- **Desktop**: misma navegación replicada como sidebar izquierda.
- Header superior contextual por pantalla (título + acciones específicas).
- Botón "atrás" disponible en pantallas de detalle (no en pestañas raíz).

### 0.3 Layout global
```
┌─────────────────────┐
│  HEADER (variable)  │  ← título contextual + acción derecha
├─────────────────────┤
│                     │
│   CONTENIDO         │
│                     │
│                     │
├─────────────────────┤
│  CHATS  PLAN  AJUST │  ← bottom nav (mobile)
└─────────────────────┘
```

### 0.4 Componentes compartidos (inventario)
- **Botón primario** (CTA principal, color marca, full-width en mobile).
- **Botón secundario** (outline, mismo tamaño).
- **Botón texto** (sin fondo, link-style).
- **Chip / pill** (selección de tono, variante de español, etiquetas de filtro).
- **Card de conversación** (item de la lista de chats).
- **Bubble de mensaje** (en vista de conversación, distinto estilo para "yo" vs "match").
- **Input de texto** (single line, multiline, con botón inline).
- **Modal bottom sheet** (acción contextual, dismissible con swipe down).
- **Modal full-screen** (procesos largos, onboarding steps).
- **Toast** (feedback efímero arriba o abajo, autocierra en 3s).
- **Loader** (spinner pequeño + skeleton de cards).
- **Snackbar de cuota** (indicador persistente arriba con generaciones restantes).
- **Tooltip** (en desktop hover, en mobile long-press).

### 0.5 Estados globales por pantalla
Toda pantalla con datos debe contemplar:
- **Loading**: skeleton animado (no spinner solo, mejor UX percibida).
- **Empty**: ilustración + texto explicativo + CTA cuando aplique.
- **Error**: mensaje claro + botón "Reintentar".
- **Offline**: banner persistente arriba "Sin conexión, mostrando datos locales".
- **Success**: estado por defecto.

### 0.6 Convención de copy
- Tono cercano, segunda persona ("tú"), sin formalismos.
- Sin emojis decorativos en UI core (sí en sugerencias del LLM si el usuario tiene tono "desenfadado" o "picante").
- Mensajes de error en lenguaje humano, nunca códigos técnicos.

---

## 1 · Onboarding

Flujo lineal de pantallas, una decisión por pantalla. Target: <90s mobile, <60s desktop.

### 1.1 Landing pública
**Propósito**: convertir visita en alta.

**Componentes**:
- Hero: titular + subtitular + CTA primario "Empezar gratis".
- 3 bloques de valor (íconos + frase corta).
- Mini demo visual (mockup de la sugerencia funcionando).
- CTA secundario al final.
- Footer con enlaces a T&C, privacidad, soporte.

**Acciones**:
- Click "Empezar gratis" → 1.2 Registro/Login.
- Click footer → respectiva landing legal (estática).

---

### 1.2 Registro / Login
**Propósito**: identificar al usuario sin fricción.

**Componentes**:
- Selector de método (decisión asumida — ver §8.1):
  - **Email + magic link**: input de email + botón "Enviarme enlace".
  - **Google SSO**: botón "Continuar con Google".
- Toggle "ya tengo cuenta / soy nuevo" — internamente es el mismo flujo (passwordless).
- Texto pequeño: "Al continuar aceptas T&C y política de privacidad" con enlaces.

**Acciones**:
- Submit email → toast "Te hemos enviado un enlace, revisa tu correo" → quedan en pantalla de espera.
- Click magic link en email → vuelve a la app autenticado → redirige a 1.3 si es primera vez, o a 2.1 si ya completó onboarding.
- Click Google SSO → flujo OAuth → redirige igual.

**Edge cases**:
- Email inválido → inline error.
- Enlace caducado (>15 min) → pantalla "Este enlace ha caducado, pídelo de nuevo" con CTA volver a 1.2.

---

### 1.3 Aceptación legal
**Propósito**: cumplimiento + edad.

**Componentes**:
- Título: "Antes de empezar".
- Checkbox 1: "Soy mayor de 18 años".
- Checkbox 2: "He leído y acepto los T&C y la Política de Privacidad" (con enlaces a páginas estáticas que abren en sheet/modal).
- Aviso pequeño: "Al usar este servicio entiendo que la otra persona del chat no ha consentido el procesamiento de sus mensajes por IA. Soy responsable de respetar su privacidad." (consent de minimización GDPR — texto exacto a validar legalmente). El descargo sobre limitaciones temporales de WhatsApp NO se muestra aquí — vive solo en T&C.
- Botón primario "Continuar" (deshabilitado hasta los 2 checkboxes activos).

**Acciones**:
- Continuar → 1.4.
- Click en T&C / Privacidad → modal full-screen con texto + botón cerrar.

---

### 1.4 Variante de español
**Propósito**: calibrar variante regional del LLM.

**Componentes**:
- Título: "¿Cómo hablas?".
- Subtítulo: "Para que las sugerencias suenen como tú".
- Lista de opciones tipo radio o cards seleccionables:
  - 🇪🇸 España
  - 🇲🇽 México
  - 🇦🇷 Argentina
  - 🇨🇱 Chile
  - 🌎 Neutro
- Botón primario "Continuar" (habilitado al elegir).

**Acciones**:
- Selección + continuar → 1.5.
- (Cambiable después en 5.2 Perfil.)

---

### 1.5 Tono base
**Propósito**: calibrar registro emocional del LLM.

**Componentes**:
- Título: "¿Qué tono prefieres por defecto?".
- Subtítulo: "Lo puedes cambiar para cada conversación".
- 4 cards con preview corto:
  - **Relajado** — "Tranqui, sin agobios. ¿Qué tal el finde?"
  - **Desenfadado** — "Eh, qué tal. Llevaba pensando en escribirte 😄"
  - **Picante** — "Estaba pensando en ti… mala idea o buena idea?"
  - **Intelectual** — "Tu última frase me hizo pensar. Cuéntame más."
- Cada card es seleccionable (selección visual clara).
- Botón primario "Continuar".

**Acciones**:
- Selección + continuar → 1.6.

---

### 1.6 Conexión WhatsApp (código universal)
**Propósito**: vincular WhatsApp del usuario mediante código de 8 caracteres. Mismo flujo en mobile y desktop, sin QR.

**Sub-pantalla A · Introducir número**:
- Título: "Conectemos tu WhatsApp".
- Subtítulo breve: "Introduce tu número y te damos un código para vincular".
- Selector de país (default detectado por geo-IP).
- Input numérico para el número.
- Botón primario "Generar código".

**Sub-pantalla B · Mostrar código + tutorial**:
- Título: "Tu código: `ABCD-EFGH`".
- Código en grande, monospace, con botón "Copiar".
- Bloque numerado de pasos:
  1. Abre WhatsApp en tu móvil.
  2. Toca **Configuración** (o **Ajustes** según versión).
  3. Toca **Dispositivos vinculados**.
  4. Toca **Vincular un dispositivo**.
  5. Toca **Vincular con número de teléfono**.
  6. Introduce el código de arriba.
- GIF/video corto del flujo en bucle (uno para iOS, otro para Android, detección automática del visor).
- Indicador inferior: spinner + "Esperando vinculación…".

**Acciones**:
- "Copiar" código → copia al clipboard + toast "Copiado".
- Backend detecta vinculación exitosa → auto-avanza a 1.9.
- Timeout (>3 min sin vincular) → modal "El código ha caducado, ¿generar uno nuevo?".

**Edge cases**:
- Número inválido → inline error.
- Número ya vinculado a otra cuenta WaFli → modal "Este número ya tiene cuenta activa, ¿quieres que la cerremos?" + opciones.
- Backend no responde → toast de error + retry.

**Nota de diseño**: en desktop el usuario lee el código en pantalla y lo introduce en su WhatsApp del móvil. En mobile el usuario abre WhatsApp en el mismo dispositivo. Sin distinción de UI ni de método.

---

### 1.7 — (eliminada · unificada en 1.6)
### 1.8 — (eliminada · unificada en 1.6)

---

### 1.9 Conectado · éxito
**Propósito**: confirmar éxito y dar siguiente paso obvio.

**Componentes**:
- Animación de éxito (checkmark con micro-interacción).
- Título: "¡Conectado!".
- Subtítulo: "Ya podemos leer tus chats y ayudarte a contestar."
- En mobile: card destacada "Añade WaFli a tu pantalla de inicio para usarlo como una app" con botón "Ver cómo" → 1.10.
- En desktop: salta directo a "Ir a mis chats".
- Botón primario "Ir a mis chats" → 2.1.

**Acciones**:
- Continuar → 2.1.
- "Ver cómo" → 1.10.

---

### 1.10 Add to Home Screen (mobile, opcional)
**Propósito**: instalar como PWA (necesario para push notifications en iOS).

**Componentes**:
- Título: "Instálalo como app".
- Subtítulo: "Acceso rápido y notificaciones."
- Tutorial paso a paso con detección iOS vs Android:
  - **iOS Safari**: "Toca el botón compartir → Añadir a pantalla de inicio".
  - **Android Chrome**: "Toca el menú (⋮) → Añadir a pantalla de inicio" o auto-prompt nativo de Chrome.
- GIF/screenshots ilustrativos.
- Botón primario "Listo, lo haré ahora".
- Botón texto "Más tarde" (le saca a 2.1, recordatorio en 24h).

**Acciones**:
- "Listo" → 2.1.
- "Más tarde" → 2.1, set flag para recordar en 24h.

---

## 2 · App principal · conversaciones

### 2.1 Lista de conversaciones (home)
**Propósito**: vista principal post-onboarding. Punto de partida diario.

**Layout**:
```
┌─────────────────────┐
│ Chats          ⋮    │  ← header con menú overflow
│ ⚡ 23 generaciones  │  ← snackbar de cuota
├─────────────────────┤
│ [foto] Nombre Match │
│        Último msg…  │
│        hace 3 min   │
├─────────────────────┤
│ [foto] Nombre Match │
│        Último msg…  │
│        hace 1 h     │
├─────────────────────┤
│        ...          │
├─────────────────────┤
│ Chats  Plan  Ajust  │
└─────────────────────┘
```

**Componentes**:
- Header: título "Chats", icono ⋮ (menú overflow con: refrescar, marcar todo como leído, filtros).
- Snackbar de cuota: persistente arriba bajo el header. Muestra "⚡ N generaciones" en color verde si >25%, ámbar si entre 10-25%, rojo si <10%. Tappable → 4.1.
- Lista virtualizada de cards de conversación, ordenadas por última actividad (más reciente arriba).
- Pull-to-refresh.
- Buscador (icono lupa en header → expande input arriba).

**Card de conversación**:
- Foto de perfil del match (de WhatsApp; si no tiene, iniciales en círculo con color hash).
- Nombre del match.
- **Icono ⭐ visible** si está marcada como favorita.
- Última frase (truncada a 1-2 líneas, "Tú: " prefijo si la mandó el usuario).
- Timestamp relativo ("hace X").
- Badge no leído (count) en la derecha.
- Indicador especial si la conversación lleva >24h sin respuesta del match: pequeño icono ⏳ ámbar.

**Filtros disponibles V0** (desde menú ⋮ overflow del header):
- ⭐ Solo favoritas.
- ✉️ Solo no leídos.
- ⏳ Encalladas (>24h sin respuesta del match).
- 🕐 Recientes (últimas 24h).

**Ordenación**: por última actividad descendente. Las favoritas se mantienen en su posición temporal con su icono ⭐ visible (no se sticky-pin arriba en V0).

**Acciones**:
- Tap en card → 2.2.
- Pull down → refresca lista.
- Long press en card → bottom sheet con:
  - **⭐ Marcar como favorita** / "Quitar de favoritas" (toggle).
  - 🔕 Silenciar notificaciones / "Activar notificaciones" (toggle).
  - 🚫 Excluir de WaFli (no procesa esa conversación; recuperable desde Ajustes → Privacidad → Conversaciones excluidas).
- Tap snackbar de cuota → 4.1.
- Tap menú ⋮ → bottom sheet con: refrescar, marcar todo como leído, **filtros (favoritas/no leídos/encalladas/recientes)**.

**Estados especiales**:
- **Empty**: "Aún no tienes chats activos. Cuando hables con alguien por WhatsApp aparecerán aquí." + ilustración.
- **Conexión WhatsApp interrumpida**: banner ámbar (no rojo) arriba "Reconecta tu WhatsApp · [Reconectar]" → §7.1.
- **Cuota agotada**: el snackbar muestra "⚡ 0" en rojo + tap lleva a 4.2.

---

### 2.2 Vista de conversación
**Propósito**: ver el historial + actuar sobre el último mensaje.

**Layout**:
```
┌─────────────────────┐
│ ← [foto] Nombre  ⋮  │  ← header con back, foto, nombre, menú
├─────────────────────┤
│                     │
│ [bubble] Hola!      │  ← match
│                     │
│      Hola, qué tal? │  ← yo
│                     │
│ [bubble] Bien :)    │  ← match (último)
│                     │
│                     │
├─────────────────────┤
│ ✨ Sugerir respuesta│  ← CTA principal contextual
├─────────────────────┤
│ [Composer expandible│  ← input para escribir manualmente
│  con + opciones]    │
└─────────────────────┘
```

**Componentes**:
- Header: botón atrás, foto + nombre, icono ⋮ (menú con: ver perfil, silenciar, excluir).
- Lista de mensajes: bubbles diferenciados visualmente (yo vs match), timestamps agrupados, separadores de día.
- Indicador de "está escribiendo…" si Baileys lo detecta.
- **CTA principal contextual** justo encima del composer: cambia de etiqueta según estado:
  - Si último mensaje es del match: **"✨ Sugerir respuesta"**.
  - Si conversación vacía (match nuevo): **"✨ Necesito abrir"**.
  - Si último mensaje es del usuario: **"✨ Reescribir lo último"** (acción menos prominente).
- Composer en la parte inferior:
  - Input multilinea expandible.
  - Botón ✨ a la izquierda → menú con opciones IA (sugerir, reescribir, analizar).
  - Botón Enviar a la derecha (solo activo si hay texto).

**Acciones**:
- Tap en CTA principal "Sugerir respuesta" → 3.1.
- Tap en CTA "Necesito abrir" → 3.4.
- Tap en CTA "Reescribir lo último" → 3.2.
- Tap en ✨ del composer → bottom sheet con: "Sugerir respuesta", "Reescribir lo que escribí", "¿Qué quiere decir el último?". Cada opción consume cuota.
- Long press en mensaje del match → bottom sheet con: "¿Qué quiere decir?", "Sugerir respuesta a este" (no al último, a uno antiguo), copiar.
- Long press en mensaje propio → copiar, eliminar (si Baileys lo permite).
- Tap en composer + escribir + enviar → mensaje sale por Baileys, sin pasar por IA.
- Scroll arriba → carga más histórico (paginación bajo demanda desde Baileys).

**Edge cases**:
- Match ha bloqueado al usuario en WhatsApp → bubble informativo "No podemos enviar mensajes a este contacto" + composer deshabilitado.
- Mensaje fallido en envío → marca de error + opción reintentar.
- Conversación con >1000 mensajes → carga inicial solo últimos 50, scroll arriba carga más.

---

### 2.3 Composer (detalle)
**Propósito**: la zona inferior reutilizable que combina input manual + acciones IA.

**Componentes**:
- Input textarea: 1 línea por defecto, crece hasta 6 líneas, scroll si más.
- Counter de caracteres (sutil, solo visible si >800 chars).
- Botón ✨ (IA): siempre visible a la izquierda. Lleva al bottom sheet de acciones IA.
- Botón Enviar: pasivo (gris) si vacío, activo (color marca) si hay texto.
- Si una sugerencia ha sido cargada en el composer: pequeño chip arriba "💡 Sugerencia de IA · [Regenerar] [Descartar]".

**Acciones**:
- Tap "Regenerar" del chip → consume cuota, reemplaza texto.
- Tap "Descartar" del chip → limpia composer.
- Tap Enviar → envía vía Baileys, limpia composer, scroll a último mensaje.

---

## 3 · Generación de sugerencias (núcleo)

Estas pantallas son el corazón del producto. Funcionan como **bottom sheet superpuesto a la conversación** (mobile) o **modal lateral** (desktop), no como pantallas separadas, para que el usuario no pierda contexto.

### 3.1 Sugerir respuesta
**Trigger**: tap en "✨ Sugerir respuesta" desde 2.2.

**Layout** (bottom sheet a 75% altura, dismissible swipe down):
```
┌─────────────────────┐
│      ──────         │  ← drag handle
│ ✨ Sugerencia       │
├─────────────────────┤
│ Tono: [Desenfadado▼]│  ← override del tono base
├─────────────────────┤
│ ┌─────────────────┐ │
│ │                 │ │
│ │  Texto generado │ │  ← textarea editable
│ │  por la IA      │ │
│ │                 │ │
│ └─────────────────┘ │
├─────────────────────┤
│ [Regenerar] [Editar]│  ← acciones secundarias
├─────────────────────┤
│   [   Enviar   ]    │  ← CTA primario full-width
│                     │
│ ⚡ 22 generaciones  │  ← cuota actual
└─────────────────────┘
```

**Componentes**:
- Drag handle arriba.
- Título "✨ Sugerencia".
- Selector de tono (chips horizontales scrollables): muestra el tono base seleccionado por defecto, el usuario puede cambiarlo para esta sugerencia. Cambiar tono regenera (consume cuota).
- Textarea grande con la sugerencia, editable directamente.
- Botones secundarios:
  - **Regenerar**: nueva propuesta misma input + tono. Consume cuota. Reemplaza texto en la textarea.
  - **Editar**: pone foco en la textarea (en mobile, abre teclado).
- Botón primario **Enviar** (full-width): envía vía Baileys el texto actual de la textarea, cierra el sheet.
- Footer: indicador de cuota.

**Estados**:
- **Loading inicial**: skeleton en la textarea + "Pensando…" + animación sutil.
- **Error de generación**: textarea muestra "Algo ha ido mal. [Reintentar]" — no consume cuota si falla.
- **Cuota insuficiente**: en lugar de generar, muestra modal de cuota agotada (4.2).

**Acciones**:
- Cambiar tono → consume 1 generación, regenera.
- Regenerar → consume 1 generación.
- Editar texto → no consume cuota.
- Enviar → mensaje sale por Baileys, cierra sheet, vuelve a 2.2 con el mensaje en el historial.
- Swipe down / tap fuera → cierra sin enviar (sin consumir cuota adicional, pero la generación inicial ya se contó).

**Comportamiento de coste**:
- La carga inicial = 1 generación.
- Cada regenerar (manual o por cambio de tono) = 1 generación adicional.
- Editar manualmente y enviar = 0 generaciones extra.

---

### 3.2 Reescribir lo que escribí
**Trigger**: 
- Tap en CTA "Reescribir lo último" desde 2.2 (cuando el último mensaje es del usuario y se quiere mejorar antes de complementar).
- Más común: tap en ✨ del composer cuando el usuario tiene texto escrito → opción "Reescribir lo que escribí".

**Layout** (bottom sheet, similar a 3.1):
```
┌─────────────────────┐
│      ──────         │
│ ✨ Reescribir       │
├─────────────────────┤
│ Tono: [Picante  ▼]  │
├─────────────────────┤
│ Original (lo tuyo): │
│ ┌─────────────────┐ │
│ │ texto del usuario│ │
│ └─────────────────┘ │
├─────────────────────┤
│ Reescrito:          │
│ ┌─────────────────┐ │
│ │ propuesta IA    │ │
│ └─────────────────┘ │
├─────────────────────┤
│ [Regenerar]         │
│ [   Usar este   ]   │
└─────────────────────┘
```

**Componentes**:
- Original arriba (read-only, pequeño).
- Reescrito abajo (textarea editable).
- Selector de tono (igual que 3.1).
- Regenerar.
- "Usar este" → pone el texto reescrito en el composer (NO envía directamente, deja al usuario revisar). Cierra el sheet.

**Acciones**:
- "Usar este" → cierra sheet, composer queda con el texto, usuario puede seguir editando o enviar.
- Editar reescrito → no consume cuota.
- Regenerar → consume 1.

---

### 3.3 ¿Qué quiere decir? (análisis)
**Trigger**: 
- Long press en un mensaje del match → opción "¿Qué quiere decir?".
- Tap en ✨ del composer → opción "¿Qué quiere decir el último?".

**Layout**:
```
┌─────────────────────┐
│      ──────         │
│ 🔍 Análisis         │
├─────────────────────┤
│ Mensaje analizado:  │
│ ┌─────────────────┐ │
│ │ "frase del match"│ │
│ └─────────────────┘ │
├─────────────────────┤
│ Tono percibido:     │
│ 😏 Coqueto, abierto │
│                     │
│ Lo que parece decir:│
│ Le interesa         │
│ continuar la        │
│ conversación pero   │
│ está testeando si   │
│ tienes interés.     │
│                     │
│ Cómo podrías        │
│ responder:          │
│ Con una respuesta   │
│ que continúe el     │
│ tono y proponga     │
│ algo concreto.      │
├─────────────────────┤
│ [Sugerir respuesta] │  ← cross-link a 3.1
└─────────────────────┘
```

**Componentes**:
- Mensaje analizado (read-only).
- Output estructurado del LLM en 3 bloques: tono percibido (con emoji), interpretación, recomendación de respuesta.
- CTA "Sugerir respuesta" → cierra este sheet, abre 3.1.

**Acciones**:
- Tap en "Sugerir respuesta" → consume 1 generación adicional, abre 3.1.
- Cierra → vuelve a 2.2 sin más acciones.

**Coste**: 1 generación al abrir (no se puede regenerar aquí, es análisis único).

---

### 3.4 Necesito abrir (match nuevo)
**Trigger**: tap en CTA "✨ Necesito abrir" en una conversación vacía desde 2.2.

**Layout** (bottom sheet más alto, 90%):
```
┌─────────────────────┐
│      ──────         │
│ ✨ Apertura         │
├─────────────────────┤
│ ¿Qué sabes de       │
│ [Nombre]?           │
│ ┌─────────────────┐ │
│ │ (opcional)      │ │
│ │ Trabaja en X,   │ │
│ │ le gusta Y...   │ │
│ └─────────────────┘ │
├─────────────────────┤
│ Tono: [Desenfadado▼]│
├─────────────────────┤
│ Aperturas sugeridas:│
│ ○ Opción 1 …        │
│ ○ Opción 2 …        │
│ ○ Opción 3 …        │
├─────────────────────┤
│ [Regenerar todas]   │
│ [   Usar elegida ]  │
└─────────────────────┘
```

**Componentes**:
- Input opcional "¿Qué sabes de [Nombre]?": el usuario puede pegar info del perfil del match (Tinder bio, intereses, etc.) — V1 no procesa imágenes (V2 sí).
- Selector de tono.
- 3 opciones de apertura como radio cards seleccionables.
- "Regenerar todas" → nuevas 3 opciones, consume 1 generación (no 3, porque es 1 prompt).
- "Usar elegida" → pone la apertura seleccionada en el composer (no envía directo, deja revisar).

**Acciones**:
- "Usar elegida" → cierra sheet, composer queda con texto.
- Regenerar → consume 1.

**Coste**: la apertura inicial con 3 opciones = 1 generación. Cada regenerar = 1.

---

## 4 · Cuota y monetización

### 4.1 Pantalla de plan (pestaña "Plan")
**Propósito**: visibilidad de consumo + acción de upgrade/compra.

**Layout**:
```
┌─────────────────────┐
│ Plan                │
├─────────────────────┤
│  Plan: GRATUITO     │
│                     │
│  ┌───────────────┐  │
│  │ ⚡ 22/30      │  │  ← gauge visual
│  │   restantes   │  │
│  │  hoy          │  │
│  └───────────────┘  │
│                     │
│  Se renueva a las   │
│  00:00 (hora local) │
├─────────────────────┤
│ [ Ver planes ]      │
│ [ Comprar bolsa ]   │
├─────────────────────┤
│ Historial de uso ▼  │
└─────────────────────┘
```

**Componentes**:
- Plan actual destacado.
- Gauge visual de cuota restante (semicircular o circular).
- Texto sobre periodo y reset.
- Botón primario "Ver planes" → 4.3.
- Botón secundario "Comprar bolsa" → 4.4.
- Sección colapsable "Historial de uso" con últimas N generaciones (timestamp + tipo: sugerir / reescribir / analizar / abrir).

**Acciones**:
- Ver planes → 4.3.
- Comprar bolsa → 4.4.
- Tap en gauge → drill-down a histórico detallado.

---

### 4.2 Cuota agotada (modal)
**Trigger**: usuario intenta generar y no le queda cuota.

**Layout** (modal full-screen o centrado en desktop):
```
┌─────────────────────┐
│                     │
│       ⚡ 0          │
│                     │
│  Has agotado tus    │
│  generaciones de    │
│  hoy.               │
│                     │
│  Para seguir:       │
│                     │
│  [ Subir a Plan X ] │
│  [ Comprar bolsa ]  │
│  [ Esperar mañana ] │
│                     │
└─────────────────────┘
```

**Componentes**:
- Mensaje claro de bloqueo.
- 3 CTAs en orden de margen para nosotros:
  - "Subir a [tier siguiente]" — más cuota mensual.
  - "Comprar bolsa de N por X€" — pago único.
  - "Esperar a [hora reset]" — cierre del modal sin acción.

**Acciones**:
- Subir → 4.3.
- Comprar → 4.4.
- Esperar → cierra modal, vuelve a la pantalla anterior (la generación no se ejecuta).

---

### 4.3 Selector de plan
**Componentes**:
- Cards comparativas (3 tiers placeholder: Gratis, Plus, Pro).
- Cada card: precio, cuota incluida, features destacadas, CTA "Elegir".
- Toggle mensual/anual con descuento.
- En el plan actual, badge "Plan actual" en lugar de CTA.

**Acciones**:
- "Elegir" → checkout Stripe → 4.5.

---

### 4.4 Comprar bolsa adicional
**Componentes**:
- 2-3 opciones de bolsa (placeholder: 50 / 200 / 500 generaciones, precios proporcionales).
- Cada opción: cantidad, precio, precio por generación destacado.
- CTA "Comprar".

**Acciones**:
- "Comprar" → checkout Stripe → 4.5.

---

### 4.5 Confirmación de pago
**Componentes**:
- Animación éxito + texto "Pago confirmado".
- Resumen: qué compraste, cuota actualizada.
- Botón "Volver a chats" → 2.1.

**Acciones**:
- Backend recibe webhook Stripe → actualiza cuota inmediatamente.
- Si pago falla → modal de error con retry.

---

## 5 · Configuración

### 5.1 Menú principal de ajustes (pestaña "Ajustes")
**Layout**: lista vertical de items con icono + label + chevron derecho.

**Items**:
- Perfil → 5.2
- Plan y facturación → 5.3 (atajo a 4.x)
- Privacidad → 5.4
- Notificaciones → 5.5
- Idioma de la app → 5.6 (decisión asumida §8.3)
- Soporte → 5.7
- Términos legales → 5.8
- Cerrar sesión → confirma + logout

---

### 5.2 Perfil
**Componentes**:
- Email (read-only, mostrado).
- Variante de español → editable, mismo selector que 1.4.
- Tono base por defecto → editable, mismo selector que 1.5.
- Nombre o alias (opcional) → input libre.
- Botón guardar.

**Acciones**:
- Guardar → toast de confirmación + persiste.

---

### 5.3 Plan y facturación
- Atajo a 4.1 + sección de método de pago + facturas descargables.

---

### 5.4 Privacidad
**Componentes**:
- Sección "Datos almacenados": resumen de qué guardamos + link a política completa.
- Toggle "Permitir uso de mis conversaciones para mejorar el modelo" (decisión asumida §8.4 — por defecto OFF, cumplimiento estricto).
- Botón "Descargar mis datos" → backend genera ZIP, envía por email.
- Botón "Borrar todo mi historial" → confirmación → wipe server-side.
- Botón destructivo "Eliminar cuenta" → confirmación doble + desconecta WhatsApp + borra todo.

---

### 5.5 Notificaciones
**Componentes**:
- Toggle global "Permitir notificaciones" (si OFF, dispara permission request del navegador).
- Toggle "Avisar cuando llega un mensaje nuevo".
- Toggle "Avisar de conversaciones encalladas (>24h sin respuesta del match)".
- Toggle "Avisos de cuota".
- Toggle "Novedades del producto".

**Acciones**:
- Cambio en toggle → persistencia inmediata + ajuste en backend.

---

### 5.6 Idioma de la app
- Selector ES / EN / PT (placeholder, V1 solo ES).

---

### 5.7 Soporte
- FAQ (lista expandible con preguntas frecuentes).
- Contacto: email + form de contacto (V0 reactivo, V1 puede tener chat).
- Estado del servicio (link a status page externa o widget).

---

### 5.8 Términos legales
- Lista a: T&C, Política de Privacidad, Política de Cookies, DPA.

---

## 6 · Push notifications

### 6.1 Permission prompt
**Trigger**: 
- Después de 1.10 (Add to Home Screen) si el usuario instaló como PWA.
- O al activar toggle en 5.5 si no se concedió antes.
- Nunca en el primer load (se hace después de un momento de valor para mejorar tasa de aceptación).

**Componentes**:
- Modal pre-prompt explicativo (ANTES del prompt nativo del navegador):
  - Título: "¿Te avisamos de nuevos mensajes?".
  - Bullets: "Cuando un match te escriba", "Cuando una conversación se enfríe", "Avisos de cuota".
  - Botón "Sí, activar" → dispara permission request nativo.
  - Botón "Más tarde" → cierra, recordatorio en 7 días.

**Acciones**:
- "Sí, activar" → permission API → si granted, registrar service worker subscription en backend.
- "Más tarde" → set flag.
- Si denied → no insistir hasta que el usuario lo active en 5.5 manualmente.

---

### 6.2 Tipos de notificación
- **Mensaje nuevo**: "Nombre te ha escrito" + preview corto.
- **Conversación encallada**: "Llevas 24h sin contestar a Nombre. ¿Te ayudamos?".
- **Cuota baja (10%)**: "Te quedan N generaciones hoy".
- **Cuota agotada**: "Has agotado tu cuota diaria".

---

### 6.3 Click en notificación
- Mensaje nuevo / encallada → abre directo a 2.2 de esa conversación.
- Cuota → abre 4.1.

---

## 7 · Estados de sistema

### 7.1 Conexión WhatsApp interrumpida
**Trigger**: backend detecta que la sesión interna ha caducado o fallado.

**Componentes**:
- Banner persistente **ámbar (no rojo)** arriba en 2.1: "Reconecta tu WhatsApp · [Reconectar]".
- Tap "Reconectar" → flujo 1.6 sin onboarding previo.
- Push notification opcional inmediata si app cerrada.

**Tono**: neutro y operativo, no alarmista.

---

### 7.2 Conexión pausada temporalmente
**Trigger**: backend detecta señal específica de pausa por parte de WhatsApp.

**Componentes** — **tono empático, sin infundir miedo**:
- Pantalla full-screen modal con:
  - Título: "WhatsApp ha pausado tu conexión un rato".
  - Texto: "Es algo puntual, suele restablecerse solo en unas horas. Te avisamos cuando vuelva. Mientras tanto puedes seguir leyendo tus chats."
  - Sin tiempo estimado específico (no prometemos lo que no sabemos).
  - Botón "Entendido" → cierra modal. Sin toast persistente.
- Cuando backend detecta restablecimiento → push notification "Ya puedes volver a usar WaFli".

**Tono crítico**: NO usar palabras como "bloqueado", "Meta", "ban", "suspendido". Lenguaje siempre del lado de WhatsApp ("WhatsApp ha pausado"), no del producto. Comunica puntualidad y externalidad, no fallo del producto.

---

### 7.3 Sin conexión a internet
- Banner amarillo persistente: "Sin conexión a internet".
- App muestra histórico cacheado, no permite generar.
- Composer deshabilitado para envío.

---

### 7.4 Error genérico
- Toast rojo con mensaje + botón "Reintentar".
- Logging anónimo a backend para detectar patrones.

---

### 7.5 Mantenimiento programado
- Modal full-screen con: razón + duración + countdown.
- App bloqueada hasta que termine.

---

## 8 · Decisiones de diseño (cerradas tras conversación CEO 2026-05-04)

Decisiones que en versiones anteriores estaban "asumidas" y ahora están confirmadas. Se mantienen documentadas aquí para trazabilidad.

| # | Decisión | Estado |
|---|---|---|
| 8.1 | **Auth en V0 = solo magic link** (sin Google ni Apple SSO en V0; ambos en V1) | ✅ Cerrada |
| 8.2 | **Filtros completos en P030 V0**: favoritas, no leídos, encalladas, recientes | ✅ Cerrada |
| 8.3 | **Idioma app y variante de español separados** (UI ES/EN/PT vs output regional) | ✅ Cerrada |
| 8.4 | **Toggle training opt-in** existe en 5.4 por defecto OFF · **anonimización siempre ON backend** sin toggle al usuario | ✅ Cerrada |
| 8.5 | **Sugerencia de respuesta = 1 propuesta + regenerar** (no 3 a la vez) | ✅ Cerrada |
| 8.6 | **Apertura match nuevo = 3 opciones** (excepción justificada por incertidumbre alta) | ✅ Cerrada |
| 8.7 | **Bottom sheet para acciones IA**, no pantalla separada | ✅ Cerrada |
| 8.8 | **Pantalla "ver excluidas" en V0** (P052a) — decisión cambiada del default original | ✅ Cerrada |
| 8.9 | **Cuota se cuenta por llamada al LLM**, no por sugerencia mostrada | ✅ Cerrada |
| 8.10 | **Sin tour interactivo post-conexión** — aprender haciendo + tooltip contextual primera vez en 2.2 | ✅ Cerrada |
| 8.11 | **PWA mobile-first** (Chrome/Safari) + desktop. Sin extensión navegador, sin escritorio nativo | ✅ Cerrada |
| 8.12 | **Conversaciones favoritas** en V0 (S005, ⭐ visible en card) | ✅ Cerrada |
| 8.13 | **Sin QR en ningún dispositivo** — código universal de 8 caracteres en mobile y desktop | ✅ Cerrada |
| 8.14 | **Copy de pausas temporales WhatsApp**: tono empático, sin alarma. Descargo solo en T&C | ✅ Cerrada |

Para decisiones que quedan abiertas (pricing avanzado, marca visual, copy legal exacto), ver [`spec-funcional.md`](./spec-funcional.md) Apéndice C y [`../decisiones-producto.md`](../decisiones-producto.md) §4.

---

## Apéndice A · Pantallas/flujos NO incluidos en este spec (V2+)

- Análisis multimodal de foto/perfil del match.
- Voz clonada / mensajes de audio generados.
- Modo coach educativo (mini-curso).
- Comunidad / social features.
- Integración con calendarios para proponer planes.
- Insights agregados multi-match.
- App nativa iOS/Android (es derivada de este spec, no contradictoria).

---

## Apéndice B · Inventario rápido de pantallas (mapa)

```
ONBOARDING (10)
├─ 1.1 Landing
├─ 1.2 Registro/Login
├─ 1.3 Aceptación legal
├─ 1.4 Variante español
├─ 1.5 Tono base
├─ 1.6 Conexión WhatsApp · selector
├─ 1.7 Conexión · pairing code
├─ 1.8 Conexión · QR
├─ 1.9 Conectado
└─ 1.10 Add to Home Screen

APP PRINCIPAL (3)
├─ 2.1 Lista conversaciones
├─ 2.2 Vista conversación
└─ 2.3 Composer (componente, no pantalla)

GENERACIÓN IA (4)
├─ 3.1 Sugerir respuesta
├─ 3.2 Reescribir
├─ 3.3 ¿Qué quiere decir?
└─ 3.4 Necesito abrir

CUOTA / PAGO (5)
├─ 4.1 Pantalla de plan
├─ 4.2 Cuota agotada
├─ 4.3 Selector plan
├─ 4.4 Comprar bolsa
└─ 4.5 Confirmación pago

CONFIGURACIÓN (8)
├─ 5.1 Menú ajustes
├─ 5.2 Perfil
├─ 5.3 Plan y facturación (atajo)
├─ 5.4 Privacidad
├─ 5.5 Notificaciones
├─ 5.6 Idioma app
├─ 5.7 Soporte
└─ 5.8 Legales

PUSH (3)
├─ 6.1 Permission prompt
├─ 6.2 Tipos
└─ 6.3 Click handler

SISTEMA (5)
├─ 7.1 WhatsApp desconectado
├─ 7.2 Bloqueado por Meta
├─ 7.3 Sin conexión
├─ 7.4 Error genérico
└─ 7.5 Mantenimiento

TOTAL: 38 pantallas/estados
```
