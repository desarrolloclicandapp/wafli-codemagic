import React from 'react';
import QRCode from 'qrcode';
const { Icons, WaFliAPI, Avatar, AppHeader, IconButton, BottomNav, QuotaPill, BottomSheet, FullModal, EmptyState, Toast, StatusBar } = window;
const LOCAL_CONVERSATIONS = [];
const SHOW_SETTINGS_LANGUAGE_SELECTOR = true;
const COUNTRY_PREFIX_OPTIONS = [
  ['+595 PY', 'Paraguay (+595)'],
  ['+54 AR', 'Argentina (+54)'],
  ['+591 BO', 'Bolivia (+591)'],
  ['+55 BR', 'Brasil (+55)'],
  ['+56 CL', 'Chile (+56)'],
  ['+57 CO', 'Colombia (+57)'],
  ['+506 CR', 'Costa Rica (+506)'],
  ['+53 CU', 'Cuba (+53)'],
  ['+593 EC', 'Ecuador (+593)'],
  ['+503 SV', 'El Salvador (+503)'],
  ['+34 ES', 'España (+34)'],
  ['+502 GT', 'Guatemala (+502)'],
  ['+504 HN', 'Honduras (+504)'],
  ['+52 MX', 'México (+52)'],
  ['+505 NI', 'Nicaragua (+505)'],
  ['+507 PA', 'Panamá (+507)'],
  ['+51 PE', 'Perú (+51)'],
  ['+1 PR', 'Puerto Rico (+1)'],
  ['+1 DO', 'República Dominicana (+1)'],
  ['+598 UY', 'Uruguay (+598)'],
  ['+58 VE', 'Venezuela (+58)'],
  ['+1 US', 'Estados Unidos (+1)'],
  ['+1 CA', 'Canadá (+1)'],
  ['+44 GB', 'Reino Unido (+44)'],
  ['+33 FR', 'Francia (+33)'],
  ['+49 DE', 'Alemania (+49)'],
  ['+39 IT', 'Italia (+39)'],
  ['+351 PT', 'Portugal (+351)']
];

const SPANISH_VARIANT_OPTIONS = [
  { id: 'España', badge: 'ES', title: 'España', sample: 'Natural de España, claro y directo sin sonar forzado.' },
  { id: 'México', badge: 'MX', title: 'México', sample: 'Cercano, cálido y cotidiano sin exceso de modismos.' },
  { id: 'Argentina', badge: 'AR', title: 'Argentina', sample: 'Suelto, conversado y con voseo cuando encaja.' },
  { id: 'Chile', badge: 'CL', title: 'Chile', sample: 'Breve, cotidiano y aterrizado sin exagerar localismos.' },
  { id: 'Paraguay', badge: 'PY', title: 'Paraguay', sample: 'Cálido, directo y natural sin forzar jopará.' },
  { id: 'Uruguay', badge: 'UY', title: 'Uruguay', sample: 'Cercano, rioplatense suave y sin copiar otros tonos.' },
  { id: 'Colombia', badge: 'CO', title: 'Colombia', sample: 'Amable, claro y cálido sin sonar ceremonioso.' },
  { id: 'Perú', badge: 'PE', title: 'Perú', sample: 'Cordial, simple y natural para chat real.' },
  { id: 'Venezuela', badge: 'VE', title: 'Venezuela', sample: 'Cercano y expresivo, con energía moderada.' },
  { id: 'Ecuador', badge: 'EC', title: 'Ecuador', sample: 'Amable, cotidiano y fácil de entender.' },
  { id: 'Bolivia', badge: 'BO', title: 'Bolivia', sample: 'Respetuoso, cálido y directo sin rigidez.' },
  { id: 'Costa Rica', badge: 'CR', title: 'Costa Rica', sample: 'Tranquilo, amable y cercano.' },
  { id: 'República Dominicana', badge: 'DO', title: 'República Dominicana', sample: 'Espontáneo y cercano sin escribir el acento.' },
  { id: 'Panamá', badge: 'PA', title: 'Panamá', sample: 'Claro, cercano y compatible con chat cotidiano.' },
  { id: 'Guatemala', badge: 'GT', title: 'Guatemala', sample: 'Amable, prudente y natural.' },
  { id: 'El Salvador', badge: 'SV', title: 'El Salvador', sample: 'Cercano, claro y sin frases estereotipadas.' },
  { id: 'Honduras', badge: 'HN', title: 'Honduras', sample: 'Amable, directo y cotidiano.' },
  { id: 'Nicaragua', badge: 'NI', title: 'Nicaragua', sample: 'Natural, cercano y respetuoso.' },
  { id: 'Cuba', badge: 'CU', title: 'Cuba', sample: 'Cálido y expresivo con moderación.' },
  { id: 'Puerto Rico', badge: 'PR', title: 'Puerto Rico', sample: 'Cálido y cotidiano sin forzar spanglish.' },
  { id: 'Hispanos en Estados Unidos', badge: 'US', title: 'Hispanos en Estados Unidos', sample: 'Bicultural solo si el contexto ya lo pide.' },
  { id: 'Neutro', badge: 'ES', title: 'Neutro', sample: 'Español claro si prefieres evitar localismos.' },
];
function CountryPrefixSelect({ value, onChange, style = {} }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} style={style}>
      {COUNTRY_PREFIX_OPTIONS.map(([optionValue, label]) => (
        <option key={`${optionValue}-${label}`} value={optionValue}>{label}</option>
      ))}
    </select>
  );
}

function sanitizePhoneInput(rawPhone, options = {}) {
  const allowPlus = options.allowPlus !== false;
  const compact = String(rawPhone || '').replace(/\s+/g, '');
  const hasLeadingPlus = allowPlus && compact.startsWith('+');
  const digits = compact.replace(/\D/g, '').slice(0, 15);
  return hasLeadingPlus ? `+${digits}` : digits;
}

function phoneDigits(rawPhone) {
  return String(rawPhone || '').replace(/\D/g, '');
}

function pickCountryOptionByIso(isoCode = "") {
  const safeCode = String(isoCode || '').trim().toUpperCase();
  const match = COUNTRY_PREFIX_OPTIONS.find(([optionValue]) => String(optionValue).toUpperCase().endsWith(` ${safeCode}`));
  return match ? match[0] : null;
}

function pickCountryOptionByPhone(rawPhone = "") {
  const digits = phoneDigits(rawPhone);
  if (!digits) return null;
  const match = [...COUNTRY_PREFIX_OPTIONS]
    .map(([optionValue, label]) => ({ optionValue, label, prefix: phoneDigits(String(optionValue).split(' ')[0]) }))
    .filter(item => item.prefix && digits.startsWith(item.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match ? match.optionValue : null;
}

function buildPhonePlaceholder(countryValue) {
  const prefix = String(countryValue || COUNTRY_PREFIX_OPTIONS[0][0]).split(' ')[0];
  const samples = {
    '+595': '981234567',
    '+54': '91123456789',
    '+591': '71234567',
    '+55': '11987654321',
    '+56': '912345678',
    '+57': '3001234567',
    '+506': '61234567',
    '+53': '51234567',
    '+593': '991234567',
    '+503': '71234567',
    '+34': '612345678',
    '+502': '51234567',
    '+504': '91234567',
    '+52': '5512345678',
    '+505': '81234567',
    '+507': '61234567',
    '+51': '912345678',
    '+1': '2025550123',
    '+598': '91234567',
    '+58': '4121234567',
    '+44': '7400123456',
    '+33': '612345678',
    '+49': '15123456789',
    '+39': '3123456789',
    '+351': '912345678',
  };
  return `Ej. ${samples[prefix] || '981234567'}`;
}

function sanitizeLocalPhoneInput(rawPhone, countryValue) {
  const clean = sanitizePhoneInput(rawPhone);
  const selectedPrefix = phoneDigits(String(countryValue || COUNTRY_PREFIX_OPTIONS[0][0]).split(' ')[0]);
  const digits = phoneDigits(clean);
  if (clean.startsWith('+') && selectedPrefix && digits.startsWith(selectedPrefix)) {
    return digits.slice(selectedPrefix.length).slice(0, 15);
  }
  if (!clean.startsWith('+') && selectedPrefix && digits.length > selectedPrefix.length + 3 && digits.startsWith(selectedPrefix)) {
    return digits.slice(selectedPrefix.length).slice(0, 15);
  }
  return clean;
}

const CHAT_LIST_LIMIT = 60;
const CONTACT_SEARCH_LIMIT = 20;
const CONTACT_SEARCH_MIN_LENGTH = 2;
const MANUAL_AI_CHAT_ID = 'wafli-ai-manual';
const MANUAL_AI_CONTEXT_STORAGE_KEY = 'wafli:manualAiContext';
const MANUAL_AI_CONTEXT_EVENT = 'wafli:manual-ai-context-updated';

function isManualAiChatId(id) {
  return String(id || '').trim() === MANUAL_AI_CHAT_ID;
}

function normalizeManualAiContext(source = {}) {
  const ctx = source && typeof source === 'object' ? source : {};
  return {
    message: String(ctx.message || ctx.messageToReply || '').trim(),
    additionalContext: String(ctx.additionalContext || ctx.context || '').trim(),
    captureName: String(ctx.captureName || '').trim(),
    updatedAt: ctx.updatedAt || null,
  };
}

function loadManualAiContext() {
  if (typeof window === 'undefined') return normalizeManualAiContext();
  try {
    return normalizeManualAiContext(JSON.parse(localStorage.getItem(MANUAL_AI_CONTEXT_STORAGE_KEY) || '{}'));
  } catch (_) {
    return normalizeManualAiContext();
  }
}

function saveManualAiContext(context = {}) {
  if (typeof window === 'undefined') return normalizeManualAiContext(context);
  const next = normalizeManualAiContext({ ...context, updatedAt: new Date().toISOString() });
  localStorage.setItem(MANUAL_AI_CONTEXT_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(MANUAL_AI_CONTEXT_EVENT, { detail: next }));
  return next;
}

function clearManualAiContext() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(MANUAL_AI_CONTEXT_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(MANUAL_AI_CONTEXT_EVENT, { detail: normalizeManualAiContext() }));
}

function createManualAiChat(context = {}) {
  const manualContext = normalizeManualAiContext(context);
  return {
    id: MANUAL_AI_CHAT_ID,
    canonicalChatId: MANUAL_AI_CHAT_ID,
    name: 'WaFli AI',
    phone: '',
    avatar: '',
    last: manualContext.message ? `mensaje: ${manualContext.message.slice(0, 80)}` : 'genera respuestas sin conectar whatsapp',
    time: '',
    unread: 0,
    muted: false,
    excluded: false,
    favorite: false,
    hasConversation: true,
    manualAi: true,
  };
}

function manualAiQuotedMessage(context = {}) {
  const manualContext = normalizeManualAiContext(context);
  if (!manualContext.message) return null;
  return {
    id: 'manual-ai-message',
    chatId: MANUAL_AI_CHAT_ID,
    sender: 'match',
    fromMe: false,
    authorName: 'contacto',
    messageType: 'text',
    type: 'text',
    text: manualContext.message,
    body: manualContext.message,
    sentAt: manualContext.updatedAt || new Date().toISOString(),
  };
}

function manualAiMediaContext(context = {}) {
  const manualContext = normalizeManualAiContext(context);
  if (!manualContext.captureName) return null;
  return `captura de conversación adjunta: ${manualContext.captureName}. Usa solo detalles descritos por el usuario; no inventes contenido visual.`;
}

function manualAiUserContext(context = {}) {
  const manualContext = normalizeManualAiContext(context);
  return [
    manualContext.additionalContext ? `contexto adicional manual: ${manualContext.additionalContext}` : '',
    manualContext.captureName ? `el usuario añadió una captura llamada "${manualContext.captureName}".` : '',
  ].filter(Boolean).join('\n');
}

function chatIdentityValue(item) {
  return String(item?.canonicalChatId || item?.id || '').trim().toLowerCase();
}

function isSystemChatId(id) {
  const value = String(id || '').trim().toLowerCase();
  return !value || value === 'status@broadcast' || value.endsWith('@newsletter');
}

function isLidOnlyItem(item) {
  const id = chatIdentityValue(item);
  const name = String(item?.name || '').trim().toLowerCase();
  return id.endsWith('@lid') && !item?.phone && (!name || name.endsWith('@lid'));
}

function isUsefulConversationItem(item) {
  const id = chatIdentityValue(item);
  const hasActiveConversation = Boolean(item?.hasConversation || item?.last || item?.time || Number(item?.unread || 0));
  if (isSystemChatId(id) || (isLidOnlyItem(item) && !hasActiveConversation)) return false;
  if (id.endsWith('@g.us') && !item?.last && !item?.time && !Number(item?.unread || 0)) return false;
  return true;
}

function isUsefulContactSuggestion(item) {
  const id = chatIdentityValue(item);
  if (isSystemChatId(id) || id.endsWith('@lid')) return false;
  if (id.endsWith('@g.us') && !item?.hasConversation) return false;
  return true;
}

function phoneWithCountryPrefix(rawPhone, countryValue) {
  const clean = sanitizePhoneInput(rawPhone);
  if (!clean) return '';
  if (clean.startsWith('+')) return `+${phoneDigits(clean).slice(0, 15)}`;
  const prefix = String(countryValue || COUNTRY_PREFIX_OPTIONS[0][0]).split(' ')[0];
  return `${prefix}${phoneDigits(clean)}`;
}

function isValidPhoneInput(rawPhone, countryValue) {
  const digits = phoneDigits(phoneWithCountryPrefix(rawPhone, countryValue));
  return digits.length >= 7 && digits.length <= 15;
}
// screens.jsx - All WaFli screens

// SCREEN 1 · Landing pública
function LandingScreen({ onStart, onLogin }) {
  const legalLinkStyle = {
    height: 'auto',
    padding: 0,
    fontSize: 12,
    color: 'var(--text-secondary)',
    textDecoration: 'none',
  };
  return (
    <div className="scroll-y" style={{background: 'var(--bg)'}}>
      <div style={{padding: '24px 22px 10px'}}>
        <div className="row" style={{justifyContent: 'space-between', alignItems: 'center'}}>
          <div className="row gap-2" style={{alignItems: 'center'}}>
            <Icons.Logo size={22} />
            <span style={{fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em'}}>WaFli</span>
          </div>
          <button className="btn btn--text" style={{fontSize: 14}} onClick={onLogin}>Entrar</button>
        </div>
      </div>

      {/* Hero */}
      <div style={{padding: '32px 22px 24px'}}>
        <div style={{display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 'var(--r-pill)', fontSize: 12, fontWeight: 500, marginBottom: 18}}>
          <Icons.Sparkles size={12} sw={2} /> IA para responder mejor
        </div>
        <h1 style={{fontSize: 38, lineHeight: 1.05, fontWeight: 600, letterSpacing: '-0.03em', margin: '0 0 16px'}}>
          Sabe qué decir cuando tú no.
        </h1>
        <p style={{fontSize: 17, lineHeight: 1.45, color: 'var(--text-secondary)', margin: '0 0 28px', textWrap: 'pretty'}}>
          Entiende el contexto, prepara una respuesta editable y tú decides qué enviar. En tu español.
        </p>
        <button className="btn btn--primary btn--full" onClick={onStart}>Empezar gratis</button>
        <p className="t-caption" style={{textAlign: 'center', marginTop: 12}}>Plan Free incluido. Puedes ampliar cuando necesites más generaciones.</p>
      </div>

      {/* Vista de producto */}
      <div style={{padding: '16px 22px 36px'}}>
        <div style={{
          background: 'linear-gradient(180deg, var(--accent-softer) 0%, var(--gray-50) 100%)',
          borderRadius: 20,
          padding: '24px 14px 0',
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            background: 'var(--bg)',
            borderRadius: '14px 14px 0 0',
            padding: 14,
            boxShadow: '0 -2px 20px rgba(91, 95, 224, 0.08)',
            border: '1px solid var(--border)',
            borderBottom: 'none',
          }}>
            <div className="row gap-2" style={{marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)'}}>
              <Avatar name="Clara" size={32} />
              <span style={{fontWeight: 600, fontSize: 14}}>Clara</span>
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
              <div style={{alignSelf: 'flex-start', background: 'var(--gray-100)', padding: '8px 12px', borderRadius: '14px 14px 14px 4px', fontSize: 13, maxWidth: '82%', lineHeight: 1.4}}>Me ha gustado verte hoy, pero me he quedado con ganas de hablar más contigo.</div>
              <div style={{
                marginTop: 8,
                background: 'var(--bg)',
                border: '1.5px solid var(--accent)',
                borderRadius: 12,
                padding: 12,
                boxShadow: '0 4px 14px rgba(91, 95, 224, 0.18)',
              }}>
                <div className="row gap-1" style={{color: 'var(--accent)', fontSize: 11, fontWeight: 600, marginBottom: 6, letterSpacing: '0.02em', textTransform: 'uppercase'}}>
                  <Icons.Sparkles size={11} sw={2} /> Sugerencia de WaFli
                </div>
                <div style={{fontSize: 13, lineHeight: 1.45}}>A mí también me ha gustado. Si te apetece, podemos tomar algo esta semana y seguimos la conversación con calma.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3 value blocks */}
      <div style={{padding: '0 22px 40px', display: 'flex', flexDirection: 'column', gap: 24}}>
        {[
          { icon: <Icons.Globe size={22} />, t: 'En tu español de verdad', s: 'Castizo, andaluz, mexicano, argentino. Sin sonar a manual.' },
          { icon: <Icons.Phone size={22} />, t: 'Sin copiar y pegar', s: 'Conecta tu WhatsApp. Tus chats, aquí.' },
          { icon: <Icons.Check size={22} />, t: 'Tú decides siempre', s: 'WaFli sugiere, tú envías. Nunca manda nada por su cuenta.' },
        ].map((v, i) => (
          <div key={i} style={{display: 'flex', gap: 14, alignItems: 'flex-start'}}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'var(--accent-softer)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>{v.icon}</div>
            <div className="col gap-1">
              <span style={{fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em'}}>{v.t}</span>
              <span className="t-small" style={{color: 'var(--text-secondary)', textWrap: 'pretty'}}>{v.s}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Cómo funciona */}
      <div style={{padding: '24px 22px 36px', background: 'var(--gray-50)', borderTop: '1px solid var(--border)'}}>
        <h2 className="t-h2" style={{margin: '0 0 24px'}}>Cómo funciona</h2>
        <div style={{display: 'flex', flexDirection: 'column', gap: 22}}>
          {[
            { n: '01', t: 'Conecta tu WhatsApp', s: 'Vinculación guiada con código de 8 caracteres. Te explicamos cada paso.' },
            { n: '02', t: 'Abre cualquier chat', s: 'Verás tus conversaciones tal cual están, sin nada nuevo encima.' },
            { n: '03', t: 'Pide una sugerencia', s: 'WaFli te propone qué decir. Tú lo lees, lo editas o lo envías.' },
          ].map(s => (
            <div key={s.n} style={{display: 'flex', gap: 16}}>
              <span className="t-mono" style={{fontSize: 13, fontWeight: 500, color: 'var(--accent)', paddingTop: 2, minWidth: 24}}>{s.n}</span>
              <div className="col gap-1">
                <span style={{fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em'}}>{s.t}</span>
                <span className="t-small" style={{color: 'var(--text-secondary)'}}>{s.s}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA secundario */}
      <div style={{padding: '36px 22px 24px', textAlign: 'center'}}>
        <h2 className="t-h2" style={{margin: '0 0 8px'}}>¿Listo para probarlo?</h2>
        <p className="t-small" style={{color: 'var(--text-secondary)', margin: '0 0 20px'}}>Empieza ahora. WhatsApp se puede conectar despues.</p>
        <button className="btn btn--primary btn--full" onClick={onStart}>Empezar gratis</button>
      </div>

      {/* Footer */}
      <div style={{padding: '20px 22px 32px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <span className="t-caption">(c) WaFli 2026</span>
        <div className="row gap-4" style={{flexWrap: 'wrap', justifyContent: 'flex-end'}}>
          <a style={legalLinkStyle} href="/terms.html">Términos</a>
          <a style={legalLinkStyle} href="/privacy.html">Privacidad</a>
          <a style={legalLinkStyle} href="/account-deletion.html">Eliminar datos</a>
          <a style={legalLinkStyle} href="/cookies.html">Cookies</a>
          <a style={legalLinkStyle} href="/faq.html">FAQ</a>
          <a style={legalLinkStyle} href="mailto:soporte@wafli.ai">Soporte</a>
        </div>
      </div>
    </div>
  );
}

const LEGAL_DOCUMENTS = {
  terms: {
    title: 'Términos y Condiciones',
    eyebrow: 'Documento de uso del servicio',
    updated: 'Última actualización: mayo 2026',
    intro: 'Estos términos explican las reglas para usar WaFli como copiloto de conversación. Al crear una cuenta o continuar usando la app, aceptas estos términos y nuestra Política de Privacidad.',
    sections: [
      ['1. Contacto', 'Para soporte, privacidad o consultas legales puedes escribir a soporte@wafli.ai.'],
      ['2. Qué es WaFli', 'WaFli es un asistente de conversación: muestra chats que tú conectas, analiza contexto reciente cuando lo solicitas y genera borradores editables. WaFli no es una red social, no ofrece citas, no decide por ti y no envía mensajes automáticamente.'],
      ['3. Edad mínima', 'WaFli está pensado para personas adultas. Solo puedes usar la app si tienes al menos 18 años o la mayoría de edad aplicable en tu jurisdicción, la que sea mayor.'],
      ['4. Responsabilidad sobre tus conversaciones', 'Debes tener derecho o base legítima para conectar, visualizar y procesar tus conversaciones. Eres responsable de respetar privacidad, consentimiento, derechos de terceros y normas de las plataformas que uses.'],
      ['5. Conexión con WhatsApp', 'La conexión con WhatsApp depende de servicios y condiciones de terceros, puede pausarse, fallar o requerir reconexión. No debes usar WaFli para spam, mensajería masiva, automatización no autorizada, suplantación o cualquier uso prohibido por WhatsApp.'],
      ['6. Contenido generado por IA', 'Las respuestas generadas por IA son borradores. Pueden ser incorrectas, incompletas, ofensivas o no adecuadas al contexto. Siempre debes revisar y editar cualquier texto antes de copiarlo o enviarlo.'],
      ['7. Usos prohibidos', 'No debes usar WaFli para acoso, amenazas, manipulación, odio, violencia, fraude, phishing, spam, suplantación, vigilancia abusiva, scraping, extracción masiva de datos o cualquier actividad ilegal o dañina.'],
      ['8. Sin consejos profesionales', 'WaFli no ofrece asesoramiento legal, médico, psicológico, financiero ni de seguridad personal. Si una conversación implica riesgo, emergencia, acoso, violencia, autolesión o una situación sensible, busca ayuda profesional o servicios de emergencia.'],
      ['9. Cuotas, planes y pagos', 'Las cuotas de IA se consumen al generar, regenerar, reescribir o reactivar conversaciones. En web los pagos pueden procesarse mediante Stripe. En apps distribuidas por App Store o Google Play, las compras digitales deben usar los sistemas de pago requeridos por cada tienda cuando corresponda.'],
      ['10. Privacidad y eliminación', 'El tratamiento de datos se describe en la Política de Privacidad. Puedes solicitar exportación, borrar historial en caché, desconectar tu WhatsApp y solicitar eliminación de cuenta desde Ajustes o mediante el recurso público de eliminación.'],
      ['11. Suspensión o limitación', 'Podemos limitar, suspender o cancelar acceso si detectamos abuso, riesgo de seguridad, incumplimiento legal, violación de estos términos o uso que pueda dañar a WaFli, a terceros o a plataformas conectadas.'],
      ['12. Cambios y disponibilidad', 'WaFli puede cambiar funciones, precios, límites, proveedores o disponibilidad. Haremos esfuerzos razonables por mantener el servicio, pero no garantizamos disponibilidad continua ni resultados concretos de la IA.'],
    ],
  },
  privacy: {
    title: 'Política de Privacidad',
    eyebrow: 'Tratamiento de datos en WaFli',
    updated: 'Última actualización: mayo 2026',
    intro: 'Esta política explica qué datos trata WaFli, para qué los usa, con quién puede compartirlos y qué controles tienes sobre tu información.',
    sections: [
      ['1. Contacto de privacidad', 'Para consultas de privacidad puedes escribir a soporte@wafli.ai.'],
      ['2. Datos de cuenta', 'Tratamos datos como correo electrónico, identificadores internos de usuario, sesión, inicio de sesión social, preferencias, idioma, tono, estado de onboarding y aceptación legal.'],
      ['3. Datos de conversaciones', 'Cuando conectas WhatsApp, WaFli puede procesar chats, mensajes recientes, metadatos de conversación, estado de lectura, archivos o medios recientes y datos técnicos necesarios para mostrar la app y generar sugerencias.'],
      ['4. IA y contexto', 'WaFli envía datos a OpenAI, proveedor externo de IA, solo cuando pides una acción como sugerir, reescribir, analizar, reactivar o usar herramientas manuales. Antes de compartir mensaje, contexto o captura con OpenAI, la app explica qué se enviará y pide permiso explícito. No activamos IA en segundo plano para leer tus chats sin una acción tuya.'],
      ['5. Finalidades', 'Usamos datos para autenticarte, prestar la app, conectar conversaciones, generar borradores de IA, gestionar cuota y pagos, enviar notificaciones, mejorar estabilidad, prevenir abuso, cumplir obligaciones legales y ofrecer soporte.'],
      ['6. Proveedores', 'Podemos usar OpenAI para funciones de IA, Google/Firebase para notificaciones y Analytics, Google o Apple para inicio de sesión, RevenueCat y los sistemas de pago de las tiendas para compras, Stripe para pagos web cuando aplique, servicios de alojamiento, correo electrónico y soporte. Exigimos protección igual o equivalente para los datos compartidos.'],
      ['7. Analytics', 'Usamos Firebase/Google Analytics para entender uso de la app, pantallas, eventos de producto y estabilidad. No debemos registrar contenido de mensajes, números de teléfono completos ni texto privado dentro de eventos de Analytics.'],
      ['8. Notificaciones', 'Si activas notificaciones, registramos tokens push o suscripciones para avisos de mensajes, cuota, conexión y novedades. Puedes desactivar las notificaciones desde Ajustes o desde el sistema operativo.'],
      ['9. Retención', 'Conservamos datos mientras tu cuenta esté activa o mientras sea necesario para prestar el servicio. La caché de conversaciones debe ser limitada. Al solicitar eliminación de cuenta, iniciamos la eliminación y podemos conservar ciertos registros por seguridad, prevención de fraude, cumplimiento legal o respaldo durante un periodo limitado.'],
      ['10. Tus derechos', 'Puedes solicitar acceso, exportación, corrección, eliminación, desconexión de WhatsApp y borrado de historial desde Ajustes o escribiendo a soporte@wafli.ai. Algunas leyes pueden darte derechos adicionales según tu país.'],
      ['11. Seguridad', 'Usamos medidas razonables como HTTPS, control de acceso, minimización y separación de secretos. Ningún sistema es perfecto; si detectamos una incidencia relevante, actuaremos conforme a la ley aplicable.'],
      ['12. Edad e información sensible', 'WaFli está pensada para personas adultas. No debes usar la app para tratar información de terceros sin una base legítima.'],
      ['13. Transferencias internacionales', 'WaFli y sus proveedores pueden procesar datos en Estados Unidos y otros países. Cuando sea necesario, usaremos mecanismos legales adecuados para transferencias internacionales.'],
    ],
  },
  deletion: {
    title: 'Eliminación de cuenta y datos',
    eyebrow: 'Control de privacidad',
    updated: 'Última actualización: mayo 2026',
    intro: 'Puedes solicitar la eliminación de tu cuenta de WaFli y de los datos asociados desde la app o desde el recurso público disponible sin iniciar sesión.',
    sections: [
      ['1. Solicitud desde la app', 'Abre Ajustes, entra en Privacidad y datos y solicita la eliminación de cuenta. La app revoca sesiones, desconecta servicios vinculados, borra cachés de conversación y elimina tokens de notificación.'],
      ['2. Solicitud sin acceso a la app', 'Si ya desinstalaste WaFli o no puedes iniciar sesión, escribe desde el correo asociado a tu cuenta a soporte@wafli.ai con el asunto “Solicitud de eliminación de cuenta WaFli”.'],
      ['3. Eliminación parcial de datos', 'Puedes solicitar borrar historial en caché, desconectar servicios vinculados o eliminar datos concretos sin cerrar tu cuenta. Indica qué datos quieres eliminar al contactar con soporte.'],
      ['4. Datos eliminados', 'Eliminamos o anonimizamos sesiones, identidades de acceso, perfil, preferencias, conversaciones en caché, contactos en cachés, medios temporales, datos técnicos de conexión, tokens push y datos de uso que no deban conservarse.'],
      ['5. Datos retenidos', 'Podemos conservar registros mínimos por seguridad, prevención de fraude, soporte, impuestos, pagos, cumplimiento legal, disputas, políticas de tienda o backups durante un periodo limitado.'],
      ['6. Plazos', 'La solicitud desde la app inicia limpieza inmediata y deja la cuenta en periodo de gracia de 7 días. Después, la cuenta se elimina o anonimiza definitivamente. Las solicitudes por correo pueden requerir verificación y normalmente se procesan en un máximo de 30 días.'],
      ['7. Suscripciones', 'Si tienes una suscripción gestionada por Google Play u otro proveedor, cancélala desde el proveedor correspondiente. La eliminación de cuenta no siempre cancela automáticamente cobros gestionados fuera de WaFli.'],
      ['8. Página pública', 'El recurso público para Play Console y App Store es /account-deletion.html y no requiere iniciar sesión. La política de privacidad pública está disponible en /privacy.html.'],
    ],
  },
  cookies: {
    title: 'Política de Cookies y Tecnologías Similares',
    eyebrow: 'Cookies, almacenamiento local y medición',
    updated: 'Última actualización: mayo 2026',
    intro: 'WaFli usa almacenamiento local, cookies técnicas y herramientas de medición para que la app funcione y para entender su uso.',
    sections: [
      ['1. Tecnologías usadas', 'Podemos usar cookies, localStorage, sessionStorage, service workers, tokens de sesión y SDKs como Firebase Analytics.'],
      ['2. Finalidades técnicas', 'Estas tecnologías permiten mantener sesión, recordar preferencias, activar PWA, notificaciones, seguridad y funcionamiento offline básico.'],
      ['3. Medición', 'Firebase/Google Analytics puede medir eventos de uso, pantallas y rendimiento. No usamos estos eventos para guardar contenido de chats.'],
      ['4. Control', 'Puedes borrar cookies y almacenamiento desde tu navegador o sistema operativo. Si lo haces, algunas funciones pueden dejar de funcionar o requerir nuevo inicio de sesión.'],
    ],
  },
  support: {
    title: 'Soporte',
    eyebrow: 'Ayuda y preguntas frecuentes',
    updated: 'Última actualización: mayo 2026',
    intro: 'Aquí tienes respuestas rápidas sobre uso, privacidad, IA, notificaciones, pagos y cuenta. Si necesitas ayuda humana, escribe a soporte@wafli.ai.',
    sections: [
      ['1. ¿Qué es WaFli?', 'WaFli es un asistente de conversación: te ayuda a entender contexto, escribir mejor y preparar respuestas editables. Tú decides qué usar, editar o descartar.'],
      ['2. ¿WaFli es una app de citas?', 'No. WaFli no es una red social ni una app de citas. Es una herramienta privada de apoyo para redactar y organizar conversaciones que tú conectas.'],
      ['3. ¿WaFli envía mensajes automáticamente?', 'No. WaFli no envía mensajes por ti. La app genera borradores editables y cualquier envío requiere una acción explícita tuya.'],
      ['4. ¿Cómo conecto mi WhatsApp?', 'En la pantalla Conectar introduces tu número, recibes un código de emparejamiento y lo usas desde Dispositivos vinculados en tu WhatsApp.'],
      ['5. ¿Por qué puede pausarse o caer la conexión?', 'La conexión depende de disponibilidad de terceros, red, sesión del dispositivo y estado del servicio. Si se pausa, la app te avisará y podrás reconectar cuando corresponda.'],
      ['6. ¿Qué puede hacer la IA?', 'Puede sugerir respuestas, reescribir mensajes propios y ayudarte a reactivar una conversación.'],
      ['7. ¿La IA siempre acierta?', 'No. Las sugerencias pueden ser incorrectas, sonar raras o no captar el contexto. Debes revisar y editar cada texto antes de usarlo.'],
      ['8. ¿Qué consume cuota?', 'Sugerir, regenerar, reescribir y reactivar consumen generaciones. Editar manualmente un texto no consume cuota.'],
      ['9. ¿Qué pasa si se agota mi cuota?', 'Puedes seguir leyendo chats y escribiendo manualmente. La app bloqueará nuevas generaciones de IA hasta el próximo reinicio de cuota o hasta que compres/actives más saldo si está disponible.'],
      ['10. ¿Mis conversaciones se usan para entrenar modelos?', 'WaFli debe usar tus conversaciones solo para prestar la función que solicitas. No debe enviar contenido privado a Analytics ni usarlo para entrenamiento sin una base válida y consentimiento cuando corresponda.'],
      ['11. ¿Qué datos procesa WaFli?', 'Puede procesar datos de cuenta, preferencias, conexión, mensajes recientes, metadatos de conversación, uso de IA, notificaciones, pagos y soporte. La Política de Privacidad explica el detalle.'],
      ['12. ¿Cuándo se envía contexto a la IA?', 'Solo cuando pides una acción de IA como sugerir, reescribir o reactivar. WaFli no activa el modelo para leer chats nuevos en segundo plano sin acción tuya.'],
      ['13. ¿Qué son las notificaciones?', 'Son avisos de mensajes, conversaciones encalladas, cuota, estado de conexión o novedades. Puedes activar o desactivar categorías desde Ajustes y también desde el sistema operativo.'],
      ['14. No me llegan notificaciones. ¿Qué hago?', 'Verifica que el permiso del sistema esté concedido, que Permitir notificaciones esté activo en WaFli, que no hayas silenciado la conversación y que el teléfono no bloquee la app por ahorro de batería.'],
      ['15. ¿Puedo silenciar o excluir chats?', 'Sí. Puedes silenciar notificaciones de una conversación o excluirla de WaFli si no quieres verla ni usarla con IA. Las conversaciones excluidas pueden gestionarse desde Privacidad y datos cuando la función esté disponible.'],
      ['16. ¿Cómo borro mis datos?', 'Desde Ajustes > Privacidad y datos puedes solicitar exportación, borrar historial en caché, desconectar WhatsApp o solicitar eliminación de cuenta. También existe una página pública de eliminación de cuenta.'],
      ['17. ¿Qué pasa al eliminar mi cuenta?', 'Se inicia la eliminación de datos asociados a tu cuenta. Puede existir un periodo de gracia y algunos registros mínimos pueden conservarse temporalmente por seguridad, prevención de fraude, cumplimiento legal o respaldo.'],
      ['18. ¿Cómo cancelo un plan?', 'Si pagaste en web, revisa Plan y facturación o escribe a soporte@wafli.ai. Si pagaste desde App Store o Google Play, debes cancelar desde la tienda correspondiente.'],
      ['19. ¿WaFli guarda mi tarjeta?', 'No deberíamos almacenar datos completos de tarjeta. Los pagos se gestionan mediante proveedores externos como Stripe o los sistemas de pago de las tiendas.'],
      ['20. ¿Hay edad mínima para usar WaFli?', 'Sí. WaFli está pensada para personas adultas. Solo puedes usarla si tienes al menos 18 años o la mayoría de edad aplicable en tu jurisdicción.'],
      ['21. ¿Qué usos están prohibidos?', 'No uses WaFli para acoso, amenazas, spam, fraude, suplantación, manipulación, explotación, contenido ilegal, vigilancia abusiva o cualquier actividad que viole derechos de terceros.'],
      ['22. ¿Qué hago si la app muestra un error?', 'Cierra y vuelve a abrir la app, verifica internet y prueba reconectar si el problema es de conexión. Si persiste, escribe a soporte@wafli.ai indicando dispositivo, fecha aproximada y qué acción estabas haciendo.'],
      ['23. ¿Qué información debo enviar a soporte?', 'Envía el correo de tu cuenta, dispositivo, sistema operativo, captura si ayuda y una descripción del problema. No envíes contenido íntimo o sensible si no es necesario.'],
      ['24. ¿Dónde están los documentos legales?', 'Puedes consultar Términos, Privacidad, Cookies y Eliminación de cuenta desde la app o en las páginas públicas de WaFli tras el despliegue web.'],
    ],
  },
};

function getLegalDocument(title, body) {
  const normalized = String(title || '').toLowerCase();
  if (normalized.includes('privacidad')) return LEGAL_DOCUMENTS.privacy;
  if (normalized.includes('cookies')) return LEGAL_DOCUMENTS.cookies;
  if (normalized.includes('términos') || normalized.includes('terminos') || normalized.includes('condiciones')) return LEGAL_DOCUMENTS.terms;
  if (normalized.includes('soporte')) return LEGAL_DOCUMENTS.support;
  return {
    title,
    eyebrow: 'Información',
    updated: '',
    intro: '',
    sections: (body || []).map((p, i) => [`${i + 1}. Detalle`, p]),
  };
}

function LegalFullscreen({ title, body, onClose }) {
  const doc = getLegalDocument(title, body);
  return (
    <div className="legal-modal">
      <div className="appheader">
        <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
          <IconButton onClick={onClose} label="Cerrar"><Icons.Close size={20} /></IconButton>
          <span style={{fontSize: 16, fontWeight: 600}}>{doc.title}</span>
        </div>
      </div>
      <div className="legal-modal__body">
        <article className="legal-doc">
          <header className="legal-doc__hero">
            <span className="legal-doc__eyebrow">{doc.eyebrow}</span>
            <h1>{doc.title}</h1>
            {doc.updated ? <p className="legal-doc__updated">{doc.updated}</p> : null}
            {doc.intro ? <p className="legal-doc__intro">{doc.intro}</p> : null}
          </header>
          <div className="legal-doc__grid">
            {doc.sections.map(([heading, text]) => (
              <section key={heading} className="legal-doc__section">
                <h2>{heading}</h2>
                <p>{text}</p>
              </section>
            ))}
          </div>
          {doc === LEGAL_DOCUMENTS.terms || doc === LEGAL_DOCUMENTS.privacy ? (
            <div className="legal-doc__notice">
              Estos documentos resumen el funcionamiento público de WaFli. Si tienes dudas legales o de privacidad, escribe a soporte@wafli.ai.
            </div>
          ) : null}
        </article>
      </div>
    </div>
  );
}

function PublicLegalPage({ type = 'privacy' }) {
  const normalized = String(type || 'privacy').toLowerCase();
  const doc = LEGAL_DOCUMENTS[normalized] || LEGAL_DOCUMENTS.privacy;
  return (
    <div className="scroll-y" style={{background: 'var(--bg)', minHeight: '100%'}}>
      <article className="legal-doc" style={{padding: '24px 18px 34px'}}>
        <header className="legal-doc__hero">
          <span className="legal-doc__eyebrow">{doc.eyebrow}</span>
          <h1>{doc.title}</h1>
          {doc.updated ? <p className="legal-doc__updated">{doc.updated}</p> : null}
          {doc.intro ? <p className="legal-doc__intro">{doc.intro}</p> : null}
        </header>
        <div className="legal-doc__grid">
          {doc.sections.map(([heading, text]) => (
            <section key={heading} className="legal-doc__section">
              <h2>{heading}</h2>
              <p>{text}</p>
            </section>
          ))}
        </div>
        <div className="legal-doc__notice">
          Página pública de WaFli. Para privacidad, eliminación de cuenta o soporte, escribe a soporte@wafli.ai.
        </div>
      </article>
    </div>
  );
}

function loadExternalScript(src, id) {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing) {
      if (existing.dataset.loaded === '1') resolve();
      else existing.addEventListener('load', resolve, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = '1';
      resolve();
    };
    script.onerror = () => reject(new Error('No hemos podido cargar el proveedor de acceso.'));
    document.head.appendChild(script);
  });
}

function createOauthNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function AuthScreen({ onBack, onMagicLink, onOpenLegal, onShowToast }) {
  const [error, setError] = React.useState('');
  const [doc, setDoc] = React.useState(null);
  const [loadingProvider, setLoadingProvider] = React.useState('');
  const [pendingRecovery, setPendingRecovery] = React.useState(null);
  const googleButtonRef = React.useRef(null);
  const googleNonceRef = React.useRef('');
  const googleClientId = WaFliAPI?.client?.GOOGLE_CLIENT_ID || '';
  const googleIosClientId = WaFliAPI?.client?.GOOGLE_IOS_CLIENT_ID || '';
  const appleClientId = WaFliAPI?.client?.APPLE_CLIENT_ID || '';
  const appleIosClientId = WaFliAPI?.client?.APPLE_IOS_CLIENT_ID || 'com.wafli.app';
  const isCapacitorNative = Boolean(WaFliAPI?.client?.IS_CAPACITOR_NATIVE);
  const nativePlatform = window.Capacitor?.getPlatform?.() || '';
  const isIOSNative = Boolean(isCapacitorNative && nativePlatform === 'ios');
  const canUseNativeGoogle = Boolean(isCapacitorNative && googleClientId && (!isIOSNative || googleIosClientId));
  const providerAvailable = Boolean((isCapacitorNative ? canUseNativeGoogle : googleClientId) || appleClientId || isIOSNative);
  const openLegal = (type) => {
    if (onOpenLegal) onOpenLegal(type);
    else setDoc(type);
  };

  const finishProviderLogin = async (provider, payload) => {
    setError('');
    setPendingRecovery(null);
    setLoadingProvider(provider);
    try {
      const result = await WaFliAPI?.auth?.socialLogin?.(provider, payload);
      onShowToast && onShowToast(result?.recovered ? 'Cuenta recuperada' : 'Sesión iniciada');
      onMagicLink && onMagicLink({ firstTime: Boolean(result?.firstTime) });
    } catch (apiError) {
      if (apiError?.code === 'account_pending_deletion') {
        setPendingRecovery({ provider, payload });
        setError('Esta cuenta tiene una eliminación pendiente. Puedes recuperarla ahora y volver a usar WaFli.');
        return;
      }
      setError(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No hemos podido iniciar sesión con ese proveedor.');
    } finally {
      setLoadingProvider('');
    }
  };

  const handleGoogleCredential = React.useCallback((response) => {
    if (!response?.credential) {
      setError('Google no devolvió una credencial válida.');
      return;
    }
    finishProviderLogin('google', { idToken: response.credential, nonce: googleNonceRef.current });
  }, []);

  const continueWithNativeGoogle = async () => {
    if (!googleClientId || !window.WaFliSocialLogin?.login) return;
    setError('');
    setLoadingProvider('google');
    try {
      const response = await window.WaFliSocialLogin.login({
        provider: 'google',
        options: {
          nonce: createOauthNonce(),
          forceRefreshToken: true,
          filterByAuthorizedAccounts: false,
          autoSelectEnabled: false,
        },
      });
      const idToken = response?.result?.idToken;
      if (!idToken) throw new Error('Google no devolvio un token valido.');
      await finishProviderLogin('google', { idToken });
    } catch (apiError) {
      setError(WaFliAPI?.client?.toUserMessage?.(apiError) || apiError?.message || 'No hemos podido iniciar sesión con Google.');
      setLoadingProvider('');
    }
  };

  React.useEffect(() => {
    if (isCapacitorNative || !googleClientId || !googleButtonRef.current) return;
    let cancelled = false;
    googleButtonRef.current.innerHTML = '';
    loadExternalScript('https://accounts.google.com/gsi/client', 'google-identity-services')
      .then(() => {
        if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;
        googleNonceRef.current = createOauthNonce();
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredential,
          nonce: googleNonceRef.current
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: Math.min(360, googleButtonRef.current.offsetWidth || 320)
        });
      })
      .catch(() => setError('No hemos podido cargar Google Sign-In.'));
    return () => { cancelled = true; };
  }, [isCapacitorNative, googleClientId, handleGoogleCredential]);

  const continueWithApple = async () => {
    if (!appleClientId) {
      setError('Falta configurar VITE_APPLE_CLIENT_ID para probar Apple Sign-In en web.');
      return;
    }
    setError('');
    setLoadingProvider('apple');
    try {
      await loadExternalScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js', 'appleid-js');
      const nonce = createOauthNonce();
      window.AppleID.auth.init({
        clientId: appleClientId,
        scope: 'name email',
        redirectURI: WaFliAPI?.client?.APPLE_REDIRECT_URI || window.location.origin,
        state: createOauthNonce(),
        nonce,
        usePopup: true
      });
      const response = await window.AppleID.auth.signIn();
      await finishProviderLogin('apple', {
        idToken: response?.authorization?.id_token,
        code: response?.authorization?.code,
        nonce,
        profile: response?.user || null
      });
    } catch (apiError) {
      setError(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No hemos podido iniciar sesión con Apple.');
      setLoadingProvider('');
    }
  };

  const continueWithNativeApple = async () => {
    if (!isIOSNative || !window.WaFliSocialLogin?.login) return;
    setError('');
    setLoadingProvider('apple');
    try {
      const response = await window.WaFliSocialLogin.login({
        provider: 'apple',
        options: {
          clientId: appleIosClientId,
        },
      });
      const result = response?.result || {};
      const nativeAppleToken = String(result?.accessToken?.token || '').split('.').length === 3
        ? result.accessToken.token
        : String(result?.idToken || '').split('.').length === 3
          ? result.idToken
          : '';
      if (!nativeAppleToken) throw new Error('Apple no devolvio un token valido.');
      const profile = result?.profile || {};
      await finishProviderLogin('apple', {
        idToken: nativeAppleToken,
        profile: {
          email: profile.email || null,
          name: {
            firstName: profile.givenName || '',
            lastName: profile.familyName || '',
          },
        },
      });
    } catch (apiError) {
      setError(WaFliAPI?.client?.toUserMessage?.(apiError) || apiError?.message || 'No hemos podido iniciar sesión con Apple.');
      setLoadingProvider('');
    }
  };

  return (
    <>
      <AppHeader
        title="Registro / inicio de sesión"
        leading={<IconButton onClick={onBack} label="Atrás"><Icons.Back size={20} /></IconButton>}
      />
      <div className="scroll-y" style={{padding: '20px 22px 24px'}}>
        <div className="card" style={{padding: 14, marginBottom: 12}}>
          <p style={{margin: '0 0 12px', fontSize: 15, textWrap: 'pretty'}}>
            Entra o crea tu cuenta para continuar con la vinculación de tu WhatsApp.
          </p>
          {canUseNativeGoogle ? (
            <button
              className="btn btn--ghost btn--full"
              style={{height: 44, border: '1px solid var(--border-strong)', color: 'var(--text)', opacity: loadingProvider === 'google' ? 0.7 : 1, marginBottom: 10}}
              disabled={Boolean(loadingProvider)}
              onClick={continueWithNativeGoogle}
            >
              {loadingProvider === 'google' ? 'Conectando...' : 'Continuar con Google'}
            </button>
          ) : null}
          {!isCapacitorNative && googleClientId ? (
            <div style={{minHeight: 44, display: 'grid', placeItems: 'center', marginBottom: 10}} ref={googleButtonRef} />
          ) : null}
          {isIOSNative ? (
            <button
              className="btn btn--ghost btn--full"
              style={{height: 44, border: '1px solid var(--border-strong)', color: 'var(--text)', opacity: loadingProvider === 'apple' ? 0.7 : 1}}
              disabled={Boolean(loadingProvider)}
              onClick={continueWithNativeApple}
            >
              {loadingProvider === 'apple' ? 'Conectando...' : 'Continuar con Apple'}
            </button>
          ) : null}
          {!isCapacitorNative ? (
            <button
              className="btn btn--ghost btn--full"
              style={{height: 44, border: '1px solid var(--border-strong)', color: 'var(--text)', opacity: loadingProvider === 'apple' ? 0.7 : 1}}
              disabled={Boolean(loadingProvider)}
              onClick={continueWithApple}
            >
              {loadingProvider === 'apple' ? 'Conectando...' : 'Continuar con Apple'}
            </button>
          ) : null}
          {!providerAvailable ? (
            <p className="t-small" style={{margin: 0, color: 'var(--text-secondary)'}}>
              Falta configurar Google o Apple Sign-In para este entorno.
            </p>
          ) : null}
          {error ? <p className="t-caption" style={{marginTop: 10, color: 'var(--danger)'}}>{error}</p> : null}
          {pendingRecovery ? (
            <div className="card" style={{padding: 12, marginTop: 12, background: 'var(--accent-soft)', borderColor: 'rgba(0,0,0,0.06)'}}>
              <div className="t-small" style={{fontWeight: 700, marginBottom: 6}}>¿Quieres recuperar tu cuenta?</div>
              <p className="t-caption" style={{margin: '0 0 10px', color: 'var(--text-secondary)'}}>
                Vamos a cancelar la eliminación pendiente y mantener tu cuenta activa.
              </p>
              <button
                className="btn btn--primary btn--full"
                disabled={Boolean(loadingProvider)}
                onClick={() => finishProviderLogin(pendingRecovery.provider, { ...pendingRecovery.payload, recoverAccount: true })}
              >
                {loadingProvider ? 'Recuperando...' : 'Recuperar cuenta'}
              </button>
            </div>
          ) : null}

          {typeof onContinueWithoutWhatsApp === 'function' ? (
            <div className="card" style={{padding: 12, marginTop: 18, display: 'grid', gap: 8}}>
              <span className="t-small" style={{color: 'var(--text-secondary)'}}>
                También puedes entrar ahora, usar Herramientas y conectar WhatsApp más tarde.
              </span>
              <button type="button" className="btn btn--secondary btn--full" onClick={onContinueWithoutWhatsApp}>
                Continuar sin WhatsApp por ahora
              </button>
            </div>
          ) : null}
        </div>

        <p className="t-caption" style={{marginTop: 12, color: 'var(--text-secondary)', textWrap: 'pretty'}}>
          Al continuar aceptas{' '}
          <button className="btn btn--text" style={{height: 'auto', padding: 0, fontSize: 12}} onClick={() => openLegal('terms')}>T&C</button>
          {' '}y{' '}
          <button className="btn btn--text" style={{height: 'auto', padding: 0, fontSize: 12}} onClick={() => openLegal('privacy')}>política de privacidad</button>.
        </p>
      </div>
      {doc === 'terms' ? (
        <LegalFullscreen
          title="Términos y Condiciones"
          body={['Términos del servicio WaFli.', 'Al continuar aceptas estos términos.']}
          onClose={() => setDoc(null)}
        />
      ) : null}
      {doc === 'privacy' ? (
        <LegalFullscreen
          title="Política de Privacidad"
          body={['Política de privacidad de WaFli.', 'Aquí se explica el uso de datos de forma transparente.']}
          onClose={() => setDoc(null)}
        />
      ) : null}
    </>
  );
}

function LegalAcceptanceScreen({ onBack, onContinue }) {
  const [ageOk, setAgeOk] = React.useState(false);
  const [legalOk, setLegalOk] = React.useState(false);
  const [doc, setDoc] = React.useState(null);
  const canContinue = ageOk && legalOk;
  return (
    <>
      <AppHeader
        title="Antes de empezar"
        leading={<IconButton onClick={onBack} label="Atrás"><Icons.Back size={20} /></IconButton>}
      />
      <div className="scroll-y" style={{padding: '20px 22px 24px'}}>
        <div className="onboarding-progress">
          <span>Paso 1 de 5</span>
          <span className="onboarding-progress__bar"><span style={{width: '20%'}} /></span>
          <span>&lt;90s</span>
        </div>
        <div className="card" style={{padding: 14}}>
          <label style={{display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12, cursor: 'pointer'}}>
            <input type="checkbox" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} style={{marginTop: 3}} />
            <span style={{fontSize: 14.5}}>Soy mayor de 18 años.</span>
          </label>
          <label style={{display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12, cursor: 'pointer'}}>
            <input type="checkbox" checked={legalOk} onChange={(e) => setLegalOk(e.target.checked)} style={{marginTop: 3}} />
            <span style={{fontSize: 14.5}}>
              He leído y acepto los{' '}
              <button className="btn btn--text" style={{height: 'auto', padding: 0, fontSize: 14.5}} onClick={(e) => { e.preventDefault(); setDoc('terms'); }}>T&C</button>
              {' '}y la{' '}
              <button className="btn btn--text" style={{height: 'auto', padding: 0, fontSize: 14.5}} onClick={(e) => { e.preventDefault(); setDoc('privacy'); }}>Política de Privacidad</button>.
            </span>
          </label>
          <p className="t-caption" style={{color: 'var(--text-secondary)', textWrap: 'pretty'}}>
            Entiendo que WaFli puede procesar contexto reciente de mis conversaciones cuando solicito una acción de IA. Soy responsable de usarlo de forma legal, respetuosa y respetando la privacidad de terceros.
          </p>
        </div>
        <button className="btn btn--primary btn--full" style={{marginTop: 14, opacity: canContinue ? 1 : 0.55}} disabled={!canContinue} onClick={onContinue}>
          Continuar
        </button>
      </div>
      {doc === 'terms' ? (
        <LegalFullscreen
          title="Términos y Condiciones"
          body={[
            'Documento legal de WaFli.',
            'WaFli sugiere respuestas, pero tú decides siempre qué enviar.',
            'El uso del servicio implica aceptación de estos términos.',
          ]}
          onClose={() => setDoc(null)}
        />
      ) : null}
      {doc === 'privacy' ? (
        <LegalFullscreen
          title="Política de Privacidad"
          body={[
            'Documento legal de WaFli.',
            'Procesamos los datos mínimos necesarios para ofrecer sugerencias.',
            'Puedes gestionar o eliminar tus datos desde Ajustes.',
          ]}
          onClose={() => setDoc(null)}
        />
      ) : null}
    </>
  );
}

function SpanishVariantScreen({ onBack, onContinue }) {
  const options = SPANISH_VARIANT_OPTIONS;
  const [selected, setSelected] = React.useState('España');
  return (
    <>
      <AppHeader
        title="¿Cómo hablas?"
        subtitle="Para que las sugerencias suenen como tú"
        leading={<IconButton onClick={onBack} label="Atrás"><Icons.Back size={20} /></IconButton>}
      />
      <div className="scroll-y" style={{padding: '20px 22px 24px'}}>
        <div className="onboarding-progress">
          <span>Paso 2 de 5</span>
          <span className="onboarding-progress__bar"><span style={{width: '40%'}} /></span>
          <span>&lt;90s</span>
        </div>
        <div className="col gap-2">
          {options.map((opt) => {
            const active = selected === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={'preset-card ' + (active ? 'preset-card--active' : '')}
              >
                <div className="row gap-3">
                  <span className="preset-card__badge">{opt.badge}</span>
                  <span className="col" style={{gap: 2}}>
                    <span style={{fontSize: 15, fontWeight: 700}}>{opt.title}</span>
                    <span className="t-caption">{opt.sample}</span>
                  </span>
                  {active ? <Icons.Check size={18} sw={2.5} style={{marginLeft: 'auto', color: 'var(--accent)'}} /> : null}
                </div>
              </button>
            );
          })}
        </div>
        <button className="btn btn--primary btn--full" style={{marginTop: 14, opacity: selected ? 1 : 0.55}} disabled={!selected} onClick={() => onContinue && onContinue(selected)}>
          Continuar
        </button>
      </div>
    </>
  );
}

function ToneBaseScreen({ onBack, onContinue }) {
  const [selected, setSelected] = React.useState(DEFAULT_AI_AGENT);
  return (
    <>
      <AppHeader
        title="Elige tu agente IA"
        subtitle="WaFli lo usará por defecto al crear tu perfil, pero podrás cambiarlo en cada ayuda."
        leading={<IconButton onClick={onBack} label="Atrás"><Icons.Back size={20} /></IconButton>}
      />
      <div className="scroll-y" style={{padding: '20px 22px 24px'}}>
        <div className="onboarding-progress">
          <span>Paso 3 de 5</span>
          <span className="onboarding-progress__bar"><span style={{width: '60%'}} /></span>
          <span>&lt;90s</span>
        </div>
        <div className="col gap-2">
          {AI_AGENTS.map((agent) => {
            const active = selected === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => setSelected(agent.id)}
                className={'tone-card ' + (active ? 'tone-card--active' : '')}
              >
                <div className="row" style={{justifyContent: 'space-between', alignItems: 'center'}}>
                  <div style={{fontSize: 15, fontWeight: 700}}>{agent.label}</div>
                  {active ? <Icons.Check size={18} sw={2.5} style={{color: 'var(--accent)'}} /> : null}
                </div>
                <div className="tone-preview">{agent.description}</div>
              </button>
            );
          })}
        </div>
        <button className="btn btn--primary btn--full" style={{marginTop: 14, opacity: selected ? 1 : 0.55}} disabled={!selected} onClick={() => onContinue && onContinue(selected)}>
          Continuar
        </button>
      </div>
    </>
  );
}

function getInstallProfile() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || (window.matchMedia ? window.matchMedia('(max-width: 768px)').matches : false);
  if (isIOS) {
    return {
      label: 'iOS Safari',
      summary: 'Pulsa Compartir y luego Añadir a pantalla de inicio.',
      steps: ['Pulsa el botón Compartir.', 'Elige Añadir a pantalla de inicio.', 'Confirma con Añadir.'],
      visual: 'ios-a2hs.gif',
      visualSteps: [
        { src: 'ios-install-1.jpeg', title: 'Abre el menú de compartir', text: 'Desde Safari, pulsa el icono de compartir en la barra inferior.' },
        { src: 'ios-install-2.jpeg', title: 'Busca la opción correcta', text: 'Desliza el menú hasta encontrar Añadir a pantalla de inicio.' },
        { src: 'ios-install-3.jpeg', title: 'Añade WaFli', text: 'Confirma el nombre y pulsa Añadir.' },
        { src: 'ios-install-4.jpeg', title: 'Listo', text: 'WaFli queda como app en tu pantalla de inicio.' },
      ],
      canAutoInstall: false,
      pushNote: 'En iPhone, las notificaciones web funcionan cuando WaFli está añadida a pantalla de inicio y el dispositivo usa iOS 16.4 o superior.',
    };
  }
  if (isAndroid) {
    return {
      label: 'Android Chrome',
      summary: 'Abre el menú de tres puntos y pulsa Instalar app.',
      steps: ['Pulsa el menú de tres puntos.', 'Elige Instalar app o Añadir a pantalla de inicio.', 'Confirma la instalación.'],
      visual: 'android-a2hs.gif',
      visualSteps: [
        { src: 'android-install-1.jpeg', title: 'Abre el menú', text: 'Pulsa los tres puntos de Chrome.' },
        { src: 'android-install-2.jpeg', title: 'Instala WaFli', text: 'Elige Instalar app o Añadir a pantalla de inicio.' },
        { src: 'android-install-3.jpeg', title: 'Confirma', text: 'Acepta la instalación y abre WaFli desde tu inicio.' },
      ],
      canAutoInstall: true,
      pushNote: 'En Android/Chrome podemos mostrar un botón de instalación si el navegador habilita el prompt.',
    };
  }
  return {
    label: isMobile ? 'Navegador móvil' : 'Desktop',
    summary: isMobile ? 'Busca la opción Añadir a pantalla de inicio en tu navegador.' : 'Usa el icono de instalar de la barra del navegador si está disponible.',
    steps: isMobile
      ? ['Abre el menú de tu navegador.', 'Busca Añadir a pantalla de inicio o Instalar app.', 'Confirma la instalación.']
      : ['Abre WaFli en Chrome, Edge u otro navegador compatible.', 'Pulsa el icono de instalar en la barra de direcciones.', 'Confirma Instalar para abrir WaFli como app.'],
    visual: isMobile ? 'mobile-a2hs.gif' : 'desktop-install.gif',
    visualSteps: [],
    canAutoInstall: true,
    pushNote: 'Las notificaciones dependen del navegador y de que hayas concedido permiso explícito.',
  };
}

function ConnectedSuccessScreen({ isNativeApp = false, onContinue, onInstall, onInstallOpportunitySeen }) {
  const install = getInstallProfile();
  React.useEffect(() => {
    onInstallOpportunitySeen && onInstallOpportunitySeen();
  }, [onInstallOpportunitySeen]);
  return (
    <>
      <AppHeader title="Conectado" />
      <div className="scroll-y" style={{padding: '26px 22px 24px'}}>
        <div className="onboarding-progress">
          <span>Paso 5 de 5</span>
          <span className="onboarding-progress__bar"><span style={{width: '100%'}} /></span>
          <span>Listo</span>
        </div>
        <div className="card" style={{padding: 18, textAlign: 'center'}}>
          <div style={{width: 68, height: 68, borderRadius: 999, margin: '0 auto 10px', background: 'var(--success-soft)', color: 'var(--success)', display: 'grid', placeItems: 'center'}}>
            <Icons.Check size={28} sw={2.4} />
          </div>
          <h2 className="t-h2" style={{margin: '0 0 8px'}}>¡Conectado!</h2>
          <p className="t-small" style={{color: 'var(--text-secondary)', margin: '0 0 12px'}}>
            Ya podemos leer tus chats y ayudarte a contestar.
          </p>
          {isNativeApp ? (
            <div className="install-help-card install-help-card--native">
              <div>
                <span className="install-help-card__badge">App nativa</span>
                <p className="t-small" style={{margin: '6px 0 0'}}>WaFli ya está instalada en tu iPhone.</p>
                <p className="t-caption" style={{margin: '4px 0 0'}}>Puedes continuar directo a tus chats; no hace falta Safari ni añadir a pantalla de inicio.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="install-help-card">
                <div>
                  <span className="install-help-card__badge">{install.label}</span>
                  <p className="t-small" style={{margin: '6px 0 0'}}>Añade WaFli a tu pantalla de inicio para usarlo como una app.</p>
                  <p className="t-caption" style={{margin: '4px 0 0'}}>{install.summary}</p>
                </div>
                <button className="btn btn--secondary btn--md" onClick={onInstall}>Añadir / ver tutorial</button>
              </div>
              <p className="t-caption" style={{margin: '10px 0 0', textAlign: 'left'}}>
                {install.pushNote}
              </p>
            </>
          )}
          <button className="btn btn--primary btn--full" style={{marginTop: 12}} onClick={onContinue}>Ir a mis chats</button>
        </div>
      </div>
    </>
  );
}

function AddToHomeScreen({ onBack, onDone, onLater }) {
  const install = getInstallProfile();
  const [canAutoInstall, setCanAutoInstall] = React.useState(Boolean(window.WaFliInstallPrompt));
  React.useEffect(() => {
    const refresh = () => setCanAutoInstall(Boolean(window.WaFliInstallPrompt));
    window.addEventListener('wafli:pwa-install-ready', refresh);
    window.addEventListener('wafli:pwa-installed', refresh);
    refresh();
    return () => {
      window.removeEventListener('wafli:pwa-install-ready', refresh);
      window.removeEventListener('wafli:pwa-installed', refresh);
    };
  }, []);
  const installNow = async () => {
    const prompt = window.WaFliInstallPrompt;
    if (!prompt) {
      onDone && onDone();
      return;
    }
    try {
      prompt.prompt();
      const choice = await prompt.userChoice.catch(() => null);
      window.WaFliInstallPrompt = null;
      setCanAutoInstall(false);
      if (!choice || choice.outcome === 'accepted') onDone && onDone();
    } catch (_) {
      window.WaFliInstallPrompt = null;
      setCanAutoInstall(false);
    }
  };
  return (
    <>
      <AppHeader
        title="Instálalo como app"
        subtitle="Acceso rápido y notificaciones"
        leading={<IconButton onClick={onBack} label="Atrás"><Icons.Back size={20} /></IconButton>}
      />
      <div className="scroll-y" style={{padding: '20px 22px 24px'}}>
        <div className="install-guide card">
          <div className="install-guide__header">
            <span className="install-help-card__badge">{install.label}</span>
            <p className="t-body-md" style={{margin: '8px 0 0'}}>{install.summary}</p>
          </div>
          <ol className="install-guide__steps">
            {install.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
          {install.visualSteps?.length ? (
            <div className="install-guide__visual-list" aria-label={`Tutorial visual ${install.label}`}>
              {install.visualSteps.map((step, index) => (
                <article className="install-guide__shot" key={step.src}>
                  <div className="install-guide__shot-index">{index + 1}</div>
                  <img src={`/onboarding/${step.src}`} alt={step.title} loading="lazy" />
                  <div className="install-guide__shot-copy">
                    <strong>{step.title}</strong>
                    <span>{step.text}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="install-guide__visual">
              <img src={`/onboarding/${install.visual}`} alt={`Tutorial ${install.label}`} onError={(event) => { event.currentTarget.style.display = 'none'; }} />
              <span className="t-caption">Tutorial visual para instalar WaFli.</span>
            </div>
          )}
          <div className="pwa-limit-note" style={{marginTop: 12}}>
            {install.pushNote}
          </div>
        </div>
        <div className="col gap-2" style={{marginTop: 14}}>
          {canAutoInstall && install.canAutoInstall ? (
            <button className="btn btn--primary btn--full" onClick={installNow}>Instalar automáticamente</button>
          ) : null}
          <button className={canAutoInstall && install.canAutoInstall ? 'btn btn--secondary btn--full' : 'btn btn--primary btn--full'} onClick={onDone}>
            Listo, lo haré ahora
          </button>
          <button className="btn btn--text" onClick={onLater}>Más tarde</button>
        </div>
      </div>
    </>
  );
}

function StaticInfoScreen({ title, subtitle, paragraphs, onBack }) {
  return (
    <>
      <AppHeader
        title={title}
        subtitle={subtitle}
        leading={<IconButton onClick={onBack} label="Atrás"><Icons.Back size={20} /></IconButton>}
      />
      <div className="scroll-y" style={{padding: '20px 22px 24px'}}>
        <div className="card" style={{padding: 14}}>
          {paragraphs.map((p, idx) => (
            <p key={idx} style={{margin: idx === paragraphs.length - 1 ? 0 : '0 0 10px', fontSize: 14.5, lineHeight: 1.5}}>{p}</p>
          ))}
        </div>
      </div>
    </>
  );
}

function formatPairingCode(value) {
  const clean = String(value || '').replace(/[\s-]/g, '').toUpperCase();
  if (clean.length === 8) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  return value || '';
}

function isFutureDate(value) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function getFreshTaskPairingCodeInfo(tasks = []) {
  const now = Date.now();
  const task = tasks.find((item) => {
    if (item?.type !== 'pairing_code' || item?.status !== 'succeeded') return false;
    const rawCode = item?.result?.pairingCode;
    if (!rawCode) return false;
    const expiresAt = item?.result?.pairingCodeExpiresAt ? new Date(item.result.pairingCodeExpiresAt).getTime() : 0;
    return !expiresAt || expiresAt > now;
  });
  return task?.result?.pairingCode
    ? { code: formatPairingCode(task.result.pairingCode), expiresAt: task.result.pairingCodeExpiresAt || null }
    : { code: '', expiresAt: null };
}

function getFreshStatusPairingCodeInfo(status = {}) {
  if (!status?.pairingCode) return { code: '', expiresAt: null };
  if (status.pairingCodeExpiresAt && !isFutureDate(status.pairingCodeExpiresAt)) return { code: '', expiresAt: null };
  return { code: formatPairingCode(status.pairingCode), expiresAt: status.pairingCodeExpiresAt || null };
}

function getLatestPairingTask(tasks = []) {
  return tasks.find((item) => item?.type === 'pairing_code') || null;
}

function cleanPairingMessage(message) {
  return String(message || '')
    .replace(/vinculacion/g, 'vinculación')
    .replace(/codigo/g, 'código')
    .replace(/Telefono/g, 'Teléfono')
    .trim();
}

function taskPairingMessage(task) {
  if (!task || task.type !== 'pairing_code' || task.status !== 'failed') return '';
  const message = cleanPairingMessage(task.errorMessage);
  if (task.errorCode === 'whatsapp_phone_already_registered') return 'Este número de WhatsApp ya está asociado a otra cuenta. Inicia sesión con el correo original o usa otro número.';
  if (task.errorCode === 'pairing_cooldown') return message || 'Hay demasiados intentos seguidos. Espera un momento antes de generar otro código.';
  if (task.errorCode === 'pairing_proxy_ip_blacklisted') return message || 'No hemos podido preparar la vinculación. Espera un momento antes de generar otro código.';
  if (task.errorCode === 'pairing_socket_rejected') return message || 'Tu WhatsApp rechazó la conexión antes de generar el código. Espera un momento y vuelve a intentarlo.';
  if (task.errorCode === 'pairing_socket_error') return message || 'La conexión falló antes de generar el código. Inténtalo de nuevo después de limpiar la sesión.';
  if (task.errorCode === 'pairing_socket_timeout') return 'La conexión tardó demasiado en prepararse. Espera unos segundos y genera un código nuevo.';
  if (task.errorCode === 'pairing_socket_closed') return 'La conexión se cerró antes de mostrar el código. Genera uno nuevo.';
  return message || 'No hemos podido generar el código. Inténtalo de nuevo.';
}

function pairingDisconnectMessage(status, visibleCode) {
  if (!visibleCode) return '';
  const reason = String(status?.disconnectReason || '').trim();
  const pauseReason = String(status?.pauseReason || '').trim();
  if (/ya esta asociado|already associated|already registered|otra cuenta|whatsapp_phone_already_registered/i.test(reason)) {
    return 'Este número de WhatsApp ya está asociado a otra cuenta. Inicia sesión con el correo original o usa otro número.';
  }
  if (pauseReason === "pairing_resume_paused") return "La vinculación sigue en reintento con este mismo código. Si continúa sin avanzar, genera uno nuevo.";
  if (!reason || ['staging_onboarding_reset', 'pairing_reset', 'manual_disconnect', 'purged'].includes(reason)) return '';
  if (/401|logged|failure/i.test(reason)) return 'No se pudo mantener la vinculación. Genera un código nuevo e inténtalo otra vez.';
  if (/timeout|408|tardo|terminat|closed|428/i.test(reason)) return 'La conexión se cerró mientras esperábamos la vinculación. Prueba este código; si falla, genera uno nuevo.';
  return 'La vinculación se interrumpió. Prueba este código; si falla, genera uno nuevo.';
}

function getPairingGuide(platform) {
  if (platform === 'ios') {
    return {
      title: 'iPhone',
      steps: [
        { src: 'pairing-ios-1.jpeg', title: 'Abre configuración', text: 'En tu WhatsApp, entra en Configuración.' },
        { src: 'pairing-ios-2.jpeg', title: 'Dispositivos vinculados', text: 'Pulsa Dispositivos vinculados.' },
        { src: 'pairing-ios-3.jpeg', title: 'Vincula con número', text: 'Elige vincular con número de teléfono e introduce el código.' },
      ],
      checklist: ['Configuración', 'Dispositivos vinculados', 'Vincular con número de teléfono', 'Introduce el código ABCD-EFGH']
    };
  }
  return {
    title: 'Android',
    steps: [
      { src: 'pairing-android-1.jpeg', title: 'Abre el menú', text: 'Pulsa el menú de tres puntos o Ajustes.' },
      { src: 'pairing-android-2.jpeg', title: 'Dispositivos vinculados', text: 'Entra en Dispositivos vinculados.' },
      { src: 'pairing-android-3.jpeg', title: 'Vincular dispositivo', text: 'Pulsa Vincular un dispositivo.' },
      { src: 'pairing-android-4.jpeg', title: 'Usa el número', text: 'Elige vincular con número e introduce el código.' },
    ],
    checklist: ['Menú o Ajustes', 'Dispositivos vinculados', 'Vincular un dispositivo', 'Vincular con número de teléfono']
  };
}

function normalizeChatIdentity(value) {
  return String(value || '').trim();
}

function normalizeApiAliases(aliases = []) {
  if (!Array.isArray(aliases)) return [];
  return aliases
    .map((alias) => {
      if (typeof alias === 'string') return { id: normalizeChatIdentity(alias) };
      return { ...alias, id: normalizeChatIdentity(alias?.id || alias?.alias_chat_id || alias?.aliasChatId) };
    })
    .filter((alias) => alias.id);
}

function chatIdentitySet(chat) {
  const aliases = normalizeApiAliases(chat?.aliases);
  return new Set([
    normalizeChatIdentity(chat?.canonicalChatId || chat?.canonical_chat_id),
    normalizeChatIdentity(chat?.id || chat?.external_chat_id),
    normalizeChatIdentity(chat?.originalId || chat?.original_id),
    ...aliases.map((alias) => alias.id),
  ].filter(Boolean));
}

function sameChatIdentity(a, b) {
  const left = typeof a === 'string' ? new Set([normalizeChatIdentity(a)]) : chatIdentitySet(a);
  const right = typeof b === 'string' ? new Set([normalizeChatIdentity(b)]) : chatIdentitySet(b);
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

function mergeChatAliases(...aliasLists) {
  const merged = new Map();
  aliasLists.flatMap((list) => normalizeApiAliases(list)).forEach((alias) => {
    if (!alias.id) return;
    merged.set(alias.id, { ...(merged.get(alias.id) || {}), ...alias });
  });
  return Array.from(merged.values());
}

function mergeCanonicalChats(items = []) {
  return items.reduce((acc, item) => {
    const existingIndex = acc.findIndex((candidate) => sameChatIdentity(candidate, item));
    if (existingIndex === -1) return [...acc, item];
    const previous = acc[existingIndex];
    const merged = {
      ...previous,
      ...item,
      aliases: mergeChatAliases(previous.aliases, item.aliases),
      favorite: Boolean(previous.favorite || item.favorite),
      muted: Boolean(previous.muted || item.muted),
      excluded: Boolean(previous.excluded || item.excluded),
      unread: Math.max(Number(previous.unread || 0), Number(item.unread || 0)),
      hasConversation: Boolean(previous.hasConversation || item.hasConversation),
    };
    return acc.map((candidate, index) => index === existingIndex ? merged : candidate);
  }, []);
}

function mapApiChat(chat) {
  const originalId = chat.id || chat.external_chat_id;
  const canonicalChatId = chat.canonicalChatId || chat.canonical_chat_id || originalId;
  const aliases = mergeChatAliases(chat.aliases, [{ id: originalId }, { id: canonicalChatId }]);
  const bestName = [
    chat.manual_alias,
    chat.name,
    chat.whatsapp_name,
    chat.push_name,
    chat.notify_name,
    chat.verified_name,
    chat.display_name,
    chat.phone,
    canonicalChatId
  ].map((value) => String(value || '').trim()).find(Boolean) || 'Chat';
  return {
    id: canonicalChatId,
    canonicalChatId,
    originalId,
    aliases,
    name: bestName,
    avatar: chat.avatar_url,
    phone: chat.phone || '',
    manualAlias: chat.manual_alias || '',
    whatsappName: chat.whatsapp_name || '',
    contactSource: chat.contact_source || chat.source || '',
    favorite: Boolean(chat.favorite),
    muted: Boolean(chat.muted),
    excluded: Boolean(chat.excluded),
    unread: Number(chat.unread || chat.unread_count || 0),
    stale: Boolean(chat.stale),
    last: cleanTechnicalMessageText(chat.last || chat.last_message_preview || '') || '',
    time: chat.last_at ? new Date(chat.last_at).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '',
    mine: false,
    hasConversation: chat.has_conversation === undefined ? true : Boolean(chat.has_conversation),
  };
}

const TECHNICAL_MESSAGE_VALUES = new Set([
  'unknown',
  'technical',
  'messagecontextinfo',
  'messagecontext',
  'senderkeydistribution',
  'senderkeydistributionmessage',
  'protocol',
  'protocolmessage',
  'devicesent',
  'devicesentmessage',
  'keepinchat',
  'keepinchatmessage'
]);

const PRESENTABLE_MESSAGE_TYPES = new Set([
  'text',
  'system',
  'image',
  'sticker',
  'audio',
  'video',
  'document',
  'location',
  'contact',
  'poll',
  'interactive',
  'unsupported'
]);

function normalizeApiMessageType(value = '') {
  const raw = String(value || '').trim();
  const key = raw.replace(/Message$/i, '').toLowerCase();
  if (!raw || TECHNICAL_MESSAGE_VALUES.has(key)) return 'text';
  return PRESENTABLE_MESSAGE_TYPES.has(key) ? key : 'unsupported';
}

function cleanTechnicalMessageText(value = '') {
  const raw = String(value || '').trim();
  const key = raw.replace(/Message$/i, '').toLowerCase();
  return TECHNICAL_MESSAGE_VALUES.has(key) ? '' : raw;
}

function displayTextForQuotedMessage(quotedMessage = {}) {
  const cleanText = cleanTechnicalMessageText(quotedMessage.text || '');
  if (cleanText) return cleanText;
  const normalizedType = normalizeApiMessageType(quotedMessage.messageType || quotedMessage.type || '');
  return ({
    image: 'Imagen',
    sticker: 'Sticker',
    audio: 'Audio',
    video: 'Vídeo',
    document: 'Documento',
    location: 'Ubicación',
    contact: 'Contacto',
    poll: 'Encuesta',
    unsupported: 'Mensaje no compatible'
  })[normalizedType] || 'Mensaje';
}

function comparablePhone(value = '') {
  return String(value || '').replace(/[^\d]/g, '');
}

function isTechnicalAuthorName(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return true;
  if (/@(?:s\.whatsapp\.net|c\.us|g\.us)$/i.test(raw)) return true;
  const digits = comparablePhone(raw);
  return digits.length >= 7 && /^[+\d\s().-]+$/.test(raw);
}

function resolveQuotedAuthorName(quotedMessage = {}, message = {}, chat = {}) {
  const rawName = String(
    quotedMessage.authorName ||
    quotedMessage.senderName ||
    quotedMessage.participantName ||
    ''
  ).trim();
  const quotedSender = String(quotedMessage.sender || quotedMessage.from || '').toLowerCase();
  if (quotedSender === 'me' || quotedMessage.fromMe === true) return 'Tú';
  if (rawName && !isTechnicalAuthorName(rawName)) return rawName;

  const contactName = chat.name || chat.contactName || 'contacto';
  const rawDigits = comparablePhone(rawName || quotedMessage.participant || quotedMessage.participantJid || '');
  const contactDigits = comparablePhone(chat.phone || chat.contactPhone || chat.id || '');
  if (rawDigits && contactDigits && (rawDigits.endsWith(contactDigits) || contactDigits.endsWith(rawDigits))) {
    return contactName;
  }
  if (message.from === 'me') return contactName;
  return rawDigits ? 'Tú' : contactName;
}

function shouldDisplayChatMessage(message = {}) {
  if (!message) return false;
  if (message.deleted) return true;
  if (message.hasMedia || message.viewOnce || message.location || message.contactNames?.length || message.pollName) return true;
  if (message.type === 'system') return Boolean(cleanTechnicalMessageText(message.text));
  if (message.type === 'unsupported') return true;
  return Boolean(cleanTechnicalMessageText(message.text));
}

function mapApiMessage(message, chatId = '') {
  const sentAt = message.sent_at ? new Date(message.sent_at) : new Date();
  const status = message.status || message.delivery_status || (message.sender === 'me' ? 'sent' : 'received');
  const statusLabelMap = {
    sending: ' · enviando',
    sent: ' · enviado',
    delivered: ' · entregado',
    read: ' · leído',
    failed: ' · falló'
  };
  const statusLabel = message.sender === 'me' ? (statusLabelMap[status] || '') : '';
  const metadata = message.metadata || {};
  const isGroupChat = Boolean(metadata.isGroup || String(chatId || message.chat_id || message.chatId || '').endsWith('@g.us'));
  const type = normalizeApiMessageType(message.message_type || 'text');
  const mediaType = normalizeApiMessageType(message.media_type || metadata.mediaType || type);
  const editedAt = message.edited_at || metadata.editedAt || null;
  const deletedAt = message.deleted_at || metadata.deletedAt || null;
  const deletedScope = message.deleted_scope || metadata.deletedScope || '';
  const isDeleted = Boolean(deletedAt);
  const mediaLabels = {
    image: 'Imagen',
    sticker: 'Sticker',
    audio: 'Audio',
    video: 'Vídeo',
    document: 'Documento',
    location: 'Ubicación',
    contact: 'Contacto',
    poll: 'Encuesta',
    reaction: 'Reacción',
    unsupported: 'Mensaje no compatible. Revísalo en WhatsApp.'
  };
  return {
    id: message.external_message_id || message.id || String(sentAt.getTime()),
    chatId,
    from: message.sender === 'me' ? 'me' : 'them',
    status,
    error: message.error_message || '',
    type,
    mediaType,
    hasMedia: !isDeleted && Boolean(message.has_media || metadata.hasMedia),
    mimeType: message.mime_type || metadata.mimeType || '',
    fileName: message.file_name || metadata.fileName || '',
    sizeBytes: Number(message.size_bytes || metadata.sizeBytes || 0),
    isGroup: isGroupChat,
    senderName: isGroupChat ? (message.sender_name || metadata.senderName || metadata.participantName || metadata.pushName || '') : '',
    participantId: metadata.participant || '',
    quotedMessage: metadata.quotedMessage || metadata.quoted || null,
    viewOnce: Boolean(metadata.viewOnce),
    pollName: metadata.pollName || '',
    pollOptions: Array.isArray(metadata.pollOptions) ? metadata.pollOptions : [],
    location: metadata.location || null,
    liveLocation: Boolean(metadata.liveLocation),
    contactNames: Array.isArray(metadata.contactNames) ? metadata.contactNames : [],
    text: isDeleted ? 'Mensaje eliminado' : (cleanTechnicalMessageText(message.body) || mediaLabels[mediaType] || mediaLabels[type] || ''),
    edited: Boolean(editedAt),
    editedAt,
    deleted: isDeleted,
    deletedAt,
    deletedScope,
    sentAt: sentAt.toISOString(),
    t: `hoy ${sentAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}${statusLabel}`,
  };
}

function quotedMessagePayload(message = {}, chat = {}) {
  if (!message?.id) return null;
  const quotedType = normalizeApiMessageType(message.mediaType || message.messageType || message.type || '');
  if (message.viewOnce && ['image', 'video'].includes(quotedType)) return null;
  const authorName = message.from === 'me'
    ? 'yo'
    : (message.senderName || chat.name || chat.phone || 'contacto');
  const text = String(message.text || message.fileName || message.mediaType || message.type || '').trim();
  return {
    id: message.id,
    chatId: message.chatId || chat.canonicalChatId || chat.id || '',
    sender: message.from === 'me' ? 'me' : 'match',
    authorName,
    participant: message.participantId || null,
    messageType: message.type || message.mediaType || 'text',
    text: text || 'mensaje sin texto',
    sentAt: message.sentAt || null
  };
}

const AI_MEDIA_TYPES = new Set(['image', 'video', 'audio', 'sticker', 'document', 'location', 'contact']);

function messageMediaKind(message = {}) {
  return String(message.mediaType || message.messageType || message.type || '').toLowerCase();
}

function hasAiRelevantMedia(message = {}) {
  const kind = messageMediaKind(message);
  return Boolean(message?.hasMedia || AI_MEDIA_TYPES.has(kind));
}

function isViewOnceVisualMessage(message = {}) {
  const kind = messageMediaKind(message);
  return Boolean(message?.viewOnce && ['image', 'video'].includes(kind));
}

function mediaKindLabel(kind = '') {
  return ({
    image: 'imagen',
    sticker: 'sticker',
    video: 'vídeo',
    audio: 'audio',
    document: 'documento',
    location: 'ubicación',
    contact: 'contacto',
  }[String(kind || '').toLowerCase()] || 'archivo');
}

function buildAiMediaContext(messages = [], quotedMessage = null) {
  const candidates = [
    quotedMessage ? { ...quotedMessage, _target: true } : null,
    ...messages.slice(-8)
  ].filter(Boolean).filter((message) => hasAiRelevantMedia(message) && !isViewOnceVisualMessage(message));
  if (!candidates.length) return null;
  const uniqueKinds = Array.from(new Set(candidates.map(messageMediaKind).filter(Boolean)));
  const onlyStickers = uniqueKinds.length === 1 && uniqueKinds[0] === 'sticker';
  if (onlyStickers) return null;
  const visual = uniqueKinds.some((kind) => ['image', 'video'].includes(kind));
  const hasSticker = uniqueKinds.includes('sticker');
  const video = uniqueKinds.includes('video');
  const audio = uniqueKinds.includes('audio');
  const document = uniqueKinds.includes('document');
  const labels = uniqueKinds.filter((kind) => kind !== 'sticker' || uniqueKinds.length > 1).map(mediaKindLabel).join(', ');
  const target = candidates.find((item) => item._target && messageMediaKind(item) !== 'sticker') || candidates.find((item) => messageMediaKind(item) !== 'sticker') || candidates[candidates.length - 1];
  const targetLabel = mediaKindLabel(messageMediaKind(target));
  return {
    hasMedia: true,
    hasVisual: visual,
    hasSticker,
    hasVideo: video,
    hasAudio: audio,
    hasDocument: document,
    requiresContext: video,
    labels,
    targetLabel,
    summary: hasSticker ? `Hay ${labels} en el contexto reciente. También hay stickers como señal ligera de tono/reacción.` : `Hay ${labels} en el contexto reciente.`,
    prompt: video
      ? 'Detecté un vídeo en el contexto. Para evitar inventar, describe qué ocurre o qué parte importa antes de generar.'
      : audio
        ? 'Detecté audio en el contexto. Si la transcripción no alcanza, agrega qué intención debería tener la respuesta.'
        : visual
          ? `Detecté ${targetLabel}. Si quieres, describe qué aparece o qué detalle importa para responder mejor.`
          : `Detecté ${targetLabel}. Si quieres, agrega el dato clave para que la IA no invente.`,
    placeholder: video
      ? 'Ej. En el vídeo se ve el producto fallando / está llegando al lugar / confirma la hora / quiero responder sobre el detalle final...'
      : visual
        ? 'Ej. En la imagen aparece el producto que pidió / es una captura con una fecha / quiero responder con calma sobre eso...'
        : audio
          ? 'Ej. El audio suena apurado / confirmó la hora / pidió que le pase el dato sin rodeos...'
          : 'Ej. El documento es una factura / la ubicación es el punto de encuentro / solo quiero confirmar recibido...'
  };
}// SCREEN 2 · Conexión WhatsApp con QR desktop + pairing code mobile
function ConnectScreen({ onBack, onConnected, onContinueWithoutWhatsApp }) {
  const defaultMethod = React.useMemo(() => {
    const ua = navigator.userAgent || '';
    const isNative = Boolean(WaFliAPI?.client?.IS_CAPACITOR_NATIVE);
    const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const isMobileWidth = window.matchMedia?.('(max-width: 820px)')?.matches;
    return isNative || isMobileUa || isMobileWidth ? 'code' : 'qr';
  }, []);
  const [method, setMethod] = React.useState(defaultMethod);
  const [step, setStep] = React.useState(defaultMethod === 'qr' ? 'qr' : 'number');
  const [country, setCountry] = React.useState(COUNTRY_PREFIX_OPTIONS[0][0]);
  const [phone, setPhone] = React.useState('');
  const [error, setError] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [modal, setModal] = React.useState(null);
  const [backendError, setBackendError] = React.useState('');
  const [code, setCode] = React.useState('');
  const [codeExpiresAt, setCodeExpiresAt] = React.useState(null);
  const [qrData, setQrData] = React.useState('');
  const [qrImage, setQrImage] = React.useState('');
  const [qrExpiresAt, setQrExpiresAt] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [connectionStatus, setConnectionStatus] = React.useState('idle');
  const [guidePlatform, setGuidePlatform] = React.useState(/iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'android');
  const [countryFromNetworkLoaded, setCountryFromNetworkLoaded] = React.useState(false);
  const autoQrStartedRef = React.useRef(false);
  const canUseQrFallback = !Boolean(WaFliAPI?.client?.IS_CAPACITOR_NATIVE);
  const phonePlaceholder = buildPhonePlaceholder(country);
  const canGenerate = isValidPhoneInput(phone, country);

  React.useEffect(() => {
    if (countryFromNetworkLoaded) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const result = await WaFliAPI?.system?.clientContext?.();
        const detectedPrefix = pickCountryOptionByIso(result?.client?.countryCode);
        if (!cancelled && detectedPrefix) setCountry(detectedPrefix);
      } finally {
        if (!cancelled) setCountryFromNetworkLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [countryFromNetworkLoaded]);

  React.useEffect(() => {
    let cancelled = false;
    if (!qrData) {
      setQrImage('');
      return undefined;
    }
    QRCode.toDataURL(qrData, { margin: 1, width: 260, errorCorrectionLevel: 'M' })
      .then((url) => { if (!cancelled) setQrImage(url); })
      .catch(() => { if (!cancelled) setBackendError('No hemos podido dibujar el QR. Genera uno nuevo.'); });
    return () => { cancelled = true; };
  }, [qrData]);

  const clearPairingCode = () => {
    setCode('');
    setCodeExpiresAt(null);
    setCopied(false);
  };

  const clearQr = () => {
    setQrData('');
    setQrImage('');
    setQrExpiresAt(null);
  };

  const switchToCode = () => {
    setMethod('code');
    setStep('number');
    setBackendError('');
    clearQr();
  };

  const switchToQr = () => {
    setMethod('qr');
    setStep('qr');
    setBackendError('');
    clearPairingCode();
    autoQrStartedRef.current = false;
  };

  const copy = () => {
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateQr = async (options = {}) => {
    const forceNew = options.forceNew === true;
    setBackendError('');
    clearQr();
    clearPairingCode();
    setLoading(true);
    try {
      const result = await WaFliAPI?.whatsapp?.qr?.(forceNew);
      const status = result?.status || {};
      if (status.qr) setQrData(status.qr);
      setQrExpiresAt(status.qrExpiresAt || null);
      if (status.status) setConnectionStatus(status.status);
      setStep('qr');
    } catch (apiError) {
      setBackendError(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No hemos podido generar el QR. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (step !== 'qr' || autoQrStartedRef.current) return undefined;
    autoQrStartedRef.current = true;
    generateQr();
    return undefined;
  }, [step]);

  React.useEffect(() => {
    if (step !== 'code') return undefined;
    const expiresAt = codeExpiresAt ? new Date(codeExpiresAt).getTime() : 0;
    const delay = expiresAt ? Math.max(0, expiresAt - Date.now()) : 180000;
    const timeoutId = setTimeout(() => {
      clearPairingCode();
      setModal('timeout');
    }, delay);
    return () => clearTimeout(timeoutId);
  }, [step, codeExpiresAt]);

  React.useEffect(() => {
    if (step !== 'qr') return undefined;
    const expiresAt = qrExpiresAt ? new Date(qrExpiresAt).getTime() : 0;
    if (!expiresAt) return undefined;
    const timeoutId = setTimeout(() => {
      clearQr();
      setBackendError('El QR caducó. Genera uno nuevo para vincular este navegador.');
    }, Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timeoutId);
  }, [step, qrExpiresAt]);

  React.useEffect(() => {
    if ((step !== 'code' && step !== 'qr') || !WaFliAPI?.whatsapp?.status) return undefined;
    let stopped = false;
    const tick = async () => {
      try {
        const result = await WaFliAPI.whatsapp.status();
        const status = result?.status || {};
        const tasks = result?.tasks || [];
        if (status.status) setConnectionStatus(status.status);
        if (status.connected && !stopped) onConnected && onConnected();

        if (step === 'qr') {
          if (status.qr) {
            setQrData(status.qr);
            setQrExpiresAt(status.qrExpiresAt || null);
            setBackendError('');
          } else if (['disconnected', 'reconnect_paused', 'runtime_unavailable'].includes(status.status) && status.disconnectReason) {
            setBackendError(pairingDisconnectMessage(status, '') || 'No hemos podido mantener el QR activo. Genera uno nuevo.');
          }
          return;
        }

        const latestTask = getLatestPairingTask(tasks);
        const statusCodeInfo = getFreshStatusPairingCodeInfo(status);
        const taskCodeInfo = statusCodeInfo.code ? statusCodeInfo : getFreshTaskPairingCodeInfo(tasks);
        const freshCode = taskCodeInfo.code;
        const localCodeStillFresh = code && (!codeExpiresAt || isFutureDate(codeExpiresAt));
        const visibleCode = freshCode || (localCodeStillFresh ? code : '');
        if (freshCode) {
          setCode(freshCode);
          setCodeExpiresAt(taskCodeInfo.expiresAt || null);
        } else if (code && !localCodeStillFresh) {
          clearPairingCode();
          setBackendError('El código caducó. Genera uno nuevo antes de abrir tu WhatsApp.');
        }
        const taskMessage = taskPairingMessage(latestTask);
        if (taskMessage) {
          setBackendError(taskMessage);
          setLoading(false);
          return;
        }
        const disconnectMessage = pairingDisconnectMessage(status, visibleCode);
        if (!status.connected && disconnectMessage && ['disconnected', 'reconnect_paused', 'runtime_unavailable', 'pairing_code'].includes(status.status)) {
          setBackendError(disconnectMessage);
        }
      } catch (_) {}
    };
    tick();
    const interval = setInterval(tick, 2500);
    return () => { stopped = true; clearInterval(interval); };
  }, [step, onConnected, code, codeExpiresAt]);

  const generateCode = async (options = {}) => {
    const forceNew = options.forceNew === true;
    if (!isValidPhoneInput(phone, country)) {
      setError('Revisa el número. Parece inválido.');
      return;
    }
    setError('');
    setBackendError('');
    clearPairingCode();
    clearQr();
    setLoading(true);
    const fullPhone = phoneWithCountryPrefix(phone, country);
    try {
      const result = await WaFliAPI?.whatsapp?.pairingCode?.(fullPhone, undefined, forceNew);
      const status = result?.status || {};
      const statusCodeInfo = getFreshStatusPairingCodeInfo(status);
      const taskCodeInfo = statusCodeInfo.code ? statusCodeInfo : getFreshTaskPairingCodeInfo(result?.tasks || []);
      setCode(taskCodeInfo.code);
      setCodeExpiresAt(taskCodeInfo.expiresAt || null);
      if (status.status) setConnectionStatus(status.status);
      setStep('code');
    } catch (apiError) {
      setBackendError(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No hemos podido generar el código. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const qrInstructions = [
    <>Abre <b>WhatsApp</b> en tu móvil.</>,
    <>Entra a <b>Dispositivos vinculados</b>.</>,
    <>Pulsa <b>Vincular un dispositivo</b>.</>,
    <>Escanea el QR de esta pantalla.</>,
  ];

  const codeInstructions = [
    <>Abre <b>tu WhatsApp</b> en tu móvil.</>,
    <>Pulsa <b>Configuración</b> o <b>Ajustes</b>.</>,
    <>Pulsa <b>Dispositivos vinculados</b>.</>,
    <>Pulsa <b>Vincular un dispositivo</b>.</>,
    <>Pulsa <b>Vincular con número de teléfono</b>.</>,
    <>Introduce el código de arriba.</>,
  ];

  const MethodToggle = ({ target }) => (
    <button className="btn btn--text" onClick={target === 'qr' ? switchToQr : switchToCode} disabled={loading}>
      Prefiero usar {target === 'qr' ? 'QR' : 'código'}
    </button>
  );

  return (
    <>
      <AppHeader
        title="Conectar WhatsApp opcional"
        leading={<IconButton onClick={onBack} label="Atrás"><Icons.Back size={20} /></IconButton>}
      />
      <div className="scroll-y">
        <div style={{padding: '20px 22px 32px'}}>
          <div className="onboarding-progress">
            <span>WhatsApp opcional</span>
            <span className="onboarding-progress__bar"><span style={{width: '80%'}} /></span>
            <span>Cuando quieras</span>
          </div>
          <p className="t-body" style={{color: 'var(--text-secondary)', margin: '0 0 24px', textWrap: 'pretty'}}>
            {method === 'qr'
              ? 'Escanea un QR desde WhatsApp para vincular este navegador en menos de un minuto.'
              : 'Introduce tu número y te damos un código para vincular desde el móvil.'}
          </p>

          {typeof onContinueWithoutWhatsApp === 'function' ? (
            <div className="card" style={{padding: 12, marginBottom: 16, background: 'var(--accent-soft)', borderColor: 'rgba(0,0,0,0.06)', display: 'grid', gap: 10}}>
              <p className="t-small" style={{margin: 0, color: 'var(--text-secondary)', textWrap: 'pretty'}}>
                No necesitas instalar WhatsApp para usar WaFli. Puedes usar Herramientas ahora y conectar chats cuando quieras.
              </p>
              <button type="button" className="btn btn--secondary btn--full" onClick={onContinueWithoutWhatsApp}>
                Usar WaFli sin WhatsApp
              </button>
            </div>
          ) : null}

          {step === 'number' ? (
            <div className="card" style={{padding: 14}}>
              <label className="t-small" style={{display: 'block', marginBottom: 8, fontWeight: 500}}>País</label>
              <CountryPrefixSelect value={country} onChange={setCountry} style={{width: '100%', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '11px 12px', outline: 'none', fontSize: 16, marginBottom: 12, fontFamily: 'inherit'}} />
              <label className="t-small" style={{display: 'block', marginBottom: 8, fontWeight: 500}}>Número de teléfono</label>
              <input value={phone} onChange={(e) => setPhone(sanitizeLocalPhoneInput(e.target.value, country))} placeholder={phonePlaceholder} inputMode="tel" maxLength={16} style={{width: '100%', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '11px 12px', outline: 'none', fontSize: 16, fontFamily: 'inherit'}} />
              {error ? <p className="t-caption" style={{marginTop: 8, color: 'var(--danger)'}}>{error}</p> : null}
              <button className="btn btn--primary btn--full" style={{marginTop: 12, opacity: canGenerate && !loading ? 1 : 0.55}} disabled={!canGenerate || loading} onClick={() => generateCode()}>
                {loading ? 'Generando...' : 'Generar código'}
              </button>
              {canUseQrFallback ? <div style={{marginTop: 8, textAlign: 'center'}}><MethodToggle target="qr" /></div> : null}
            </div>
          ) : null}

          {step === 'qr' ? (
            <>
              <div style={{background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 18, padding: '22px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 22}}>
                <span className="t-caption" style={{textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600}}>Vinculación por QR</span>
                <div style={{width: 280, maxWidth: '100%', aspectRatio: '1', borderRadius: 20, background: '#fff', border: '1px solid var(--border-strong)', display: 'grid', placeItems: 'center', padding: 12}}>
                  {qrImage ? <img src={qrImage} alt="QR para vincular WhatsApp" style={{width: '100%', height: '100%', objectFit: 'contain'}} /> : <span className="t-small" style={{display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)'}}><Spinner size={16} /> Generando QR...</span>}
                </div>
                <span className="t-small" style={{color: 'var(--text-secondary)', textAlign: 'center'}}>No cierres esta pantalla hasta que WhatsApp confirme la vinculación.</span>
              </div>

              <ol style={{margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14}}>
                {qrInstructions.map((item, i) => (
                  <li key={i} style={{display: 'flex', gap: 14, alignItems: 'flex-start'}}>
                    <span className="t-mono" style={{fontSize: 12, fontWeight: 600, width: 22, height: 22, borderRadius: 6, background: 'var(--gray-100)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1}}>{i + 1}</span>
                    <span style={{fontSize: 15, lineHeight: 1.5}}>{item}</span>
                  </li>
                ))}
              </ol>
              <div style={{marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 14}}><Spinner size={16} /><span>{connectionStatus === 'qr' ? 'QR listo. Esperando escaneo...' : 'Preparando vinculación...'}</span></div>
              {backendError ? <p className="t-caption" style={{marginTop: 10, color: 'var(--danger)', textAlign: 'center'}}>{backendError}</p> : null}
              <div className="col gap-2" style={{marginTop: 20}}>
                <button className="btn btn--secondary btn--full" onClick={() => generateQr({ forceNew: true })} disabled={loading}>{loading ? 'Generando...' : 'Generar QR nuevo'}</button>
                <MethodToggle target="code" />
              </div>
            </>
          ) : null}

          {step === 'code' ? (
            <>
              <div style={{background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 24}}>
                <span className="t-caption" style={{textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500}}>Tu código</span>
                <div className="row gap-3" style={{alignItems: 'center'}}>
                  {code ? <span className="t-mono" style={{fontSize: 42, fontWeight: 600, letterSpacing: '0.03em', color: 'var(--text)'}}>{code}</span> : <span className="t-small" style={{display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)'}}><Spinner size={16} /> Generando código...</span>}
                </div>
                <button className="btn btn--ghost btn--sm" onClick={copy} disabled={!code} style={{color: copied ? 'var(--success)' : 'var(--accent)', opacity: code ? 1 : 0.55}}>
                  {copied ? <><Icons.Check size={14} sw={2.5} /> Copiado</> : <><Icons.Copy size={14} /> Copiar</>}
                </button>
              </div>
              <ol style={{margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14}}>
                {codeInstructions.map((item, i) => (
                  <li key={i} style={{display: 'flex', gap: 14, alignItems: 'flex-start'}}>
                    <span className="t-mono" style={{fontSize: 12, fontWeight: 600, width: 22, height: 22, borderRadius: 6, background: 'var(--gray-100)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1}}>{i + 1}</span>
                    <span style={{fontSize: 15, lineHeight: 1.5}}>{item}</span>
                  </li>
                ))}
              </ol>
              <div className="pairing-guide-card">
                <div className="pairing-guide-card__tabs">
                  <button className={'pairing-guide-card__tab ' + (guidePlatform === 'ios' ? 'pairing-guide-card__tab--active' : '')} onClick={() => setGuidePlatform('ios')}>iPhone</button>
                  <button className={'pairing-guide-card__tab ' + (guidePlatform === 'android' ? 'pairing-guide-card__tab--active' : '')} onClick={() => setGuidePlatform('android')}>Android</button>
                </div>
                <div className="pairing-guide-card__shots" aria-label={`Tutorial para vincular en ${getPairingGuide(guidePlatform).title}`}>
                  {getPairingGuide(guidePlatform).steps.map((item, index) => (
                    <article className="pairing-guide-card__shot" key={item.src}>
                      <span className="pairing-guide-card__shot-index">{index + 1}</span>
                      <img src={`/onboarding/${item.src}`} alt={item.title} loading="lazy" />
                      <div className="pairing-guide-card__shot-copy"><strong>{item.title}</strong><span>{item.text}</span></div>
                    </article>
                  ))}
                </div>
                <ol className="pairing-guide-card__steps">{getPairingGuide(guidePlatform).checklist.map((item) => <li key={item}>{item}</li>)}</ol>
              </div>
              <div style={{marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 14}}><Spinner size={16} /><span>{connectionStatus === 'pairing_code' ? 'Código listo. Esperando vinculación...' : code ? 'Código listo. Introdúcelo en tu WhatsApp.' : 'Esperando vinculación...'}</span></div>
              {backendError ? <p className="t-caption" style={{marginTop: 10, color: 'var(--danger)', textAlign: 'center'}}>{backendError}</p> : null}
              <div className="col gap-2" style={{marginTop: 20}}>
                <button className="btn btn--secondary btn--full" onClick={() => generateCode({ forceNew: true })} disabled={loading || !canGenerate}>{loading ? 'Generando...' : (code || backendError ? 'Generar código nuevo' : 'Generar código')}</button>
                {canUseQrFallback ? <MethodToggle target="qr" /> : null}
                <button className="btn btn--text" onClick={() => { setBackendError(''); clearPairingCode(); setStep('number'); }}>Cambiar número</button>
              </div>
            </>
          ) : null}
        </div>
      </div>
      {modal === 'timeout' ? (
        <div style={{position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(15,20,30,0.35)', display: 'grid', placeItems: 'center', padding: 20}}>
          <div className="card" style={{width: '100%', maxWidth: 360, padding: 16}}>
            <p style={{margin: '0 0 12px', fontWeight: 600}}>El código ha caducado</p>
            <p className="t-small" style={{margin: '0 0 14px', color: 'var(--text-secondary)'}}>¿Quieres generar uno nuevo?</p>
            <div className="col gap-2">
              <button className="btn btn--primary btn--full" onClick={() => { setModal(null); generateCode({ forceNew: true }); }}>Generar nuevo código</button>
              <button className="btn btn--secondary btn--full" onClick={() => setModal(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
function Spinner({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{animation: 'spin 0.9s linear infinite'}}>
      <circle cx="12" cy="12" r="9" stroke="var(--gray-200)" strokeWidth="2.5" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="var(--accent)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </svg>
  );
}

// SCREEN 3 · Lista de conversaciones (Chats)
function ChatsListScreen({ onOpenChat, onOpenQuota, empty = false, onNavigate, whatsappInterrupted = false, offline = false, whatsappUnavailable = false, onReconnectWhatsApp }) {
  const [searching, setSearching] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [activeFilter, setActiveFilter] = React.useState('all'); // all | favorites | unread | stale | recent
  const [lastRefreshAt, setLastRefreshAt] = React.useState('');
  const [sheet, setSheet] = React.useState(null); // 'new-chat' | 'new-contact' | null
  const [contactSearch, setContactSearch] = React.useState('');
  const [newContactName, setNewContactName] = React.useState('');
  const [newContactCountry, setNewContactCountry] = React.useState(COUNTRY_PREFIX_OPTIONS[0][0]);
  const [newContactPhone, setNewContactPhone] = React.useState('');
  const [newContactCountryLoaded, setNewContactCountryLoaded] = React.useState(false);
  const [contactSuggestions, setContactSuggestions] = React.useState([]);
  const [loadingContacts, setLoadingContacts] = React.useState(false);
  const filterOptions = [
    ['all', 'Todos'],
    ['favorites', 'Favoritas'],
    ['unread', 'No leídos'],
  ];
  const [contacts, setContacts] = React.useState([]);
  const [loadingChats, setLoadingChats] = React.useState(false);
  const [apiError, setApiError] = React.useState('');
  const [manualAiContextVersion, setManualAiContextVersion] = React.useState(0);
  const [manualAiFallbackActive, setManualAiFallbackActive] = React.useState(false);
  React.useEffect(() => {
    const handleManualContextUpdate = () => setManualAiContextVersion((value) => value + 1);
    window.addEventListener(MANUAL_AI_CONTEXT_EVENT, handleManualContextUpdate);
    return () => window.removeEventListener(MANUAL_AI_CONTEXT_EVENT, handleManualContextUpdate);
  }, []);
  React.useEffect(() => {
    if (!filterOptions.some(([key]) => key === activeFilter)) setActiveFilter('all');
  }, [activeFilter]);
  React.useEffect(() => {
    if (newContactCountryLoaded) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const result = await WaFliAPI?.system?.clientContext?.();
        const detectedPrefix = pickCountryOptionByIso(result?.client?.countryCode);
        if (!cancelled && detectedPrefix && !newContactPhone && newContactCountry === COUNTRY_PREFIX_OPTIONS[0][0]) {
          setNewContactCountry(detectedPrefix);
        }
      } finally {
        if (!cancelled) setNewContactCountryLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [newContactCountryLoaded, newContactCountry, newContactPhone]);
  const loadChats = React.useCallback(async (options = {}) => {
    if (!WaFliAPI?.chats?.list || !WaFliAPI?.client?.isAuthenticated?.()) return;
    const silent = options.silent === true;
    if (!silent) setLoadingChats(true);
    setApiError('');
    try {
      const chatResult = await WaFliAPI.chats.list({
        limit: CHAT_LIST_LIMIT,
        activeOnly: true,
        includeSilentGroups: false
      });
      const chats = (chatResult.chats || [])
        .map(mapApiChat)
        .map(chat => ({ ...chat, hasConversation: true }))
        .filter(isUsefulConversationItem);
      setManualAiFallbackActive(false);
      setContacts(mergeCanonicalChats(chats));
    } catch (error) {
      if (error?.code === 'whatsapp_required') {
        setContacts([]);
        setManualAiFallbackActive(true);
        if (!silent) setApiError('');
        return;
      }
      if (!silent) setApiError(WaFliAPI.client.toUserMessage(error));
    } finally {
      if (!silent) setLoadingChats(false);
    }
  }, []);
  const loadContactSuggestions = React.useCallback(async (searchTerm) => {
    const query = String(searchTerm || '').trim();
    if (!WaFliAPI?.chats?.contacts || !WaFliAPI?.client?.isAuthenticated?.() || query.length < CONTACT_SEARCH_MIN_LENGTH) {
      setContactSuggestions([]);
      setLoadingContacts(false);
      return;
    }
    setLoadingContacts(true);
    try {
      const result = await WaFliAPI.chats.contacts({
        q: query,
        limit: CONTACT_SEARCH_LIMIT,
        activeOnly: true,
        excludeLid: true,
        includeGroups: false,
        onlyUseful: true
      });
      const suggestions = (result.contacts || [])
        .map(mapApiChat)
        .filter(isUsefulContactSuggestion);
      setContactSuggestions(mergeCanonicalChats(suggestions).slice(0, CONTACT_SEARCH_LIMIT));
    } catch (error) {
      setApiError(WaFliAPI?.client?.toUserMessage?.(error) || 'No hemos podido buscar contactos.');
      setContactSuggestions([]);
    } finally {
      setLoadingContacts(false);
    }
  }, []);
  React.useEffect(() => {
    loadChats();
    let reloadTimer = null;
    const scheduleSilentLoad = (delay = 250) => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => loadChats({ silent: true }), delay);
    };
    const unsubscribe = WaFliAPI?.chats?.subscribeEvents
      ? WaFliAPI.chats.subscribeEvents(({ event }) => {
          if (event === 'chat.updated' || event === 'message.created' || event === 'message.updated' || event === 'message.deleted') {
            scheduleSilentLoad(event === 'message.created' ? 120 : 250);
          }
        }, () => {})
      : null;
    const handleFocus = () => loadChats({ silent: true });
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadChats({ silent: true });
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      if (unsubscribe) unsubscribe();
      if (reloadTimer) clearTimeout(reloadTimer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadChats]);
  React.useEffect(() => {
    const query = contactSearch.trim();
    if (sheet !== 'new-chat' || query.length < CONTACT_SEARCH_MIN_LENGTH) {
      setContactSuggestions([]);
      setLoadingContacts(false);
      return undefined;
    }
    const timer = setTimeout(() => loadContactSuggestions(query), 280);
    return () => clearTimeout(timer);
  }, [sheet, contactSearch, loadContactSuggestions]);
  const matchesSearch = (item, query) => [
    item.name,
    item.phone,
    item.id,
    item.canonicalChatId,
    ...normalizeApiAliases(item.aliases).map(alias => alias.id),
  ].some(value => String(value || '').toLowerCase().includes(query.toLowerCase()));
  const manualAiContext = React.useMemo(() => loadManualAiContext(), [manualAiContextVersion]);
  const manualAiChat = null;
  const chatSource = contacts;
  const filtered = q ? chatSource.filter(m => matchesSearch(m, q)) : chatSource;
  const withConversation = filtered.filter(m => m.hasConversation && !m.excluded);
  const filterByMode = (items) => {
    switch (activeFilter) {
      case 'favorites': return items.filter(m => m.favorite);
      case 'unread': return items.filter(m => (m.unread || 0) > 0);
      case 'stale': return items.filter(m => m.stale);
      case 'recent': return items.filter(m => String(m.time || '').includes('hace') || String(m.time || '').includes('hoy'));
      default: return items;
    }
  };
  const filteredForListBase = filterByMode(withConversation);
  const filteredForList = filteredForListBase;
  const showStandaloneEmptyState = !q && (empty || ((whatsappUnavailable || manualAiFallbackActive) && contacts.length === 0 && !loadingChats));
  const contactQuery = contactSearch.trim();
  const recentConversationContacts = contacts
    .filter(m => m.hasConversation && !m.excluded && isUsefulConversationItem(m))
    .slice(0, CONTACT_SEARCH_LIMIT);
  const matchingRecentContacts = contactQuery.length >= CONTACT_SEARCH_MIN_LENGTH
    ? recentConversationContacts.filter(m => matchesSearch(m, contactQuery))
    : [];
  const filteredContacts = contactQuery.length >= CONTACT_SEARCH_MIN_LENGTH
    ? mergeCanonicalChats([...matchingRecentContacts, ...contactSuggestions]).slice(0, CONTACT_SEARCH_LIMIT)
    : recentConversationContacts;
  const newChatEmptyText = contactQuery.length >= CONTACT_SEARCH_MIN_LENGTH
    ? 'No encontramos ese contacto activo.'
    : 'Busca por nombre o número. Mostramos solo chats activos para no cargar toda tu agenda.';
  const refreshChats = () => {
    loadChats();
    setLastRefreshAt(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    setMenuOpen(false);
  };
  const markAllRead = () => {
    setContacts(prev => prev.map(c => ({ ...c, unread: 0 })));
    setMenuOpen(false);
  };
  const toggleFavorite = (contactId) => {
    const next = contacts.find(c => c.id === contactId)?.favorite !== true;
    setContacts(prev => prev.map(c => (
      c.id === contactId ? { ...c, favorite: !c.favorite } : c
    )));
    WaFliAPI?.chats?.updateMeta?.(contactId, { favorite: next }).catch((error) => setApiError(WaFliAPI.client.toUserMessage(error)));
  };
  const startConversation = async (contactId) => {
    setApiError('');
    try {
      const result = await WaFliAPI?.chats?.start?.(contactId);
      if (result?.chat) {
        const started = mapApiChat(result.chat);
        setContacts(prev => mergeCanonicalChats([
          ...prev.map(c => sameChatIdentity(c, contactId) || sameChatIdentity(c, started) ? { ...c, ...started, hasConversation: true } : c),
          { ...started, hasConversation: true },
        ]));
      }
      setSheet(null);
      setContactSearch('');
      setContactSuggestions([]);
      setMenuOpen(false);
      onOpenChat(result?.chat ? mapApiChat(result.chat).id : contactId);
    } catch (error) {
      setApiError(WaFliAPI?.client?.toUserMessage?.(error) || 'No hemos podido iniciar la conversación.');
    }
  };
  const createContact = async () => {
    const name = newContactName.trim();
    const cleanPhone = phoneWithCountryPrefix(newContactPhone, newContactCountry);
    if (!name || !isValidPhoneInput(newContactPhone, newContactCountry)) return;
    setApiError('');
    try {
      const result = await WaFliAPI?.chats?.createContact?.({ name, phone: cleanPhone });
      const created = result?.chat ? mapApiChat(result.chat) : null;
      if (created) {
        setContacts(prev => {
          const rest = prev.filter(c => !sameChatIdentity(c, created));
          return [{ ...created, hasConversation: true }, ...rest];
        });
        setNewContactName('');
        setNewContactCountry(COUNTRY_PREFIX_OPTIONS[0][0]);
        setNewContactPhone('');
        setSheet(null);
        setContactSearch('');
        setContactSuggestions([]);
        setMenuOpen(false);
        onOpenChat(created.canonicalChatId || created.id);
      }
    } catch (error) {
      setApiError(WaFliAPI?.client?.toUserMessage?.(error) || 'No hemos podido crear el contacto.');
    }
  };
  const canSaveContact = newContactName.trim().length > 0 && isValidPhoneInput(newContactPhone, newContactCountry);
  return (
    <>
      {searching ? (
        <div className="appheader" style={{gap: 8}}>
          <Icons.Search size={18} style={{color: 'var(--text-tertiary)', flexShrink: 0}} />
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar chats..."
            style={{flex: 1, border: 'none', outline: 'none', fontSize: 16, background: 'transparent'}}
          />
          <button className="btn btn--text" style={{fontSize: 14, padding: '4px 8px'}} onClick={() => { setSearching(false); setQ(''); }}>Cancelar</button>
        </div>
      ) : (
        <AppHeader
          title="Chats"
          showQuota
          trailing={<>
            <IconButton onClick={() => setSearching(true)} label="Buscar"><Icons.Search size={20} /></IconButton>
            <div style={{position: 'relative'}}>
              <IconButton onClick={() => setMenuOpen(v => !v)} label="Más"><Icons.More size={20} /></IconButton>
              {menuOpen && (
                <>
                  <button
                    onClick={() => setMenuOpen(false)}
                    aria-label="Cerrar menú"
                    style={{position: 'fixed', inset: 0, background: 'transparent', border: 'none', zIndex: 29}}
                  />
                  <div style={getHeaderMenuDropdownStyle(220)}>
                    <button onClick={refreshChats} style={menuActionStyle}>
                      <Icons.Refresh size={16} /> Refrescar
                    </button>
                    <button onClick={markAllRead} style={{...menuActionStyle, borderTop: '1px solid var(--border)'}}>
                      <Icons.Check size={16} /> Marcar todo leído
                    </button>
                    <button
                      onClick={() => { setSheet('new-chat'); setContactSearch(''); setContactSuggestions([]); setMenuOpen(false); }}
                      style={{...menuActionStyle, borderTop: '1px solid var(--border)'}}
                    >
                      <Icons.Chats size={16} /> Nueva conversación
                    </button>
                    <button
                      onClick={() => { setSheet('new-contact'); setMenuOpen(false); }}
                      style={{...menuActionStyle, borderTop: '1px solid var(--border)'}}
                    >
                      <Icons.User size={16} /> Crear nuevo contacto
                    </button>
                    <button
                      onClick={() => { onOpenQuota && onOpenQuota(); setMenuOpen(false); }}
                      style={{...menuActionStyle, borderTop: '1px solid var(--border)'}}
                    >
                      <Icons.Plan size={16} /> Mi plan
                    </button>
                  </div>
                </>
              )}
            </div>
          </>}
        />
      )}
      {(whatsappInterrupted || manualAiFallbackActive) && (
        <div style={{
          margin: '10px 16px 0',
          borderRadius: 12,
          border: '1px solid #f2cc8f',
          background: '#fff7e8',
          padding: '9px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}>
          <span className="t-small" style={{color: '#7a4d0b'}}>Puedes usar Herramientas sin WhatsApp. Conecta WhatsApp solo para traer tus chats reales.</span>
          <button className="btn btn--text" style={{height: 26, color: '#7a4d0b', fontWeight: 600}} onClick={onReconnectWhatsApp}>Conectar</button>
        </div>
      )}
      {offline && (
        <div style={{
          margin: '10px 16px 0',
          borderRadius: 12,
          border: '1px solid #f2cc8f',
          background: '#fff7e8',
          padding: '9px 10px',
        }}>
          <span className="t-small" style={{color: '#7a4d0b'}}>Sin conexión a internet. No podemos actualizar tus chats.</span>
        </div>
      )}
      <div className="chat-toolbar">
        <div className="chat-toolbar__filters" aria-label="Filtros de chats">
          {filterOptions.map(([key, label]) => (
            <button
              key={key}
              className={'chat-filter-chip ' + (activeFilter === key ? 'chat-filter-chip--active' : '')}
              onClick={() => setActiveFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {lastRefreshAt && (
          <div className="t-caption" style={{textAlign: 'right', marginTop: 4}}>
            Actualizado: {lastRefreshAt}
          </div>
        )}
      </div>
      <div className="scroll-y">
        {loadingChats && (
          <div style={{padding: '10px 16px'}}>
            <span className="t-caption">Cargando chats...</span>
          </div>
        )}
        {apiError && (
          <div style={{padding: '10px 16px'}}>
            <div className="card" style={{padding: 10, borderColor: 'rgba(180,30,30,0.25)'}}>
              <span className="t-small" style={{color: 'var(--danger)'}}>{apiError}</span>
              <button className="btn btn--text" style={{height: 28, color: 'var(--danger)'}} onClick={loadChats}>Reintentar</button>
            </div>
          </div>
        )}
        {showStandaloneEmptyState ? (
          <>
            <EmptyState
              icon={<Icons.Empty size={32} sw={1.4} />}
              title={whatsappUnavailable ? "WhatsApp es opcional" : "Aún no tienes chats activos"}
              subtitle={whatsappUnavailable ? "Puedes usar Herramientas para generar respuestas sin conectar WhatsApp. Conecta WhatsApp cuando quieras para traer tus chats reales." : "Cuando hables con alguien desde tu WhatsApp aparecerán aquí."}
            />
            <div className="card" style={{margin: '0 16px 16px', padding: 12, display: 'grid', gap: 10}}>
              <button type="button" className="btn btn--primary btn--full" onClick={() => onNavigate && onNavigate('tools')}>
                Ir a Herramientas
              </button>
              {onReconnectWhatsApp && (
                <button type="button" className="btn btn--secondary btn--full" onClick={onReconnectWhatsApp}>
                  Conectar WhatsApp
                </button>
              )}
            </div>
          </>
        ) : (
          <div>
            {filteredForList.map(m => (
              <ConvCard
                key={m.id}
                match={m}
                onClick={() => onOpenChat(m.canonicalChatId || m.id)}
                onToggleFavorite={() => toggleFavorite(m.canonicalChatId || m.id)}
              />
            ))}
            {filteredForList.length === 0 && (
              <div style={{padding: '40px 24px', textAlign: 'center'}}>
                <span className="t-small" style={{color: 'var(--text-secondary)'}}>
                  {q ? `Ningún chat con "${q}".` : 'No hay chats para ese filtro.'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      <BottomNav active="chats" onChange={onNavigate} />
      <BottomSheet open={sheet === 'new-chat'} onClose={() => setSheet(null)} height="92%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%', padding: '4px 18px 0'}}>
          <div className="row gap-2" style={{alignItems: 'center', marginBottom: 10}}>
            <Icons.Chats size={18} style={{color: 'var(--accent)'}} />
            <span className="t-h3">Nueva conversación</span>
          </div>
          <div style={{display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 12}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 8, background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', flex: 1, minWidth: 0}}>
              <Icons.Search size={16} style={{color: 'var(--text-tertiary)', flexShrink: 0}} />
              <input
                autoFocus
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                placeholder="Buscar por nombre o número"
                style={{flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 16}}
              />
            </div>
            <button className="btn btn--secondary btn--md" onClick={() => loadContactSuggestions(contactSearch)} disabled={contactSearch.trim().length < CONTACT_SEARCH_MIN_LENGTH || loadingContacts} style={{paddingInline: 12}}>
              Buscar
            </button>
          </div>
          <div className="scroll-y" style={{flex: 1, minHeight: 0, margin: '0 -18px', padding: '0 18px 12px', overflowY: 'auto'}}>
            {contactQuery.length < CONTACT_SEARCH_MIN_LENGTH && recentConversationContacts.length > 0 && (
              <div className="t-caption" style={{margin: '0 0 10px', color: 'var(--text-secondary)'}}>
                Chats activos recientes
              </div>
            )}
            {loadingContacts && (
              <div style={{padding: '14px 4px'}}>
                <span className="t-caption">Buscando contactos activos...</span>
              </div>
            )}
            {!loadingContacts && filteredContacts.map(c => (
              <button key={c.id} onClick={() => startConversation(c.id)} style={contactRowStyle}>
                <Avatar name={c.name} src={c.avatar} size={40} />
                <div className="col" style={{flex: 1, minWidth: 0}}>
                  <span style={{fontSize: 14.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{c.name}</span>
                  <span className="t-caption" style={{fontSize: 12}}>
                    {c.hasConversation ? 'Chat activo' : 'Contacto guardado'}{c.phone ? ` - ${c.phone}` : ''}
                  </span>
                </div>
                <Icons.Chevron size={15} sw={2} style={{color: 'var(--text-tertiary)'}} />
              </button>
            ))}
            {!loadingContacts && filteredContacts.length === 0 && (
              <div style={{padding: '30px 4px', textAlign: 'center'}}>
                <span className="t-small" style={{color: 'var(--text-secondary)'}}>{newChatEmptyText}</span>
              </div>
            )}
          </div>
          <div style={{position: 'sticky', bottom: 0, zIndex: 80, flexShrink: 0, background: 'var(--bg)', borderTop: '1px solid var(--border)', padding: '10px 0 calc(12px + var(--safe-bottom))', display: 'flex', gap: 8}}>
            <button className="btn btn--secondary btn--md" style={{flex: 1}} onClick={() => setSheet(null)}>Cerrar</button>
            <button className="btn btn--primary btn--md" style={{flex: 1.35}} onClick={() => setSheet('new-contact')}>
              <Icons.Plus size={16} /> Crear contacto
            </button>
          </div>
        </div>
      </BottomSheet>
      <BottomSheet open={sheet === 'new-contact'} onClose={() => setSheet(null)} height="82%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%', overflowY: 'auto', padding: '4px 18px 0'}}>
          <div className="row gap-2" style={{alignItems: 'center', marginBottom: 8}}>
            <Icons.User size={18} style={{color: 'var(--accent)'}} />
            <span className="t-h3">Crear contacto</span>
          </div>
          <p className="t-small" style={{color: 'var(--text-secondary)', margin: '0 0 14px'}}>Añádelo aquí y empieza una conversación al momento.</p>
          <label className="t-small" style={{marginBottom: 6, fontWeight: 500}}>Nombre del contacto</label>
          <input
            value={newContactName}
            onChange={e => setNewContactName(e.target.value)}
            placeholder="Ej. Sofía Ramírez"
            autoComplete="off"
            autoCorrect="off"
            enterKeyHint="next"
            style={{
              width: '100%',
              border: '1px solid var(--border-strong)',
              borderRadius: 12,
              padding: '11px 12px',
              outline: 'none',
              fontSize: 16,
              marginBottom: 14,
              fontFamily: 'inherit',
            }}
          />
          <label className="t-small" style={{marginBottom: 6, fontWeight: 500}}>Número de contacto</label>
          <CountryPrefixSelect
            value={newContactCountry}
            onChange={setNewContactCountry}
            style={{
              width: '100%',
              border: '1px solid var(--border-strong)',
              borderRadius: 12,
              padding: '11px 12px',
              outline: 'none',
              fontSize: 16,
              marginBottom: 8,
              fontFamily: 'inherit'
            }}
          />
          <input
            value={newContactPhone}
            onChange={e => setNewContactPhone(sanitizePhoneInput(e.target.value))}
            placeholder={buildPhonePlaceholder(newContactCountry)}
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="done"
            maxLength={16}
            style={{
              width: '100%',
              border: '1px solid var(--border-strong)',
              borderRadius: 12,
              padding: '11px 12px',
              outline: 'none',
              fontSize: 16,
              marginBottom: 14,
              fontFamily: 'inherit',
            }}
          />
          <div className="row gap-2" style={{position: 'sticky', bottom: 0, zIndex: 80, flexShrink: 0, margin: '18px -18px 0', padding: '10px 18px calc(12px + var(--safe-bottom))', background: 'var(--bg)', borderTop: '1px solid var(--border)'}}>
            <button className="btn btn--secondary btn--md" style={{flex: 1}} onClick={() => setSheet('new-chat')}>Volver</button>
            <button className="btn btn--primary btn--md" style={{flex: 1.2, opacity: canSaveContact ? 1 : 0.55}} disabled={!canSaveContact} onClick={createContact}>
              Guardar y continuar
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
const menuActionStyle = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  padding: '11px 12px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 14.5,
  color: 'var(--text)',
};
function getHeaderMenuDropdownStyle(width = 240) {
  return {
    position: 'fixed',
    top: 'calc(var(--safe-top) + 58px)',
    right: 'calc(var(--safe-right) + 12px)',
    zIndex: 300,
    width: `min(${width}px, calc(100vw - 24px - var(--safe-left) - var(--safe-right)))`,
    maxWidth: 'calc(100vw - 24px - var(--safe-left) - var(--safe-right))',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    boxShadow: 'var(--sh-card)',
    overflow: 'hidden',
  };
}
const contactRowStyle = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 2px',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--border)',
  textAlign: 'left',
  cursor: 'pointer',
};

function MessageStatus({ status }) {
  const labels = {
    sending: 'enviando',
    sent: 'enviado',
    delivered: 'entregado',
    read: 'leído',
    failed: 'falló'
  };
  const label = labels[status];
  if (!label) return null;
  return (
    <div className="t-caption" style={{
      marginTop: 3,
      textAlign: 'right',
      fontSize: 10.5,
      color: status === 'failed' ? 'var(--danger)' : status === 'read' ? 'var(--accent)' : 'var(--text-tertiary)',
      fontWeight: status === 'failed' ? 700 : 500,
    }}>
      {label}
    </div>
  );
}

function messageMetaAlreadyHasStatus(message = {}) {
  return /\b(?:enviando|enviado|entregado|le[ií]do|fall[oó])\b/i.test(String(message.t || message.time || ''));
}

function ConvCard({ match, onClick, onToggleFavorite, onLongPress }) {
  const holdRef = React.useRef(null);
  const startHold = () => {
    if (!onLongPress) return;
    holdRef.current = setTimeout(() => onLongPress(), 450);
  };
  const clearHold = () => {
    if (holdRef.current) clearTimeout(holdRef.current);
    holdRef.current = null;
  };
  return (
    <div className="conv-card" style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', background: 'transparent', border: 'none',
      borderBottom: '1px solid var(--border)', textAlign: 'left',
    }}>
      <button onClick={onClick} onMouseDown={startHold} onMouseUp={clearHold} onMouseLeave={clearHold} onTouchStart={startHold} onTouchEnd={clearHold} style={{
        display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0,
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0,
      }}>
        <Avatar name={match.name} src={match.avatar} size={40} />
      <div style={{flex: 1, minWidth: 0}}>
        <div className="row" style={{justifyContent: 'space-between', gap: 8, marginBottom: 2}}>
          <div className="row gap-1" style={{minWidth: 0}}>
            <span className="conv-card__name" style={{fontWeight: match.unread ? 600 : 500, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{match.name}</span>
            {match.favorite && (
              <span aria-hidden="true" style={{fontSize: 13, lineHeight: 1, color: 'var(--warning)'}}>★</span>
            )}
            {match.stale && <Icons.Hourglass size={13} sw={1.75} style={{color: 'var(--warning)', flexShrink: 0}} />}
          </div>
          <span className="t-caption" style={{fontSize: 12, color: match.unread ? 'var(--accent)' : 'var(--text-tertiary)', flexShrink: 0, fontVariantNumeric: 'tabular-nums'}}>{match.time}</span>
        </div>
        <div className="row" style={{justifyContent: 'space-between', gap: 8}}>
          <span style={{
            fontSize: 13.5, color: 'var(--text-secondary)',
            fontWeight: match.unread ? 500 : 400,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
          }}>
            {match.mine && <span>Tú: </span>}{match.last}
          </span>
          {match.unread > 0 && (
            <span style={{
              minWidth: 20, height: 20, borderRadius: 10, padding: '0 6px',
              background: 'var(--accent)', color: 'white',
              fontSize: 11, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>{match.unread}</span>
          )}
        </div>
      </div>
      </button>
      {!match.manualAi && (
        <button
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite && onToggleFavorite();
          }}
          aria-label={match.favorite ? 'Quitar de favoritas' : 'Marcar como favorita'}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: match.favorite ? 'var(--warning)' : 'var(--text-tertiary)',
            fontSize: 20, lineHeight: 1, padding: '6px 4px',
            minWidth: 32, minHeight: 32, borderRadius: 999,
          }}
        >
          {match.favorite ? '★' : '☆'}
        </button>
      )}
    </div>
  );
}

// SCREEN 4 · Vista de conversación
function ChatScreen({ matchId, onBack, onSuggest, onRewrite, onReactivate, onAnalyze, composerSeed = '', offline = false, showInstallShortcut = false, onInstallApp, aiSheetOpen = false }) {
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [aiProfileOpen, setAiProfileOpen] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [editPhoneCountry, setEditPhoneCountry] = React.useState(COUNTRY_PREFIX_OPTIONS[0][0]);
  const [editPhone, setEditPhone] = React.useState('');
  const [muted, setMuted] = React.useState(false);
  const [chatAiProfile, setChatAiProfile] = React.useState(() => normalizeAiManualProfile());
  const [chatAiProfileStatus, setChatAiProfileStatus] = React.useState('');
  const [draft, setDraft] = React.useState('');
  const [aiMenuOpen, setAiMenuOpen] = React.useState(false);
  const [remoteMessages, setRemoteMessages] = React.useState(null);
  const [remoteChat, setRemoteChat] = React.useState(null);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [chatError, setChatError] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const sendingRef = React.useRef(false);
  const [audioDraft, setAudioDraft] = React.useState(null);
  const [recordingAudio, setRecordingAudio] = React.useState(false);
  const [replyTo, setReplyTo] = React.useState(null);
  const [selectedMessage, setSelectedMessage] = React.useState(null);
  const [editingMessage, setEditingMessage] = React.useState(null);
  const [editMessageText, setEditMessageText] = React.useState('');
  const [editAiAgent, setEditAiAgent] = React.useState(DEFAULT_AI_AGENT);
  const [editAiObjective, setEditAiObjective] = React.useState(AI_AUTO_OBJECTIVE);
  const [editAiCustomObjective, setEditAiCustomObjective] = React.useState('');
  const [messageActionLoading, setMessageActionLoading] = React.useState('');
  const [imageViewer, setImageViewer] = React.useState(null);
  const imageViewerTouchStartRef = React.useRef(null);
  const scrollRef = React.useRef(null);
  const fileInputRef = React.useRef(null);
  const audioCaptureInputRef = React.useRef(null);
  const mediaRecorderRef = React.useRef(null);
  const audioChunksRef = React.useRef([]);
  const audioStreamRef = React.useRef(null);
  const audioRecordingStartedAtRef = React.useRef(0);
  const audioRecordingCanceledRef = React.useRef(false);
  const micPressTimerRef = React.useRef(null);
  const micHoldActiveRef = React.useRef(false);
  const canonicalChatIdRef = React.useRef(matchId);
  const presenceStateRef = React.useRef('paused');
  const presenceIdleTimerRef = React.useRef(null);
  const presenceCooldownUntilRef = React.useRef(0);
  const [newMessagesBelow, setNewMessagesBelow] = React.useState(false);
  const lastSeenMessageCountRef = React.useRef(0);
  const wasNearBottomRef = React.useRef(true);
  const manualMode = isManualAiChatId(matchId);
  const [manualContext, setManualContext] = React.useState(() => loadManualAiContext());
  const [manualContextOpen, setManualContextOpen] = React.useState(false);
  const [manualContextStatus, setManualContextStatus] = React.useState('');
  const [manualMessage, setManualMessage] = React.useState('');
  const [manualAdditionalContext, setManualAdditionalContext] = React.useState('');
  const [manualCaptureName, setManualCaptureName] = React.useState('');
  const [manualLocalMessages, setManualLocalMessages] = React.useState([]);

  const manualReady = Boolean(manualContext.message);
  const manualContextMessage = manualReady ? {
    id: 'manual-ai-message',
    chatId: MANUAL_AI_CHAT_ID,
    from: 'them',
    type: 'text',
    text: manualContext.message,
    t: 'contexto',
    sentAt: manualContext.updatedAt || new Date().toISOString(),
    senderName: 'contacto',
  } : null;
  const manualMessages = [manualContextMessage, ...manualLocalMessages].filter(Boolean);
  const match = manualMode
    ? createManualAiChat(manualContext)
    : remoteChat || LOCAL_CONVERSATIONS.find(m => m.id === matchId) || { id: matchId, name: 'Chat', phone: '', messages: [] };
  const activeChatId = match.canonicalChatId || match.id || canonicalChatIdRef.current || matchId;
  const messages = manualMode ? manualMessages : (remoteMessages || match.messages || []);
  const buildAiContext = (extra = {}) => {
    if (!manualMode) {
      return {
        ...extra,
        mediaContext: buildAiMediaContext(messages, extra.quotedMessage || null)
      };
    }
    const quotedMessage = extra.quotedMessage || manualAiQuotedMessage(manualContext);
    const baseUserContext = manualAiUserContext(manualContext);
    const extraUserContext = String(extra.userContext || '').trim();
    return {
      ...extra,
      quotedMessage,
      manualContext,
      mediaContext: extra.mediaContext || manualAiMediaContext(manualContext),
      userContext: [baseUserContext, extraUserContext].filter(Boolean).join('\n')
    };
  };
  const isEmpty = messages.length === 0;
  const isNativeIOS = Boolean(WaFliAPI?.client?.IS_CAPACITOR_NATIVE && window.Capacitor?.getPlatform?.() === 'ios');
  const canRecordInlineAudio = Boolean(!isNativeIOS && navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined');
  const composerFileAccept = isNativeIOS ? 'image/*,video/*,.webp' : 'image/*,video/*,audio/*,.webp';
  const isThreadNearBottom = React.useCallback(() => {
    const node = scrollRef.current;
    if (!node) return true;
    return node.scrollHeight - node.scrollTop - node.clientHeight < 96;
  }, []);
  const scrollToThreadBottom = React.useCallback((behavior = 'auto') => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior });
  }, []);
  const dismissComposerKeyboard = React.useCallback(() => {
    const active = document.activeElement;
    if (active && active !== document.body && typeof active.blur === 'function') active.blur();
  }, []);
  const openManualContextForm = React.useCallback((context = manualContext) => {
    const current = normalizeManualAiContext(context);
    setManualMessage(current.message);
    setManualAdditionalContext(current.additionalContext);
    setManualCaptureName(current.captureName);
    setManualContextStatus('');
    setManualContextOpen(true);
  }, [manualContext]);
  React.useEffect(() => {
    if (!manualMode) return undefined;
    canonicalChatIdRef.current = MANUAL_AI_CHAT_ID;
    setRemoteMessages(null);
    setRemoteChat(null);
    setLoadingMessages(false);
    setChatError('');
    const syncManualContext = (event) => {
      setManualContext(normalizeManualAiContext(event?.detail || loadManualAiContext()));
    };
    window.addEventListener(MANUAL_AI_CONTEXT_EVENT, syncManualContext);
    return () => window.removeEventListener(MANUAL_AI_CONTEXT_EVENT, syncManualContext);
  }, [manualMode]);
  const lastMessage = isEmpty ? null : messages[messages.length - 1];
  const lastSentAt = lastMessage?.sentAt ? new Date(lastMessage.sentAt).getTime() : 0;
  const inactiveHours = lastSentAt ? (Date.now() - lastSentAt) / 36e5 : 0;
  const isCooledThread = !isEmpty && inactiveHours >= 24 && lastMessage?.from === 'me';
  const ctaMode = isCooledThread ? 'reactivate' : 'suggest';
  const showContextualCta = ctaMode !== 'suggest' && !aiMenuOpen && !aiSheetOpen;

  React.useEffect(() => {
    let alive = true;
    setChatAiProfileStatus('');
    setChatAiProfile(normalizeAiManualProfile());
    if (manualMode || !activeChatId || !WaFliAPI?.chats?.getAiProfile || !WaFliAPI?.client?.isAuthenticated?.()) return () => { alive = false; };
    WaFliAPI.chats.getAiProfile(activeChatId)
      .then(result => {
        if (!alive) return;
        setChatAiProfile(normalizeAiManualProfile(result?.profile?.manual));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [activeChatId, manualMode]);

  React.useEffect(() => {
    lastSeenMessageCountRef.current = 0;
    wasNearBottomRef.current = true;
    setNewMessagesBelow(false);
  }, [matchId]);

  React.useEffect(() => {
    const previousCount = lastSeenMessageCountRef.current;
    const grew = messages.length > previousCount;
    const shouldStick = !grew || wasNearBottomRef.current || lastMessage?.from === 'me';
    if (shouldStick) {
      scrollToThreadBottom('auto');
      const frame = window.requestAnimationFrame(() => scrollToThreadBottom('auto'));
      setNewMessagesBelow(false);
      lastSeenMessageCountRef.current = messages.length;
      return () => window.cancelAnimationFrame(frame);
    }
    if (grew) setNewMessagesBelow(true);
    lastSeenMessageCountRef.current = messages.length;
    return undefined;
  }, [matchId, refreshKey, messages.length, lastMessage?.id, lastMessage?.from, replyTo?.id, Boolean(audioDraft), recordingAudio, showContextualCta, scrollToThreadBottom]);

  const handleThreadScroll = React.useCallback(() => {
    const nearBottom = isThreadNearBottom();
    wasNearBottomRef.current = nearBottom;
    if (nearBottom) {
      if (newMessagesBelow && WaFliAPI?.chats?.markRead && WaFliAPI?.client?.isAuthenticated?.()) {
        WaFliAPI.chats.markRead(canonicalChatIdRef.current || activeChatId || matchId).catch(() => {});
      }
      setNewMessagesBelow(false);
    }
  }, [activeChatId, isThreadNearBottom, matchId, newMessagesBelow]);

  React.useEffect(() => {
    if (composerSeed) setDraft(composerSeed);
  }, [composerSeed]);

  React.useEffect(() => {
    setEditName(match.name || '');
    setEditPhone(match.phone || '');
    setEditPhoneCountry(pickCountryOptionByPhone(match.phone) || COUNTRY_PREFIX_OPTIONS[0][0]);
    setMuted(Boolean(match.muted));
  }, [matchId, refreshKey, match.name, match.phone, match.muted]);
  React.useEffect(() => {
    let alive = true;
    if (manualMode) {
      setRemoteMessages(null);
      setRemoteChat(null);
      setLoadingMessages(false);
      setChatError('');
      return () => { alive = false; };
    }
    const loadConversation = async (options = {}) => {
      if (!WaFliAPI?.chats?.messages || !WaFliAPI?.client?.isAuthenticated?.()) return;
      const silent = options.silent === true;
      if (!silent) setLoadingMessages(true);
      if (!silent) setChatError('');
      try {
        const [chatResult, messagesResult] = await Promise.all([
          WaFliAPI.chats.get ? WaFliAPI.chats.get(matchId).catch(() => null) : Promise.resolve(null),
          WaFliAPI.chats.messages(matchId)
        ]);
        if (!alive) return;
        const mappedChat = chatResult?.chat ? mapApiChat(chatResult.chat) : null;
        const canonicalChatId = mappedChat?.canonicalChatId || messagesResult?.canonicalChatId || messagesResult?.chatId || matchId;
        canonicalChatIdRef.current = canonicalChatId;
        if (mappedChat) setRemoteChat(mappedChat);
        setRemoteMessages((messagesResult.messages || [])
          .filter((message) => message.message_type !== 'reaction')
          .map((message) => mapApiMessage(message, canonicalChatId))
          .filter(shouldDisplayChatMessage));
        if (options.markRead && WaFliAPI.chats.markRead) {
          WaFliAPI.chats.markRead(canonicalChatId)
            .then((result) => {
              if (alive && result?.chat) {
                const readChat = mapApiChat(result.chat);
                canonicalChatIdRef.current = readChat.canonicalChatId || readChat.id || canonicalChatId;
                setRemoteChat(readChat);
              }
            })
            .catch(() => {});
        }
      } catch (error) {
        if (alive && !silent) setChatError(WaFliAPI.client.toUserMessage(error));
      } finally {
        if (alive && !silent) setLoadingMessages(false);
      }
    };
    setRemoteMessages(null);
    setRemoteChat(null);
    loadConversation({ markRead: true });
    let reloadTimer = null;
    const scheduleConversationLoad = (markRead = false, delay = 140) => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => loadConversation({ silent: true, markRead }), delay);
    };
    const unsubscribe = WaFliAPI?.chats?.subscribeEvents
      ? WaFliAPI.chats.subscribeEvents(({ event, data }) => {
          if (
            (event === 'chat.updated' || event === 'message.created' || event === 'message.updated' || event === 'message.deleted') &&
            (
              data?.chatId === matchId ||
              data?.canonicalChatId === matchId ||
              data?.chatId === canonicalChatIdRef.current ||
              data?.canonicalChatId === canonicalChatIdRef.current ||
              sameChatIdentity(data?.chat || {}, { id: canonicalChatIdRef.current, aliases: [{ id: matchId }] })
            )
          ) {
            if (event === 'message.created' && data?.message) {
              const realtimeChatId = data?.canonicalChatId || data?.chatId || canonicalChatIdRef.current || matchId;
              const realtimeMessage = mapApiMessage(data.message, realtimeChatId);
              if (!shouldDisplayChatMessage(realtimeMessage)) return;
              setRemoteMessages((prev) => {
                const base = prev || messages;
                if (base.some(item => item.id === realtimeMessage.id)) {
                  return base.map(item => item.id === realtimeMessage.id ? { ...item, ...realtimeMessage } : item);
                }
                return [...base, realtimeMessage];
              });
            }
            scheduleConversationLoad((event === 'message.created' && wasNearBottomRef.current) || event === 'message.deleted', event === 'message.created' ? 80 : 180);
          }
        }, () => {})
      : null;
    const handleFocus = () => loadConversation({ silent: true, markRead: false });
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadConversation({ silent: true, markRead: false });
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      alive = false;
      if (unsubscribe) unsubscribe();
      if (reloadTimer) clearTimeout(reloadTimer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [matchId, manualMode]);

  const saveContactEdits = async () => {
    const name = editName.trim();
    const phone = phoneWithCountryPrefix(editPhone, editPhoneCountry);
    const hasPhone = phoneDigits(editPhone).length > 0;
    if (!name || (hasPhone && !isValidPhoneInput(editPhone, editPhoneCountry))) return;

    setChatError('');
    try {
      const payload = hasPhone ? { name, phone } : { name };
      const result = await WaFliAPI?.chats?.updateContact?.(activeChatId, payload);
      if (result?.chat) setRemoteChat(mapApiChat(result.chat));
      setRefreshKey(v => v + 1);
      setEditOpen(false);
      setMenuOpen(false);
    } catch (error) {
      setChatError(WaFliAPI?.client?.toUserMessage?.(error) || 'No hemos podido guardar el contacto.');
    }
  };
  const excludeConversation = () => {
    setMenuOpen(false);
    WaFliAPI?.chats?.updateMeta?.(activeChatId, { excluded: true }).catch(() => {});
    onBack();
  };
  const saveChatAiProfile = async () => {
    if (manualMode || !WaFliAPI?.chats?.updateAiProfile || !WaFliAPI?.client?.isAuthenticated?.()) return;
    setChatAiProfileStatus('Guardando...');
    try {
      const payload = normalizeAiManualProfile(chatAiProfile);
      const result = await WaFliAPI.chats.updateAiProfile(activeChatId, payload);
      setChatAiProfile(normalizeAiManualProfile(result?.profile?.manual || payload));
      setChatAiProfileStatus('Guardado');
    } catch (_) {
      setChatAiProfileStatus('No se pudo guardar');
    }
  };
  const toggleMuted = () => {
    const next = !muted;
    setMuted(next);
    setMenuOpen(false);
    WaFliAPI?.chats?.updateMeta?.(activeChatId, { muted: next }).catch(() => {});
  };
  const clearPresenceIdleTimer = React.useCallback(() => {
    if (presenceIdleTimerRef.current) {
      clearTimeout(presenceIdleTimerRef.current);
      presenceIdleTimerRef.current = null;
    }
  }, []);
  const sendPresenceUpdate = React.useCallback((presenceType) => {
    if (manualMode || offline || !WaFliAPI?.chats?.presence || !WaFliAPI?.client?.isAuthenticated?.()) return;
    const chatId = canonicalChatIdRef.current || activeChatId || matchId;
    if (!chatId) return;
    const safePresence = presenceType === 'composing' || presenceType === 'recording' ? presenceType : 'paused';
    const now = Date.now();
    if (safePresence === 'composing') {
      if (presenceStateRef.current === 'composing' && now < presenceCooldownUntilRef.current) return;
      presenceCooldownUntilRef.current = now + 5000;
    }
    presenceStateRef.current = safePresence;
    WaFliAPI.chats.presence(chatId, safePresence).catch(() => {});
  }, [activeChatId, matchId, offline, manualMode]);
  const handleDraftChange = React.useCallback((event) => {
    const value = event.target.value;
    setDraft(value);
    clearPresenceIdleTimer();
    if (!value.trim()) {
      sendPresenceUpdate('paused');
      return;
    }
    sendPresenceUpdate('composing');
    presenceIdleTimerRef.current = setTimeout(() => sendPresenceUpdate('paused'), 3500);
  }, [clearPresenceIdleTimer, sendPresenceUpdate]);
  React.useEffect(() => () => {
    clearPresenceIdleTimer();
    sendPresenceUpdate('paused');
  }, [clearPresenceIdleTimer, sendPresenceUpdate]);
  const clearAudioDraft = React.useCallback(() => {
    setAudioDraft((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);
  React.useEffect(() => () => {
    if (micPressTimerRef.current) window.clearTimeout(micPressTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    audioStreamRef.current?.getTracks?.().forEach(track => track.stop());
    if (audioDraft?.url) URL.revokeObjectURL(audioDraft.url);
  }, [audioDraft?.url]);
  const stopAudioRecording = React.useCallback(() => {
    if (micPressTimerRef.current) {
      window.clearTimeout(micPressTimerRef.current);
      micPressTimerRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      audioRecordingCanceledRef.current = true;
      setRecordingAudio(false);
      audioStreamRef.current?.getTracks?.().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    sendPresenceUpdate('paused');
  }, [sendPresenceUpdate]);
  const startAudioRecording = React.useCallback(async () => {
    if (offline || sending || recordingAudio || audioDraft) return;
    if (!canRecordInlineAudio) {
      if (audioCaptureInputRef.current) {
        audioCaptureInputRef.current.value = '';
        audioCaptureInputRef.current.click();
        setChatError('');
        return;
      }
      setChatError('Tu dispositivo no habilitó el grabador de audio. Revisa permisos de micrófono e intenta de nuevo.');
      return;
    }
    try {
      audioRecordingCanceledRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (audioRecordingCanceledRef.current) {
        stream.getTracks().forEach(track => track.stop());
        audioRecordingCanceledRef.current = false;
        return;
      }
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      const supportedMime = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']
        .find(type => MediaRecorder.isTypeSupported?.(type));
      const recorder = new MediaRecorder(stream, supportedMime ? { mimeType: supportedMime } : undefined);
      mediaRecorderRef.current = recorder;
      audioRecordingStartedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data?.size) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const chunks = audioChunksRef.current || [];
        audioStreamRef.current?.getTracks?.().forEach(track => track.stop());
        audioStreamRef.current = null;
        setRecordingAudio(false);
        if (!chunks.length) return;
        const mimeType = recorder.mimeType || supportedMime || 'audio/webm; codecs=opus';
        const blob = new Blob(chunks, { type: mimeType });
        if (!blob.size) return;
        const ext = mimeType.includes('ogg') ? 'ogg'
          : mimeType.includes('mp4') ? 'm4a'
          : mimeType.includes('mpeg') ? 'mp3'
          : 'webm';
        const url = URL.createObjectURL(blob);
        const durationMs = Math.max(0, Date.now() - audioRecordingStartedAtRef.current);
        setAudioDraft((current) => {
          if (current?.url) URL.revokeObjectURL(current.url);
          return {
            blob,
            url,
            mimeType,
            durationMs,
            fileName: `nota-voz-${Date.now()}.${ext}`
          };
        });
      };
      recorder.start();
      setChatError('');
      setRecordingAudio(true);
      sendPresenceUpdate('recording');
    } catch (_) {
      setRecordingAudio(false);
      audioStreamRef.current?.getTracks?.().forEach(track => track.stop());
      audioStreamRef.current = null;
      sendPresenceUpdate('paused');
      setChatError('No hemos podido acceder al micrófono. Revisa los permisos e inténtalo de nuevo.');
    }
  }, [audioDraft, canRecordInlineAudio, offline, recordingAudio, sending, sendPresenceUpdate]);
  const handleMicPointerDown = () => {
    if (offline || sending || audioDraft || recordingAudio) return;
    if (micPressTimerRef.current) window.clearTimeout(micPressTimerRef.current);
    micHoldActiveRef.current = false;
    micPressTimerRef.current = window.setTimeout(() => {
      micHoldActiveRef.current = true;
      startAudioRecording();
    }, 240);
  };
  const handleMicPointerUp = () => {
    if (micPressTimerRef.current) {
      window.clearTimeout(micPressTimerRef.current);
      micPressTimerRef.current = null;
    }
    if (micHoldActiveRef.current) stopAudioRecording();
  };
  const handleMicClick = () => {
    if (micHoldActiveRef.current) {
      micHoldActiveRef.current = false;
      return;
    }
    if (recordingAudio) {
      stopAudioRecording();
      return;
    }
    startAudioRecording();
  };
  const sendRecordedAudio = async () => {
    if (!audioDraft || offline || sending) return;
    const resolvedMimeType = audioDraft.mimeType || 'audio/webm; codecs=opus';
    const safeMimeType = String(resolvedMimeType).startsWith('audio/') ? resolvedMimeType : 'audio/webm; codecs=opus';
    const fileName = audioDraft.fileName || `nota-voz-${Date.now()}.webm`;
    const file = new File([audioDraft.blob], fileName, {
      type: safeMimeType
    });
    const sent = await sendMediaFile(file, { mediaType: 'audio', ptt: true, label: 'Nota de voz' });
    if (sent) clearAudioDraft();
  };
  const sendDraft = async () => {
    const text = draft.trim();
    if (!text || offline || sending || sendingRef.current) return;
    sendingRef.current = true;
    clearPresenceIdleTimer();
    sendPresenceUpdate('paused');
    if (manualMode) {
      const quotedMessage = replyTo ? quotedMessagePayload(replyTo, match) : null;
      const sent = {
        id: `manual-me-${Date.now()}`,
        chatId: MANUAL_AI_CHAT_ID,
        from: 'me',
        type: 'text',
        status: 'sent',
        quotedMessage,
        text,
        t: `hoy ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · enviado`,
        sentAt: new Date().toISOString(),
      };
      setManualLocalMessages((prev) => [...prev, sent]);
      setDraft('');
      setReplyTo(null);
      sendingRef.current = false;
      return;
    }
    setSending(true);
    setChatError('');
    const quotedMessage = replyTo ? quotedMessagePayload(replyTo, match) : null;
    try {
      let nextMessage = null;
      if (WaFliAPI?.chats?.send && WaFliAPI?.client?.isAuthenticated?.()) {
        const result = await WaFliAPI.chats.send(activeChatId, text, quotedMessage ? { quotedMessage } : {});
        const sentChatId = result?.canonicalChatId || result?.chatId || activeChatId;
        canonicalChatIdRef.current = sentChatId;
        if (result?.message) nextMessage = mapApiMessage(result.message, sentChatId);
      }
      const sent = nextMessage || {
        id: `local-${Date.now()}`,
        from: 'me',
        status: 'sending',
        quotedMessage,
        text,
        t: `hoy ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · enviando`
      };
      setRemoteMessages((prev) => {
        const base = prev || messages;
        if (base.some(item => item.id === sent.id)) {
          return base.map(item => item.id === sent.id ? { ...item, ...sent } : item);
        }
        return [...base, sent];
      });
      setDraft('');
      setReplyTo(null);
    } catch (error) {
      setChatError(WaFliAPI?.client?.toUserMessage?.(error) || 'No hemos podido enviar el mensaje.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };
  const inferUploadMediaType = (file, forcedType = '') => {
    if (forcedType) return forcedType;
    const mimeType = file?.type || 'application/octet-stream';
    return mimeType === 'image/webp' ? 'sticker' : mimeType.startsWith('audio/') ? 'audio' : mimeType.startsWith('image/') ? 'image' : mimeType.startsWith('video/') ? 'video' : '';
  };
  const sendMediaFile = async (file, options = {}) => {
    if (!file || offline || sending || sendingRef.current) return false;
    const mimeType = file.type || 'application/octet-stream';
    const mediaType = inferUploadMediaType(file, options.mediaType);
    if (!mediaType) {
      setChatError('Por ahora puedes adjuntar imágenes, vídeos, stickers webp o audios.');
      return;
    }
    const maxBytes = 12 * 1024 * 1024;
    if (file.size > maxBytes) {
      setChatError('El archivo es demasiado pesado para esta versión.');
      return;
    }
    clearPresenceIdleTimer();
    sendPresenceUpdate('paused');
    sendingRef.current = true;
    setSending(true);
    setChatError('');
    const captionText = options.captionOverride !== undefined ? String(options.captionOverride || '').trim() : draft.trim();
    const caption = mediaType === 'image' || mediaType === 'video' ? captionText : '';
    const quotedMessage = replyTo ? quotedMessagePayload(replyTo, match) : null;
    try {
      let nextMessage = null;
      if (WaFliAPI?.chats?.sendMedia && WaFliAPI?.client?.isAuthenticated?.()) {
        const result = await WaFliAPI.chats.sendMedia(activeChatId, file, {
          mediaType,
          caption,
          quotedMessage,
          ptt: options.ptt === true
        });
        const sentChatId = result?.canonicalChatId || result?.chatId || activeChatId;
        canonicalChatIdRef.current = sentChatId;
        if (result?.message) nextMessage = mapApiMessage(result.message, sentChatId);
      }
      const sent = nextMessage || {
        id: `local-media-${Date.now()}`,
        chatId: activeChatId,
        from: 'me',
        status: 'sending',
        type: mediaType,
        mediaType,
        hasMedia: false,
        quotedMessage,
        text: caption || options.label || ({ image: 'Imagen', video: 'Vídeo', audio: 'Audio', sticker: 'Sticker' }[mediaType] || 'Archivo'),
        fileName: file.name || '',
        sizeBytes: file.size || 0,
        t: `hoy ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · enviando`
      };
      setRemoteMessages((prev) => {
        const base = prev || messages;
        if (base.some(item => item.id === sent.id)) {
          return base.map(item => item.id === sent.id ? { ...item, ...sent } : item);
        }
        return [...base, sent];
      });
      if (caption && options.clearDraft !== false) setDraft('');
      if (options.clearReply !== false) setReplyTo(null);
      return true;
    } catch (error) {
      setChatError(WaFliAPI?.client?.toUserMessage?.(error) || 'No hemos podido enviar el archivo.');
      return false;
    } finally {
      sendingRef.current = false;
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  const sendMediaFiles = async (fileList) => {
    const selectedFiles = Array.from(fileList || []).filter(Boolean);
    if (!selectedFiles.length || offline || sending) return;
    if (selectedFiles.length === 1) {
      await sendMediaFile(selectedFiles[0]);
      return;
    }
    const resolvedFiles = selectedFiles.map((file) => ({ file, mediaType: inferUploadMediaType(file) }));
    if (resolvedFiles.some((item) => !item.mediaType)) {
      setChatError('Hay un archivo no compatible. Puedes adjuntar imágenes, vídeos, stickers webp o audios.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (resolvedFiles.some((item) => item.mediaType !== 'image')) {
      setChatError('Para enviar varios archivos a la vez, selecciona solo imágenes. Vídeos, audios y stickers se envían de forma individual.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (resolvedFiles.length > 10) {
      setChatError('Puedes enviar hasta 10 imágenes por vez.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const batchCaption = draft.trim();
    let sentAny = false;
    for (let index = 0; index < resolvedFiles.length; index += 1) {
      const item = resolvedFiles[index];
      const sent = await sendMediaFile(item.file, {
        mediaType: 'image',
        captionOverride: index === 0 ? batchCaption : '',
        clearDraft: false,
        clearReply: false,
        label: 'Imagen'
      });
      if (!sent) break;
      sentAny = true;
    }
    if (sentAny && batchCaption) setDraft('');
    if (sentAny) setReplyTo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const openImageViewer = React.useCallback((payload) => {
    const imageMessages = (messages || []).filter((message) => {
      const type = message?.mediaType || message?.type;
      return !message?.deleted && !message?.viewOnce && message?.hasMedia && (type === 'image' || type === 'sticker');
    });
    const gallery = imageMessages.map((message) => {
      const cacheKey = `${message?.chatId || ''}:${message?.id || ''}`;
      const cachedUrl = mediaObjectUrlCache.get(cacheKey);
      const caption = [message.fileName, formatMediaSize(message.sizeBytes)].filter(Boolean).join(' · ');
      const url = message?.id === payload?.message?.id ? (cachedUrl || payload?.url || '') : (cachedUrl || '');
      return { message, url, caption };
    });
    const foundIndex = gallery.findIndex((item) => item.message?.id === payload?.message?.id);
    const index = foundIndex >= 0 ? foundIndex : 0;
    const selected = gallery[index] || payload;
    setImageViewer({
      ...payload,
      ...selected,
      gallery,
      loading: false,
      error: '',
      index,
      total: gallery.length || 1
    });
  }, [messages]);
  const moveImageViewer = React.useCallback((direction) => {
    setImageViewer((current) => {
      if (!current?.gallery?.length || current.gallery.length < 2) return current;
      const nextIndex = (Number(current.index || 0) + direction + current.gallery.length) % current.gallery.length;
      const nextItem = current.gallery[nextIndex];
      return {
        ...current,
        ...nextItem,
        loading: false,
        error: '',
        index: nextIndex,
        total: current.gallery.length
      };
    });
  }, []);
  React.useEffect(() => {
    if (!imageViewer || imageViewer.url || !imageViewer.message?.chatId || !imageViewer.message?.id || !WaFliAPI?.chats?.media) return undefined;
    const cacheKey = `${imageViewer.message.chatId}:${imageViewer.message.id}`;
    const cachedUrl = mediaObjectUrlCache.get(cacheKey);
    if (cachedUrl) {
      setImageViewer((current) => {
        if (!current || current.message?.id !== imageViewer.message.id) return current;
        const gallery = (current.gallery || []).map((item) => item.message?.id === current.message?.id ? { ...item, url: cachedUrl } : item);
        return { ...current, url: cachedUrl, loading: false, error: '', gallery };
      });
      return undefined;
    }
    let alive = true;
    setImageViewer((current) => current && current.message?.id === imageViewer.message.id ? { ...current, loading: true, error: '' } : current);
    WaFliAPI.chats.media(imageViewer.message.chatId, imageViewer.message.id)
      .then((blob) => {
        if (!alive) return;
        const objectUrl = URL.createObjectURL(blob);
        rememberMediaObjectUrl(cacheKey, objectUrl);
        setImageViewer((current) => {
          if (!current || current.message?.id !== imageViewer.message.id) return current;
          const gallery = (current.gallery || []).map((item) => item.message?.id === current.message?.id ? { ...item, url: objectUrl } : item);
          return { ...current, url: objectUrl, loading: false, error: '', gallery };
        });
      })
      .catch(() => {
        if (!alive) return;
        setImageViewer((current) => current && current.message?.id === imageViewer.message.id ? { ...current, loading: false, error: 'No hemos podido cargar esta imagen.' } : current);
      });
    return () => {
      alive = false;
    };
  }, [imageViewer?.message?.chatId, imageViewer?.message?.id, imageViewer?.url, imageViewer?.retryKey]);
  const handleImageViewerTouchStart = React.useCallback((event) => {
    imageViewerTouchStartRef.current = event.touches?.[0]?.clientX | event.clientX | null;
  }, []);
  const handleImageViewerTouchEnd = React.useCallback((event) => {
    const start = imageViewerTouchStartRef.current;
    imageViewerTouchStartRef.current = null;
    if (start == null) return;
    const end = event.changedTouches?.[0]?.clientX | event.clientX | start;
    const delta = end - start;
    if (Math.abs(delta) < 48) return;
    moveImageViewer(delta < 0 ? 1 : -1);
  }, [moveImageViewer]);
  const patchMessageInThread = (messageId, patch) => {
    setRemoteMessages((prev) => {
      const base = prev || messages;
      return base.map((item) => item.id === messageId ? { ...item, ...patch } : item);
    });
  };
  const openMessageActions = (message) => {
    if (!message?.id) return;
    setMenuOpen(false);
    setAiMenuOpen(false);
    setEditOpen(false);
    setEditingMessage(null);
    setSelectedMessage(message);
  };
  const beginEditSelectedMessage = () => {
    if (!selectedMessage || selectedMessage.from !== 'me' || selectedMessage.type !== 'text' || selectedMessage.deleted) return;
    const manualProfile = normalizeAiManualProfile(chatAiProfile);
    const initialAgent = manualProfile.preferredAgent && manualProfile.preferredAgent !== 'auto'
      ? getAiAgentConfig(manualProfile.preferredAgent).id
      : DEFAULT_AI_AGENT;
    const initialObjective = normalizeAiObjectiveForAgent(initialAgent, manualProfile.preferredObjective);
    setEditAiAgent(initialAgent);
    setEditAiObjective(initialObjective);
    setEditAiCustomObjective(initialObjective === 'Personalizado' ? manualProfile.notes || '' : '');
    setEditMessageText(selectedMessage.text || '');
    setEditingMessage(selectedMessage);
    setSelectedMessage(null);
  };
  const saveEditedMessage = async () => {
    const nextText = editMessageText.trim();
    if (!editingMessage || !nextText) return;
    if (nextText === editingMessage.text) {
      setEditingMessage(null);
      setEditMessageText('');
      return;
    }
    setMessageActionLoading('edit');
    setChatError('');
    try {
      const result = await WaFliAPI?.chats?.editMessage?.(activeChatId, editingMessage.id, nextText);
      const patched = result?.message ? mapApiMessage(result.message, result?.canonicalChatId || activeChatId) : {
        ...editingMessage,
        text: nextText,
        edited: true,
        editedAt: new Date().toISOString(),
        t: editingMessage.t?.replace('falló', 'enviado') || editingMessage.t,
      };
      patchMessageInThread(editingMessage.id, patched);
      setEditingMessage(null);
      setEditMessageText('');
    } catch (error) {
      setChatError(WaFliAPI?.client?.toUserMessage?.(error) || 'WhatsApp no permitió editar este mensaje.');
    } finally {
      setMessageActionLoading('');
    }
  };
  const rewriteEditingMessage = async () => {
    const sourceText = editMessageText.trim();
    if (!editingMessage || !sourceText) return;
    if (!WaFliAPI?.ai?.rewrite || !WaFliAPI?.client?.isAuthenticated?.()) {
      setChatError('Inicia sesión y conecta tu WhatsApp para reescribir con IA.');
      return;
    }
    const editAiProfile = normalizeAiManualProfile(chatAiProfile);
    const editAgent = getAiAgentConfig(editAiAgent).id;
    const editObjective = normalizeAiObjectiveForAgent(editAgent, editAiObjective);
    setMessageActionLoading('rewrite-edit');
    setChatError('');
    try {
      const result = await WaFliAPI.ai.rewrite({
        chatId: activeChatId,
        draft: sourceText,
        message: sourceText,
        editingMessage: true,
        contextMode: 'edit_message',
        agent: editAgent,
        tone: editAgent,
        objective: editObjective,
        intensity: editAiProfile.intensity || 'auto',
        customObjective: editObjective === 'Personalizado' ? editAiCustomObjective.trim() : '',
        userContext: 'La persona usuaria está editando un mensaje propio ya enviado. Reescribe solo ese mensaje para que suene natural, fiel al contexto y listo para guardar como edición.'
      });
      if (result?.text) setEditMessageText(result.text);
      emitQuotaUsage(result);
    } catch (error) {
      if (error.code === 'quota_exhausted') setChatError('No te quedan generaciones IA disponibles.');
      else setChatError(WaFliAPI?.client?.toUserMessage?.(error) || 'No hemos podido reescribir este mensaje.');
    } finally {
      setMessageActionLoading('');
    }
  };
  const deleteSelectedMessage = async (scope) => {
    if (!selectedMessage) return;
    const target = selectedMessage;
    setMessageActionLoading(scope === 'everyone' ? 'delete-everyone' : 'delete-me');
    setChatError('');
    try {
      const result = await WaFliAPI?.chats?.deleteMessage?.(activeChatId, target.id, scope);
      const patched = result?.message ? mapApiMessage(result.message, result?.canonicalChatId || activeChatId) : {
        ...target,
        text: 'Mensaje eliminado',
        hasMedia: false,
        deleted: true,
        deletedAt: new Date().toISOString(),
        deletedScope: scope,
      };
      patchMessageInThread(target.id, patched);
      setSelectedMessage(null);
      if (replyTo?.id === target.id) setReplyTo(null);
    } catch (error) {
      setChatError(WaFliAPI?.client?.toUserMessage?.(error) || 'WhatsApp no permitió eliminar este mensaje.');
    } finally {
      setMessageActionLoading('');
    }
  };
  const canSaveEdits = editName.trim().length > 0 && (!phoneDigits(editPhone) || isValidPhoneInput(editPhone, editPhoneCountry));

  return (
    <>
      <AppHeader
        title={match.name}
        showQuota
        subtitle={manualMode ? 'genera respuestas sin conectar whatsapp' : String(match.id || '').endsWith('@g.us') ? 'Grupo de tu WhatsApp' : (match.phone || 'tu WhatsApp')}
        leading={<>
          <IconButton onClick={onBack} label="Atrás"><Icons.Back size={20} /></IconButton>
          <Avatar name={match.name} src={match.avatar} size={32} />
        </>}
        trailing={manualMode ? null :
          <div style={{position: 'relative', display: 'flex', alignItems: 'center', gap: 6}}>
            {showInstallShortcut ? (
              <button className="appheader__install-btn" onClick={onInstallApp} aria-label="Instalar WaFli">
                <Icons.Phone size={15} />
                <span>Instalar</span>
              </button>
            ) : null}
            <IconButton onClick={() => setMenuOpen(v => !v)} label="Más"><Icons.More size={20} /></IconButton>
            {menuOpen && (
              <>
                <button
                  onClick={() => setMenuOpen(false)}
                  aria-label="Cerrar menú"
                  style={{position: 'fixed', inset: 0, background: 'transparent', border: 'none', zIndex: 29}}
                />
                <div style={getHeaderMenuDropdownStyle(240)}>
                  <button onClick={() => { setEditOpen(true); setMenuOpen(false); }} style={menuActionStyle}>
                    <Icons.Edit size={16} /> Editar nombre y número
                  </button>
                  <button onClick={toggleMuted} style={{...menuActionStyle, borderTop: '1px solid var(--border)'}}>
                    <Icons.Bell size={16} /> {muted ? 'Activar notificaciones' : 'Silenciar notificaciones'}
                  </button>
                  <button onClick={() => { setAiProfileOpen(true); setMenuOpen(false); }} style={{...menuActionStyle, borderTop: '1px solid var(--border)'}}>
                    <Icons.Settings size={16} /> Ajustes IA del contacto
                  </button>
                  <button onClick={excludeConversation} style={{...menuActionStyle, borderTop: '1px solid var(--border)', color: 'var(--danger)'}}>
                    <Icons.Close size={16} /> Excluir de WaFli
                  </button>
                </div>
              </>
            )}
          </div>
        }
      />

      <div ref={scrollRef} className="scroll-y chat-thread-scroll" onScroll={handleThreadScroll} style={{
        background: 'var(--gray-50)',
        padding: '16px 14px max(20px, calc(12px + var(--mobile-bottom-guard, var(--safe-bottom))))',
        scrollPaddingBottom: 'calc(112px + var(--keyboard-offset))',
        overscrollBehaviorY: 'contain',
      }}>
        {offline && (
          <div style={{
            margin: '0 0 10px',
            borderRadius: 12,
            border: '1px solid #f2cc8f',
            background: '#fff7e8',
            padding: '8px 10px',
          }}>
            <span className="t-small" style={{color: '#7a4d0b'}}>Sin conexión a internet.</span>
          </div>
        )}
        {loadingMessages && <div className="t-caption" style={{marginBottom: 10}}>Cargando mensajes...</div>}
        {chatError && (
          <div style={{margin: '0 0 10px', borderRadius: 12, border: '1px solid rgba(180,30,30,0.25)', background: 'var(--danger-soft)', padding: '8px 10px'}}>
            <span className="t-small" style={{color: 'var(--danger)'}}>{chatError}</span>
          </div>
        )}
        {manualContextStatus ? (
          <div style={{margin: '0 0 10px', borderRadius: 12, border: '1px solid rgba(20,120,80,0.22)', background: 'rgba(20,120,80,0.08)', padding: '8px 10px'}}>
            <span className="t-small" style={{color: 'var(--success, #147850)'}}>{manualContextStatus}</span>
          </div>
        ) : null}
        {manualMode && manualReady ? (
          <div className="card" style={{margin: '0 0 12px', padding: 12, display: 'grid', gap: 8}}>
            <div className="row" style={{justifyContent: 'space-between', gap: 10, alignItems: 'center'}}>
              <span className="t-small" style={{fontWeight: 800}}>contexto activo</span>
              <div className="row gap-2" style={{flexShrink: 0}}>
                <button className="btn btn--ghost btn--sm" style={{height: 30}} onClick={() => openManualContextForm()}>editar contexto</button>
                <button className="btn btn--text" style={{height: 30, color: 'var(--danger)'}} onClick={() => {
                  clearManualAiContext();
                  setManualContext(normalizeManualAiContext());
                  setManualLocalMessages([]);
                  setManualContextStatus('');
                }}>borrar contexto</button>
              </div>
            </div>
            <span className="t-small" style={{color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
              mensaje: {manualContext.message}
            </span>
          </div>
        ) : null}
        {manualMode && !manualReady ? (
          <div style={{padding: '44px 16px', textAlign: 'center'}}>
            <div style={{
              width: 56, height: 56, margin: '0 auto 16px', borderRadius: 18,
              background: 'var(--accent-soft)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Icons.Sparkles size={24} />
            </div>
            <div className="t-h3" style={{margin: '0 0 8px'}}>WaFli AI</div>
            <div className="t-small" style={{color: 'var(--text-secondary)', maxWidth: 300, margin: '0 auto 18px'}}>
              para generar respuestas necesito saber qué mensaje quieres responder.
            </div>
            <button className="btn btn--primary btn--md" onClick={() => openManualContextForm()}>
              añadir contexto
            </button>
          </div>
        ) : isEmpty ? (
          <div style={{padding: '32px 16px', textAlign: 'center'}}>
            <div style={{
              display: 'inline-flex', padding: '4px 10px', borderRadius: 'var(--r-pill)',
              background: 'var(--accent-soft)', color: 'var(--accent)',
              fontSize: 12, fontWeight: 500, marginBottom: 14,
            }}>Match nuevo</div>
            <div className="t-h3" style={{margin: '0 0 6px'}}>Aún no hay mensajes</div>
            <div className="t-small" style={{color: 'var(--text-secondary)', maxWidth: 260, margin: '0 auto 18px'}}>
              Escribe el primer mensaje o usa las acciones IA para preparar una respuesta con contexto.
            </div>
            <button className="btn btn--secondary btn--md" onClick={() => onSuggest && onSuggest(buildAiContext())}>
              <Icons.Sparkles size={16} /> Sugerir respuesta
            </button>
          </div>
        ) : (
          <>
            <ChatMessages
              messages={messages}
              chatName={match.name}
              chatPhone={match.phone}
              onLongPressMessage={openMessageActions}
              onReplyMessage={(message) => setReplyTo(message)}
              onOpenImage={openImageViewer}
            />
          {newMessagesBelow ? (
            <button
              type="button"
              className="chat-new-messages"
              onClick={() => {
                scrollToThreadBottom('smooth');
                wasNearBottomRef.current = true;
                setNewMessagesBelow(false);
              }}
            >
              Nuevos mensajes
            </button>
          ) : null}
          </>
        )}
      </div>

      {manualMode && !manualReady ? null : !(aiSheetOpen || aiMenuOpen || editOpen || aiProfileOpen || selectedMessage || editingMessage || imageViewer) ? (
      <div className="chat-fixed-composer" style={{position: 'relative', zIndex: 130, width: '100%', maxWidth: '100%', boxSizing: 'border-box', flexShrink: 0, minHeight: 'fit-content', maxHeight: 'min(calc(var(--visual-viewport-height) - 120px), 320px)', overflowY: 'auto', overscrollBehavior: 'contain', background: 'var(--bg)', borderTop: '1px solid var(--border)', boxShadow: '0 -10px 24px rgba(15, 23, 42, 0.10)'}}>
        {/* Contextual CTA bar */}
        {showContextualCta && (
          <div style={{padding: '8px 14px', background: 'var(--gray-50)', borderTop: '1px solid var(--border)'}}>
            {ctaMode === 'reactivate' && (
              <button onClick={() => { dismissComposerKeyboard(); onReactivate && onReactivate(buildAiContext()); }} disabled={offline} className="btn btn--primary btn--full" style={{height: 48, opacity: offline ? 0.55 : 1}}>
                <Icons.Sparkles size={16} /> Reactivar conversación
              </button>
            )}
          </div>
        )}

        {/* Composer */}
        <div className="chat-composer-wrap" style={{
          padding: replyTo ? '0 12px calc(12px + var(--mobile-bottom-guard, var(--safe-bottom)))' : '8px 12px calc(12px + var(--mobile-bottom-guard, var(--safe-bottom)))',
          background: 'var(--bg)',
          borderTop: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {replyTo ? (
            <div style={{width: '100%', marginTop: 8, border: '1px solid var(--border)', borderRadius: 14, background: 'var(--gray-50)', padding: '8px 10px', display: 'flex', gap: 10, alignItems: 'flex-start'}}>
              <div style={{width: 3, alignSelf: 'stretch', borderRadius: 6, background: 'var(--accent)'}} />
              <div style={{flex: 1, minWidth: 0}}>
                <div className="t-caption" style={{fontWeight: 700, color: 'var(--accent)', marginBottom: 2}}>
                  Respondiendo a {replyTo.from === 'me' ? 'tu mensaje' : (replyTo.senderName || match.name || 'contacto')}
                </div>
                <div className="t-small" style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-secondary)'}}>
                  {replyTo.text || replyTo.mediaType || replyTo.type || 'Mensaje'}
                </div>
              </div>
              <button className="btn btn--text" style={{height: 24, padding: '0 4px'}} onClick={() => setReplyTo(null)}>Quitar</button>
            </div>
          ) : null}
          <div style={{display: 'flex', alignItems: 'flex-end', gap: 8, width: '100%'}}>
            <button className="appheader__icon-btn" disabled={offline} style={{color: 'var(--text-secondary)', opacity: offline ? 0.45 : 1}} aria-label="Opciones IA" onClick={() => { dismissComposerKeyboard(); setAiMenuOpen(true); }}><Icons.Sparkles size={20} /></button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={composerFileAccept}
              style={{display: 'none'}}
              onChange={(event) => sendMediaFiles(event.target.files)}
            />
            <input
              ref={audioCaptureInputRef}
              type="file"
              accept="audio/*"
              capture="microphone"
              style={{display: 'none'}}
              onChange={(event) => sendMediaFile(event.target.files?.[0], { mediaType: 'audio', ptt: true, label: 'Nota de voz' })}
            />
            <button
              className="appheader__icon-btn"
              disabled={manualMode || offline || sending || recordingAudio || Boolean(audioDraft)}
              style={{color: 'var(--text-secondary)', opacity: manualMode || offline || sending || recordingAudio || audioDraft ? 0.45 : 1}}
              aria-label="Adjuntar imagen, sticker o audio"
              onClick={() => fileInputRef.current?.click()}
            >
              <span style={{fontSize: 22, lineHeight: 1, transform: 'translateY(-1px)'}}>+</span>
            </button>
            {audioDraft ? (
              <div style={{flex: 1, minWidth: 0, maxWidth: '100%', border: '1px solid var(--border-strong)', borderRadius: 22, padding: '7px 10px', background: 'var(--gray-50)', display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden'}}>
                <span className="t-caption" style={{fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap'}}>Nota de voz</span>
                <audio src={audioDraft.url} controls className="chat-composer-audio" />
              </div>
            ) : recordingAudio ? (
              <div style={{flex: 1, minHeight: 40, border: '1px solid rgba(180,30,30,0.25)', borderRadius: 22, padding: '10px 14px', background: 'var(--danger-soft)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10}}>
                <span className="t-small" style={{fontWeight: 700}}>Grabando nota de voz...</span>
                <span className="t-caption">pulsa Detener para revisar</span>
              </div>
            ) : (
              <textarea
                rows={1}
                value={draft}
                onChange={handleDraftChange}
                placeholder={replyTo ? 'Responder mensaje' : 'Mensaje'}
                className="chat-composer-input"
                style={{
                  flex: 1, resize: 'none',
                  border: '1px solid var(--border-strong)', borderRadius: 22,
                  padding: '10px 14px', fontSize: 16, outline: 'none',
                  fontFamily: 'inherit', background: 'var(--gray-50)',
                  minHeight: 40, maxHeight: 120,
                }}
              />
            )}
            {audioDraft ? (
              <button className="appheader__icon-btn" disabled={sending} onClick={clearAudioDraft} style={{background: 'var(--gray-200)', color: 'var(--text-secondary)', transition: 'all 150ms'}} aria-label="Descartar nota de voz">
                <Icons.Close size={18} />
              </button>
            ) : null}
            {audioDraft ? (
              <button className="appheader__icon-btn" disabled={offline || sending} onClick={sendRecordedAudio} style={{background: !offline ? 'var(--accent)' : 'var(--gray-200)', color: !offline ? 'white' : 'var(--text-tertiary)', transition: 'all 150ms', opacity: !offline ? 1 : 0.7}} aria-label="Enviar nota de voz">
                <Icons.Send size={18} sw={2} />
              </button>
            ) : draft.trim() ? (
              <button className="appheader__icon-btn" disabled={offline || sending} onClick={sendDraft} style={{background: !offline ? 'var(--accent)' : 'var(--gray-200)', color: !offline ? 'white' : 'var(--text-tertiary)', transition: 'all 150ms', opacity: !offline ? 1 : 0.7}} aria-label="Enviar">
                <Icons.Send size={18} sw={2} />
              </button>
            ) : !manualMode ? (
              <button
                className="appheader__icon-btn"
                disabled={offline || sending}
                onPointerDown={handleMicPointerDown}
                onPointerUp={handleMicPointerUp}
                onPointerCancel={handleMicPointerUp}
                onPointerLeave={handleMicPointerUp}
                onClick={handleMicClick}
                onContextMenu={(event) => event.preventDefault()}
                style={{background: recordingAudio ? 'var(--danger)' : 'var(--accent)', color: 'white', transition: 'all 150ms', opacity: offline || sending ? 0.55 : 1, touchAction: 'none'}}
                aria-label={recordingAudio ? 'Detener nota de voz' : 'Grabar nota de voz'}
              >
                {recordingAudio ? (
                  <span style={{fontSize: 15, lineHeight: 1}}>|</span>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3Z" />
                    <path d="M5 11a7 7 0 0 0 14 0" />
                    <path d="M12 18v3" />
                  </svg>
                )}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      ) : null}
      <BottomSheet open={manualContextOpen} onClose={() => setManualContextOpen(false)} height="78%">
        <form
          style={{display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 18px 18px'}}
          onSubmit={(event) => {
            event.preventDefault();
            const message = manualMessage.trim();
            if (!message) {
              setManualContextStatus('');
              setChatError('Escribe el mensaje a responder.');
              return;
            }
            const next = saveManualAiContext({
              message,
              additionalContext: manualAdditionalContext,
              captureName: manualCaptureName,
            });
            setManualContext(next);
            setManualContextOpen(false);
            setChatError('');
            setManualContextStatus('contexto actualizado');
          }}
        >
          <div className="row gap-2" style={{alignItems: 'center'}}>
            <Icons.Sparkles size={18} style={{color: 'var(--accent)'}} />
            <span className="t-h3">añadir contexto</span>
          </div>
          <div>
            <label className="t-caption" style={{display: 'block', marginBottom: 6, fontWeight: 700}}>mensaje a responder</label>
            <textarea
              className="textarea"
              rows={4}
              value={manualMessage}
              onChange={(event) => setManualMessage(event.target.value)}
              placeholder="Pega aquí el mensaje que quieres responder"
              style={{fontSize: 16, lineHeight: 1.45}}
              autoFocus
            />
          </div>
          <div>
            <label className="t-caption" style={{display: 'block', marginBottom: 6, fontWeight: 700}}>captura de conversación <span style={{fontWeight: 400, color: 'var(--text-tertiary)'}}>(opcional)</span></label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setManualCaptureName(event.target.files?.[0]?.name || '')}
              style={{width: '100%', fontSize: 14}}
            />
            {manualCaptureName ? <span className="t-caption" style={{display: 'block', marginTop: 6}}>archivo: {manualCaptureName}</span> : null}
          </div>
          <div>
            <label className="t-caption" style={{display: 'block', marginBottom: 6, fontWeight: 700}}>contexto adicional <span style={{fontWeight: 400, color: 'var(--text-tertiary)'}}>(opcional)</span></label>
            <textarea
              className="textarea"
              rows={3}
              value={manualAdditionalContext}
              onChange={(event) => setManualAdditionalContext(event.target.value)}
              placeholder="Ej. quién escribe, qué quieres lograr o cualquier detalle útil"
              style={{fontSize: 16, lineHeight: 1.45}}
            />
          </div>
          <div className="row gap-2" style={{justifyContent: 'flex-end', flexWrap: 'wrap'}}>
            <button type="button" className="btn btn--secondary btn--md" onClick={() => setManualContextOpen(false)}>cancelar</button>
            <button type="submit" className="btn btn--primary btn--md">guardar contexto</button>
          </div>
        </form>
      </BottomSheet>
      {imageViewer ? (
        <div
          className="chat-image-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Imagen en pantalla completa"
          onClick={() => setImageViewer(null)}
          onTouchStart={handleImageViewerTouchStart}
          onTouchEnd={handleImageViewerTouchEnd}
          onMouseDown={handleImageViewerTouchStart}
          onMouseUp={handleImageViewerTouchEnd}
        >
          <div className="chat-image-viewer__topbar" onClick={(event) => event.stopPropagation()}>
            <button className="chat-image-viewer__icon" onClick={() => setImageViewer(null)} aria-label="Cerrar imagen">
              <Icons.Close size={22} />
            </button>
            {imageViewer.total > 1 ? (
              <span className="chat-image-viewer__counter">{Number(imageViewer.index || 0) + 1} / {imageViewer.total}</span>
            ) : null}
            <a
              className="chat-image-viewer__download"
              href={imageViewer.url}
              download={imageViewer.message?.fileName || `wafli-${imageViewer.message?.id || 'imagen'}.jpg`}
              onClick={(event) => event.stopPropagation()}
            >
              Descargar
            </a>
          </div>
          {imageViewer.total > 1 ? (
            <>
              <button
                type="button"
                className="chat-image-viewer__nav chat-image-viewer__nav--prev"
                onClick={(event) => {
                  event.stopPropagation();
                  moveImageViewer(-1);
                }}
                aria-label="Imagen anterior"
              >
                ‹
              </button>
              <button
                type="button"
                className="chat-image-viewer__nav chat-image-viewer__nav--next"
                onClick={(event) => {
                  event.stopPropagation();
                  moveImageViewer(1);
                }}
                aria-label="Imagen siguiente"
              >
                ›
              </button>
            </>
          ) : null}
          {imageViewer.loading ? (
            <div className="chat-image-viewer__loading" onClick={(event) => event.stopPropagation()}>
              Cargando imagen...
            </div>
          ) : imageViewer.error ? (
            <button
              type="button"
              className="chat-image-viewer__loading chat-image-viewer__loading--button"
              onClick={(event) => {
                event.stopPropagation();
                setImageViewer((current) => current ? { ...current, url: '', error: '', loading: false, retryKey: Date.now() } : current);
              }}
            >
              {imageViewer.error} Pulsa para reintentar.
            </button>
          ) : (
            <img
              src={imageViewer.url}
              alt={imageViewer.message?.fileName || 'Imagen'}
              className="chat-image-viewer__image"
              onClick={(event) => event.stopPropagation()}
            />
          )}
          {imageViewer.caption ? (
            <div className="chat-image-viewer__caption" onClick={(event) => event.stopPropagation()}>{imageViewer.caption}</div>
          ) : null}
        </div>
      ) : null}
      <BottomSheet open={Boolean(selectedMessage)} onClose={() => setSelectedMessage(null)} height="44%">
        <div style={{padding: '8px 18px 18px'}}>
          <div className="t-h3" style={{marginBottom: 4}}>Mensaje</div>
          <div className="t-small" style={{color: 'var(--text-secondary)', marginBottom: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
            {selectedMessage?.deleted ? 'Mensaje eliminado' : (selectedMessage?.text || selectedMessage?.fileName || selectedMessage?.mediaType || 'Mensaje')}
          </div>
          <button style={menuActionStyle} onClick={() => { if (selectedMessage) setReplyTo(selectedMessage); setSelectedMessage(null); }}>
            Responder
          </button>
          {selectedMessage?.from === 'me' && selectedMessage?.type === 'text' && !selectedMessage?.deleted ? (
            <button style={menuActionStyle} disabled={messageActionLoading === 'edit'} onClick={beginEditSelectedMessage}>
              <Icons.Edit size={16} /> Editar
            </button>
          ) : null}
          {!selectedMessage?.deleted ? (
            <button style={menuActionStyle} disabled={Boolean(messageActionLoading)} onClick={() => deleteSelectedMessage('me')}>
              <Icons.Close size={16} /> {messageActionLoading === 'delete-me' ? 'Eliminando...' : 'Eliminar para mí'}
            </button>
          ) : null}
          {selectedMessage?.from === 'me' && !selectedMessage?.deleted ? (
            <button style={{...menuActionStyle, color: 'var(--danger)'}} disabled={Boolean(messageActionLoading)} onClick={() => deleteSelectedMessage('everyone')}>
              <Icons.Close size={16} /> {messageActionLoading === 'delete-everyone' ? 'Eliminando...' : 'Eliminar para todos'}
            </button>
          ) : null}
        </div>
      </BottomSheet>
      <BottomSheet open={Boolean(editingMessage)} onClose={() => { setEditingMessage(null); setEditMessageText(''); setEditAiCustomObjective(''); }} height="82%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '8px 18px 0', gap: 10}}>
          <div className="t-h3">Editar mensaje</div>
          <AiAgentControls
            agent={editAiAgent}
            setAgent={setEditAiAgent}
            objective={editAiObjective}
            setObjective={setEditAiObjective}
            customObjective={editAiCustomObjective}
            setCustomObjective={setEditAiCustomObjective}
          />
          <button
            className="btn btn--secondary btn--full"
            disabled={!editMessageText.trim() || Boolean(messageActionLoading)}
            onClick={rewriteEditingMessage}
            style={{height: 44, flexShrink: 0}}
          >
            <Icons.Sparkles size={16} /> {messageActionLoading === 'rewrite-edit' ? 'Reescribiendo...' : 'Reescribir con IA'}
          </button>
          <textarea
            value={editMessageText}
            onChange={(event) => setEditMessageText(event.target.value)}
            rows={4}
            autoCorrect="off"
            enterKeyHint="done"
            className="chat-composer-input"
            style={{
              width: '100%',
              flex: '1 1 auto',
              minHeight: 120,
              border: '1px solid var(--border-strong)',
              borderRadius: 14,
              padding: '12px',
              fontSize: 16,
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'none',
              background: 'var(--gray-50)',
            }}
          />
          <div style={{display: 'flex', gap: 8, position: 'sticky', bottom: 0, zIndex: 80, flexShrink: 0, margin: '8px -18px 0', padding: '10px 18px calc(12px + var(--safe-bottom))', background: 'var(--bg)', borderTop: '1px solid var(--border)'}}>
            <button className="btn btn--ghost btn--full" onClick={() => { setEditingMessage(null); setEditMessageText(''); setEditAiCustomObjective(''); }}>
              Cancelar
            </button>
            <button className="btn btn--primary btn--full" disabled={!editMessageText.trim() || Boolean(messageActionLoading)} onClick={saveEditedMessage}>
              {messageActionLoading === 'edit' ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </BottomSheet>
      <BottomSheet open={aiMenuOpen} onClose={() => setAiMenuOpen(false)} height="44%">
        <div style={{padding: '8px 18px 18px'}}>
          <div className="t-h3" style={{marginBottom: 12}}>Acciones IA</div>
          <button style={menuActionStyle} onClick={() => { dismissComposerKeyboard(); setAiMenuOpen(false); onSuggest && onSuggest(buildAiContext(replyTo ? { quotedMessage: quotedMessagePayload(replyTo, match) } : {})); }}><Icons.Sparkles size={16} /> {replyTo ? 'Sugerir respuesta al mensaje' : 'Sugerir respuesta'}</button>
          <button style={menuActionStyle} onClick={() => { dismissComposerKeyboard(); setAiMenuOpen(false); onReactivate && onReactivate(buildAiContext()); }}><Icons.Refresh size={16} /> Reactivar conversación</button>
          <button style={menuActionStyle} onClick={() => { dismissComposerKeyboard(); setAiMenuOpen(false); onRewrite && onRewrite(draft, buildAiContext()); }}><Icons.Edit size={16} /> Reescribir mensaje propio</button>
        </div>
      </BottomSheet>
      <BottomSheet open={aiProfileOpen} onClose={() => setAiProfileOpen(false)} height="76%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '4px 18px 18px', gap: 12}}>
          <div className="row gap-2" style={{alignItems: 'center'}}>
            <Icons.Settings size={18} style={{color: 'var(--accent)'}} />
            <span className="t-h3">Ajustes IA del contacto</span>
          </div>
          <AiProfileAdvancedControls
            intensity={normalizeAiManualProfile(chatAiProfile).intensity}
            setIntensity={(nextValue) => setChatAiProfile(previous => ({ ...normalizeAiManualProfile(previous), intensity: nextValue }))}
            aiProfile={chatAiProfile}
            setAiProfile={setChatAiProfile}
            onSaveAiProfile={saveChatAiProfile}
            profileStatus={chatAiProfileStatus}
          />
          <button className="btn btn--secondary btn--full" onClick={() => setAiProfileOpen(false)}>
            Cerrar
          </button>
        </div>
      </BottomSheet>
      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} height="88%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '4px 18px 0', scrollPaddingBottom: 96}}>
          <div className="row gap-2" style={{alignItems: 'center', marginBottom: 8}}>
            <Icons.Edit size={18} style={{color: 'var(--accent)'}} />
            <span className="t-h3">Editar contacto</span>
          </div>
          <label className="t-small" style={{marginBottom: 6, fontWeight: 500}}>Nombre del contacto</label>
          <input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            placeholder="Ej. Nombre del chat"
            autoComplete="off"
            autoCorrect="off"
            enterKeyHint="next"
            style={{
              width: '100%',
              border: '1px solid var(--border-strong)',
              borderRadius: 12,
              padding: '11px 12px',
              outline: 'none',
              fontSize: 16,
              marginBottom: 14,
              fontFamily: 'inherit',
            }}
          />
          <label className="t-small" style={{marginBottom: 6, fontWeight: 500}}>Número de contacto</label>
          <CountryPrefixSelect
            value={editPhoneCountry}
            onChange={setEditPhoneCountry}
            style={{
              width: '100%',
              border: '1px solid var(--border-strong)',
              borderRadius: 12,
              padding: '11px 12px',
              outline: 'none',
              fontSize: 16,
              marginBottom: 8,
              fontFamily: 'inherit'
            }}
          />
          <input
            value={editPhone}
            onChange={e => setEditPhone(sanitizeLocalPhoneInput(e.target.value, editPhoneCountry))}
            placeholder={buildPhonePlaceholder(editPhoneCountry)}
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="done"
            maxLength={16}
            style={{
              width: '100%',
              border: '1px solid var(--border-strong)',
              borderRadius: 12,
              padding: '11px 12px',
              outline: 'none',
              fontSize: 16,
              marginBottom: 14,
              fontFamily: 'inherit',
            }}
          />
          <div className="row gap-2" style={{position: 'sticky', bottom: 0, zIndex: 80, flexShrink: 0, margin: 'auto -18px 0', padding: '10px 18px calc(12px + var(--safe-bottom))', background: 'var(--bg)', borderTop: '1px solid var(--border)'}}>
            <button className="btn btn--secondary btn--md" style={{flex: 1}} onClick={() => setEditOpen(false)}>Cancelar</button>
            <button className="btn btn--primary btn--md" style={{flex: 1.2, opacity: canSaveEdits ? 1 : 0.55}} disabled={!canSaveEdits} onClick={saveContactEdits}>
              Guardar cambios
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}

function formatMediaSize(bytes) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

const MEDIA_OBJECT_URL_CACHE_LIMIT = 30;
const mediaObjectUrlCache = new Map();

function rememberMediaObjectUrl(cacheKey, objectUrl) {
  if (!cacheKey || !objectUrl) return;
  mediaObjectUrlCache.set(cacheKey, objectUrl);
  while (mediaObjectUrlCache.size > MEDIA_OBJECT_URL_CACHE_LIMIT) {
    const oldestKey = mediaObjectUrlCache.keys().next().value;
    const oldestUrl = mediaObjectUrlCache.get(oldestKey);
    mediaObjectUrlCache.delete(oldestKey);
    if (oldestUrl) URL.revokeObjectURL(oldestUrl);
  }
}

function MessageMediaPreview({ message, onOpenImage }) {
  const [url, setUrl] = React.useState('');
  const [error, setError] = React.useState('');
  const [retryKey, setRetryKey] = React.useState(0);
  const [shouldLoad, setShouldLoad] = React.useState(false);
  const hostRef = React.useRef(null);
  const cacheKey = `${message?.chatId || ''}:${message?.id || ''}`;

  React.useEffect(() => {
    setShouldLoad(false);
    setRetryKey(0);
    setUrl('');
    setError('');
    return () => {};
  }, [cacheKey, message?.hasMedia, message?.viewOnce, message?.deleted]);

  React.useEffect(() => {
    let alive = true;
    setUrl('');
    setError('');
    if (!shouldLoad || !message?.hasMedia || message?.deleted || !message.chatId || !message.id || !WaFliAPI?.chats?.media) return () => {};
    const cachedUrl = mediaObjectUrlCache.get(cacheKey);
    if (cachedUrl) {
      setUrl(cachedUrl);
      return () => { alive = false; };
    }
    WaFliAPI.chats.media(message.chatId, message.id)
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        rememberMediaObjectUrl(cacheKey, objectUrl);
        if (alive) setUrl(objectUrl);
      })
      .catch((mediaError) => {
        if (!alive) return;
        const code = mediaError?.code || '';
        const friendly = code === 'media_socket_unavailable'
          ? 'Conecta tu WhatsApp para cargar este archivo.'
          : code === 'media_too_large'
            ? 'Archivo demasiado pesado para previsualizarlo aqui.'
          : code === 'media_descriptor_missing' || code === 'media_not_found'
            ? 'Archivo temporal no disponible.'
            : 'Pulsa para reintentar cargar este archivo.';
        setError(friendly);
    });
    return () => {
      alive = false;
    };
  }, [cacheKey, message?.chatId, message?.id, message?.hasMedia, message?.deleted, shouldLoad, retryKey]);

  if (!message?.hasMedia || message?.viewOnce || message?.deleted) return null;
  const type = message.mediaType || message.type;
  const caption = [message.fileName, formatMediaSize(message.sizeBytes)].filter(Boolean).join(' · ');
  if (!shouldLoad) {
    return (
      <button
        ref={hostRef}
        type="button"
        className="chat-media-placeholder chat-media-placeholder--button"
        onClick={(event) => {
          event.stopPropagation();
          setShouldLoad(true);
        }}
      >
        <span className="chat-media-placeholder__dot" />
        Pulsa para cargar archivo
      </button>
    );
  }
  if (error) {
    return (
      <div className="chat-media-error">
        <div className="t-caption">{error}</div>
        <button className="btn btn--text" onClick={() => setRetryKey(key => key + 1)}>
          Reintentar
        </button>
      </div>
    );
  }
  if (!url) return <div className="chat-media-placeholder"><span className="chat-media-placeholder__dot" />Cargando archivo...</div>;
  if (type === 'image' || type === 'sticker') {
    return (
      <div className={type === 'sticker' ? 'chat-media-sticker' : 'chat-media-card'} style={{marginBottom: message.text ? 7 : 0}}>
        <button
          type="button"
          className="chat-media-image-button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenImage && onOpenImage({ message, url, caption });
          }}
          aria-label="Abrir imagen en pantalla completa"
        >
          <img src={url} alt={message.fileName || type} className="chat-media-preview-image" />
        </button>
        {caption ? <div className="t-caption" style={{marginTop: 4, color: 'var(--text-secondary)'}}>{caption}</div> : null}
      </div>
    );
  }
  if (type === 'audio') {
    return (
      <div className="chat-media-audio-card" style={{marginBottom: message.text ? 7 : 0}}>
        <div className="chat-media-audio-card__bar">
          <span className="chat-media-audio-card__play">Play</span>
          <span className="chat-media-audio-card__wave" />
        </div>
        <audio controls src={url} className="chat-media-preview-audio" />
        {caption ? <div className="t-caption" style={{marginTop: 4, color: 'var(--text-secondary)'}}>{caption}</div> : null}
      </div>
    );
  }
  if (type === 'video') {
    return (
      <div className="chat-media-video-card" style={{marginBottom: message.text ? 7 : 0}}>
        <video controls playsInline preload="metadata" src={url} className="chat-media-preview-video" />
        {caption ? <div className="t-caption" style={{marginTop: 4, color: 'var(--text-secondary)'}}>{caption}</div> : null}
        <a href={url} download={message.fileName || 'video.mp4'} className="t-caption" style={{display: 'inline-flex', marginTop: 6, color: 'var(--accent)', fontWeight: 700}}>
          Descargar vídeo
        </a>
      </div>
    );
  }
  return (
    <a href={url} download={message.fileName || 'archivo'} className="chat-media-document-card" style={{marginBottom: message.text ? 7 : 0}}>
      <span className="chat-media-document-card__icon">DOC</span>
      <span>Abrir archivo{caption ? ` · ${caption}` : ''}</span>
    </a>
  );
}

function MessageStructuredPreview({ message }) {
  const cardStyle = {
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.48)',
    borderRadius: 12,
    padding: '9px 10px',
    marginBottom: message.text ? 7 : 0,
  };
  const titleStyle = {fontSize: 12, fontWeight: 800, marginBottom: 4, color: 'var(--text)'};
  const bodyStyle = {fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.35};

  if (message.viewOnce) {
    const viewOnceKind = normalizeApiMessageType(message.mediaType || message.type || '');
    const viewOnceLabel = viewOnceKind === 'video' ? 'este vídeo' : viewOnceKind === 'image' ? 'esta foto' : 'este contenido';
    return (
      <div style={cardStyle}>
        <div style={titleStyle}>Una sola visualización</div>
        <div style={bodyStyle}>Revisa {viewOnceLabel} de una sola visualización en WhatsApp. WaFli no puede abrir este contenido ni usarlo con IA.</div>
      </div>
    );
  }

  if (message.type === 'poll') {
    const options = Array.isArray(message.pollOptions) ? message.pollOptions : [];
    return (
      <div style={cardStyle}>
        <div style={titleStyle}>{message.pollName || 'Encuesta'}</div>
        {options.length ? (
          <div className="col gap-1">
            {options.map((option, index) => (
              <div key={`${option}-${index}`} style={{...bodyStyle, display: 'flex', gap: 6}}>
                <span style={{color: 'var(--accent)', fontWeight: 700}}>•</span>
                <span>{option}</span>
              </div>
            ))}
          </div>
        ) : <div style={bodyStyle}>Encuesta recibida.</div>}
      </div>
    );
  }

  if (message.type === 'location') {
    const location = message.location || {};
    const label = location.name || location.address || message.text || 'Ubicación compartida';
    const coords = location.latitude && location.longitude ? `${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}` : '';
    return (
      <div style={cardStyle}>
        <div style={titleStyle}>{message.liveLocation ? 'Ubicación en vivo' : 'Ubicación'}</div>
        <div style={bodyStyle}>{label}</div>
        {coords ? <div className="t-mono" style={{fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4}}>{coords}</div> : null}
      </div>
    );
  }

  if (message.type === 'contact') {
    const names = Array.isArray(message.contactNames) && message.contactNames.length ? message.contactNames : [message.text || 'Contacto'];
    return (
      <div style={cardStyle}>
        <div style={titleStyle}>Contacto compartido</div>
        <div className="col gap-1">
          {names.map((name, index) => <div key={`${name}-${index}`} style={bodyStyle}>{name}</div>)}
        </div>
      </div>
    );
  }

  return null;
}

function LinkifiedText({ text = '' }) {
  const value = String(text || '');
  if (!value) return null;
  const pattern = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
  const nodes = [];
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) nodes.push(value.slice(lastIndex, match.index));
    const rawUrl = match[0].replace(/[),.;!?]+$/g, '');
    const trailing = match[0].slice(rawUrl.length);
    const href = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    nodes.push(
      <a
        key={`${rawUrl}-${match.index}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="chat-message-link"
        onClick={(event) => event.stopPropagation()}
      >
        {rawUrl}
      </a>
    );
    if (trailing) nodes.push(trailing);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < value.length) nodes.push(value.slice(lastIndex));
  return <>{nodes}</>;
}

function ChatMessages({ messages, chatName = '', chatPhone = '', onLongPressMessage, onReplyMessage, onOpenImage, messageError, onRetry }) {
  // Group by day separator
  const grouped = [];
  let lastDay = null;
  messages.forEach(m => {
    const day = m.t.split(' ')[0];
    if (day !== lastDay) {
      const label = day === 'hoy' ? 'Hoy' : day === 'ayer' ? 'Ayer' : day === 'lun' ? 'lunes 28 abril' : day === 'mar' ? 'martes 29 abril' : day;
      grouped.push({ separator: label, key: 'sep-' + day });
      lastDay = day;
    }
    grouped.push(m);
  });

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, paddingBottom: 4}}>
      {grouped.map((m, i) => {
        if (m.separator) {
          return (
            <div key={m.key} style={{textAlign: 'center', margin: '14px 0 6px'}}>
              <span className="t-caption" style={{
                background: 'var(--gray-100)', padding: '3px 10px', borderRadius: 'var(--r-pill)',
                fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)',
              }}>{m.separator}</span>
            </div>
          );
        }
        if (m.type === 'system') {
          return (
            <div key={m.id} className="chat-system-message">
              <span>{m.text || 'Aviso de WhatsApp'}</span>
            </div>
          );
        }
        const mine = m.from === 'me';
        const prev = grouped[i - 1];
        const grouped_with_prev = prev && !prev.separator && prev.from === m.from && (prev.senderName || '') === (m.senderName || '');
        const showSenderName = !mine && m.isGroup && m.senderName && !grouped_with_prev;
        const isDeleted = Boolean(m.deleted);
        const mediaFallbackText = {
          image: 'Imagen',
          sticker: 'Sticker',
          audio: 'Audio',
          video: 'Vídeo',
          document: 'Documento',
        }[m.mediaType || m.type];
        const visibleText = isDeleted ? 'Mensaje eliminado' : (m.hasMedia && mediaFallbackText && m.text === mediaFallbackText ? '' : m.text);
        const hasStructuredPreview = !isDeleted && Boolean(m.viewOnce || m.type === 'poll' || m.type === 'location' || m.type === 'contact');
        const messageTime = m.time || (m.t ? String(m.t).split(' ').slice(1).join(' ') : '');
        const holdRef = { current: null };
        const startHold = () => {
          if (!onLongPressMessage) return;
          holdRef.current = setTimeout(() => onLongPressMessage(m), 420);
        };
        const clearHold = () => {
          if (holdRef.current) clearTimeout(holdRef.current);
          holdRef.current = null;
        };
        const replyButton = (
          <button
            type="button"
            className={'chat-message-reply ' + (mine ? 'chat-message-reply--mine' : 'chat-message-reply--theirs')}
            aria-label="Responder mensaje"
            onClick={(event) => { event.stopPropagation(); onReplyMessage && onReplyMessage(m); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M10 8.5V4L3 11l7 7v-4.6h4.2c3.2 0 5.4 1.4 6.8 4.1-.3-5.1-3.1-9-8.1-9H10z" fill="currentColor" />
            </svg>
          </button>
        );
        return (
          <div key={m.id} className={'chat-message-row ' + (mine ? 'chat-message-row--mine' : 'chat-message-row--theirs')} style={{
            display: 'flex',
            justifyContent: mine ? 'flex-end' : 'flex-start',
            alignItems: 'flex-end',
            gap: 4,
            marginTop: grouped_with_prev ? 0 : 4,
          }}>
            {mine ? replyButton : null}
            <div
              className={'chat-message-bubble ' + (mine ? 'chat-message-bubble--mine' : 'chat-message-bubble--theirs') + (grouped_with_prev ? ' chat-message-bubble--stacked' : '')}
              onClick={() => onLongPressMessage && onLongPressMessage(m)}
              onMouseDown={startHold}
              onMouseUp={clearHold}
              onMouseLeave={clearHold}
              onTouchStart={startHold}
              onTouchEnd={clearHold}
              style={{
              maxWidth: 'min(82%, 340px)',
              minWidth: 0,
              padding: '8px 12px',
              fontSize: 14.5,
              lineHeight: 1.4,
              background: mine ? 'var(--accent-soft)' : 'var(--bg)',
              color: 'var(--text)',
              borderRadius: mine
                ? `16px 16px ${grouped_with_prev ? '16px' : '4px'} 16px`
                : `16px 16px 16px ${grouped_with_prev ? '16px' : '4px'}`,
              border: mine ? 'none' : '1px solid var(--border)',
              boxShadow: mine ? 'none' : '0 1px 1px rgba(0,0,0,0.02)',
              textWrap: 'pretty',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              opacity: isDeleted ? 0.74 : 1,
            }}>
              {showSenderName ? (
                <div className="chat-message-sender" style={{fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 2}}>
                  {m.senderName}
                </div>
              ) : null}
              {!isDeleted ? <MessageStructuredPreview message={m} /> : null}
              {!isDeleted ? <MessageMediaPreview message={m} onOpenImage={onOpenImage} /> : null}
              {m.quotedMessage && !isDeleted ? (
                <div className="chat-message-quote" style={{borderLeft: '3px solid var(--accent)', background: 'rgba(255,255,255,0.45)', borderRadius: 8, padding: '5px 7px', marginBottom: 6}}>
                  <div className="t-caption" style={{fontWeight: 700, color: 'var(--accent)'}}>
                    {resolveQuotedAuthorName(m.quotedMessage, m, { name: chatName, phone: chatPhone })}
                  </div>
                  <div className="t-caption" style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                    {displayTextForQuotedMessage(m.quotedMessage)}
                  </div>
                </div>
              ) : null}
              {!hasStructuredPreview ? (
                <span className="chat-message-text" style={{fontStyle: isDeleted ? 'italic' : 'normal', color: isDeleted ? 'var(--text-secondary)' : 'inherit'}}>
                  <LinkifiedText text={visibleText} />
                </span>
              ) : null}
              <div className="chat-message-meta">
                {messageTime ? <span>{messageTime}</span> : null}
                {m.edited && !isDeleted ? <span>editado</span> : null}
                {mine && !messageMetaAlreadyHasStatus(m) ? <MessageStatus status={m.status} /> : null}
              </div>
            </div>
            {!mine ? replyButton : null}
            {(messageError === m.id || m.status === 'failed') && mine && (
              <button className="btn btn--text" onClick={onRetry} style={{fontSize: 11, color: 'var(--danger)', marginLeft: 8}}>
                Error · Reintentar
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// SCREEN 5 · Sugerir respuesta (bottom sheet content)
const AI_AGENTS = [
  {
    id: 'Ligoteo',
    label: 'Ligoteo',
    description: 'Citas, química y conexión sin sonar intenso ni forzado.',
    objectives: ['Concretar una cita', 'Crear conexión', 'Seguir la charla con química', 'Personalizado'],
  },
  {
    id: 'Profesional',
    label: 'Profesional',
    description: 'Trabajo, clientes, jefes o conversaciones donde conviene ser claro y cuidado.',
    objectives: ['Responder con claridad', 'Pedir información', 'Cerrar una tarea', 'Personalizado'],
  },
  {
    id: 'Amistoso',
    label: 'Amistoso',
    description: 'Amigos, familia y chats cotidianos con naturalidad cercana.',
    objectives: ['Responder natural', 'Mantener la conversación', 'Apoyar o acompañar', 'Personalizado'],
  },
];
const DEFAULT_AI_AGENT = 'Ligoteo';
const AI_AUTO_OBJECTIVE = 'Auto';
const TONES = AI_AGENTS.map(agent => agent.label);
const AI_INTENSITY_OPTIONS = [
  ['auto', 'Auto'],
  ['suave', 'Suave'],
  ['media', 'Media'],
  ['directa', 'Directa'],
];
const AI_RELATIONSHIP_OPTIONS = [
  ['auto', 'Auto'],
  ['professional', 'Profesional'],
  ['flirt', 'Ligoteo'],
  ['friend', 'Amistad'],
  ['family', 'Familia'],
  ['client', 'Cliente'],
  ['boss', 'Jefe'],
  ['group', 'Grupo'],
];
const AI_RESPONSE_LENGTH_OPTIONS = [
  ['auto', 'Auto'],
  ['corta', 'Corta'],
  ['media', 'Media'],
  ['larga', 'Larga'],
];
const AI_ADDRESS_MODE_OPTIONS = [
  ['auto', 'Automatico'],
  ['tu', 'Tu'],
  ['vos', 'Vos'],
  ['usted', 'Usted'],
];
const AI_INITIATIVE_OPTIONS = [
  ['auto', 'Automatico'],
  ['prudente', 'Prudente'],
  ['equilibrada', 'Equilibrada'],
  ['proactiva', 'Proactiva'],
];

function getAiAgentConfig(agent) {
  return AI_AGENTS.find(item => item.id === agent || item.label === agent) || AI_AGENTS.find(item => item.id === DEFAULT_AI_AGENT) || AI_AGENTS[0];
}

function defaultObjectiveForAgent(agent) {
  return AI_AUTO_OBJECTIVE;
}

function normalizeAiObjectiveForAgent(agent, objective) {
  const selectedAgent = getAiAgentConfig(agent);
  const allowed = [AI_AUTO_OBJECTIVE, ...(selectedAgent.objectives || [])];
  return allowed.includes(objective) ? objective : AI_AUTO_OBJECTIVE;
}

function normalizeAiManualProfile(profile = {}) {
  const source = profile && typeof profile === 'object' ? profile : {};
  return {
    relationshipType: source.relationshipType || 'auto',
    preferredAgent: source.preferredAgent || 'auto',
    preferredObjective: source.preferredObjective || AI_AUTO_OBJECTIVE,
    intensity: source.intensity || 'auto',
    responseLength: source.responseLength || 'auto',
    addressMode: source.addressMode || source.treatment || 'auto',
    initiativeLevel: source.initiativeLevel || source.initiative || 'auto',
    notes: source.notes || '',
  };
}

function getSpeechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function useDeviceSpeechInput(setValue, setError) {
  const recognitionRef = React.useRef(null);
  const [listening, setListening] = React.useState(false);

  const stop = React.useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    setListening(false);
    try { recognition?.stop?.(); } catch (_) {}
    try { recognition?.abort?.(); } catch (_) {}
  }, []);

  React.useEffect(() => () => {
    stop();
  }, [stop]);

  React.useEffect(() => {
    const handleStop = () => stop();
    window.addEventListener('wafli:ai-stop-dictation', handleStop);
    return () => window.removeEventListener('wafli:ai-stop-dictation', handleStop);
  }, [stop]);

  const start = React.useCallback(() => {
    stop();
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setError && setError('Tu navegador no ofrece transcripción directa. Usa el micrófono del teclado del móvil para dictar este campo sin consumir IA.');
      return;
    }
    try {
      const recognition = new Recognition();
      recognitionRef.current = recognition;
      recognition.lang = 'es-ES';
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onstart = () => setListening(true);
      recognition.onend = () => {
        if (recognitionRef.current === recognition) recognitionRef.current = null;
        setListening(false);
      };
      recognition.onerror = () => {
        if (recognitionRef.current === recognition) recognitionRef.current = null;
        setListening(false);
        setError && setError('No hemos podido escuchar el dictado. También puedes usar el micrófono del teclado del móvil.');
      };
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results || [])
          .map(result => result?.[0]?.transcript || '')
          .join(' ')
          .trim();
        if (transcript) {
          setValue(previous => `${String(previous || '').trim()}${previous ? ' ' : ''}${transcript}`.trim());
        }
        if (recognitionRef.current === recognition) recognitionRef.current = null;
        setListening(false);
        try { recognition.stop?.(); } catch (_) {}
        try { recognition.abort?.(); } catch (_) {}
      };
      recognition.start();
    } catch (_) {
      recognitionRef.current = null;
      setListening(false);
      setError && setError('No hemos podido activar el micrófono. Puedes dictar desde el teclado del móvil.');
    }
  }, [setError, setValue, stop]);

  return { listening, start, stop };
}


function AiAgentControls({ agent, setAgent, objective, setObjective, customObjective, setCustomObjective }) {
  const selectedAgent = getAiAgentConfig(agent);
  const objectives = [AI_AUTO_OBJECTIVE, ...(selectedAgent.objectives || []).filter(item => item !== AI_AUTO_OBJECTIVE)];

  const changeAgent = (nextAgent) => {
    setAgent(nextAgent);
    setObjective(AI_AUTO_OBJECTIVE);
    setCustomObjective('');
  };

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14}}>
      <div>
        <div className="t-caption" style={{margin: '0 0 6px', fontWeight: 700}}>Agente</div>
        <div style={{display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2}}>
          {AI_AGENTS.map(item => (
            <button
              key={item.id}
              type="button"
              className={'chip ' + (agent === item.id || agent === item.label ? 'chip--active' : '')}
              onClick={() => changeAgent(item.id)}
              style={{whiteSpace: 'nowrap'}}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="t-caption" style={{display: 'block', margin: '0 0 6px', fontWeight: 700}}>Objetivo</label>
        <select
          value={objective}
          onChange={event => {
            setObjective(event.target.value);
            if (event.target.value !== 'Personalizado') setCustomObjective('');
          }}
          style={{
            width: '100%',
            border: '1px solid var(--border-strong)',
            borderRadius: 12,
            padding: '10px 12px',
            background: 'var(--bg)',
            color: 'var(--text)',
            font: 'inherit',
            outline: 'none'
          }}
        >
          {objectives.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        {objective === 'Personalizado' ? (
          <input
            value={customObjective}
            onChange={event => setCustomObjective(event.target.value)}
            placeholder="Describe el objetivo"
            style={{
              width: '100%',
              marginTop: 8,
              border: '1px solid var(--border-strong)',
              borderRadius: 12,
              padding: '10px 12px',
              background: 'var(--bg)',
              color: 'var(--text)',
              font: 'inherit',
              outline: 'none'
            }}
          />
        ) : null}
      </div>

      <p className="t-caption" style={{margin: '-2px 0 0', color: 'var(--text-secondary)'}}>
        WaFli usara el contexto del chat al generar.
      </p>
    </div>
  );
}

function AiProfileAdvancedControls({ intensity = 'auto', setIntensity, aiProfile, setAiProfile, onSaveAiProfile, profileStatus }) {
  const manualProfile = normalizeAiManualProfile(aiProfile);

  const updateManualProfile = (key, value) => {
    if (!setAiProfile) return;
    setAiProfile(previous => ({ ...normalizeAiManualProfile(previous), [key]: value }));
  };

  return (
    <div className="card" style={{padding: 12, border: '1px solid var(--border)', background: 'var(--surface)'}}>
      <div className="t-small" style={{fontWeight: 700, marginBottom: 4}}>Ajustes avanzados por chat</div>
      <p className="t-caption" style={{margin: '0 0 12px', color: 'var(--text-secondary)'}}>
        Opcional. Se guarda solo para este contacto y ayuda a WaFli a responder mejor.
      </p>
      <div style={{display: 'grid', gap: 10}}>
        <label className="t-caption" style={{display: 'grid', gap: 5, fontWeight: 700}}>
          Relacion
          <select
            value={manualProfile.relationshipType}
            onChange={event => updateManualProfile('relationshipType', event.target.value)}
            style={{border: '1px solid var(--border-strong)', borderRadius: 12, padding: '9px 10px', background: 'var(--bg)', color: 'var(--text)', font: 'inherit'}}
          >
            {AI_RELATIONSHIP_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="t-caption" style={{display: 'grid', gap: 5, fontWeight: 700}}>
          Intensidad
          <select
            value={intensity}
            onChange={event => {
              const nextValue = event.target.value;
              setIntensity && setIntensity(nextValue);
              updateManualProfile('intensity', nextValue);
            }}
            style={{border: '1px solid var(--border-strong)', borderRadius: 12, padding: '9px 10px', background: 'var(--bg)', color: 'var(--text)', font: 'inherit'}}
          >
            {AI_INTENSITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="t-caption" style={{display: 'grid', gap: 5, fontWeight: 700}}>
          Cómo tratar a esa persona
          <select
            value={manualProfile.addressMode}
            onChange={event => updateManualProfile('addressMode', event.target.value)}
            style={{border: '1px solid var(--border-strong)', borderRadius: 12, padding: '9px 10px', background: 'var(--bg)', color: 'var(--text)', font: 'inherit'}}
          >
            {AI_ADDRESS_MODE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="t-caption" style={{display: 'grid', gap: 5, fontWeight: 700}}>
          Nivel de iniciativa
          <select
            value={manualProfile.initiativeLevel}
            onChange={event => updateManualProfile('initiativeLevel', event.target.value)}
            style={{border: '1px solid var(--border-strong)', borderRadius: 12, padding: '9px 10px', background: 'var(--bg)', color: 'var(--text)', font: 'inherit'}}
          >
            {AI_INITIATIVE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="t-caption" style={{display: 'grid', gap: 5, fontWeight: 700}}>
          Notas persistentes
          <textarea
            className="textarea"
            rows={2}
            value={manualProfile.notes}
            onChange={event => updateManualProfile('notes', event.target.value)}
            placeholder="Ej. es mi jefe directo, mejor ir al grano."
            style={{fontSize: 14, lineHeight: 1.4}}
          />
        </label>
        <button type="button" className="btn btn--ghost btn--sm" style={{justifySelf: 'start', border: '1px solid var(--border-strong)', color: 'var(--text)'}} onClick={onSaveAiProfile}>
          Guardar ajustes
        </button>
        {profileStatus ? <span className="t-caption" style={{color: profileStatus.startsWith('Guard') ? 'var(--success, var(--accent))' : 'var(--text-secondary)'}}>{profileStatus}</span> : null}
      </div>
    </div>
  );
}

function AiOptionalControls({ userContext, setUserContext, setError, contextPlaceholder }) {
  const [showContext, setShowContext] = React.useState(() => Boolean(String(userContext || '').trim()));
  const { listening, start, stop } = useDeviceSpeechInput(setUserContext, setError);

  React.useEffect(() => {
    if (String(userContext || '').trim()) setShowContext(true);
  }, [userContext]);

  React.useEffect(() => {
    if (!showContext) stop();
  }, [showContext, stop]);

  const changeContextVisibility = (event) => {
    const checked = event.target.checked;
    setShowContext(checked);
    if (!checked) {
      stop();
      setUserContext('');
    }
  };

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 10, margin: '14px 0 10px'}}>
      <label className="row gap-2" style={{alignItems: 'center', cursor: 'pointer', userSelect: 'none'}}>
        <input type="checkbox" checked={showContext} onChange={changeContextVisibility} />
        <span className="t-small" style={{fontWeight: 700}}>Agregar contexto (opcional)</span>
      </label>

      {showContext ? (
        <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
          <textarea
            className="textarea"
            rows={3}
            value={userContext}
            onChange={event => setUserContext(event.target.value)}
            placeholder={contextPlaceholder || 'Añade solo lo que la IA deba tener en cuenta.'}
            style={{fontSize: 15, lineHeight: 1.45}}
          />
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={listening ? stop : start}
            style={{alignSelf: 'flex-start', border: '1px solid var(--border-strong)', color: 'var(--text)'}}
          >
            <Icons.Mic size={14} /> {listening ? 'Detener dictado' : 'Dictar contexto'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function stopAiSpeechDictation() {
  try {
    window.dispatchEvent(new CustomEvent('wafli:ai-stop-dictation'));
  } catch (_) {}
}

function emitQuotaUsage(result = {}) {
  window.dispatchEvent(new CustomEvent('wafli:quota-refresh'));
  if (result.quota) window.dispatchEvent(new CustomEvent('wafli:quota-consumed', { detail: result.quota }));
}

const AI_REPORT_METADATA_KEYS = new Set([
  'source',
  'action',
  'chatId',
  'agent',
  'objective',
  'variant',
  'promptVersion',
  'qualityFlags',
  'dialectWarnings',
  'spanishNaturalnessFlags',
  'humanReplyScore',
  'humanReplyDimensions',
  'model',
  'objectiveSource',
  'intensity',
  'situation',
  'relationshipType',
  'usedConversationProfile',
  'contextCopilotHints',
  'hasQuotedMessage',
  'hasMediaContext',
  'originalLength',
  'selectedIndex',
  'wasEditedBeforeSend',
]);

function sanitizeAiReportMetadata(metadata = {}, extra = {}) {
  const safe = {};
  if (metadata && typeof metadata === 'object') {
    Object.entries(metadata).forEach(([key, value]) => {
      if (AI_REPORT_METADATA_KEYS.has(key) && value !== undefined) safe[key] = value;
    });
  }
  return { ...safe, ...extra };
}

function AiReportButton({ chatId, action = 'unknown', text = '', originalText = '', metadata = null }) {
  const [status, setStatus] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('not_helpful');
  const [note, setNote] = React.useState('');
  const reportableText = String(text || '').trim();
  if (!reportableText || !WaFliAPI?.ai?.reportGeneratedContent || !WaFliAPI?.client?.isAuthenticated?.()) return null;

  const submit = async () => {
    setLoading(true);
    setStatus('');
    try {
      const noteText = note.trim();
      const safeMetadata = sanitizeAiReportMetadata(metadata, {
        chatId,
        action,
        wasEditedBeforeReport: Boolean(originalText) && reportableText !== String(originalText || '').trim(),
        reportedTextLength: reportableText.length,
        noteLength: noteText.length,
      });
      await WaFliAPI.ai.reportGeneratedContent({
        chatId,
        action,
        reason,
        note: noteText,
        generatedText: reportableText,
        text: reportableText,
        metadata: safeMetadata,
      });
      setStatus('Reporte enviado. Gracias.');
      setOpen(false);
      setNote('');
    } catch (apiError) {
      setStatus(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No hemos podido enviar el reporte.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{display: 'grid', gap: 8, minWidth: 220}}>
      <button type="button" className="btn btn--ghost btn--sm" style={{border: '1px solid var(--border)', color: 'var(--text-secondary)', justifySelf: 'start'}} disabled={loading} onClick={() => setOpen(previous => !previous)}>
        {open ? 'Cerrar reporte' : 'Reportar respuesta IA'}
      </button>
      {open ? (
        <div className="card" style={{padding: 10, display: 'grid', gap: 8, border: '1px solid var(--border)'}}>
          <label className="t-caption" style={{display: 'grid', gap: 5, fontWeight: 700}}>
            Motivo
            <select
              value={reason}
              onChange={event => setReason(event.target.value)}
              style={{border: '1px solid var(--border-strong)', borderRadius: 10, padding: '8px 10px', background: 'var(--bg)', color: 'var(--text)', font: 'inherit'}}
            >
              <option value="not_helpful">No me ayudo</option>
              <option value="wrong_context">Contexto equivocado</option>
              <option value="sounds_ai">Suena a IA</option>
              <option value="wrong_variant">Variante incorrecta</option>
              <option value="invented">Invento informacion</option>
              <option value="wrong_tone">Tono incorrecto</option>
              <option value="unsafe">Puede ser inapropiada</option>
              <option value="privacy">Privacidad</option>
              <option value="spam">Suena repetitiva o spam</option>
              <option value="other">Otro</option>
            </select>
          </label>
          <label className="t-caption" style={{display: 'grid', gap: 5, fontWeight: 700}}>
            Comentario (opcional)
            <textarea
              className="textarea"
              rows={3}
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="¿Qué falló o qué esperabas recibir?"
              style={{fontSize: 14, lineHeight: 1.4}}
            />
          </label>
          <div className="row gap-2" style={{flexWrap: 'wrap'}}>
            <button type="button" className="btn btn--primary btn--sm" disabled={loading} onClick={submit}>
              {loading ? 'Enviando...' : 'Enviar reporte'}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" style={{border: '1px solid var(--border)', color: 'var(--text-secondary)'}} disabled={loading} onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      {status ? <span className="t-caption" style={{color: status.startsWith('Reporte') ? 'var(--success, var(--accent))' : 'var(--danger)'}}>{status}</span> : null}
    </div>
  );
}


function SuggestSheet({ chatId, action = 'suggest', title = 'Sugerir respuesta', caption = '', matchContext = '', mediaContext = null, quotedMessage = null, manualContext = null, onClose, onSent, onQuota, canSend = true }) {
  const [agent, setAgent] = React.useState(DEFAULT_AI_AGENT);
  const [objective, setObjective] = React.useState(defaultObjectiveForAgent(DEFAULT_AI_AGENT));
  const [customObjective, setCustomObjective] = React.useState('');
  const [userContext, setUserContext] = React.useState('');
  const [intensity, setIntensity] = React.useState('auto');
  const [aiProfile, setAiProfile] = React.useState(() => normalizeAiManualProfile());
  const [profileStatus, setProfileStatus] = React.useState('');
  const [text, setText] = React.useState('');
  const [generated, setGenerated] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [sendingResult, setSendingResult] = React.useState(false);
  const [sentResult, setSentResult] = React.useState(false);
  const [error, setError] = React.useState('');
  const generatedTextRef = React.useRef('');
  const generationMetaRef = React.useRef(null);
  const sendResultLockRef = React.useRef(false);
  const hasResult = generated && Boolean(text.trim());
  const isReactivate = action === 'reactivate';

  React.useEffect(() => {
    setSentResult(false);
    sendResultLockRef.current = false;
  }, [text]);

  React.useEffect(() => {
    let alive = true;
    if (manualContext || !chatId || !WaFliAPI?.chats?.getAiProfile || !WaFliAPI?.client?.isAuthenticated?.()) return () => { alive = false; };
    WaFliAPI.chats.getAiProfile(chatId)
      .then(result => {
        if (!alive) return;
        const manual = normalizeAiManualProfile(result?.profile?.manual);
        setAiProfile(manual);
        if (manual.intensity && manual.intensity !== 'auto') setIntensity(manual.intensity);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [chatId, manualContext]);

  const saveAiProfile = async () => {
    if (manualContext || !WaFliAPI?.chats?.updateAiProfile || !WaFliAPI?.client?.isAuthenticated?.()) return;
    setProfileStatus('Guardando...');
    try {
      const payload = normalizeAiManualProfile({ ...aiProfile, intensity });
      const result = await WaFliAPI.chats.updateAiProfile(chatId, payload);
      setAiProfile(normalizeAiManualProfile(result?.profile?.manual || payload));
      setProfileStatus('Guardado');
    } catch (_) {
      setProfileStatus('No se pudo guardar');
    }
  };

  const buildPayload = (extra = {}) => ({
    chatId,
    action,
    agent,
    tone: agent,
    objective,
    intensity,
    customObjective: objective === 'Personalizado' ? customObjective.trim() : '',
    userContext: [manualAiUserContext(manualContext), userContext.trim()].filter(Boolean).join('\n'),
    manualContext: manualContext ? normalizeManualAiContext(manualContext) : undefined,
    matchContext,
    quotedMessage,
    mediaContext,
    ...extra,
  });

  const generateSuggestion = async () => {
    if (loading) return;
      const baseEndpoint = isReactivate ? WaFliAPI?.ai?.reactivate : WaFliAPI?.ai?.suggest;
      const isRegeneration = hasResult;
      const endpoint = isRegeneration ? (WaFliAPI?.ai?.regenerate || baseEndpoint) : baseEndpoint;
    if (!endpoint || !WaFliAPI?.client?.isAuthenticated?.()) {
      setError('Inicia sesión para generar con IA.');
      return;
    }
    stopAiSpeechDictation();
    setLoading(true);
    setError('');
    try {
      const result = await endpoint(buildPayload(isRegeneration ? {
        regeneration: true,
        previousGeneratedText: String(generatedTextRef.current || text || '').trim(),
        currentDraftText: String(text || '').trim(),
      } : {}));
      const nextText = String(result?.text || result?.message || '').trim();
      if (nextText) {
        const resultMeta = result?.meta || {};
        setText(nextText);
        setGenerated(true);
        generatedTextRef.current = nextText;
        generationMetaRef.current = {
          ...resultMeta,
          source: isReactivate ? 'reactivate' : 'ai_suggestion',
          action,
          chatId,
          promptVersion: resultMeta.promptVersion || result.promptVersion || result['promptVersion'] || '',
          model: resultMeta.model || result.model || '',
          variant: resultMeta.variant || result.variant || '',
          contextCopilotHints: resultMeta.contextCopilotHints ?? result.contextCopilotHints ?? null,
          agent: resultMeta.agent || agent,
          objective: resultMeta.objective || objective,
          objectiveSource: resultMeta.objectiveSource || '',
          intensity: resultMeta.intensity || intensity,
          situation: resultMeta.situation || '',
          relationshipType: resultMeta.relationshipType || '',
          usedConversationProfile: Boolean(resultMeta.usedConversationProfile),
          customObjective: objective === 'Personalizado' ? customObjective.trim() : '',
          userContext: userContext.trim(),
          hasQuotedMessage: Boolean(quotedMessage),
          hasMediaContext: Boolean(mediaContext),
        };
      }
      emitQuotaUsage(result);
    } catch (apiError) {
      if (apiError.code === 'quota_exhausted') onQuota && onQuota();
      else setError(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No hemos podido generar la sugerencia.');
    } finally {
      setLoading(false);
    }
  };

  const clearResult = () => {
    setText('');
    setGenerated(false);
    generatedTextRef.current = '';
    generationMetaRef.current = null;
    setError('');
  };

  return (
    <div className="ai-sheet" style={{display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '4px 18px 18px'}}>
      <div className="ai-sheet__scroll">
        <div className="row gap-2" style={{marginBottom: 12, alignItems: 'center'}}>
          <Icons.Sparkles size={18} style={{color: 'var(--accent)'}} />
          <span className="t-h3">{title}</span>
        </div>

        <AiAgentControls
          agent={agent}
          setAgent={setAgent}
          objective={objective}
          setObjective={setObjective}
          customObjective={customObjective}
          setCustomObjective={setCustomObjective}
          userContext={userContext}
          setUserContext={setUserContext}
          setError={setError}
          intensity={intensity}
          setIntensity={setIntensity}
          aiProfile={aiProfile}
          setAiProfile={setAiProfile}
          onSaveAiProfile={saveAiProfile}
          profileStatus={profileStatus}
          contextPlaceholder={isReactivate
            ? 'Ej. quiero retomar sin parecer intenso; habíamos quedado en hablar esta semana...'
            : 'Ej. es alguien que me interesa, mi jefe o un amigo; quiero sonar con calma, claro o cercano...'}
        />

        {hasResult ? (
          <div style={{position: 'relative', flex: 1, minHeight: 0, marginBottom: 12}}>
            <textarea
              className="textarea"
              value={text}
              onChange={event => setText(event.target.value)}
              style={{
                height: '100%', width: '100%', fontSize: 16, lineHeight: 1.5, minHeight: 140,
                opacity: loading ? 0.4 : 1, transition: 'opacity 150ms',
              }}
            />
            {loading ? (
              <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--accent)', fontSize: 13, fontWeight: 500}}>
                <Spinner size={16} /> generando...
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="ai-sheet__actions">
          <div className="row gap-2" style={{marginBottom: hasResult ? 10 : 0, flexWrap: 'wrap', alignItems: 'center'}}>
            <button
              className={hasResult ? 'btn btn--ghost btn--sm' : 'btn btn--primary btn--sm'}
              style={{border: hasResult ? '1px solid var(--border-strong)' : undefined, color: hasResult ? 'var(--text)' : undefined, opacity: loading ? 0.65 : 1}}
              disabled={loading}
              onClick={generateSuggestion}
            >
              {hasResult ? <Icons.Refresh size={15} /> : <Icons.Sparkles size={15} />}
              {hasResult ? 'Regenerar' : 'Generar'}
            </button>
            {hasResult ? (
              <>
                <button className="btn btn--ghost btn--sm" style={{border: '1px solid var(--border-strong)', color: 'var(--text)'}} onClick={clearResult}>
                  <Icons.Edit size={14} /> Limpiar
                </button>
                <AiReportButton chatId={chatId} action={action} text={text} originalText={generatedTextRef.current} metadata={generationMetaRef.current || { source: isReactivate ? 'reactivate' : 'ai_suggestion', agent, objective }} />
              </>
            ) : null}
          </div>

          <AiOptionalControls
            userContext={userContext}
            setUserContext={setUserContext}
            setError={setError}
            contextPlaceholder={isReactivate
              ? 'Ej. quiero retomar sin parecer intenso; habíamos quedado en hablar esta semana...'
              : 'Ej. es alguien que me interesa, mi jefe o un amigo; quiero sonar con calma, claro o cercano...'}
          />

          {error ? <p className="t-caption" style={{margin: hasResult ? '0 0 8px' : '10px 0 0', color: 'var(--danger)'}}>{error}</p> : null}
        </div>
      </div>

      {hasResult && canSend ? (
        <div className="ai-sheet__footer">
          <button className="btn btn--primary btn--full" disabled={loading || sendingResult || sentResult} onClick={async () => {
            if (sendResultLockRef.current || sentResult) return;
            sendResultLockRef.current = true;
            setSendingResult(true);
            let sentOk = false;
            try {
              const outgoingText = text.trim();
              if (!outgoingText) {
                setError('Genera un mensaje antes de enviarlo.');
                return;
              }
              if (WaFliAPI?.chats?.send && WaFliAPI?.client?.isAuthenticated?.()) {
                await WaFliAPI.chats.send(chatId, outgoingText, generationMetaRef.current ? {
                  metadata: {
                    ...generationMetaRef.current,
                    wasEditedBeforeSend: outgoingText !== String(generatedTextRef.current || '').trim()
                  }
                } : {});
              }
              setSentResult(true);
              sentOk = true;
              onSent && onSent(outgoingText);
            } catch (apiError) {
              setError(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No hemos podido enviar el mensaje.');
            } finally {
              if (!sentOk) sendResultLockRef.current = false;
              setSendingResult(false);
            }
          }}>{sendingResult ? 'Enviando...' : sentResult ? 'Enviado' : 'Enviar'}</button>
        </div>
      ) : null}
    </div>
  );
}

function RewriteSheet({ chatId, sourceText = '', manualContext = null, onUse, onQuota }) {
  const [agent, setAgent] = React.useState(DEFAULT_AI_AGENT);
  const [objective, setObjective] = React.useState(defaultObjectiveForAgent(DEFAULT_AI_AGENT));
  const [customObjective, setCustomObjective] = React.useState('');
  const [userContext, setUserContext] = React.useState('');
  const [intensity, setIntensity] = React.useState('auto');
  const [aiProfile, setAiProfile] = React.useState(() => normalizeAiManualProfile());
  const [profileStatus, setProfileStatus] = React.useState('');
  const [baseDraft, setBaseDraft] = React.useState(sourceText || '');
  const [rewritten, setRewritten] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const generatedMetaRef = React.useRef(null);
  const generatedTextRef = React.useRef('');
  const hasResult = Boolean(rewritten.trim());

  React.useEffect(() => {
    setBaseDraft(sourceText || '');
    setRewritten('');
    generatedMetaRef.current = null;
    generatedTextRef.current = '';
  }, [sourceText]);

  React.useEffect(() => {
    let alive = true;
    if (manualContext || !chatId || !WaFliAPI?.chats?.getAiProfile || !WaFliAPI?.client?.isAuthenticated?.()) return () => { alive = false; };
    WaFliAPI.chats.getAiProfile(chatId)
      .then(result => {
        if (!alive) return;
        const manual = normalizeAiManualProfile(result?.profile?.manual);
        setAiProfile(manual);
        if (manual.intensity && manual.intensity !== 'auto') setIntensity(manual.intensity);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [chatId, manualContext]);

  const saveAiProfile = async () => {
    if (manualContext || !WaFliAPI?.chats?.updateAiProfile || !WaFliAPI?.client?.isAuthenticated?.()) return;
    setProfileStatus('Guardando...');
    try {
      const payload = normalizeAiManualProfile({ ...aiProfile, intensity });
      const result = await WaFliAPI.chats.updateAiProfile(chatId, payload);
      setAiProfile(normalizeAiManualProfile(result?.profile?.manual || payload));
      setProfileStatus('Guardado');
    } catch (_) {
      setProfileStatus('No se pudo guardar');
    }
  };

  const generateRewrite = async () => {
    const draft = baseDraft.trim();
    if (!draft) {
      setError('Escribe el mensaje base que quieres reescribir.');
      return;
    }
    const isRegeneration = hasResult;
    const endpoint = isRegeneration ? (WaFliAPI?.ai?.regenerate || WaFliAPI?.ai?.rewrite) : WaFliAPI?.ai?.rewrite;
    if (!endpoint || !WaFliAPI?.client?.isAuthenticated?.()) {
      setError('Inicia sesión para reescribir con IA.');
      return;
    }
    stopAiSpeechDictation();
    setLoading(true);
    setError('');
    try {
      const result = await endpoint({
        chatId,
        action: 'rewrite',
        draft,
        message: draft,
        agent,
        tone: agent,
        objective,
        intensity,
        customObjective: objective === 'Personalizado' ? customObjective.trim() : '',
        userContext: [manualAiUserContext(manualContext), userContext.trim()].filter(Boolean).join('\n'),
        manualContext: manualContext ? normalizeManualAiContext(manualContext) : undefined,
        regeneration: isRegeneration,
        previousGeneratedText: isRegeneration ? String(generatedTextRef.current || rewritten || '').trim() : '',
        currentDraftText: isRegeneration ? String(rewritten || '').trim() : '',
      });
      const nextText = String(result?.text || result?.message || '').trim();
      if (nextText) {
        const resultMeta = result?.meta || {};
        setRewritten(nextText);
        generatedTextRef.current = nextText;
        generatedMetaRef.current = {
          ...resultMeta,
          source: 'rewrite',
          action: 'rewrite',
          chatId,
          originalLength: draft.length,
          promptVersion: resultMeta.promptVersion || result.promptVersion || result['promptVersion'] || '',
          model: resultMeta.model || result.model || '',
          variant: resultMeta.variant || result.variant || '',
          contextCopilotHints: resultMeta.contextCopilotHints ?? result.contextCopilotHints ?? null,
          agent: resultMeta.agent || agent,
          objective: resultMeta.objective || objective,
          objectiveSource: resultMeta.objectiveSource || '',
          intensity: resultMeta.intensity || intensity,
          situation: resultMeta.situation || '',
          relationshipType: resultMeta.relationshipType || '',
          usedConversationProfile: Boolean(resultMeta.usedConversationProfile),
          customObjective: objective === 'Personalizado' ? customObjective.trim() : '',
          userContext: userContext.trim(),
        };
      }
      emitQuotaUsage(result);
    } catch (apiError) {
      if (apiError.code === 'quota_exhausted') onQuota && onQuota();
      else setError(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No hemos podido reescribir el mensaje.');
    } finally {
      setLoading(false);
    }
  };

  const clearResult = () => {
    setRewritten('');
    generatedMetaRef.current = null;
    generatedTextRef.current = '';
    setError('');
  };

  return (
    <div className="ai-sheet" style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '4px 18px 18px'}}>
      <div className="ai-sheet__scroll">
        <div className="row gap-2" style={{marginBottom: 12, alignItems: 'center'}}>
          <Icons.Sparkles size={18} style={{color: 'var(--accent)'}} />
          <span className="t-h3">Reescribir mensaje propio</span>
        </div>
        <AiAgentControls
          agent={agent}
          setAgent={setAgent}
          objective={objective}
          setObjective={setObjective}
          customObjective={customObjective}
          setCustomObjective={setCustomObjective}
          userContext={userContext}
          setUserContext={setUserContext}
          setError={setError}
          intensity={intensity}
          setIntensity={setIntensity}
          aiProfile={aiProfile}
          setAiProfile={setAiProfile}
          onSaveAiProfile={saveAiProfile}
          profileStatus={profileStatus}
          contextPlaceholder="Ej. quiero sonar más seguro, más cercano o menos seco."
        />
        <label className="t-caption" style={{display: 'block', marginBottom: 6, fontWeight: 700}}>Mensaje base</label>
        <textarea
          className="textarea"
          rows={4}
          value={baseDraft}
          onChange={event => setBaseDraft(event.target.value)}
          placeholder="Escribe el mensaje que quieres reescribir"
          style={{fontSize: 16, lineHeight: 1.45, marginBottom: 12}}
        />
        {hasResult ? (
          <div style={{position: 'relative', marginBottom: 12}}>
            <textarea className="textarea" rows={6} value={rewritten} onChange={event => setRewritten(event.target.value)} style={{fontSize: 16, lineHeight: 1.5, opacity: loading ? 0.45 : 1}} />
            {loading ? (
              <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--accent)', fontSize: 13, fontWeight: 500}}>
                <Spinner size={16} /> generando...
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="ai-sheet__actions">
          <div className="row gap-2" style={{marginBottom: hasResult ? 10 : 0, flexWrap: 'wrap', alignItems: 'center'}}>
            <button className={hasResult ? 'btn btn--ghost btn--sm' : 'btn btn--primary btn--sm'} style={{border: hasResult ? '1px solid var(--border-strong)' : undefined, color: hasResult ? 'var(--text)' : undefined}} disabled={loading} onClick={generateRewrite}>
              {hasResult ? <Icons.Refresh size={15} /> : <Icons.Sparkles size={15} />} {hasResult ? 'Regenerar' : 'Generar'}
            </button>
            {hasResult ? (
              <>
                <button className="btn btn--ghost btn--sm" style={{border: '1px solid var(--border-strong)', color: 'var(--text)'}} onClick={clearResult}>
                  <Icons.Edit size={14} /> Limpiar
                </button>
                <AiReportButton chatId={chatId} action="rewrite" text={rewritten} originalText={generatedTextRef.current} metadata={generatedMetaRef.current || { source: 'rewrite', agent, objective, originalLength: String(baseDraft || '').length }} />
              </>
            ) : null}
          </div>
          <AiOptionalControls
            userContext={userContext}
            setUserContext={setUserContext}
            setError={setError}
            contextPlaceholder="Ej. quiero sonar más seguro, más cercano o menos seco."
          />
          {error ? <p className="t-caption" style={{margin: hasResult ? '0 0 8px' : '10px 0 0', color: 'var(--danger)'}}>{error}</p> : null}
        </div>
      </div>
      {hasResult ? (
        <div className="ai-sheet__footer">
          <button className="btn btn--primary btn--full" disabled={loading} onClick={() => onUse && onUse(rewritten)}>Usar este texto</button>
        </div>
      ) : null}
    </div>
  );
}

function AnalysisSheet({ chatId, message = '', onSuggest, onQuota }) {
  const [analysis, setAnalysis] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    setAnalysis('');
    setError('');
    setLoading(false);
  }, [chatId, message]);
  return (
    <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '4px 18px 18px'}}>
      <div className="row gap-2" style={{marginBottom: 8, alignItems: 'center'}}><Icons.Search size={18} style={{color: 'var(--accent)'}} /><span className="t-h3">Análisis</span></div>
      <div className="t-caption" style={{marginBottom: 6}}>Mensaje analizado</div>
      <div className="card" style={{padding: 10, marginBottom: 12, fontSize: 13.5}}>{message || 'No hay mensaje seleccionado.'}</div>
      <div className="card" style={{padding: 12, marginBottom: 12}}>
        {loading ? <p style={{margin: 0}}>Analizando...</p> : analysis ? <p style={{margin: 0, whiteSpace: 'pre-wrap'}}>{analysis}</p> : (
          <p style={{margin: 0, color: 'var(--text-secondary)'}}>WaFli no analiza mensajes automaticamente. Usa sugerir respuesta para generar solo cuando quieras.</p>
        )}
      </div>
      <AiReportButton chatId={chatId} action="analyze" text={analysis} metadata={{ source: 'analysis' }} />
      {error ? <p className="t-caption" style={{margin: '0 0 8px', color: 'var(--danger)'}}>{error}</p> : null}
      <button className="btn btn--primary btn--full" onClick={onSuggest}><Icons.Sparkles size={16} /> Sugerir respuesta</button>
    </div>
  );
}

// SCREEN 6 · Sugerencia heredada para compatibilidad interna
function OpenerSheet({ chatId, matchName = 'Chat', onClose, onUse, onQuota }) {
  const [tone, setTone] = React.useState(DEFAULT_AI_AGENT);
  const [context, setContext] = React.useState('');
  const [selected, setSelected] = React.useState(0);
  const [remoteOptions, setRemoteOptions] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const generatedRef = React.useRef(false);

  const options = remoteOptions.map((text) => ({ kind: 'IA', text }));
  const generateOpener = async () => {
    if (!WaFliAPI?.ai?.opener || !WaFliAPI?.client?.isAuthenticated?.()) {
      setError('Inicia sesión y conecta tu WhatsApp para generar sugerencias con IA.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await WaFliAPI.ai.opener({ chatId, notes: context, tone });
      const nextOptions = Array.isArray(result.alternatives) && result.alternatives.length
        ? result.alternatives
        : String(result.text || '').split(/\n+/).map((item) => item.trim()).filter(Boolean);
      if (nextOptions.length) {
        setRemoteOptions(nextOptions.slice(0, 3));
        setSelected(0);
      }
      emitQuotaUsage(result);
    } catch (apiError) {
      if (apiError.code === 'quota_exhausted') onQuota && onQuota();
      else setError(WaFliAPI.client.toUserMessage(apiError));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    generatedRef.current = false;
    setRemoteOptions([]);
    setSelected(0);
  }, [chatId]);

  return (
    <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '4px 18px 18px'}}>
      <div className="row gap-2" style={{marginBottom: 4, alignItems: 'center'}}>
        <Icons.Sparkles size={18} style={{color: 'var(--accent)'}} />
        <span className="t-h3">Sugerencia para {matchName}</span>
      </div>
      <p className="t-caption" style={{margin: '0 0 14px'}}>Elige una de las tres o regenera.</p>

      <div className="scroll-y" style={{margin: '0 -18px', padding: '0 18px'}}>
        {/* Context input */}
        <div style={{marginBottom: 14}}>
          <label className="t-small" style={{display: 'block', marginBottom: 6, fontWeight: 500}}>¿Qué sabes de {matchName}? <span style={{color: 'var(--text-tertiary)', fontWeight: 400}}>(opcional)</span></label>
          <textarea
            className="textarea"
            rows={2}
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="Trabaja en X, le gusta Y, vimos en su perfil que..."
            style={{fontSize: 16}}
          />
        </div>

        {/* Tone */}
        <div style={{display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4}}>
          {TONES.map(t => (
            <span key={t} className={'chip ' + (tone === t ? 'chip--active' : '')} onClick={() => setTone(t)}>{t}</span>
          ))}
        </div>

        {/* Options */}
        <div className="t-small" style={{fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11, marginBottom: 8}}>Opciones</div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16}}>
          {options.length ? options.map((o, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left',
                padding: 14,
                borderRadius: 12,
                border: '1.5px solid ' + (selected === i ? 'var(--accent)' : 'var(--border)'),
                background: selected === i ? 'var(--accent-softer)' : 'var(--bg)',
                cursor: 'pointer',
                transition: 'all 120ms',
              }}>
              <span style={{
                width: 18, height: 18, borderRadius: 10,
                border: '2px solid ' + (selected === i ? 'var(--accent)' : 'var(--border-strong)'),
                background: selected === i ? 'var(--accent)' : 'transparent',
                position: 'relative', flexShrink: 0, marginTop: 2,
              }}>
                {selected === i && <span style={{position: 'absolute', inset: 3, background: 'white', borderRadius: 5}} />}
              </span>
              <div className="col gap-1" style={{flex: 1}}>
                <span className="t-caption" style={{textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10, fontWeight: 600, color: 'var(--accent)'}}>{o.kind}</span>
                <span style={{fontSize: 14.5, lineHeight: 1.45}}>{o.text}</span>
              </div>
            </button>
          )) : (
            <div className="card" style={{padding: 12}}>
              <span className="t-small" style={{color: 'var(--text-secondary)'}}>Genera una sugerencia para ver opciones reales.</span>
            </div>
          )}
        </div>
      </div>

      <AiReportButton chatId={chatId} action="opener" text={options[selected]?.text || ''} metadata={{ source: 'opener', selectedIndex: selected }} />
      <div className="row gap-2" style={{paddingTop: 8}}>
        {error ? <p className="t-caption" style={{margin: '0 0 8px', color: 'var(--danger)'}}>{error}</p> : null}
        <button className="btn btn--ghost btn--md" style={{flex: 1, border: '1px solid var(--border-strong)', color: 'var(--text)'}} disabled={loading} onClick={generateOpener}>
          <Icons.Refresh size={16} /> {loading ? 'Generando...' : 'Regenerar todas'}
        </button>
        <button className="btn btn--primary btn--md" style={{flex: 1.4, opacity: options.length ? 1 : 0.55}} disabled={!options.length} onClick={() => onUse && onUse(options[selected]?.text)}>Usar elegida</button>
      </div>
    </div>
  );
}

function phoneFromUsageChatId(chatId = '') {
  const value = String(chatId || '');
  if (!value.includes('@s.whatsapp.net')) return '';
  const digits = value.split('@')[0].replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

function usageActionLabel(action = '') {
  const key = String(action || '').toLowerCase();
  return {
    suggest: 'Sugerencia de respuesta',
    rewrite: 'Reescritura de texto',
    opener: 'Sugerencia de respuesta',
    reactivate: 'Reactivación de hilo',
    analyze: 'Análisis de mensaje'
  }[key] || 'Generación IA';
}

function usageTargetLabel(row = {}) {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const explicitName = row.chat_name || metadata.chatName || metadata.matchName || metadata.contactName || metadata.displayName;
  if (explicitName) return explicitName;
  const phone = row.chat_phone || metadata.phone || phoneFromUsageChatId(row.resolved_chat_id || metadata.chatId);
  if (phone) return phone;
  const chatId = row.resolved_chat_id || metadata.chatId || '';
  if (String(chatId).endsWith('@g.us')) return 'un grupo';
  if (chatId) return 'un chat reciente';
  return '';
}

function formatUsageRow(row = {}) {
  const action = usageActionLabel(row.action);
  const target = usageTargetLabel(row);
  const status = String(row.status || '').toLowerCase();
  const cost = Math.max(0, Number(row.cost || 1));
  const statusLabel = status === 'reserved'
    ? 'En proceso'
    : status === 'failed'
      ? 'No cobrado'
      : `${cost || 1} generación${cost === 1 ? '' : 'es'} usada${cost === 1 ? '' : 's'}`;
  const detail = target ? `${action} con ${target}` : action;
  const reason = {
    suggest: 'Se gastó al pedir una respuesta sugerida.',
    rewrite: 'Se gastó al reescribir un texto.',
    opener: 'Se gastó al pedir una respuesta sugerida.',
    reactivate: 'Se gastó al reactivar una conversación.',
    analyze: 'Se gastó al analizar un mensaje.'
  }[String(row.action || '').toLowerCase()] || 'Se gastó al usar una acción de IA.';
  return { detail, reason, statusLabel };
}

const toolSelectStyle = {
  width: '100%',
  border: '1px solid var(--border-strong)',
  borderRadius: 12,
  padding: '10px 11px',
  outline: 'none',
  fontSize: 15,
  fontFamily: 'inherit',
  background: 'var(--surface)',
};

function firstToolVariant() {
  return SPANISH_VARIANT_OPTIONS.find(option => option.id === 'Neutro')?.id || SPANISH_VARIANT_OPTIONS[0]?.id || 'Neutro';
}

function readToolImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (!String(file.type || '').startsWith('image/')) {
      reject(new Error('Selecciona una imagen válida.'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('La imagen debe pesar menos de 5 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({
      dataUrl: String(reader.result || ''),
      fileName: file.name || 'captura',
      mimeType: file.type || 'image/*',
      sizeBytes: file.size || 0,
    });
    reader.onerror = () => reject(new Error('No hemos podido leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

async function copyStandaloneText(text, setStatus) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus && setStatus('Copiado');
  } catch {
    setStatus && setStatus('No hemos podido copiar automáticamente.');
  }
}

function ToolSelectRow({ agent, onAgentChange, objective = AI_AUTO_OBJECTIVE, onObjectiveChange, customObjective = '', onCustomObjectiveChange, variant, onVariantChange }) {
  const selectedAgent = getAiAgentConfig(agent);
  const objectives = [AI_AUTO_OBJECTIVE, ...(selectedAgent.objectives || []).filter(item => item !== AI_AUTO_OBJECTIVE)];
  const changeAgent = (nextAgent) => {
    onAgentChange && onAgentChange(nextAgent);
    onObjectiveChange && onObjectiveChange(AI_AUTO_OBJECTIVE);
  };
  return (
    <div className="grid" style={{gridTemplateColumns: '1fr 1fr', gap: 10}}>
      <label className="field">
        <span className="field__label">Agente</span>
        <select value={agent} onChange={(event) => changeAgent(event.target.value)} style={toolSelectStyle}>
          {AI_AGENTS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
      <label className="field">
        <span className="field__label">Objetivo</span>
        <select value={objective || AI_AUTO_OBJECTIVE} onChange={(event) => onObjectiveChange && onObjectiveChange(event.target.value)} style={toolSelectStyle}>
          {objectives.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label className="field" style={{gridColumn: '1 / -1'}}>
        <span className="field__label">Español</span>
        <select value={variant} onChange={(event) => onVariantChange(event.target.value)} style={toolSelectStyle}>
          {SPANISH_VARIANT_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.title || option.id}</option>)}
        </select>
      </label>
      {objective === 'Personalizado' ? (
        <label className="field" style={{gridColumn: '1 / -1'}}>
          <span className="field__label">Objetivo personalizado</span>
          <input
            value={customObjective}
            onChange={(event) => onCustomObjectiveChange && onCustomObjectiveChange(event.target.value)}
            placeholder="Ej. responder con más seguridad sin sonar seco"
            maxLength={180}
            style={toolSelectStyle}
          />
        </label>
      ) : null}
    </div>
  );
}

function ToolImageInput({ label, image, onChange, onClear, required = false }) {
  return (
    <div className="field">
      <span className="field__label">{label}{required ? '' : ' (opcional)'}</span>
      <label
        className="card"
        style={{
          padding: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          cursor: 'pointer',
          border: '1px dashed var(--border-strong)',
          background: 'var(--gray-50)',
        }}
      >
        <span className="row gap-2" style={{minWidth: 0}}>
          <span style={{width: 32, height: 32, borderRadius: 10, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
            <Icons.Doc size={16} />
          </span>
          <span className="col" style={{gap: 2, minWidth: 0}}>
            <span className="t-small" style={{fontWeight: 700}}>{image ? 'Cambiar captura' : 'Añadir captura'}</span>
            <span className="t-caption" style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
              {image?.fileName || 'PNG, JPG o HEIC'}
            </span>
          </span>
        </span>
        <span className="btn btn--secondary btn--sm" style={{pointerEvents: 'none', flexShrink: 0}}>Elegir</span>
        <input
          type="file"
          accept="image/*"
          style={{display: 'none'}}
          onChange={async (event) => {
            const file = event.target.files?.[0] || null;
            try {
              const next = await readToolImageFile(file);
              onChange(next);
            } catch (error) {
              onChange(null, error?.message || 'No hemos podido leer la imagen.');
            } finally {
              event.target.value = '';
            }
          }}
        />
      </label>
      {image ? (
        <div className="card" style={{marginTop: 8, padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10}}>
          <span className="t-small" style={{minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
            {image.fileName || 'Captura adjunta'}
          </span>
          <button type="button" className="btn btn--text" style={{height: 28}} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onClear(); }}>Quitar</button>
        </div>
      ) : null}
    </div>
  );
}

function ToolCard({ icon, title, subtitle, onClick, disabled = false }) {
  return (
    <button
      type="button"
      className="card"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: 16,
        textAlign: 'left',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        border: '1px solid var(--border)',
        background: disabled ? 'var(--gray-50)' : 'var(--surface)',
        opacity: disabled ? 0.7 : 1,
        cursor: disabled ? 'default' : 'pointer'
      }}
    >
      <span style={{width: 42, height: 42, borderRadius: 14, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
        {icon}
      </span>
      <span className="col" style={{gap: 3, minWidth: 0}}>
        <span className="t-h3" style={{fontSize: 16}}>{title}</span>
        <span className="t-small" style={{color: 'var(--text-secondary)'}}>{subtitle}</span>
      </span>
    </button>
  );
}

function ToolsHomeScreen({ onNavigate, onOpenReplyTool, onOpenIcebreakers, onOpenSavedLines, onConnectWhatsApp, onOpenProfileSettings, whatsappConnected = false }) {
  return (
    <>
      <AppHeader title="Herramientas" showQuota />
      <div className="scroll-y" style={{padding: '14px 16px 96px'}}>
        <div className="card" style={{padding: 16, marginBottom: 12, background: 'linear-gradient(135deg, rgba(77,91,246,0.12), rgba(20,184,166,0.10))'}}>
          <div className="row gap-2" style={{marginBottom: 6}}>
            <Icons.Sparkles size={20} style={{color: 'var(--accent)'}} />
            <span className="t-h3">IA útil sin conectar WhatsApp</span>
          </div>
          <p className="t-small" style={{margin: 0, color: 'var(--text-secondary)'}}>
            Pega una conversación o sube una captura para generar respuestas, entender mensajes y romper el hielo.
          </p>
        </div>

        <div className="grid gap-3">
          <ToolCard
            icon={<Icons.Chats size={22} />}
            title="¿Qué le respondo?"
            subtitle="Sube una captura o pega el chat y recibe una respuesta lista para copiar."
            onClick={onOpenReplyTool}
          />
          <ToolCard
            icon={<Icons.Sparkles size={22} />}
            title="Rompe el hielo"
            subtitle="Genera tres aperturas distintas para iniciar una conversación."
            onClick={onOpenIcebreakers}
          />
          <ToolCard
            icon={<Icons.Settings size={22} />}
            title="Mejora tu perfil"
            subtitle="Ajusta tu forma de hablar para que WaFli escriba más parecido a ti."
            onClick={onOpenProfileSettings}
          />
          {!whatsappConnected ? (
            <div className="card" style={{padding: 14, display: 'grid', gap: 10}}>
              <div>
                <span className="t-h3" style={{fontSize: 16}}>Conecta tu WhatsApp</span>
                <p className="t-small" style={{margin: '4px 0 0', color: 'var(--text-secondary)'}}>
                  Opcional: trae tus chats reales para responder desde WaFli.
                </p>
              </div>
              <div className="row gap-2">
                <button type="button" className="btn btn--secondary btn--md" onClick={onConnectWhatsApp}>Conectar</button>
                <button type="button" className="btn btn--text btn--md">Ahora no</button>
              </div>
            </div>
          ) : null}
          <div style={{padding: '8px 2px 2px'}}>
            <span className="t-caption" style={{fontWeight: 700, color: 'var(--text-secondary)'}}>Próximamente</span>
          </div>
          <ToolCard icon={<Icons.Sparkles size={22} />} title="Entrena conmigo" subtitle="Práctica conversacional para preparar mejores respuestas." disabled />
        </div>
      </div>
      <BottomNav active="tools" onChange={onNavigate} />
    </>
  );
}

function ToolReplyScreen({ onBack, onNavigate, onQuota }) {
  const [conversationText, setConversationText] = React.useState('');
  const [screenshot, setScreenshot] = React.useState(null);
  const [notes, setNotes] = React.useState('');
  const [agent, setAgent] = React.useState(DEFAULT_AI_AGENT);
  const [objective, setObjective] = React.useState(AI_AUTO_OBJECTIVE);
  const [customObjective, setCustomObjective] = React.useState('');
  const [variant, setVariant] = React.useState(firstToolVariant());
  const [result, setResult] = React.useState('');
  const [meta, setMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [status, setStatus] = React.useState('');

  React.useEffect(() => {
    let alive = true;
    WaFliAPI?.me?.getProfile?.().then(profile => {
      if (!alive || !profile) return;
      if (profile.spanish_variant || profile.variant) setVariant(profile.spanish_variant || profile.variant);
      if (profile.base_tone || profile.baseTone) setAgent(getAiAgentConfig(profile.base_tone || profile.baseTone).id);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const generateReply = async (regenerate = false) => {
    if (!conversationText.trim() && !screenshot) {
      setError('Añade una captura o pega la conversación para continuar.');
      return;
    }
    setLoading(true);
    setError('');
    setStatus('');
    try {
      const response = await WaFliAPI?.ai?.toolReply?.({
        mode: 'reply',
        agent,
        tone: agent,
        objective,
        customObjective,
        variant,
        conversationText,
        screenshot,
        notes,
        previousGeneratedText: regenerate ? result : '',
        regeneration: regenerate,
      });
      setResult(response?.text || '');
      setMeta(response?.meta || null);
      setStatus(regenerate ? 'Nueva versión generada' : 'Respuesta generada');
    } catch (apiError) {
      if (apiError?.code === 'quota_exhausted') onQuota && onQuota();
      setError(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No hemos podido generar la respuesta.');
    } finally {
      setLoading(false);
    }
  };

  const changeAgent = () => {
    const currentIndex = AI_AGENTS.findIndex(item => item.id === agent);
    const nextAgent = AI_AGENTS[(currentIndex + 1 + AI_AGENTS.length) % AI_AGENTS.length];
    setAgent(nextAgent.id);
    setObjective(AI_AUTO_OBJECTIVE);
    setCustomObjective('');
    setStatus('Agente cambiado. Pulsa Regenerar para crear otra versión.');
  };

  return (
    <>
      <AppHeader title="¿Qué le respondo?" showQuota leading={<IconButton onClick={onBack} label="Atrás"><Icons.Back size={20} /></IconButton>} />
      <div className="scroll-y" style={{padding: '14px 16px 110px'}}>
        <div className="grid gap-3">
          <div className="card" style={{padding: 14}}>
            <span className="t-h3" style={{fontSize: 16}}>Contexto</span>
            <p className="t-small" style={{margin: '4px 0 12px', color: 'var(--text-secondary)'}}>
              Sube una captura o pega la conversación. Una de las dos opciones es suficiente.
            </p>
            <ToolImageInput
              label="Captura de conversación"
              image={screenshot}
              onChange={(image, imageError) => { setScreenshot(image); if (imageError) setError(imageError); }}
              onClear={() => setScreenshot(null)}
            />
            <label className="field" style={{marginTop: 10}}>
              <span className="field__label">Texto pegado de conversación</span>
              <textarea className="textarea" value={conversationText} onChange={(event) => setConversationText(event.target.value)} rows={7} placeholder="Pega aquí el mensaje o la conversación..." />
            </label>
            <label className="field" style={{marginTop: 10}}>
              <span className="field__label">Contexto adicional (opcional)</span>
              <textarea className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Algo breve que ayude: intención, relación o detalle importante." />
            </label>
          </div>

          <div className="card" style={{padding: 14}}>
            <span className="t-h3" style={{fontSize: 16}}>Modo</span>
            <div className="row gap-2" style={{marginTop: 10, flexWrap: 'wrap'}}>
              <button type="button" className="btn btn--md btn--primary">Sugerirme respuesta</button>
            </div>
            <div style={{marginTop: 12}}>
              <ToolSelectRow agent={agent} onAgentChange={setAgent} objective={objective} onObjectiveChange={(nextObjective) => { setObjective(nextObjective); if (nextObjective !== 'Personalizado') setCustomObjective(''); }} customObjective={customObjective} onCustomObjectiveChange={setCustomObjective} variant={variant} onVariantChange={setVariant} />
            </div>
          </div>

          <button type="button" className="btn btn--primary btn--full" disabled={loading} onClick={() => generateReply(false)}>
            {loading ? 'Generando...' : 'Generar respuesta'}
          </button>

          {error ? <div className="card" style={{padding: 10, borderColor: 'rgba(180,30,30,0.25)'}}><span className="t-small" style={{color: 'var(--danger)'}}>{error}</span></div> : null}

          {result ? (
            <div className="card" style={{padding: 14, display: 'grid', gap: 10}}>
              <div className="row" style={{justifyContent: 'space-between', gap: 10}}>
                <span className="t-h3" style={{fontSize: 16}}>Resultado</span>
                {meta?.humanReplyScore ? <span className="t-caption">score {meta.humanReplyScore}</span> : null}
              </div>
              <textarea className="textarea" value={result} onChange={(event) => setResult(event.target.value)} rows={5} />
              <div className="row gap-2" style={{flexWrap: 'wrap'}}>
                <button type="button" className="btn btn--secondary btn--md" onClick={() => copyStandaloneText(result, setStatus)}><Icons.Copy size={15} /> Copiar</button>
                <button type="button" className="btn btn--secondary btn--md" disabled={loading} onClick={() => generateReply(true)}><Icons.Refresh size={15} /> Regenerar</button>
                <button type="button" className="btn btn--secondary btn--md" onClick={changeAgent}>Cambiar agente</button>
              </div>
            </div>
          ) : null}
          {status ? <span className="t-caption" style={{color: 'var(--text-secondary)'}}>{status}</span> : null}
        </div>
      </div>
      <BottomNav active="tools" onChange={onNavigate} />
    </>
  );
}

function ToolIcebreakersScreen({ onBack, onNavigate, onQuota }) {
  const [knownInfo, setKnownInfo] = React.useState('');
  const [profileScreenshot, setProfileScreenshot] = React.useState(null);
  const [agent, setAgent] = React.useState(DEFAULT_AI_AGENT);
  const [objective, setObjective] = React.useState(AI_AUTO_OBJECTIVE);
  const [customObjective, setCustomObjective] = React.useState('');
  const [variant, setVariant] = React.useState(firstToolVariant());
  const [alternatives, setAlternatives] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [status, setStatus] = React.useState('');

  React.useEffect(() => {
    let alive = true;
    WaFliAPI?.me?.getProfile?.().then(profile => {
      if (!alive || !profile) return;
      if (profile.spanish_variant || profile.variant) setVariant(profile.spanish_variant || profile.variant);
      if (profile.base_tone || profile.baseTone) setAgent(getAiAgentConfig(profile.base_tone || profile.baseTone).id);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const generateIcebreakers = async () => {
    if (!knownInfo.trim() && !profileScreenshot) {
      setError('Añade algo sobre la otra persona o una captura de perfil.');
      return;
    }
    setLoading(true);
    setError('');
    setStatus('');
    try {
      const response = await WaFliAPI?.ai?.toolIcebreakers?.({ knownInfo, profileScreenshot, agent, tone: agent, objective, customObjective, variant });
      setAlternatives((response?.alternatives || []).filter(Boolean).slice(0, 3));
      setStatus('Aperturas generadas');
    } catch (apiError) {
      if (apiError?.code === 'quota_exhausted') onQuota && onQuota();
      setError(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No hemos podido generar aperturas.');
    } finally {
      setLoading(false);
    }
  };

  const saveAlternative = async (text) => {
    try {
      await WaFliAPI?.ai?.saveLine?.({ text, tone: agent, variant, source: 'icebreaker', metadata: { objective, customObjective } });
      setStatus('Línea guardada');
    } catch (apiError) {
      setStatus(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No hemos podido guardar la línea.');
    }
  };

  return (
    <>
      <AppHeader title="Rompe el hielo" showQuota leading={<IconButton onClick={onBack} label="Atrás"><Icons.Back size={20} /></IconButton>} />
      <div className="scroll-y" style={{padding: '14px 16px 110px'}}>
        <div className="grid gap-3">
          <div className="card" style={{padding: 14}}>
            <span className="t-h3" style={{fontSize: 16}}>Punto de partida</span>
            <p className="t-small" style={{margin: '4px 0 12px', color: 'var(--text-secondary)'}}>
              Cuéntame algo de la otra persona o sube una captura de perfil.
            </p>
            <ToolImageInput
              label="Captura de perfil"
              image={profileScreenshot}
              onChange={(image, imageError) => { setProfileScreenshot(image); if (imageError) setError(imageError); }}
              onClear={() => setProfileScreenshot(null)}
            />
            <label className="field" style={{marginTop: 10}}>
              <span className="field__label">Qué sabes de la otra persona</span>
              <textarea className="textarea" value={knownInfo} onChange={(event) => setKnownInfo(event.target.value)} rows={5} placeholder="Ej. le gusta viajar, tiene una foto con su perro, estudia arquitectura..." />
            </label>
            <div style={{marginTop: 12}}>
              <ToolSelectRow agent={agent} onAgentChange={setAgent} objective={objective} onObjectiveChange={(nextObjective) => { setObjective(nextObjective); if (nextObjective !== 'Personalizado') setCustomObjective(''); }} customObjective={customObjective} onCustomObjectiveChange={setCustomObjective} variant={variant} onVariantChange={setVariant} />
            </div>
          </div>
          <button type="button" className="btn btn--primary btn--full" disabled={loading} onClick={generateIcebreakers}>
            {loading ? 'Generando...' : alternatives.length ? 'Regenerar tanda' : 'Generar 3 aperturas'}
          </button>
          {error ? <div className="card" style={{padding: 10, borderColor: 'rgba(180,30,30,0.25)'}}><span className="t-small" style={{color: 'var(--danger)'}}>{error}</span></div> : null}
          {alternatives.map((text, index) => (
            <div key={`${text}-${index}`} className="card" style={{padding: 14, display: 'grid', gap: 10}}>
              <span className="t-caption" style={{fontWeight: 700, color: 'var(--accent)'}}>{['Directa', 'Juguetona', 'Curiosa'][index] || `Opción ${index + 1}`}</span>
              <p className="t-body" style={{margin: 0}}>{text}</p>
              <div className="row gap-2" style={{flexWrap: 'wrap'}}>
                <button type="button" className="btn btn--secondary btn--md" onClick={() => copyStandaloneText(text, setStatus)}><Icons.Copy size={15} /> Copiar</button>
                <button type="button" className="btn btn--secondary btn--md" onClick={() => saveAlternative(text)}><Icons.Check size={15} /> Guardar</button>
              </div>
            </div>
          ))}
          {status ? <span className="t-caption" style={{color: 'var(--text-secondary)'}}>{status}</span> : null}
        </div>
      </div>
      <BottomNav active="tools" onChange={onNavigate} />
    </>
  );
}

function SavedLinesScreen({ onBack, onNavigate }) {
  const [lines, setLines] = React.useState([]);
  const [q, setQ] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState('');

  const loadLines = React.useCallback(async () => {
    setLoading(true);
    setStatus('');
    try {
      const result = await WaFliAPI?.ai?.savedLines?.({ q });
      setLines(result?.lines || []);
    } catch (apiError) {
      setStatus(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No hemos podido cargar tus líneas.');
    } finally {
      setLoading(false);
    }
  }, [q]);

  React.useEffect(() => {
    loadLines();
  }, [loadLines]);

  const deleteSavedLine = async (id) => {
    try {
      await WaFliAPI?.ai?.deleteLine?.(id);
      setLines(prev => prev.filter(line => String(line.id) !== String(id)));
      setStatus('Línea borrada');
    } catch (apiError) {
      setStatus(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No hemos podido borrar la línea.');
    }
  };

  return (
    <>
      <AppHeader title="Mis líneas guardadas" leading={<IconButton onClick={onBack} label="Atrás"><Icons.Back size={20} /></IconButton>} />
      <div className="scroll-y" style={{padding: '14px 16px 110px'}}>
        <div className="card" style={{padding: 12, marginBottom: 12}}>
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar líneas guardadas" style={{width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 16}} />
        </div>
        {loading ? <span className="t-caption">Cargando...</span> : null}
        <div className="grid gap-3">
          {lines.map(line => (
            <div key={line.id} className="card" style={{padding: 14, display: 'grid', gap: 10}}>
              <p className="t-body" style={{margin: 0}}>{line.text}</p>
              <div className="row gap-2" style={{flexWrap: 'wrap', justifyContent: 'space-between'}}>
                <span className="t-caption">{line.tone || 'Sin tono'} · {line.variant || 'Neutro'}</span>
                <span className="row gap-2">
                  <button type="button" className="btn btn--secondary btn--md" onClick={() => copyStandaloneText(line.text, setStatus)}><Icons.Copy size={15} /> Copiar</button>
                  <button type="button" className="btn btn--text btn--md" onClick={() => deleteSavedLine(line.id)}>Borrar</button>
                </span>
              </div>
            </div>
          ))}
          {!loading && lines.length === 0 ? (
            <EmptyState icon={<Icons.Empty size={32} sw={1.4} />} title="Todavía no guardaste líneas" subtitle="Cuando guardes aperturas desde Rompe el hielo aparecerán aquí." />
          ) : null}
        </div>
        {status ? <div style={{marginTop: 12}}><span className="t-caption" style={{color: 'var(--text-secondary)'}}>{status}</span></div> : null}
      </div>
      <BottomNav active="tools" onChange={onNavigate} />
    </>
  );
}

// SCREEN 7 · Pestaña Plan
function PlanScreen({ onNavigate, onOpenPlans, onOpenPacks, onOpenHistory }) {
  const [remoteUsage, setRemoteUsage] = React.useState(null);
  const [planName, setPlanName] = React.useState('');
  const [usageLoading, setUsageLoading] = React.useState(true);
  const [usageError, setUsageError] = React.useState('');
  const [restoreMsg, setRestoreMsg] = React.useState('');
  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!WaFliAPI?.billing?.usage || !WaFliAPI?.client?.isAuthenticated?.()) {
        setUsageLoading(false);
        return;
      }
      try {
        const result = await WaFliAPI.billing.usage();
        if (!alive) return;
        setRemoteUsage(result.usage || null);
        setPlanName(result.usage?.balance?.plan_name || '');
      } catch (error) {
        if (alive) setUsageError(WaFliAPI?.client?.toUserMessage?.(error) || 'No hemos podido cargar tu uso.');
      } finally {
        if (alive) setUsageLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, []);
  const balance = remoteUsage?.balance;
  const summary = remoteUsage?.summary || {};
  const hasBalance = Boolean(balance);
  const total = hasBalance ? Number(summary.includedLimit | balance?.included_limit | 0) + Number(summary.packBalance | balance?.pack_balance | 0) : 0;
  const used = hasBalance ? Number(summary.usedInPeriod | balance?.used_in_period | 0) : 0;
  const remaining = hasBalance ? Number(summary.totalAvailable | Math.max(0, Number(balance?.included_limit || 0) - used) + Number(balance?.pack_balance || 0)) : 0;
  const periodLabel = summary.periodType === 'month' ? 'este mes' : summary.periodType === 'trial' ? 'en tu trial' : 'hoy';
  const renewLabel = summary.periodType === 'month'
    ? 'Se renueva al empezar el próximo mes.'
    : summary.periodType === 'trial'
      ? 'Tu periodo actual se mantiene hasta su vencimiento. Después vuelves a Gratis si no renuevas.'
      : 'Se renueva a las 00:00.';
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const gaugeColor = pct > 0.25 ? 'var(--success)' : pct > 0.1 ? 'var(--warning)' : 'var(--danger)';
  const r = 78, cx = 100, cy = 100;
  const circ = Math.PI * r;
  const dash = circ * pct;
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const nativePurchaseCaps = WaFliAPI?.billing?.capabilities?.().nativePurchases;
  const history = (remoteUsage?.recent || []).map((row) => ({
    t: row.created_at ? new Date(row.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '',
    ...formatUsageRow(row),
  }));
  const visibleHistory = history;
  const openNativeSubscriptionManagement = async () => {
    setRestoreMsg('');
    try {
      const result = await WaFliAPI.billing.customerPortal();
      const url = result?.url || result?.managementUrl;
      if (!url) {
        setRestoreMsg('No encontramos una suscripción activa para gestionar.');
        return;
      }
      window.location.href = url;
      setRestoreMsg('Abrimos la tienda para gestionar tu suscripción.');
    } catch (error) {
      setRestoreMsg(WaFliAPI?.client?.toUserMessage?.(error) || 'No hemos podido abrir la gestión de suscripción.');
    }
  };
  const restoreNativePurchases = async () => {
    setRestoreMsg('');
    try {
      await WaFliAPI.billing.restorePurchases();
      setRestoreMsg('Compras restauradas y sincronizadas.');
    } catch (error) {
      setRestoreMsg(WaFliAPI?.client?.toUserMessage?.(error) || 'No hemos podido restaurar compras.');
    }
  };

  return (
    <>
      <AppHeader title="Plan" showQuota />
      <div className="scroll-y">
        <div style={{padding: 16}}>
          <div className="card" style={{padding: 18}}>
            <div className="t-small" style={{color: 'var(--text-secondary)', marginBottom: 4}}>
              {usageLoading ? 'Cargando plan...' : `Plan: ${String(planName || 'sin datos').toUpperCase()}`}
            </div>
            {usageError ? <p className="t-caption" style={{margin: '0 0 8px', color: 'var(--danger)'}}>{usageError}</p> : null}
            <button onClick={onOpenHistory} style={{width: '100%', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer'}}>
              <div style={{display: 'flex', justifyContent: 'center'}}>
                <svg width="220" height="130" viewBox="0 0 200 120">
                  <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} stroke="var(--gray-100)" strokeWidth="14" fill="none" strokeLinecap="round" />
                  <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} stroke={gaugeColor} strokeWidth="14" fill="none" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />
                  <text x={cx} y={cy - 14} textAnchor="middle" style={{fontSize: 30, fontWeight: 700, fill: 'var(--text)', letterSpacing: '-0.02em'}}>{hasBalance ? `${remaining}/${total}` : '--'}</text>
                  <text x={cx} y={cy + 8} textAnchor="middle" style={{fontSize: 12, fill: 'var(--text-secondary)'}}>generaciones {periodLabel}</text>
                </svg>
              </div>
            </button>
            <p className="t-caption" style={{textAlign: 'center', margin: 0}}>
              {hasBalance ? renewLabel : 'Sin datos de uso todavía'}
            </p>
          </div>

          <div className="col gap-2" style={{marginTop: 14}}>
            <button className="btn btn--primary btn--full" onClick={onOpenPlans}>Ver planes</button>
          <button className="btn btn--secondary btn--full" onClick={onOpenPacks}>Comprar pack de 50 generaciones</button>
          {nativePurchaseCaps?.nativePurchasePlatform ? (
            <>
              <button className="btn btn--secondary btn--full" onClick={openNativeSubscriptionManagement}>Gestionar suscripción / volver a Gratis</button>
              <button className="btn btn--text" style={{height: 40}} onClick={restoreNativePurchases}>Restaurar compras</button>
            </>
          ) : null}
          {restoreMsg ? <p className="t-caption" style={{margin: 0, color: restoreMsg.startsWith('Compras') || restoreMsg.startsWith('Abrimos') ? 'var(--success, var(--accent))' : 'var(--danger)'}}>{restoreMsg}</p> : null}
          </div>

          <div className="card" style={{marginTop: 16, padding: 0, overflow: 'hidden'}}>
            <button onClick={() => setHistoryOpen(v => !v)} style={{width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: '12px 14px', textAlign: 'left', display: 'flex', justifyContent: 'space-between'}}>
              <span style={{fontSize: 14.5, fontWeight: 600}}>Historial de uso</span>
              <span className="t-caption">{historyOpen ? 'Ocultar' : 'Ver'}</span>
            </button>
            {historyOpen ? (
              <div style={{borderTop: '1px solid var(--border)'}}>
                {visibleHistory.length ? visibleHistory.map((h, i) => (
                  <div key={i} style={{padding: '10px 14px', borderBottom: i < visibleHistory.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'flex-start', gap: 10}}>
                    <span className="t-mono" style={{fontSize: 12, width: 38, color: 'var(--text-tertiary)', paddingTop: 2}}>{h.t}</span>
                    <span style={{flex: 1, minWidth: 0}}>
                      <span className="t-small" style={{display: 'block', fontWeight: 600}}>{h.detail}</span>
                      <span className="t-caption" style={{display: 'block', color: 'var(--text-secondary)', marginTop: 2}}>{h.reason}</span>
                    </span>
                    <span className="t-caption" style={{fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap'}}>{h.statusLabel}</span>
                  </div>
                )) : (
                  <div style={{padding: '12px 14px'}}><span className="t-small" style={{color: 'var(--text-secondary)'}}>Todavía no hay uso registrado.</span></div>
                )}
                <button className="btn btn--text" style={{width: '100%', height: 38}} onClick={onOpenHistory}>Ver detalle completo</button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <BottomNav active="plan" onChange={onNavigate} />
    </>
  );
}

// SCREEN 8 · Cuota agotada (modal full-screen)
function QuotaExhausted({ onClose, onOpenPlans, onOpenPacks }) {
  return (
    <div style={{flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 22px'}}>
      <div className="row" style={{justifyContent: 'flex-end'}}>
        <IconButton onClick={onClose} label="Cerrar"><Icons.Close size={20} /></IconButton>
      </div>
      <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 8}}>
        <div style={{
          width: 120, height: 120, borderRadius: 30,
          background: 'var(--gray-50)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-tertiary)', marginBottom: 24, position: 'relative',
        }}>
          <Icons.EmptyBattery size={48} sw={1.4} />
          <span className="t-mono" style={{
            position: 'absolute', fontSize: 32, fontWeight: 600,
            color: 'var(--danger)', letterSpacing: '-0.02em',
            transform: 'translate(-2px, 0)',
          }}>0</span>
        </div>
        <h1 className="t-h1" style={{margin: '0 0 8px', maxWidth: 320, textWrap: 'balance'}}>Has agotado tus mensajes IA de hoy</h1>
        <p style={{margin: '0 0 32px', color: 'var(--text-secondary)', fontSize: 15, maxWidth: 280, textWrap: 'pretty'}}>
          Para seguir, elige una opción. Tu próxima recarga llega a las 00:00.
        </p>
        <div className="col gap-2" style={{width: '100%', maxWidth: 320}}>
          <button className="btn btn--primary btn--full" onClick={onOpenPlans}>Ver Plus y Pro</button>
          <button className="btn btn--secondary btn--full" onClick={onOpenPacks}>Comprar 50 extra por €2.99</button>
          <button className="btn btn--text" style={{height: 44, marginTop: 4}} onClick={onClose}>Esperar a 00:00</button>
        </div>
      </div>
    </div>
  );
}

// SCREEN 9 · Pestaña Ajustes
function SettingsScreen({ onNavigate, onShowToast, notificationPermission, notificationPrefs, onToggleNotification, onRequestNotificationPrompt, theme = 'system', onThemeChange, isNativeApp = false, initialSheet = null, onInitialSheetConsumed }) {
  const SUPPORT_EMAIL = 'soporte@wafli.ai';
  const SUPPORT_URL = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Soporte WaFli')}`;
  const isNativeIOS = Boolean(isNativeApp && window.Capacitor?.getPlatform?.() === 'ios');
  const showLanguageSelector = Boolean(SHOW_SETTINGS_LANGUAGE_SELECTOR && !isNativeIOS);
  const [sheet, setSheet] = React.useState(null);
  const [legalDoc, setLegalDoc] = React.useState(null);
  const [email, setEmail] = React.useState('');
  const [alias, setAlias] = React.useState('');
  const [spanishVariant, setSpanishVariant] = React.useState('Neutro');
  const [toneBase, setToneBase] = React.useState(DEFAULT_AI_AGENT);
  const [language, setLanguage] = React.useState('ES');
  const [styleWordsUse, setStyleWordsUse] = React.useState('');
  const [styleWordsAvoid, setStyleWordsAvoid] = React.useState('');
  const [styleExamples, setStyleExamples] = React.useState('');
  const [notifications, setNotifications] = React.useState(notificationPrefs || {
    global: false,
    newMessage: true,
    stalled: true,
    quota: true,
    product: false,
  });
  const rowButtonStyle = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 16px', background: 'transparent', border: 'none',
    borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left',
  };
  const [actionMsg, setActionMsg] = React.useState('');
  const [privacyLoading, setPrivacyLoading] = React.useState('');
  const [privacyConfirm, setPrivacyConfirm] = React.useState(null);

  React.useEffect(() => {
    if (notificationPrefs) setNotifications(notificationPrefs);
  }, [notificationPrefs]);
  React.useEffect(() => {
    if (!initialSheet) return;
    setSheet(initialSheet);
    onInitialSheetConsumed && onInitialSheetConsumed();
  }, [initialSheet, onInitialSheetConsumed]);
  React.useEffect(() => {
    const handleNativeBack = (event) => {
      if (legalDoc) {
        event.preventDefault();
        setLegalDoc(null);
        return;
      }
      if (privacyConfirm) {
        event.preventDefault();
        if (!privacyLoading) setPrivacyConfirm(null);
        return;
      }
      if (sheet) {
        event.preventDefault();
        setSheet(null);
      }
    };
    window.addEventListener('wafli:native-back', handleNativeBack);
    return () => window.removeEventListener('wafli:native-back', handleNativeBack);
  }, [legalDoc, privacyConfirm, privacyLoading, sheet]);
  React.useEffect(() => {
    let alive = true;
    const loadProfile = async () => {
      if (!WaFliAPI?.me?.getProfile || !WaFliAPI?.client?.isAuthenticated?.()) return;
      try {
        const result = await WaFliAPI.me.getProfile();
        const profile = result.profile || result;
        if (!alive || !profile) return;
        setEmail(profile.email || email);
        setAlias(profile.alias || '');
        setSpanishVariant(profile.spanish_variant || profile.spanishVariant || 'Neutro');
        const savedAgent = getAiAgentConfig(profile.base_tone || profile.baseTone || DEFAULT_AI_AGENT);
        setToneBase(savedAgent.label);
        setLanguage(profile.ui_language || profile.uiLanguage || 'ES');
        const aiStyle = profile.ai_style_profile || profile.aiStyleProfile || {};
        setStyleWordsUse(aiStyle.wordsUse || aiStyle.words_use || '');
        setStyleWordsAvoid(aiStyle.wordsAvoid || aiStyle.words_avoid || '');
        setStyleExamples(aiStyle.examples || aiStyle.writingExamples || aiStyle.styleExamples || '');
      } catch (_) {}
    };
    loadProfile();
    return () => { alive = false; };
  }, []);
  const setNotification = (key) => {
    if (key === 'global' && !notifications.global && notificationPermission !== 'granted') {
      if (onToggleNotification) onToggleNotification(key);
      return;
    }
    if (onToggleNotification) onToggleNotification(key);
    else setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
    const apiKey = key === 'global' ? 'global_enabled' : key === 'newMessage' ? 'new_message' : key;
    WaFliAPI?.push?.updatePreferences?.({ [apiKey]: !notifications[key] }).catch(() => {});
  };
  const saveProfile = async () => {
    try {
      await WaFliAPI?.me?.updateProfile?.({ alias, spanishVariant, baseTone: toneBase, uiLanguage: language });
      setActionMsg('Perfil actualizado');
      setSheet(null);
    } catch (apiError) {
      setActionMsg(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No hemos podido guardar el perfil.');
    }
  };
  const saveSpeakingStyle = async () => {
    try {
      await WaFliAPI?.me?.updateProfile?.({
        aiStyleProfile: {
          wordsUse: styleWordsUse,
          wordsAvoid: styleWordsAvoid,
          examples: styleExamples,
        }
      });
      setActionMsg('Forma de hablar guardada');
      setSheet(null);
    } catch (apiError) {
      setActionMsg(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No hemos podido guardar tu forma de hablar.');
    }
  };
  const runPrivacyAction = async (config = {}) => {
    if (privacyLoading) return;
    const { id, action, success, afterSuccess } = config;
    setPrivacyLoading(id);
    setActionMsg('');
    try {
      if (typeof action !== 'function') throw new Error('Acción no disponible');
      await action();
      setActionMsg(success);
      if (success) onShowToast && onShowToast(success);
      setPrivacyConfirm(null);
      setSheet(null);
      if (typeof afterSuccess === 'function') await afterSuccess();
    } catch (apiError) {
      setActionMsg(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No hemos podido completar la acción.');
    } finally {
      setPrivacyLoading('');
    }
  };
  const downloadPrivacyExport = async () => {
    if (privacyLoading) return;
    setPrivacyLoading('export');
    setActionMsg('');
    try {
      const result = await WaFliAPI?.privacy?.exportData?.();
      const payload = {
        exportedAt: new Date().toISOString(),
        app: 'WaFli',
        data: result?.data || result || {},
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wafli-datos-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setActionMsg('Descarga preparada');
    } catch (apiError) {
      setActionMsg(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No hemos podido preparar la descarga.');
    } finally {
      setPrivacyLoading('');
    }
  };
  const askPrivacyAction = (config) => setPrivacyConfirm(config);
  const disconnectWhatsApp = () => askPrivacyAction({
    id: 'disconnect',
    title: '¿Desconectar tu WhatsApp?',
    body: 'WaFli dejará de recibir y enviar mensajes hasta que vuelvas a conectar tu WhatsApp.',
    confirmLabel: 'Sí, desconectar',
    loadingLabel: 'Desconectando...',
    action: () => WaFliAPI?.whatsapp?.disconnect?.(true),
    success: 'Tu WhatsApp fue desconectado de WaFli',
    afterSuccess: () => onNavigate && onNavigate('connect')
  });
  const deletePrivacyHistory = () => askPrivacyAction({
    id: 'history',
    title: '¿Borrar historial en caché?',
    body: 'Se eliminará el historial temporal que WaFli usa para mostrar chats recientes y contexto IA. No borra tus chats originales.',
    confirmLabel: 'Sí, borrar historial',
    loadingLabel: 'Borrando...',
    action: () => WaFliAPI?.privacy?.deleteHistory?.(),
    success: 'Historial borrado'
  });
  const requestAccountDelete = () => askPrivacyAction({
    id: 'delete-account',
    title: 'Eliminar tu cuenta?',
    body: 'Vamos a programar la eliminación de tu cuenta. Tendrás margen para cancelarla si fue un error.',
    confirmLabel: 'Sí, eliminar cuenta',
    loadingLabel: 'Solicitando...',
    danger: true,
    action: () => WaFliAPI?.privacy?.requestDelete?.(),
    success: 'Eliminación solicitada',
    afterSuccess: () => {
      WaFliAPI?.client?.clearSession?.();
      onNavigate && onNavigate('landing');
    }
  });
  const privacyButtonContent = (id, idleLabel, loadingLabel) => (
    privacyLoading === id
      ? <><Spinner size={14} /> {loadingLabel}</>
      : idleLabel
  );
  const openSupport = async () => {
    try {
      window.location.href = SUPPORT_URL;
    } catch (_) {
      await navigator.clipboard?.writeText?.(SUPPORT_EMAIL).catch(() => {});
      onShowToast && onShowToast('Correo de soporte copiado');
    }
  };

  const item = (icon, title, subtitle, onClick, noBorder = false) => (
    <button onClick={onClick} style={{...rowButtonStyle, borderBottom: noBorder ? 'none' : rowButtonStyle.borderBottom}}>
      <span style={{
        width: 32, height: 32, borderRadius: 8, background: 'var(--gray-50)', color: 'var(--text-secondary)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{icon}</span>
      <div className="col" style={{flex: 1, gap: 2}}>
        <span style={{fontSize: 15, fontWeight: 500}}>{title}</span>
        {subtitle ? <span className="t-caption">{subtitle}</span> : null}
      </div>
      <Icons.Chevron size={16} sw={2} style={{color: 'var(--text-tertiary)'}} />
    </button>
  );

  return (
    <>
      <AppHeader title="Ajustes" showQuota />
      <div className="scroll-y">
        <div style={{padding: 16}}>
          {actionMsg ? <div className="card" style={{padding: 10, marginBottom: 12}}><span className="t-small">{actionMsg}</span></div> : null}
          <div className="card settings-theme-card">
            <div className="row" style={{justifyContent: 'space-between', gap: 12, alignItems: 'center'}}>
              <div className="col" style={{gap: 2}}>
                <span style={{fontSize: 15, fontWeight: 700}}>Modo de color</span>
                <span className="t-caption">Claro, oscuro o automático según tu dispositivo.</span>
              </div>
              <span style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--accent-softer)',
                color: 'var(--accent)',
                flexShrink: 0,
              }}>
                <Icons.Settings size={17} />
              </span>
            </div>
            <div className="theme-segment">
              {[
                ['system', 'Sistema'],
                ['light', 'Claro'],
                ['dark', 'Oscuro'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={'theme-segment__button ' + (theme === value ? 'theme-segment__button--active' : '')}
                  onClick={() => onThemeChange && onThemeChange(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="card" style={{padding: 0, overflow: 'hidden'}}>
            {item(<Icons.User size={17} />, 'Perfil', `${spanishVariant} · ${toneBase}`, () => setSheet('profile'))}
            {item(<Icons.Sparkles size={17} />, 'Mi forma de hablar', 'Palabras que usas y evitas', () => setSheet('speaking-style'))}
            {item(<Icons.Card size={17} />, 'Plan y facturación', 'Atajo a plan + pago + facturas', () => setSheet('billing'))}
            {item(<Icons.Lock size={17} />, 'Privacidad', 'Datos, exportación y eliminación', () => setSheet('privacy'))}
            {item(<Icons.Bell size={17} />, 'Notificaciones', notifications.global ? 'Activadas' : 'Desactivadas', () => setSheet('notifications'))}
            {item(<Icons.Settings size={17} />, 'Apariencia', theme === 'dark' ? 'Oscuro' : theme === 'light' ? 'Claro' : 'Sistema', () => setSheet('appearance'))}
            {item(<Icons.Help size={17} />, 'Soporte', 'Contacto por correo', () => setSheet('support'))}
            {item(<Icons.Doc size={17} />, 'Términos legales', 'T&C, privacidad, cookies y soporte', () => setSheet('terms'), true)}
          </div>

          <div className="card" style={{marginTop: 16, padding: 0, overflow: 'hidden'}}>
            <button
              onClick={() => setSheet('logout')}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--danger)',
              }}
            >
              <span style={{
                width: 32, height: 32, borderRadius: 8, background: 'var(--danger-soft)', color: 'var(--danger)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}><Icons.Logout size={17} /></span>
              <span style={{fontSize: 15, fontWeight: 500}}>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
      <BottomNav active="settings" onChange={onNavigate} />

      <BottomSheet open={sheet === 'profile'} onClose={() => setSheet(null)} height="88%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '8px 18px 18px'}}>
          <span className="t-h3" style={{marginBottom: 10}}>Perfil</span>
          <label className="t-small" style={{fontWeight: 600, marginBottom: 6}}>Correo</label>
          <div className="card" style={{padding: '10px 12px', marginBottom: 12, background: 'var(--gray-50)'}}>{email}</div>
          <label className="t-small" style={{fontWeight: 600, marginBottom: 6}}>Variante de español</label>
          <div className="row gap-2" style={{flexWrap: 'wrap', marginBottom: 12}}>
            {SPANISH_VARIANT_OPTIONS.map(option => option.id).map((v) => (
              <button key={v} className={'chip ' + (spanishVariant === v ? 'chip--active' : '')} onClick={() => setSpanishVariant(v)}>{v}</button>
            ))}
          </div>
          <label className="t-small" style={{fontWeight: 600, marginBottom: 6}}>Agente predeterminado</label>
          <div className="row gap-2" style={{flexWrap: 'wrap', marginBottom: 12}}>
            {AI_AGENTS.map((agent) => (
              <button key={agent.id} className={'chip ' + (getAiAgentConfig(toneBase).id === agent.id ? 'chip--active' : '')} onClick={() => setToneBase(agent.label)}>{agent.label}</button>
            ))}
          </div>
          <label className="t-small" style={{fontWeight: 600, marginBottom: 6}}>Nombre o alias (opcional)</label>
          <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Tu alias" autoComplete="nickname" autoCorrect="off" enterKeyHint="done" style={{width: '100%', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '11px 12px', outline: 'none', fontSize: 16, marginBottom: 14, fontFamily: 'inherit'}} />
          <div style={{position: 'sticky', bottom: 0, zIndex: 80, flexShrink: 0, margin: '18px -18px 0', padding: '10px 18px calc(12px + var(--safe-bottom))', background: 'var(--bg)', borderTop: '1px solid var(--border)'}}>
            <button className="btn btn--primary btn--full" onClick={saveProfile}>Guardar</button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'speaking-style'} onClose={() => setSheet(null)} height="68%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '8px 18px 18px'}}>
          <span className="t-h3" style={{marginBottom: 8}}>Mi forma de hablar</span>
          <p className="t-caption" style={{margin: '0 0 14px', color: 'var(--text-secondary)'}}>
            Opcional. Ayuda a WaFli a sonar más parecido a ti cuando generas una respuesta.
          </p>
          <label className="t-small" style={{fontWeight: 700, marginBottom: 6}}>Palabras que suelo usar</label>
          <input
            value={styleWordsUse}
            onChange={(event) => setStyleWordsUse(event.target.value)}
            placeholder="Ej. perfecto, claro, sin problema"
            maxLength={240}
            autoCorrect="off"
            enterKeyHint="next"
            style={{width: '100%', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '11px 12px', outline: 'none', fontSize: 16, marginBottom: 14, fontFamily: 'inherit'}}
          />
          <label className="t-small" style={{fontWeight: 700, marginBottom: 6}}>Palabras que no uso</label>
          <input
            value={styleWordsAvoid}
            onChange={(event) => setStyleWordsAvoid(event.target.value)}
            placeholder="Ej. muy formal, urgente, estimado"
            maxLength={240}
            autoCorrect="off"
            enterKeyHint="done"
            style={{width: '100%', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '11px 12px', outline: 'none', fontSize: 16, marginBottom: 14, fontFamily: 'inherit'}}
          />
          <label className="t-small" style={{fontWeight: 700, marginBottom: 6}}>Ejemplos de cómo escribo</label>
          <textarea
            className="textarea"
            rows={4}
            value={styleExamples}
            onChange={(event) => setStyleExamples(event.target.value)}
            placeholder="Ej. copia 2 o 3 mensajes tuyos cortos para que WaFli entienda tu ritmo."
            maxLength={700}
            style={{fontSize: 15, lineHeight: 1.45, marginBottom: 14}}
          />
          <div className="card" style={{padding: 12, background: 'var(--gray-50)', marginTop: 2}}>
            <p className="t-caption" style={{margin: 0}}>
              No hace falta completarlo. WaFli también usa el contexto del chat y tu variante de español.
            </p>
          </div>
          <div style={{position: 'sticky', bottom: 0, zIndex: 80, flexShrink: 0, margin: '18px -18px 0', padding: '10px 18px calc(12px + var(--safe-bottom))', background: 'var(--bg)', borderTop: '1px solid var(--border)'}}>
            <button className="btn btn--primary btn--full" onClick={saveSpeakingStyle}>Guardar</button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'billing'} onClose={() => setSheet(null)} height="90%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '8px 18px 18px'}}>
          <span className="t-h3" style={{marginBottom: 10}}>Plan y facturación</span>
          <button className="btn btn--primary btn--md" style={{marginBottom: 10}} onClick={() => onNavigate('plan')}>Ir a mi plan</button>
          <div className="card" style={{padding: 12, marginBottom: 14}}>
            <div className="t-small" style={{fontWeight: 600, marginBottom: 8}}>Pagos y facturas</div>
            <p className="t-caption" style={{margin: 0, color: 'var(--text-secondary)'}}>
              {WaFliAPI?.billing?.capabilities?.().nativePurchases?.nativePurchasePlatform
                ? 'En iOS y Android, las suscripciones se compran, cancelan o cambian desde App Store o Google Play. En Plan puedes restaurar compras o abrir la gestión de suscripción.'
                : 'En web, la gestión de pagos se realiza desde el portal de facturación.'}
            </p>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'privacy'} onClose={() => setSheet(null)} height="92%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '8px 18px 18px'}}>
          <span className="t-h3" style={{marginBottom: 10}}>Privacidad</span>
          <div className="card" style={{padding: 12, marginBottom: 12}}>
            <div className="t-small" style={{fontWeight: 600, marginBottom: 6}}>Datos almacenados</div>
            <p className="t-caption" style={{margin: 0, color: 'var(--text-secondary)'}}>Usamos una caché temporal de conversaciones recientes para mostrar tus chats y generar respuestas. Puedes borrar ese historial desde aquí.</p>
          </div>
          <div className="card" style={{padding: 12, marginBottom: 12, background: 'var(--gray-50)'}}>
            <div className="t-small" style={{fontWeight: 700, marginBottom: 4}}>Mejora de modelo desactivada en V0</div>
            <p className="t-caption" style={{margin: 0}}>
              Tus conversaciones se usan solo para mostrar la app y generar respuestas cuando lo pides. La anonimización técnica del servidor está siempre activa.
            </p>
          </div>
          <div className="col gap-2">
            <button className="btn btn--secondary btn--md" disabled={Boolean(privacyLoading)} onClick={downloadPrivacyExport}>
              {privacyButtonContent('export', 'Descargar mis datos JSON', 'Preparando...')}
            </button>
            <button className="btn btn--secondary btn--md" disabled={Boolean(privacyLoading)} onClick={disconnectWhatsApp}>
              {privacyButtonContent('disconnect', 'Desconectar mi WhatsApp', 'Desconectando...')}
            </button>
            <button className="btn btn--secondary btn--md" disabled={Boolean(privacyLoading)} onClick={deletePrivacyHistory}>
              {privacyButtonContent('history', 'Borrar todo mi historial', 'Borrando...')}
            </button>
            <button className="btn btn--secondary btn--md" disabled={Boolean(privacyLoading)} onClick={requestAccountDelete} style={{color: 'var(--danger)', borderColor: 'var(--danger)'}}>
              {privacyButtonContent('delete-account', 'Eliminar cuenta', 'Solicitando...')}
            </button>
          </div>
          <p className="t-caption" style={{margin: '12px 0 0', color: 'var(--text-secondary)'}}>
            La eliminación de cuenta queda programada para darte margen de cancelar si fue un error.
          </p>
        </div>
      </BottomSheet>

      <FullModal open={Boolean(privacyConfirm)} onClose={() => !privacyLoading && setPrivacyConfirm(null)}>
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '20px 22px'}}>
          <div className="row" style={{justifyContent: 'flex-end'}}>
            <IconButton onClick={() => !privacyLoading && setPrivacyConfirm(null)} label="Cerrar"><Icons.Close size={20} /></IconButton>
          </div>
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', gap: 10}}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              margin: '0 auto 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: privacyConfirm?.danger ? 'var(--danger-soft)' : 'var(--accent-soft)',
              color: privacyConfirm?.danger ? 'var(--danger)' : 'var(--accent)',
            }}>
              <Icons.Lock size={26} />
            </div>
            <h1 className="t-h2" style={{margin: 0}}>{privacyConfirm?.title || 'Confirmar acción'}</h1>
            <p style={{margin: '0 auto 24px', color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.5, maxWidth: 320}}>
              {privacyConfirm?.body || 'Esta acción requiere confirmación.'}
            </p>
            <div className="col gap-2" style={{width: '100%', maxWidth: 320, margin: '0 auto'}}>
              <button
                className="btn btn--primary btn--full"
                disabled={Boolean(privacyLoading)}
                onClick={() => privacyConfirm && runPrivacyAction(privacyConfirm)}
                style={privacyConfirm?.danger ? {background: 'var(--danger)', borderColor: 'var(--danger)'} : undefined}
              >
                {privacyLoading === privacyConfirm?.id
                  ? <><Spinner size={14} /> {privacyConfirm?.loadingLabel || 'Procesando...'}</>
                  : (privacyConfirm?.confirmLabel || 'Sí, continuar')}
              </button>
              <button className="btn btn--text" disabled={Boolean(privacyLoading)} onClick={() => setPrivacyConfirm(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </FullModal>

      <BottomSheet open={sheet === 'notifications'} onClose={() => setSheet(null)} height="82%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '8px 18px 18px', gap: 10}}>
          <span className="t-h3">Notificaciones</span>
          <p className="t-caption" style={{margin: 0, color: 'var(--text-secondary)'}}>
            Permiso del sistema: {notificationPermission || 'default'}
          </p>
          <div className="pwa-limit-note">
            {isNativeApp
              ? 'En Android WaFli usa Firebase Cloud Messaging para avisarte aunque la app esté en segundo plano.'
              : 'En iPhone las notificaciones web requieren iOS 16.4 o superior y que WaFli esté añadida a pantalla de inicio.'}
          </div>
          {notificationPermission !== 'granted' ? (
            <button className="btn btn--secondary btn--md" onClick={onRequestNotificationPrompt}>Activar permisos</button>
          ) : null}
          {[
            ['global', 'Permitir notificaciones'],
            ['newMessage', 'Avisar cuando llega un mensaje nuevo'],
            ['stalled', 'Avisar de conversaciones encalladas'],
            ['quota', 'Avisos de cuota'],
            ['product', 'Novedades del producto'],
          ].map(([key, label]) => (
            <div key={key} className="row" style={{justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px'}}>
              <span className="t-small">{label}</span>
              <button className={'btn btn--sm ' + (notifications[key] ? 'btn--primary' : 'btn--secondary')} onClick={() => setNotification(key)}>
                {notifications[key] ? 'ON' : 'OFF'}
              </button>
            </div>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'appearance'} onClose={() => setSheet(null)} height="58%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '8px 18px 18px'}}>
          <span className="t-h3" style={{marginBottom: 10}}>Apariencia</span>
          <p className="t-caption" style={{margin: '0 0 12px'}}>Elige cómo se ve WaFli en este dispositivo.</p>
          <div className="theme-segment" style={{marginTop: 0, marginBottom: 12}}>
            {[
              ['system', 'Sistema'],
              ['light', 'Claro'],
              ['dark', 'Oscuro'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={'theme-segment__button ' + (theme === value ? 'theme-segment__button--active' : '')}
                onClick={() => onThemeChange && onThemeChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="card" style={{padding: 12, background: 'var(--gray-50)'}}>
            <div className="t-small" style={{fontWeight: 700, marginBottom: 4}}>
              {theme === 'dark' ? 'Modo oscuro activo' : theme === 'light' ? 'Modo claro activo' : 'Modo del sistema activo'}
            </div>
            <p className="t-caption" style={{margin: 0}}>
              Esta preferencia se guarda en este dispositivo y se aplica antes de cargar la app para evitar parpadeos.
            </p>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'support'} onClose={() => setSheet(null)} height="58%">
        <div style={{padding: '8px 18px 18px', display: 'flex', flexDirection: 'column', gap: 12}}>
          <span className="t-h3" style={{marginBottom: 2}}>Soporte</span>
          <p className="t-caption" style={{margin: '0 0 6px', color: 'var(--text-secondary)', textWrap: 'pretty'}}>
            Si necesitas ayuda, escríbenos con el correo de tu cuenta, dispositivo, sistema operativo y una descripción breve del problema.
          </p>
          <div className="card" style={{padding: 12}}>
            <div className="t-small" style={{fontWeight: 800, marginBottom: 6}}>Contacto</div>
            <div className="t-caption" style={{marginBottom: 12, color: 'var(--text-secondary)'}}>{SUPPORT_EMAIL}</div>
            <button className="btn btn--secondary btn--md" onClick={openSupport}>Enviar correo a soporte</button>
          </div>
        </div>
      </BottomSheet>      <BottomSheet open={sheet === 'terms'} onClose={() => setSheet(null)} height="76%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '8px 18px 18px', gap: 8}}>
          <span className="t-h3">Términos legales</span>
          <button className="btn btn--secondary btn--md" style={{textAlign: 'left'}} onClick={() => { setSheet(null); setLegalDoc('terms'); }}>Términos y Condiciones</button>
          <button className="btn btn--secondary btn--md" style={{textAlign: 'left'}} onClick={() => { setSheet(null); setLegalDoc('privacy'); }}>Política de Privacidad</button>
          <button className="btn btn--secondary btn--md" style={{textAlign: 'left'}} onClick={() => { setSheet(null); setLegalDoc('cookies'); }}>Política de Cookies</button>
        </div>
      </BottomSheet>
      {legalDoc && LEGAL_DOCUMENTS[legalDoc] ? (
        <LegalFullscreen
          title={LEGAL_DOCUMENTS[legalDoc].title}
          body={[
            LEGAL_DOCUMENTS[legalDoc].intro,
            ...LEGAL_DOCUMENTS[legalDoc].sections.map(([heading, text]) => `${heading}\n${text}`),
          ]}
          onClose={() => setLegalDoc(null)}
        />
      ) : null}

      <BottomSheet open={sheet === 'logout'} onClose={() => setSheet(null)} height="42%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '8px 18px 18px'}}>
          <span className="t-h3" style={{marginBottom: 6}}>Cerrar sesión</span>
          <p className="t-small" style={{margin: '0 0 14px', color: 'var(--text-secondary)'}}>¿Seguro que quieres cerrar sesión en este dispositivo?</p>
          <div className="col gap-2" style={{marginTop: 'auto'}}>
            <button className="btn btn--primary btn--md" onClick={async () => { await WaFliAPI?.auth?.logout?.().catch(() => {}); setSheet(null); onNavigate('landing'); }}>Sí, cerrar sesión</button>
            <button className="btn btn--secondary btn--md" onClick={() => setSheet(null)}>Cancelar</button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}

function androidBillingBlocked() {
  const caps = WaFliAPI?.billing?.capabilities?.();
  return Boolean(caps?.nativePurchases?.nativePurchasePlatform && !caps?.nativePurchases?.nativePurchasesConfigured && !caps?.externalCheckoutAllowed);
}

function nativeBillingStoreCopy() {
  const caps = WaFliAPI?.billing?.capabilities?.();
  const platform = caps?.nativePurchases?.platform;
  if (platform === 'ios') return { platformName: 'iOS', storeName: 'App Store' };
  if (platform === 'android') return { platformName: 'Android', storeName: 'Google Play Billing' };
  return { platformName: 'esta app', storeName: 'la tienda nativa' };
}

function AndroidBillingNotice() {
  if (!androidBillingBlocked()) return null;
  const { platformName, storeName } = nativeBillingStoreCopy();
  return (
    <div className="card" style={{padding: 12, marginBottom: 12, borderColor: 'rgba(14, 165, 143, 0.18)', background: 'var(--accent-soft)'}}>
      <div className="t-small" style={{fontWeight: 800, color: 'var(--accent)', marginBottom: 4}}>Compras nativas</div>
      <div className="t-caption" style={{color: 'var(--text-secondary)'}}>
        Las compras dentro de {platformName} se gestionan con {storeName}. Esta versión no abre pagos externos.
      </div>
    </div>
  );
}

function PlanSelectorSheet({ onChoose }) {
  const blocked = androidBillingBlocked();
  const { storeName } = nativeBillingStoreCopy();
  const plans = [
    { id: 'free', name: 'Gratis', price: '€0', quota: '5 generaciones IA/día', features: ['Plan básico incluido', 'Sugerir y reescribir', 'Vuelve a Gratis cancelando Plus/Pro desde la tienda'] },
    { id: 'plus', name: 'Plus', price: '€4.99/mes', quota: '150 generaciones IA/mes', features: ['Más generaciones mensuales', 'Sugerir, reescribir y reactivar'] },
    { id: 'pro', name: 'Pro', price: '€9.99/mes', quota: '500 generaciones IA/mes', features: ['Mayor cupo mensual', 'Pensado para uso intensivo', 'Packs extra compatibles'] },
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '8px 18px 18px'}}>
      <span className="t-h3" style={{marginBottom: 10}}>Ver planes</span>
      <span className="t-caption" style={{color: 'var(--text-secondary)', marginBottom: 12}}>Planes mensuales y gestión desde la tienda correspondiente.</span>
      <AndroidBillingNotice />
      <div className="col gap-2 billing-plan-list">
        {plans.map((p) => (
          <div key={p.id} className="card" style={{padding: 12}}>
            <div className="row" style={{justifyContent: 'space-between', alignItems: 'baseline'}}>
              <span style={{fontSize: 16, fontWeight: 700}}>{p.name}</span>
              <span className="t-mono" style={{fontWeight: 700}}>{p.price}</span>
            </div>
            <div className="t-caption" style={{margin: '4px 0 8px'}}>{p.quota}</div>
            {p.features.map((f, i) => <div key={i} className="t-small">- {f}</div>)}
            {p.id === 'free' ? (
              <button className="btn btn--secondary btn--md" style={{width: '100%', marginTop: 10}} onClick={async () => {
                try {
                  const result = WaFliAPI?.billing?.manageSubscription
                    ? await WaFliAPI.billing.manageSubscription()
                    : WaFliAPI?.billing?.customerPortal
                      ? await WaFliAPI.billing.customerPortal()
                      : null;
                  const url = result?.url || result?.managementUrl;
                  if (url) window.location.href = url;
                  else onChoose && onChoose('free');
                } catch (_) {
                  onChoose && onChoose('free');
                }
              }}>Gestionar / volver a Gratis</button>
            ) : (
              <button className={'btn btn--md ' + (p.current || blocked ? 'btn--secondary' : 'btn--primary')} style={{width: '100%', marginTop: 10}} onClick={() => !p.current && !blocked && onChoose && onChoose(p.id)} disabled={p.current || blocked}>
                {blocked ? `Disponible con ${storeName}` : `Elegir ${p.name}`}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PackSelectorSheet({ onBuy }) {
  const blocked = androidBillingBlocked();
  const { storeName } = nativeBillingStoreCopy();
  const packs = [
    { id: '50', qty: 50, price: 2.99 },
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '8px 18px 18px'}}>
      <span className="t-h3" style={{marginBottom: 10}}>Comprar packs</span>
      <AndroidBillingNotice />
      <div className="col gap-2 billing-pack-list">
        {packs.map((p) => (
          <div key={p.id} className="card" style={{padding: 12}}>
            <div className="row" style={{justifyContent: 'space-between'}}>
              <span style={{fontSize: 15, fontWeight: 600}}>{p.qty} mensajes IA</span>
              <span className="t-mono" style={{fontWeight: 700}}>€{p.price.toFixed(2)}</span>
            </div>
            <div className="t-caption" style={{marginTop: 4}}>No caducan nunca.</div>
            <button className={'btn btn--md ' + (blocked ? 'btn--secondary' : 'btn--primary')} style={{width: '100%', marginTop: 10}} disabled={blocked} onClick={() => !blocked && onBuy && onBuy(p.qty)}>
              {blocked ? `Disponible con ${storeName}` : 'Comprar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsageHistorySheet() {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!WaFliAPI?.billing?.usage || !WaFliAPI?.client?.isAuthenticated?.()) {
        setLoading(false);
        return;
      }
      try {
        const result = await WaFliAPI.billing.usage();
        const recent = (result.usage?.recent || []).map((row) => ({
          day: row.created_at ? new Date(row.created_at).toLocaleDateString('es-ES') : '',
          time: row.created_at ? new Date(row.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '',
          ...formatUsageRow(row),
        }));
        if (alive) setRows(recent);
      } catch (apiError) {
        if (alive) setError(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No hemos podido cargar el historial.');
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, []);
  return (
    <div style={{display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '8px 18px 18px'}}>
      <span className="t-h3" style={{marginBottom: 4}}>Historial de uso</span>
      <p className="t-caption" style={{margin: '0 0 12px', color: 'var(--text-secondary)'}}>Cada fila indica qué acción de IA consumió cuota y en qué chat ocurrió.</p>
      <div className="card usage-history-list" style={{padding: 0}}>
        {loading ? (
          <div style={{padding: '12px'}}><span className="t-small">Cargando historial...</span></div>
        ) : error ? (
          <div style={{padding: '12px'}}><span className="t-small" style={{color: 'var(--danger)'}}>{error}</span></div>
        ) : rows.length ? rows.map((r, i) => (
          <div key={i} style={{display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none'}}>
            <span className="t-caption" style={{width: 58, color: 'var(--text-tertiary)'}}>{r.time}<br />{r.day}</span>
            <span style={{flex: 1, minWidth: 0}}>
              <span className="t-small" style={{display: 'block', fontWeight: 700}}>{r.detail}</span>
              <span className="t-caption" style={{display: 'block', color: 'var(--text-secondary)', marginTop: 2}}>{r.reason}</span>
            </span>
            <span className="t-caption" style={{color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap'}}>{r.statusLabel}</span>
          </div>
        )) : (
          <div style={{padding: '12px'}}><span className="t-small" style={{color: 'var(--text-secondary)'}}>Todavía no hay uso registrado.</span></div>
        )}
      </div>
    </div>
  );
}

function PaymentSuccessSheet({ onBack }) {
  return (
    <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '12px 18px 18px', justifyContent: 'center', alignItems: 'center', textAlign: 'center'}}>
      <div style={{width: 72, height: 72, borderRadius: 18, background: 'var(--success-soft)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12}}>
        <Icons.Check size={36} />
      </div>
      <h3 className="t-h3" style={{margin: '0 0 8px'}}>Pago confirmado</h3>
      <p className="t-small" style={{color: 'var(--text-secondary)', margin: '0 0 16px'}}>Tu cuota ya está actualizada.</p>
      <button className="btn btn--primary btn--full" onClick={onBack}>Volver a chats</button>
    </div>
  );
}

Object.assign(window, {
  LEGAL_DOCUMENTS, PublicLegalPage,
  LandingScreen, AuthScreen, LegalAcceptanceScreen, SpanishVariantScreen, ToneBaseScreen, ConnectScreen, ConnectedSuccessScreen, AddToHomeScreen, StaticInfoScreen, ChatsListScreen, ChatScreen,
  ToolsHomeScreen, ToolReplyScreen, ToolIcebreakersScreen, SavedLinesScreen,
  SuggestSheet, RewriteSheet, AnalysisSheet, OpenerSheet, PlanScreen, QuotaExhausted, SettingsScreen,
  PlanSelectorSheet, PackSelectorSheet, UsageHistorySheet, PaymentSuccessSheet,
  Spinner,
});
