// app.jsx Ã¢â‚¬â€ main WaFli app (navigation state machine + tweaks)

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentColor": "#5B5FE0",
  "density": "regular",
  "screen": "chats"
}/*EDITMODE-END*/;

const SCREEN_OPTIONS = [
  { id: 'landing', label: '01 Ã‚Â· Landing' },
  { id: 'auth', label: '02 Â· Registro / Login' },
  { id: 'legal', label: '03 Â· AceptaciÃ³n legal' },
  { id: 'spanish-variant', label: '04 Â· Variante de espaÃ±ol' },
  { id: 'tone-base', label: '05 Â· Tono base' },
  { id: 'connect', label: '06 Â· Conectar WhatsApp' },
  { id: 'connected', label: '07 Â· Conectado' },
  { id: 'install', label: '08 Â· Add to Home Screen' },
  { id: 'chats', label: '03 Ã‚Â· Lista de chats' },
  { id: 'chats-empty', label: '03b Ã‚Â· Lista vacÃƒÂ­a' },
  { id: 'chat', label: '04 Ã‚Â· ConversaciÃƒÂ³n' },
  { id: 'suggest', label: '05 Ã‚Â· Sugerir respuesta' },
  { id: 'opener', label: '06 Ã‚Â· Apertura nueva' },
  { id: 'plan', label: '07 Ã‚Â· Plan' },
  { id: 'quota', label: '08 Ã‚Â· Cuota agotada' },
  { id: 'settings', label: '09 Ã‚Â· Ajustes' },
];

const ACCENT_OPTIONS = [
  { name: 'Indigo', val: '#5B5FE0' },
  { name: 'Salvia', val: '#6FAA8C' },
  { name: 'ElÃƒÂ©ctrico', val: '#3D5AFE' },
  { name: 'CarbÃƒÂ³n', val: '#3A3A42' },
];

function applyAccent(hex) {
  // derive softer/600 versións
  const root = document.documentElement;
  root.style.setProperty('--accent', hex);
  // Generate a soft + softer + 600 by mixing with white/black
  const mix = (h, p, withColor) => {
    const c1 = parseInt(h.slice(1, 3), 16), c2 = parseInt(h.slice(3, 5), 16), c3 = parseInt(h.slice(5, 7), 16);
    const w = parseInt(withColor.slice(1, 3), 16), w2 = parseInt(withColor.slice(3, 5), 16), w3 = parseInt(withColor.slice(5, 7), 16);
    const r = Math.round(c1 * (1 - p) + w * p), g = Math.round(c2 * (1 - p) + w2 * p), b = Math.round(c3 * (1 - p) + w3 * p);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  };
  root.style.setProperty('--accent-soft', mix(hex, 0.82, '#FFFFFF'));
  root.style.setProperty('--accent-softer', mix(hex, 0.92, '#FFFFFF'));
  root.style.setProperty('--accent-600', mix(hex, 0.12, '#000000'));
  root.style.setProperty('--accent-700', mix(hex, 0.25, '#000000'));
}

function WaFliApp({ initialScreen = 'chats', tweakHook }) {
  // Multi-tab navigation: track current tab + screen + active chat
  const [screen, setScreen] = React.useState(initialScreen);
  const [activeChat, setActiveChat] = React.useState('lucia');
  const [sheet, setSheet] = React.useState(null); // 'suggest' | 'opener' | 'rewrite' | 'analysis' | null
  const [modal, setModal] = React.useState(null); // 'quota' | null
  const [billingSheet, setBillingSheet] = React.useState(null); // plans | packs | history | success
  const [toast, setToast] = React.useState(null);
  const [analysisMessage, setAnalysisMessage] = React.useState('');
  const [composerSeed, setComposerSeed] = React.useState('');
  const [returnScreen, setReturnScreen] = React.useState('landing');
  const [notificationPermission, setNotificationPermission] = React.useState(
    (typeof Notification !== 'undefined' && Notification.permission) ? Notification.permission : 'default'
  );
  const [notificationPrefs, setNotificationPrefs] = React.useState({
    global: false,
    newMessage: true,
    stalled: true,
    quota: true,
    product: false,
  });
  const [showNotifPrePrompt, setShowNotifPrePrompt] = React.useState(false);
  const [notifReminderAt, setNotifReminderAt] = React.useState(null);
  const [systemState, setSystemState] = React.useState({
    whatsappInterrupted: false,
    whatsappPausedModal: false,
    offline: false,
    maintenance: false,
    maintenanceReason: 'Mejora de infraestructura',
    maintenanceUntil: Date.now() + (45 * 60 * 1000),
    systemError: null,
  });

  React.useEffect(() => { setScreen(initialScreen); }, [initialScreen]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };
  const retrySystemError = () => {
    setSystemState((s) => ({ ...s, systemError: null }));
    showToast('Reintentando…');
  };

  // Navigation helpers
  const goTo = (s) => { setScreen(s); setSheet(null); setModal(null); setBillingSheet(null); };
  const navigate = (tab) => goTo(tab);
  const openChat = (id) => { setActiveChat(id); goTo('chat'); };
  const reconnectWhatsApp = () => {
    setSystemState((s) => ({ ...s, whatsappInterrupted: false }));
    goTo('connect');
  };
  const askNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      showToast('Tu navegador no soporta notificaciones.');
      return false;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        showToast('Notificaciones activadas');
        // Placeholder de registro backend de suscripción SW.
        if (navigator.serviceWorker?.ready) navigator.serviceWorker.ready.then(() => {});
        return true;
      }
      if (perm === 'denied') {
        showToast('Notificaciones bloqueadas. Puedes activarlas luego en Ajustes.');
      }
      return false;
    } catch (e) {
      showToast('No se pudo activar notificaciones. Reintenta.');
      return false;
    }
  };
  const openNotificationPrePrompt = () => {
    if (notificationPermission === 'granted') return;
    setShowNotifPrePrompt(true);
  };
  const onToggleNotification = (key) => {
    if (key === 'global') {
      const turningOn = !notificationPrefs.global;
      if (turningOn && notificationPermission !== 'granted') {
        openNotificationPrePrompt();
        return;
      }
    }
    setNotificationPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  React.useEffect(() => {
    const handler = (event) => {
      const data = event?.data || {};
      if (data?.type !== 'notification-click') return;
      if (data.notificationType === 'new_message' || data.notificationType === 'stalled') {
        openChat(data.chatId || 'lucia');
      } else if (data.notificationType === 'quota_low' || data.notificationType === 'quota_exhausted') {
        goTo('plan');
      }
    };
    navigator.serviceWorker?.addEventListener?.('message', handler);
    return () => navigator.serviceWorker?.removeEventListener?.('message', handler);
  }, []);

  // For Tweaks-controlled screen jumping
  React.useEffect(() => {
    if (!tweakHook) return;
    const target = tweakHook.screen;
    if (target === 'chats-empty') { goTo('chats'); return; }
    if (target === 'suggest') { setActiveChat('lucia'); setScreen('chat'); setSheet('suggest'); setModal(null); return; }
    if (target === 'opener') { setActiveChat('martina-new'); setScreen('chat-empty'); setSheet('opener'); setModal(null); return; }
    if (target === 'quota') { setScreen('chats'); setSheet(null); setModal('quota'); return; }
    if (target === 'chat') { setActiveChat('lucia'); setScreen('chat'); setSheet(null); setModal(null); return; }
    setScreen(target); setSheet(null); setModal(null);
  }, [tweakHook && tweakHook.screen]);

  let body;
  if (screen === 'landing') {
    body = <LandingScreen onStart={() => goTo('auth')} onLogin={() => goTo('auth')} />;
  } else if (screen === 'auth') {
    body = <AuthScreen onBack={() => goTo('landing')} onMagicLink={({ firstTime }) => goTo(firstTime ? 'legal' : 'chats')} onGoogleContinue={({ firstTime }) => goTo(firstTime ? 'legal' : 'chats')} onShowToast={showToast} />;
  } else if (screen === 'legal') {
    body = <LegalAcceptanceScreen onBack={() => goTo('auth')} onContinue={() => goTo('spanish-variant')} />;
  } else if (screen === 'spanish-variant') {
    body = <SpanishVariantScreen onBack={() => goTo('legal')} onContinue={() => goTo('tone-base')} />;
  } else if (screen === 'tone-base') {
    body = <ToneBaseScreen onBack={() => goTo('spanish-variant')} onContinue={() => goTo('connect')} />;
  } else if (screen === 'connect') {
    body = <ConnectScreen onBack={() => goTo('tone-base')} onConnected={() => { showToast('WhatsApp vinculado âœ“'); goTo('connected'); }} />;
  } else if (screen === 'connected') {
    body = <ConnectedSuccessScreen onContinue={() => goTo('chats')} onInstall={() => goTo('install')} />;
  } else if (screen === 'install') {
    body = <AddToHomeScreen onBack={() => goTo('connected')} onDone={() => { openNotificationPrePrompt(); goTo('chats'); }} onLater={() => goTo('chats')} />;
  } else if (screen === 'chats') {
    body = <ChatsListScreen
      empty={initialScreen === 'chats-empty' || tweakHook?.screen === 'chats-empty'}
      onOpenChat={openChat}
      onOpenQuota={() => goTo('plan')}
      onNavigate={navigate}
      whatsappInterrupted={systemState.whatsappInterrupted}
      offline={systemState.offline}
      onReconnectWhatsApp={reconnectWhatsApp}
    />;
  } else if (screen === 'chat') {
    body = <ChatScreen matchId={activeChat} onBack={() => goTo('chats')} onSuggest={() => setSheet('suggest')} onOpener={() => setSheet('opener')} onRewrite={() => { setComposerSeed('¿Te apetece que lo hablemos mejor en persona?'); setSheet('rewrite'); }} onAnalyze={() => { setAnalysisMessage((MATCHES.find(m => m.id === activeChat)?.messages || []).slice(-1)[0]?.text || ''); setSheet('analysis'); }} offline={systemState.offline} />;
  } else if (screen === 'chat-empty') {
    body = <ChatScreen matchId="martina-new" onBack={() => goTo('chats')} onSuggest={() => setSheet('suggest')} onOpener={() => setSheet('opener')} onRewrite={() => { setComposerSeed(''); setSheet('rewrite'); }} onAnalyze={() => { setAnalysisMessage(''); setSheet('analysis'); }} offline={systemState.offline} />;
  } else if (screen === 'plan') {
    body = <PlanScreen
      onNavigate={navigate}
      onOpenPlans={() => setBillingSheet('plans')}
      onOpenPacks={() => setBillingSheet('packs')}
      onOpenHistory={() => setBillingSheet('history')}
    />;
  } else if (screen === 'settings') {
    body = <SettingsScreen onNavigate={navigate} notificationPermission={notificationPermission} notificationPrefs={notificationPrefs} onToggleNotification={onToggleNotification} onRequestNotificationPrompt={openNotificationPrePrompt} />;
  } else {
    // Safety fallback: if an unknown screen id is loaded from persisted tweaks/state,
    // render landing instead of leaving a blank preview.
    body = <LandingScreen onStart={() => goTo('auth')} onLogin={() => goTo('auth')} />;
  }

  // Density adjustment
  const densityScale = tweakHook?.density === 'compact' ? 0.92 : tweakHook?.density === 'comfy' ? 1.06 : 1;

  return (
    <div className="phone__content" style={{fontSize: `${15 * densityScale}px`}}>
      {body}

      <BottomSheet open={sheet === 'suggest'} onClose={() => setSheet(null)} height="78%">
        <SuggestSheet onClose={() => setSheet(null)} onSent={() => { setSheet(null); showToast('Mensaje enviado Ã¢Å“â€œ'); }} />
      </BottomSheet>

      <BottomSheet open={sheet === 'opener'} onClose={() => setSheet(null)} height="88%">
        <OpenerSheet matchName={MATCHES.find(m => m.id === activeChat)?.name || 'LucÃƒÂ­a'} onClose={() => setSheet(null)} onUse={() => { setSheet(null); showToast('Apertura insertada en el composer'); }} />
      </BottomSheet>
      <BottomSheet open={sheet === 'rewrite'} onClose={() => setSheet(null)} height="82%">
        <RewriteSheet sourceText={composerSeed} onUse={() => { setSheet(null); showToast('Texto reescrito cargado en composer'); }} />
      </BottomSheet>
      <BottomSheet open={sheet === 'analysis'} onClose={() => setSheet(null)} height="78%">
        <AnalysisSheet message={analysisMessage} onSuggest={() => setSheet('suggest')} />
      </BottomSheet>
      <BottomSheet open={billingSheet === 'plans'} onClose={() => setBillingSheet(null)} height="84%">
        <PlanSelectorSheet onChoose={() => { setBillingSheet('success'); showToast('Redirigiendo a checkout de Stripe…'); }} />
      </BottomSheet>
      <BottomSheet open={billingSheet === 'packs'} onClose={() => setBillingSheet(null)} height="74%">
        <PackSelectorSheet onBuy={() => { setBillingSheet('success'); showToast('Redirigiendo a checkout de Stripe…'); }} />
      </BottomSheet>
      <BottomSheet open={billingSheet === 'history'} onClose={() => setBillingSheet(null)} height="90%">
        <UsageHistorySheet />
      </BottomSheet>
      <BottomSheet open={billingSheet === 'success'} onClose={() => setBillingSheet(null)} height="56%">
        <PaymentSuccessSheet onBack={() => goTo('chats')} />
      </BottomSheet>
      <FullModal open={modal === 'quota'} onClose={() => setModal(null)}>
        <QuotaExhausted
          onClose={() => setModal(null)}
          onOpenPlans={() => { setModal(null); setBillingSheet('plans'); }}
          onOpenPacks={() => { setModal(null); setBillingSheet('packs'); }}
        />
      </FullModal>
      <BottomSheet open={showNotifPrePrompt} onClose={() => setShowNotifPrePrompt(false)} height="52%">
        <div style={{padding: '12px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10}}>
          <span className="t-h3">¿Te avisamos de nuevos mensajes?</span>
          <div className="card" style={{padding: 12}}>
            <div className="t-small">• Cuando un match te escriba</div>
            <div className="t-small">• Cuando una conversación se enfríe</div>
            <div className="t-small">• Avisos de cuota</div>
          </div>
          <button className="btn btn--primary btn--full" onClick={async () => {
            setShowNotifPrePrompt(false);
            const granted = await askNotificationPermission();
            if (granted) setNotificationPrefs((p) => ({ ...p, global: true }));
          }}>Sí, activar</button>
          <button className="btn btn--text" style={{height: 40}} onClick={() => {
            setShowNotifPrePrompt(false);
            const next = Date.now() + (7 * 24 * 60 * 60 * 1000);
            setNotifReminderAt(next);
            showToast('Te lo recordaremos en 7 días.');
          }}>Más tarde</button>
        </div>
      </BottomSheet>
      {systemState.systemError ? (
        <div style={{
          position: 'fixed', left: 12, right: 12, bottom: 18, zIndex: 150,
          borderRadius: 12, border: '1px solid rgba(180,30,30,0.35)',
          background: 'var(--danger-soft)', padding: 10, display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span className="t-small" style={{color: 'var(--danger)'}}>{systemState.systemError}</span>
          <button className="btn btn--text" style={{height: 28, color: 'var(--danger)', fontWeight: 600}} onClick={retrySystemError}>Reintentar</button>
        </div>
      ) : null}
      <FullModal open={systemState.whatsappPausedModal} onClose={() => setSystemState((s) => ({ ...s, whatsappPausedModal: false }))}>
        <div style={{padding: '28px 22px'}}>
          <h2 className="t-h2" style={{marginTop: 0}}>WhatsApp ha pausado tu conexión un rato</h2>
          <p className="t-body" style={{color: 'var(--text-secondary)', textWrap: 'pretty'}}>
            Es algo puntual, suele restablecerse solo en unas horas. Te avisamos cuando vuelva.
            Mientras tanto puedes seguir leyendo tus chats.
          </p>
          <button className="btn btn--primary btn--full" onClick={() => setSystemState((s) => ({ ...s, whatsappPausedModal: false }))}>Entendido</button>
        </div>
      </FullModal>
      <FullModal open={systemState.maintenance} onClose={() => {}}>
        <div style={{padding: '28px 22px'}}>
          <h2 className="t-h2" style={{marginTop: 0}}>Mantenimiento programado</h2>
          <p className="t-body" style={{color: 'var(--text-secondary)', marginBottom: 12}}>{systemState.maintenanceReason}</p>
          <p className="t-small" style={{marginTop: 0}}>Tiempo estimado restante: {Math.max(0, Math.round((systemState.maintenanceUntil - Date.now()) / 60000))} min</p>
        </div>
      </FullModal>

      <Toast msg={toast} visible={!!toast} />
    </div>
  );
}

function PlanSelectorSheet({ onChoose }) {
  const [period, setPeriod] = React.useState('monthly');
  const plans = [
    { id: 'free', name: 'Gratis', monthly: '€0', yearly: '€0', quota: '30/día', features: ['Sugerir', 'Reescribir básica'] },
    { id: 'plus', name: 'Plus', monthly: '€8.99', yearly: '€89.99', quota: '300/día', features: ['Sugerir + Reescribir', 'Análisis completo'] },
    { id: 'pro', name: 'Pro', monthly: '€17.99', yearly: '€179.99', quota: '1200/día', features: ['Todo Plus', 'Prioridad y velocidad'] },
  ];
  return (
    <div style={{padding: '8px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10}}>
      <span className="t-h3">Selector de plan</span>
      <div className="row gap-2">
        <button className={'btn btn--sm ' + (period === 'monthly' ? 'btn--primary' : 'btn--secondary')} onClick={() => setPeriod('monthly')}>Mensual</button>
        <button className={'btn btn--sm ' + (period === 'yearly' ? 'btn--primary' : 'btn--secondary')} onClick={() => setPeriod('yearly')}>Anual (-15%)</button>
      </div>
      {plans.map((p) => (
        <div key={p.id} className="card" style={{padding: 12}}>
          <div className="row" style={{justifyContent: 'space-between', alignItems: 'center'}}>
            <span style={{fontWeight: 700}}>{p.name}</span>
            <span className="t-small" style={{fontWeight: 700}}>{period === 'monthly' ? p.monthly : p.yearly}</span>
          </div>
          <p className="t-caption" style={{margin: '4px 0 8px'}}>{p.quota}</p>
          {p.features.map((f, i) => <div key={i} className="t-small">• {f}</div>)}
          {p.id === 'free' ? (
            <span className="t-caption" style={{display: 'inline-block', marginTop: 8}}>Plan actual</span>
          ) : (
            <button className="btn btn--primary btn--md" style={{marginTop: 10}} onClick={onChoose}>Elegir</button>
          )}
        </div>
      ))}
    </div>
  );
}

function PackSelectorSheet({ onBuy }) {
  const packs = [
    { qty: 50, price: '€2.99' },
    { qty: 200, price: '€7.99' },
    { qty: 500, price: '€16.99' },
  ];
  return (
    <div style={{padding: '8px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10}}>
      <span className="t-h3">Comprar bolsa adicional</span>
      {packs.map((p, i) => (
        <div key={i} className="card" style={{padding: 12}}>
          <div className="row" style={{justifyContent: 'space-between', alignItems: 'center'}}>
            <span style={{fontWeight: 700}}>{p.qty} generaciones</span>
            <span className="t-small" style={{fontWeight: 700}}>{p.price}</span>
          </div>
          <p className="t-caption" style={{margin: '4px 0 10px'}}>Precio por generación destacado</p>
          <button className="btn btn--primary btn--md" onClick={onBuy}>Comprar</button>
        </div>
      ))}
    </div>
  );
}

function UsageHistorySheet() {
  const rows = [
    ['Hoy', '18:42', 'Sugerir'],
    ['Hoy', '18:39', 'Reescribir'],
    ['Hoy', '17:14', 'Analizar'],
    ['Ayer', '23:19', 'Sugerir'],
    ['Ayer', '20:04', 'Abrir'],
  ];
  return (
    <div style={{padding: '8px 18px 18px'}}>
      <span className="t-h3" style={{display: 'block', marginBottom: 10}}>Historial detallado</span>
      <div className="card" style={{padding: 0}}>
        {rows.map((r, i) => (
          <div key={i} style={{padding: '10px 12px', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 10}}>
            <span className="t-caption" style={{width: 36}}>{r[1]}</span>
            <span className="t-small" style={{flex: 1}}>{r[2]}</span>
            <span className="t-caption">{r[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentSuccessSheet({ onBack }) {
  return (
    <div style={{padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10}}>
      <div style={{width: 62, height: 62, borderRadius: 20, background: 'var(--success-soft)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <Icons.Check size={30} />
      </div>
      <h3 className="t-h3" style={{margin: 0}}>Pago confirmado</h3>
      <p className="t-small" style={{margin: 0, color: 'var(--text-secondary)'}}>Tu compra se aplicó y la cuota ya está actualizada.</p>
      <button className="btn btn--primary btn--full" style={{marginTop: 8}} onClick={onBack}>Volver a chats</button>
    </div>
  );
}

// Phone wrapper
function Phone({ initialScreen = 'chats', tweakHook }) {
  return (
    <div className="phone">
      <StatusBar />
      <WaFliApp initialScreen={initialScreen} tweakHook={tweakHook} />
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Top-level: prototype + design canvas + tweaks
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function PrototypeRoot() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => { applyAccent(t.accentColor); }, [t.accentColor]);

  return (
    <div style={{minHeight: '100vh', display: 'flex', flexDirection: 'column'}}>
      {/* Hero / brief banner */}
      <header style={{padding: '40px 32px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)'}}>
        <div style={{maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap'}}>
          <div>
            <div className="row gap-2" style={{marginBottom: 12}}>
              <Icons.Logo size={20} color="var(--accent)" />
              <span style={{fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--text-secondary)'}}>WaFli Ã‚Â· primer borrador visual</span>
            </div>
            <h1 style={{margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em'}}>Copiloto IA para WhatsApp</h1>
            <p style={{margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 15, maxWidth: 560, textWrap: 'pretty'}}>
              PWA mobile-first Ã‚Â· espaÃƒÂ±ol de EspaÃƒÂ±a Ã‚Â· 9 pantallas Ã‚Â· sistema base. Usa la columna de la izquierda como prototipo navegable; abajo, el canvas con todas las pantallas.
            </p>
          </div>
          <div className="row gap-2" style={{flexWrap: 'wrap'}}>
            <a href="#prototype" className="btn btn--secondary btn--sm">Prototipo</a>
            <a href="#system" className="btn btn--secondary btn--sm">Sistema</a>
            <a href="#canvas" className="btn btn--secondary btn--sm">9 pantallas</a>
          </div>
        </div>
      </header>

      {/* Prototype + brief */}
      <section id="prototype" style={{padding: '40px 32px', display: 'flex', justifyContent: 'center', background: 'var(--gray-100)'}}>
        <div style={{maxWidth: 1280, width: '100%', display: 'grid', gridTemplateColumns: '1fr 420px', gap: 48, alignItems: 'flex-start'}}>
          <div>
            <span className="t-caption" style={{textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, color: 'var(--text-tertiary)'}}>Prototipo navegable</span>
            <h2 style={{margin: '4px 0 16px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em'}}>PruÃƒÂ©balo aquÃƒÂ­ mismo</h2>
            <p style={{margin: '0 0 24px', color: 'var(--text-secondary)', fontSize: 15, textWrap: 'pretty'}}>
              Empieza en Chats. Pulsa cualquier conversaciÃƒÂ³n para entrar, abre la sugerencia con el botÃƒÂ³n violeta, prueba las pestaÃƒÂ±as Plan y Ajustes en la barra inferior. La pantalla "Apertura para X" se abre desde una conversaciÃƒÂ³n vacÃƒÂ­a. La cuota agotada y el cÃƒÂ³digo de vinculaciÃƒÂ³n los expongo en el canvas y vÃƒÂ­a Tweaks.
            </p>
            <div style={{display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 18, rowGap: 10, fontSize: 14}}>
              <span className="t-mono" style={{color: 'var(--text-tertiary)', fontSize: 13}}>Color</span>
              <span><b>Indigo {t.accentColor}</b> Ã¢â‚¬â€ sereno, tech, sin connotaciÃƒÂ³n romÃƒÂ¡ntica</span>
              <span className="t-mono" style={{color: 'var(--text-tertiary)', fontSize: 13}}>Tipo</span>
              <span>Geist (sans + mono) Ã‚Â· Linear-vibes</span>
              <span className="t-mono" style={{color: 'var(--text-tertiary)', fontSize: 13}}>Idioma</span>
              <span>es-ES Ã‚Â· castizo, tuteante, sin emojis decorativos en el chrome</span>
              <span className="t-mono" style={{color: 'var(--text-tertiary)', fontSize: 13}}>Densidad</span>
              <span>CÃƒÂ³moda por defecto (toggle en Tweaks)</span>
              <span className="t-mono" style={{color: 'var(--text-tertiary)', fontSize: 13}}>Avatares</span>
              <span>Iniciales en cÃƒÂ­rculo con color hash Ã¢â‚¬â€ anti-dating-app, sobrio</span>
            </div>

            <div style={{marginTop: 32, padding: 16, background: 'var(--accent-softer)', borderRadius: 12, borderLeft: '3px solid var(--accent)'}}>
              <span style={{fontSize: 12, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.04em', textTransform: 'uppercase'}}>Asunciones</span>
              <ul style={{margin: '8px 0 0', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-secondary)'}}>
                <li>Avatar = iniciales con color hash. WhatsApp real cargarÃƒÂ¡ la foto cuando la haya.</li>
                <li>"Plan Gratuito" muestra 30 generaciones/dÃƒÂ­a Ã¢â‚¬â€ placeholder hasta definir pricing.</li>
                <li>El gauge del Plan es semicircular grande; alternativa circular en prÃƒÂ³xima iteraciÃƒÂ³n si te encaja mejor.</li>
                <li>IconografÃƒÂ­a Lucide-style hecha a mano para no depender de CDN externo.</li>
                <li>Status bar de iOS mockeada (no es real).</li>
              </ul>
            </div>
          </div>

          <div>
            <Phone initialScreen={t.screen === 'chats-empty' ? 'chats-empty' : 'chats'} tweakHook={t} />
          </div>
        </div>
      </section>

      {/* Mini design system */}
      <section id="system" style={{padding: '56px 32px', background: 'var(--bg)', borderTop: '1px solid var(--border)'}}>
        <div style={{maxWidth: 1280, margin: '0 auto'}}>
          <span className="t-caption" style={{textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, color: 'var(--text-tertiary)'}}>Sistema de diseÃƒÂ±o</span>
          <h2 style={{margin: '4px 0 28px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em'}}>Tokens y componentes core</h2>
          <DesignSystem />
        </div>
      </section>

      {/* Canvas with all 9 screens */}
      <section id="canvas" style={{borderTop: '1px solid var(--border)', background: 'var(--gray-100)'}}>
        <div style={{padding: '40px 32px 16px', maxWidth: 1280, margin: '0 auto'}}>
          <span className="t-caption" style={{textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, color: 'var(--text-tertiary)'}}>Las 9 pantallas</span>
          <h2 style={{margin: '4px 0 8px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em'}}>Canvas comparativo</h2>
          <p className="t-small" style={{color: 'var(--text-secondary)', margin: '0 0 16px', maxWidth: 560}}>
            Arrastra/zoom el canvas. Renombra etiquetas in-line. Pulsa el icono de expandir (esquina superior derecha al pasar el ratÃƒÂ³n) para abrir cualquier pantalla a tamaÃƒÂ±o completo.
          </p>
        </div>
        <div style={{height: '900px'}}>
          <CanvasView />
        </div>
      </section>

      {/* Footer */}
      <footer style={{padding: '32px', textAlign: 'center', background: 'var(--bg)', borderTop: '1px solid var(--border)'}}>
        <span className="t-caption">WaFli Ã¢â‚¬â€ primer borrador Ã‚Â· base para iterar Ã‚Â· es-ES</span>
      </footer>

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Tema" />
        <div className="twk-row">
          <span className="twk-lbl"><span>Color de acento</span><span className="twk-val">{t.accentColor}</span></span>
          <div style={{display: 'flex', gap: 6, marginTop: 4}}>
            {ACCENT_OPTIONS.map(c => (
              <button key={c.val} onClick={() => setTweak('accentColor', c.val)}
                title={c.name}
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  border: t.accentColor === c.val ? '2px solid var(--gray-800)' : '1px solid rgba(0,0,0,0.12)',
                  background: c.val, cursor: 'pointer', padding: 0,
                }} />
            ))}
          </div>
        </div>
        <TweakRadio label="Densidad" value={t.density} options={['compact', 'regular', 'comfy']} onChange={v => setTweak('density', v)} />
        <TweakSection label="Pantalla" />
        <TweakSelect label="Ir a" value={t.screen} options={SCREEN_OPTIONS.map(s => s.id)} optionLabels={SCREEN_OPTIONS.map(s => s.label)} onChange={v => setTweak('screen', v)} />
      </TweaksPanel>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Mini design system display
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function DesignSystem() {
  return (
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20}}>
      {/* Color */}
      <div className="card" style={{padding: 20}}>
        <span className="t-small" style={{fontWeight: 600, marginBottom: 12, display: 'block'}}>Color</span>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 12}}>
          {['--accent','--accent-600','--accent-soft','--accent-softer','--bg'].map(v => (
            <div key={v} style={{aspectRatio: '1', borderRadius: 8, background: `var(${v})`, border: '1px solid var(--border)'}} />
          ))}
        </div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 12}}>
          {['--gray-100','--gray-200','--gray-400','--gray-600','--gray-900'].map(v => (
            <div key={v} style={{aspectRatio: '1', borderRadius: 8, background: `var(${v})`, border: '1px solid var(--border)'}} />
          ))}
        </div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6}}>
          {['--success','--warning','--danger'].map(v => (
            <div key={v} style={{height: 28, borderRadius: 8, background: `var(${v})`}} />
          ))}
        </div>
      </div>

      {/* Type */}
      <div className="card" style={{padding: 20}}>
        <span className="t-small" style={{fontWeight: 600, marginBottom: 12, display: 'block'}}>TipografÃƒÂ­a Ã‚Â· Geist</span>
        <div className="col gap-2">
          <div className="t-h1" style={{margin: 0}}>H1 Ã‚Â· 30/600</div>
          <div className="t-h2" style={{margin: 0}}>H2 Ã‚Â· 22/600</div>
          <div className="t-h3" style={{margin: 0}}>H3 Ã‚Â· 18/600</div>
          <div className="t-body">Body Ã‚Â· 15/400 Ã¢â‚¬â€ texto largo legible.</div>
          <div className="t-small" style={{color: 'var(--text-secondary)'}}>Small Ã‚Â· 13/400</div>
          <div className="t-mono" style={{fontSize: 13}}>Mono Ã‚Â· ABCD-EFGH 0123</div>
        </div>
      </div>

      {/* Buttons */}
      <div className="card" style={{padding: 20}}>
        <span className="t-small" style={{fontWeight: 600, marginBottom: 12, display: 'block'}}>Botones</span>
        <div className="col gap-2">
          <button className="btn btn--primary btn--full">Primario</button>
          <button className="btn btn--secondary btn--full">Secundario</button>
          <button className="btn btn--text">Texto enlace</button>
        </div>
      </div>

      {/* Chips + quota */}
      <div className="card" style={{padding: 20}}>
        <span className="t-small" style={{fontWeight: 600, marginBottom: 12, display: 'block'}}>Chips & cuota</span>
        <div style={{display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14}}>
          <span className="chip">Relajado</span>
          <span className="chip chip--active">Desenfadado</span>
          <span className="chip">Picante</span>
        </div>
        <div className="col gap-2">
          <QuotaPill count={22} total={30} />
          <QuotaPill count={5} total={30} />
          <QuotaPill count={1} total={30} />
        </div>
      </div>

      {/* Avatars */}
      <div className="card" style={{padding: 20}}>
        <span className="t-small" style={{fontWeight: 600, marginBottom: 12, display: 'block'}}>Avatares (color hash)</span>
        <div className="row gap-2" style={{flexWrap: 'wrap'}}>
          {['LucÃƒÂ­a','Martina','Noa','Paula','Irene CastaÃƒÂ±o','Clara','Andrea Ruiz','Sara M.'].map(n => (
            <Avatar key={n} name={n} size={44} />
          ))}
        </div>
      </div>

      {/* Bubbles */}
      <div className="card" style={{padding: 20, background: 'var(--gray-50)'}}>
        <span className="t-small" style={{fontWeight: 600, marginBottom: 12, display: 'block'}}>Bubbles</span>
        <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
          <div style={{alignSelf: 'flex-start', maxWidth: '78%', padding: '8px 12px', fontSize: 14.5, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px 16px 16px 4px'}}>Ese plan me convence</div>
          <div style={{alignSelf: 'flex-end', maxWidth: '78%', padding: '8px 12px', fontSize: 14.5, background: 'var(--accent-soft)', borderRadius: '16px 16px 4px 16px'}}>Pues quedamos el viernes</div>
        </div>
      </div>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Design canvas with all 9 screens
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function CanvasView() {
  // For canvas previews we want each screen rendered statically (no internal nav)
  const W = 390, H = 780;
  const wrap = (children) => (
    <div style={{width: W, height: H, background: 'var(--bg)', borderRadius: 28, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', position: 'relative'}}>
      <StatusBar />
      <div className="phone__content">{children}</div>
    </div>
  );

  // For sheet/modal screens we render the underlying chat + the sheet on top
  return (
    <DesignCanvas>
      <DCSection id="entry" title="Entrada" subtitle="Antes de loguearse">
        <DCArtboard id="landing" label="01 Ã‚Â· Landing pÃƒÂºblica" width={W + 2} height={H + 2}>
          {wrap(<LandingScreen onStart={() => {}} />)}
        </DCArtboard>
        <DCArtboard id="connect" label="02 Ã‚Â· Conectar WhatsApp" width={W + 2} height={H + 2}>
          {wrap(<ConnectScreen onBack={() => {}} onConnected={() => {}} />)}
        </DCArtboard>
      </DCSection>

      <DCSection id="chats" title="Chats" subtitle="Home + conversaciÃƒÂ³n">
        <DCArtboard id="list" label="03 Ã‚Â· Lista de chats" width={W + 2} height={H + 2}>
          {wrap(<ChatsListScreen onOpenChat={() => {}} onOpenQuota={() => {}} onNavigate={() => {}} />)}
        </DCArtboard>
        <DCArtboard id="empty" label="03b Ã‚Â· Estado vacÃƒÂ­o" width={W + 2} height={H + 2}>
          {wrap(<ChatsListScreen empty onOpenChat={() => {}} onOpenQuota={() => {}} onNavigate={() => {}} />)}
        </DCArtboard>
        <DCArtboard id="conv" label="04 Ã‚Â· ConversaciÃƒÂ³n" width={W + 2} height={H + 2}>
          {wrap(<ChatScreen matchId="lucia" onBack={() => {}} onSuggest={() => {}} onOpener={() => {}} />)}
        </DCArtboard>
      </DCSection>

      <DCSection id="ai" title="Acciones IA" subtitle="Pantallas nÃƒÂºcleo del producto">
        <DCArtboard id="suggest" label="05 Ã‚Â· Sugerir respuesta" width={W + 2} height={H + 2}>
          <div style={{width: W, height: H, background: 'var(--bg)', borderRadius: 28, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', position: 'relative'}}>
            <StatusBar />
            <div className="phone__content">
              <ChatScreen matchId="lucia" onBack={() => {}} onSuggest={() => {}} onOpener={() => {}} />
              <div style={{position: 'absolute', inset: 0, zIndex: 50}}>
                <div style={{position: 'absolute', inset: 0, background: 'rgba(20,20,30,0.32)'}} />
                <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: '78%', background: 'var(--bg)', borderRadius: '20px 20px 0 0', boxShadow: 'var(--sh-modal)', display: 'flex', flexDirection: 'column'}}>
                  <div style={{display: 'flex', justifyContent: 'center', padding: '8px 0 4px'}}>
                    <div style={{width: 36, height: 4, background: 'var(--gray-200)', borderRadius: 2}} />
                  </div>
                  <SuggestSheet onClose={() => {}} onSent={() => {}} />
                </div>
              </div>
            </div>
          </div>
        </DCArtboard>

        <DCArtboard id="opener" label="06 Ã‚Â· Necesito abrir" width={W + 2} height={H + 2}>
          <div style={{width: W, height: H, background: 'var(--bg)', borderRadius: 28, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', position: 'relative'}}>
            <StatusBar />
            <div className="phone__content">
              <ChatScreen matchId="martina-new" onBack={() => {}} onSuggest={() => {}} onOpener={() => {}} />
              <div style={{position: 'absolute', inset: 0, zIndex: 50}}>
                <div style={{position: 'absolute', inset: 0, background: 'rgba(20,20,30,0.32)'}} />
                <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: '88%', background: 'var(--bg)', borderRadius: '20px 20px 0 0', boxShadow: 'var(--sh-modal)', display: 'flex', flexDirection: 'column'}}>
                  <div style={{display: 'flex', justifyContent: 'center', padding: '8px 0 4px'}}>
                    <div style={{width: 36, height: 4, background: 'var(--gray-200)', borderRadius: 2}} />
                  </div>
                  <OpenerSheet matchName="Martina" onClose={() => {}} onUse={() => {}} />
                </div>
              </div>
            </div>
          </div>
        </DCArtboard>
      </DCSection>

      <DCSection id="meta" title="Plan, ajustes & estados" subtitle="PestaÃƒÂ±as secundarias y bloqueos">
        <DCArtboard id="plan" label="07 Ã‚Â· Plan" width={W + 2} height={H + 2}>
          {wrap(<PlanScreen onNavigate={() => {}} onUpgrade={() => {}} />)}
        </DCArtboard>
        <DCArtboard id="quota" label="08 Ã‚Â· Cuota agotada" width={W + 2} height={H + 2}>
          <div style={{width: W, height: H, background: 'var(--bg)', borderRadius: 28, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', position: 'relative'}}>
            <StatusBar />
            <div className="phone__content">
              <QuotaExhausted onClose={() => {}} onOpenPlans={() => {}} onOpenPacks={() => {}} />
            </div>
          </div>
        </DCArtboard>
        <DCArtboard id="settings" label="09 Ã‚Â· Ajustes" width={W + 2} height={H + 2}>
          {wrap(<SettingsScreen onNavigate={() => {}} />)}
        </DCArtboard>
      </DCSection>

      <DCSection id="desktop" title="AdaptaciÃƒÂ³n desktop" subtitle="Columna central de 480px sobre fondo neutro + sidebar replica">
        <DCArtboard id="desktop-chats" label="Desktop Ã‚Â· Chats (>1024px)" width={1100} height={780}>
          <DesktopShell active="chats">
            {wrap(<ChatsListScreen onOpenChat={() => {}} onOpenQuota={() => {}} onNavigate={() => {}} />)}
          </DesktopShell>
        </DCArtboard>
        <DCArtboard id="desktop-chat" label="Desktop Ã‚Â· ConversaciÃƒÂ³n" width={1100} height={780}>
          <DesktopShell active="chats">
            {wrap(<ChatScreen matchId="lucia" onBack={() => {}} onSuggest={() => {}} onOpener={() => {}} />)}
          </DesktopShell>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

// Desktop shell with sidebar nav
function DesktopShell({ active = 'chats', children }) {
  const items = [
    { id: 'chats', label: 'Chats', Icon: Icons.Chats },
    { id: 'plan', label: 'Plan', Icon: Icons.Plan },
    { id: 'settings', label: 'Ajustes', Icon: Icons.Settings },
  ];
  return (
    <div style={{width: 1100, height: 780, background: 'var(--gray-100)', borderRadius: 16, overflow: 'hidden', display: 'flex', border: '1px solid var(--border)'}}>
      {/* Sidebar */}
      <aside style={{width: 240, padding: '20px 16px', borderRight: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 6}}>
        <div className="row gap-2" style={{padding: '4px 8px 16px'}}>
          <Icons.Logo size={18} color="var(--accent)" />
          <span style={{fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em'}}>WaFli</span>
        </div>
        {items.map(it => {
          const isActive = active === it.id;
          return (
            <button key={it.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10,
              background: isActive ? 'var(--accent-softer)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text)',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              fontSize: 14, fontWeight: isActive ? 600 : 500,
            }}>
              <it.Icon size={18} sw={isActive ? 2 : 1.75} />
              {it.label}
            </button>
          );
        })}
        <div style={{flex: 1}} />
        <div style={{padding: '12px 8px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10}}>
          <Avatar name="Carlos M" size={32} />
          <div className="col" style={{flex: 1, minWidth: 0}}>
            <span style={{fontSize: 13, fontWeight: 500}}>Carlos</span>
            <span className="t-caption" style={{fontSize: 11}}>Plan Gratuito</span>
          </div>
        </div>
      </aside>
      {/* Center column */}
      <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0'}}>
        {children}
      </div>
    </div>
  );
}

class RuntimeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error('WaFli runtime error:', error);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding: 16, fontFamily: 'system-ui, sans-serif'}}>
          <h2 style={{margin: '0 0 8px'}}>Error en la vista previa</h2>
          <p style={{margin: '0 0 8px'}}>Se capturó un error de ejecución. Abre la consola para el detalle.</p>
          <pre style={{whiteSpace: 'pre-wrap', background: '#f7f7f9', border: '1px solid #ddd', padding: 10, borderRadius: 8}}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <RuntimeErrorBoundary>
    <PrototypeRoot />
  </RuntimeErrorBoundary>
);



