// screens.jsx â€” All 9 WaFli screens

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SCREEN 1 Â· Landing pÃºblica
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function LandingScreen({ onStart, onLogin, onOpenLegal }) {
  const [doc, setDoc] = React.useState(null);
  const openLegal = (type) => {
    if (onOpenLegal) onOpenLegal(type);
    else setDoc(type);
  };
  return (
    <div className="scroll-y" style={{background: 'var(--bg)'}}>
      <div style={{padding: '24px 22px 10px'}}>
        <div className="row" style={{justifyContent: 'space-between', alignItems: 'center'}}>
          <div className="row gap-2" style={{alignItems: 'center'}}>
            <Icons.Logo size={22} color="var(--accent)" />
            <span style={{fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em'}}>WaFli</span>
          </div>
          <button className="btn btn--text" style={{fontSize: 14}} onClick={onLogin}>Entrar</button>
        </div>
      </div>

      {/* Hero */}
      <div style={{padding: '32px 22px 24px'}}>
        <div style={{display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 'var(--r-pill)', fontSize: 12, fontWeight: 500, marginBottom: 18}}>
          <Icons.Sparkles size={12} sw={2} /> Beta privada · ES
        </div>
        <h1 style={{fontSize: 38, lineHeight: 1.05, fontWeight: 600, letterSpacing: '-0.03em', margin: '0 0 16px'}}>
          Tu wingman para WhatsApp.
        </h1>
        <p style={{fontSize: 17, lineHeight: 1.45, color: 'var(--text-secondary)', margin: '0 0 28px', textWrap: 'pretty'}}>
          Te lee la conversación, te sugiere qué decir, tú decides. En tu español.
        </p>
        <button className="btn btn--primary btn--full" onClick={onStart}>Empezar gratis</button>
        <p className="t-caption" style={{textAlign: 'center', marginTop: 12}}>30 generaciones al día. Sin tarjeta.</p>
      </div>

      {/* Mockup preview */}
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
              <Avatar name="Lucía" size={32} />
              <span style={{fontWeight: 600, fontSize: 14}}>Lucía</span>
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
              <div style={{alignSelf: 'flex-start', background: 'var(--gray-100)', padding: '8px 12px', borderRadius: '14px 14px 14px 4px', fontSize: 13, maxWidth: '78%'}}>jajaja vale, me has convencido</div>
              <div style={{
                marginTop: 8,
                background: 'var(--bg)',
                border: '1.5px solid var(--accent)',
                borderRadius: 12,
                padding: 12,
                boxShadow: '0 4px 14px rgba(91, 95, 224, 0.18)',
              }}>
                <div className="row gap-1" style={{color: 'var(--accent)', fontSize: 11, fontWeight: 600, marginBottom: 6, letterSpacing: '0.02em', textTransform: 'uppercase'}}>
                  <Icons.Sparkles size={11} sw={2} /> Sugerencia
                </div>
                <div style={{fontSize: 13, lineHeight: 1.45}}>Pues entonces no te escapas. ¿El viernes te animas a tomar algo por Malasaña?</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3 value blocks */}
      <div style={{padding: '0 22px 40px', display: 'flex', flexDirection: 'column', gap: 24}}>
        {[
          { icon: <Icons.Globe size={22} />, t: 'En tu español de verdad', s: 'Castizo, andaluz, mexicano, argentino. Sin sonar a manual.' },
          { icon: <Icons.Phone size={22} />, t: 'Sin copiar y pegar', s: 'Conecta tu WhatsApp como en WhatsApp Web. Tus chats, aquí.' },
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
            { n: '01', t: 'Conecta tu WhatsApp', s: 'Vinculación oficial con código de 8 caracteres. Te explicamos cada paso.' },
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
        <p className="t-small" style={{color: 'var(--text-secondary)', margin: '0 0 20px'}}>Configurar lleva menos de 2 minutos.</p>
        <button className="btn btn--primary btn--full" onClick={onStart}>Conectar mi WhatsApp</button>
      </div>

      {/* Footer */}
      <div style={{padding: '20px 22px 32px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <span className="t-caption">© WaFli 2026</span>
        <div className="row gap-4">
          <button className="btn btn--text" style={{height: 'auto', padding: 0, fontSize: 12, color: 'var(--text-secondary)'}} onClick={() => openLegal('terms')}>Términos</button>
          <button className="btn btn--text" style={{height: 'auto', padding: 0, fontSize: 12, color: 'var(--text-secondary)'}} onClick={() => openLegal('privacy')}>Privacidad</button>
          <button className="btn btn--text" style={{height: 'auto', padding: 0, fontSize: 12, color: 'var(--text-secondary)'}} onClick={() => openLegal('support')}>Soporte</button>
        </div>
      </div>
      {doc === 'terms' ? (
        <LegalFullscreen title="Términos y Condiciones" body={['Documento legal estático de la landing pública.', 'Aquí vivirán los términos completos del servicio WaFli.']} onClose={() => setDoc(null)} />
      ) : null}
      {doc === 'privacy' ? (
        <LegalFullscreen title="Política de Privacidad" body={['Documento legal estático de la landing pública.', 'Aquí vivirá el detalle de privacidad y tratamiento de datos.']} onClose={() => setDoc(null)} />
      ) : null}
      {doc === 'support' ? (
        <LegalFullscreen title="Soporte" body={['Documento estático de soporte.', 'Puedes configurar aquí canales de contacto y tiempos de respuesta.']} onClose={() => setDoc(null)} />
      ) : null}
    </div>
  );
}

function LegalFullscreen({ title, body, onClose }) {
  return (
    <div style={{position: 'fixed', inset: 0, zIndex: 120, background: 'var(--bg)', display: 'flex', flexDirection: 'column'}}>
      <div className="appheader">
        <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
          <IconButton onClick={onClose} label="Cerrar"><Icons.Close size={20} /></IconButton>
          <span style={{fontSize: 16, fontWeight: 600}}>{title}</span>
        </div>
      </div>
      <div className="scroll-y" style={{padding: '18px 22px 26px'}}>
        <div className="card" style={{padding: 14, lineHeight: 1.5, fontSize: 14}}>
          {body.map((p, i) => <p key={i} style={{margin: i === body.length - 1 ? 0 : '0 0 10px'}}>{p}</p>)}
        </div>
      </div>
    </div>
  );
}

function AuthScreen({ onBack, onMagicLink, onGoogleContinue, onOpenLegal, onShowToast }) {
  const [email, setEmail] = React.useState('');
  const [mode, setMode] = React.useState('new');
  const [error, setError] = React.useState('');
  const [stage, setStage] = React.useState('form'); // form | waiting | expired
  const [doc, setDoc] = React.useState(null);
  const openLegal = (type) => {
    if (onOpenLegal) onOpenLegal(type);
    else setDoc(type);
  };

  const submitEmail = () => {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!ok) {
      setError('Revisa el correo. Parece que no es válido.');
      return;
    }
    setError('');
    onShowToast && onShowToast('Te hemos enviado un enlace, revisa tu correo');
    setStage('waiting');
  };

  if (stage === 'expired') {
    return (
      <>
        <AppHeader
          title="Enlace caducado"
          leading={<IconButton onClick={onBack} label="Atrás"><Icons.Back size={20} /></IconButton>}
        />
        <div className="scroll-y" style={{padding: '20px 22px 24px'}}>
          <div className="card" style={{padding: 14}}>
            <p style={{margin: '0 0 12px', fontSize: 15}}>Este enlace ha caducado, pídelo de nuevo.</p>
            <button className="btn btn--primary btn--full" onClick={() => setStage('form')}>Volver a Registro / Login</button>
          </div>
        </div>
      </>
    );
  }

  if (stage === 'waiting') {
    return (
      <>
        <AppHeader
          title="Revisa tu correo"
          leading={<IconButton onClick={onBack} label="Atrás"><Icons.Back size={20} /></IconButton>}
        />
        <div className="scroll-y" style={{padding: '20px 22px 24px'}}>
          <div className="card" style={{padding: 14}}>
            <p style={{margin: '0 0 8px', fontSize: 15, textWrap: 'pretty'}}>
              Te enviamos un enlace mágico a <b>{email}</b>.
            </p>
            <p className="t-small" style={{margin: '0 0 14px', color: 'var(--text-secondary)'}}>
              Ábrelo para volver autenticado.
            </p>
            <div className="col gap-2">
              <button className="btn btn--primary btn--full" onClick={() => onMagicLink && onMagicLink({ firstTime: mode === 'new' })}>
                Ya abrí mi enlace
              </button>
              <button className="btn btn--secondary btn--full" onClick={() => setStage('expired')}>
                Simular enlace caducado (+15 min)
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader
        title="Registro / Login"
        leading={<IconButton onClick={onBack} label="Atrás"><Icons.Back size={20} /></IconButton>}
      />
      <div className="scroll-y" style={{padding: '20px 22px 24px'}}>
        <div className="row gap-2" style={{marginBottom: 14}}>
          <button className={'btn btn--sm ' + (mode === 'new' ? 'btn--primary' : 'btn--secondary')} onClick={() => setMode('new')}>Soy nuevo</button>
          <button className={'btn btn--sm ' + (mode === 'existing' ? 'btn--primary' : 'btn--secondary')} onClick={() => setMode('existing')}>Ya tengo cuenta</button>
        </div>

        <div className="card" style={{padding: 14, marginBottom: 12}}>
          <label className="t-small" style={{display: 'block', marginBottom: 8, fontWeight: 500}}>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            inputMode="email"
            style={{width: '100%', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '11px 12px', outline: 'none', fontSize: 15, fontFamily: 'inherit'}}
          />
          {error ? <p className="t-caption" style={{marginTop: 8, color: 'var(--danger)'}}>{error}</p> : null}
          <button className="btn btn--primary btn--full" style={{marginTop: 12}} onClick={submitEmail}>Enviarme enlace</button>
        </div>

        <button className="btn btn--secondary btn--full" onClick={() => onGoogleContinue && onGoogleContinue({ firstTime: mode === 'new' })}>Continuar con Google</button>

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
          body={['Documento legal estático para Registro/Login.', 'Al continuar aceptas estos términos.']}
          onClose={() => setDoc(null)}
        />
      ) : null}
      {doc === 'privacy' ? (
        <LegalFullscreen
          title="Política de Privacidad"
          body={['Documento legal estático para Registro/Login.', 'Aquí se explica el uso de datos de forma transparente.']}
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
            Al usar este servicio entiendo que la otra persona del chat no ha consentido el procesamiento de sus mensajes por IA. Soy responsable de respetar su privacidad.
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
            'Este es un documento legal estático de demostración para el onboarding.',
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
            'Este es un documento legal estático de demostración para el onboarding.',
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
  const options = ['🇪🇸 España', '🇲🇽 México', '🇦🇷 Argentina', '🇨🇱 Chile', '🌎 Neutro'];
  const [selected, setSelected] = React.useState('');
  return (
    <>
      <AppHeader
        title="¿Cómo hablas?"
        subtitle="Para que las sugerencias suenen como tú"
        leading={<IconButton onClick={onBack} label="Atrás"><Icons.Back size={20} /></IconButton>}
      />
      <div className="scroll-y" style={{padding: '20px 22px 24px'}}>
        <div className="col gap-2">
          {options.map((opt) => {
            const active = selected === opt;
            return (
              <button
                key={opt}
                onClick={() => setSelected(opt)}
                style={{
                  width: '100%',
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  background: active ? 'var(--accent-softer)' : 'var(--bg)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 500,
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
        <button className="btn btn--primary btn--full" style={{marginTop: 14, opacity: selected ? 1 : 0.55}} disabled={!selected} onClick={onContinue}>
          Continuar
        </button>
      </div>
    </>
  );
}

function ToneBaseScreen({ onBack, onContinue }) {
  const tones = [
    { id: 'relajado', title: 'Relajado', sample: 'Tranqui, sin agobios. ¿Qué tal el finde?' },
    { id: 'desenfadado', title: 'Desenfadado', sample: 'Eh, qué tal. Llevaba pensando en escribirte 😄' },
    { id: 'picante', title: 'Picante', sample: 'Estaba pensando en ti… mala idea o buena idea?' },
    { id: 'intelectual', title: 'Intelectual', sample: 'Tu última frase me hizo pensar. Cuéntame más.' },
  ];
  const [selected, setSelected] = React.useState('');
  return (
    <>
      <AppHeader
        title="¿Qué tono prefieres por defecto?"
        subtitle="Lo puedes cambiar para cada conversación"
        leading={<IconButton onClick={onBack} label="Atrás"><Icons.Back size={20} /></IconButton>}
      />
      <div className="scroll-y" style={{padding: '20px 22px 24px'}}>
        <div className="col gap-2">
          {tones.map((t) => {
            const active = selected === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                style={{
                  width: '100%',
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  background: active ? 'var(--accent-softer)' : 'var(--bg)',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{fontSize: 15, fontWeight: 600, marginBottom: 3}}>{t.title}</div>
                <div className="t-small" style={{color: 'var(--text-secondary)'}}>{t.sample}</div>
              </button>
            );
          })}
        </div>
        <button className="btn btn--primary btn--full" style={{marginTop: 14, opacity: selected ? 1 : 0.55}} disabled={!selected} onClick={onContinue}>
          Continuar
        </button>
      </div>
    </>
  );
}

function ConnectedSuccessScreen({ onContinue, onInstall }) {
  const isMobile = window.matchMedia ? window.matchMedia('(max-width: 1024px)').matches : true;
  return (
    <>
      <AppHeader title="Conectado" />
      <div className="scroll-y" style={{padding: '26px 22px 24px'}}>
        <div className="card" style={{padding: 18, textAlign: 'center'}}>
          <div style={{width: 68, height: 68, borderRadius: 999, margin: '0 auto 10px', background: 'var(--success-soft)', color: 'var(--success)', display: 'grid', placeItems: 'center'}}>
            <Icons.Check size={28} sw={2.4} />
          </div>
          <h2 className="t-h2" style={{margin: '0 0 8px'}}>¡Conectado!</h2>
          <p className="t-small" style={{color: 'var(--text-secondary)', margin: '0 0 12px'}}>
            Ya podemos leer tus chats y ayudarte a contestar.
          </p>
          {isMobile ? (
            <div className="card" style={{padding: 12, background: 'var(--gray-50)', textAlign: 'left'}}>
              <p className="t-small" style={{margin: 0}}>Añade WaFli a tu pantalla de inicio para usarlo como una app.</p>
              <button className="btn btn--secondary btn--md" style={{marginTop: 10}} onClick={onInstall}>Ver cómo</button>
            </div>
          ) : null}
          <button className="btn btn--primary btn--full" style={{marginTop: 12}} onClick={onContinue}>Ir a mis chats</button>
        </div>
      </div>
    </>
  );
}

function AddToHomeScreen({ onBack, onDone, onLater }) {
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return (
    <>
      <AppHeader
        title="Instálalo como app"
        subtitle="Acceso rápido y notificaciones"
        leading={<IconButton onClick={onBack} label="Atrás"><Icons.Back size={20} /></IconButton>}
      />
      <div className="scroll-y" style={{padding: '20px 22px 24px'}}>
        <div className="card" style={{padding: 14}}>
          <p style={{margin: '0 0 8px', fontWeight: 600}}>{isIOS ? 'iOS Safari' : 'Android Chrome'}</p>
          {isIOS ? (
            <ol className="t-small" style={{margin: 0, paddingLeft: 18}}>
              <li>Toca el botón Compartir.</li>
              <li>Elige Añadir a pantalla de inicio.</li>
              <li>Confirma con Añadir.</li>
            </ol>
          ) : (
            <ol className="t-small" style={{margin: 0, paddingLeft: 18}}>
              <li>Toca el menú de tres puntos.</li>
              <li>Elige Añadir a pantalla de inicio.</li>
              <li>Confirma la instalación.</li>
            </ol>
          )}
          <div style={{marginTop: 12, height: 120, borderRadius: 10, border: '1px dashed var(--border-strong)', background: 'repeating-linear-gradient(135deg, var(--gray-100) 0 8px, var(--gray-50) 8px 16px)', display: 'grid', placeItems: 'center'}}>
            <span className="t-caption">[ demo-a2hs.gif ]</span>
          </div>
        </div>
        <div className="col gap-2" style={{marginTop: 14}}>
          <button className="btn btn--primary btn--full" onClick={onDone}>Listo, lo haré ahora</button>
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SCREEN 2 Â· ConexiÃ³n WhatsApp via pairing code
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function ConnectScreen({ onBack, onConnected }) {
  const [step, setStep] = React.useState('number'); // number | code
  const [country, setCountry] = React.useState('+595 PY');
  const [phone, setPhone] = React.useState('');
  const [error, setError] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [modal, setModal] = React.useState(null); // timeout | linked
  const [backendError, setBackendError] = React.useState('');
  const code = 'ABCD-EFGH';
  const canGenerate = phone.replace(/\D/g, '').length >= 7;
  const copy = () => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  React.useEffect(() => {
    if (step !== 'code') return undefined;
    const timeoutId = setTimeout(() => setModal('timeout'), 180000);
    return () => clearTimeout(timeoutId);
  }, [step]);

  const generateCode = () => {
    const numericPhone = phone.replace(/\D/g, '');
    if (numericPhone.length < 7) {
      setError('Revisa el número. Parece inválido.');
      return;
    }
    if (numericPhone.endsWith('0000')) {
      setModal('linked');
      return;
    }
    setError('');
    setBackendError('');
    setStep('code');
  };

  return (
    <>
      <AppHeader
        title="Conectemos tu WhatsApp"
        leading={<IconButton onClick={onBack} label="Atrás"><Icons.Back size={20} /></IconButton>}
      />
      <div className="scroll-y">
        <div style={{padding: '20px 22px 32px'}}>
          <p className="t-body" style={{color: 'var(--text-secondary)', margin: '0 0 24px', textWrap: 'pretty'}}>
            Introduce tu número y te damos un código para vincular.
          </p>
          {step === 'number' ? (
            <div className="card" style={{padding: 14}}>
              <label className="t-small" style={{display: 'block', marginBottom: 8, fontWeight: 500}}>País</label>
              <select value={country} onChange={(e) => setCountry(e.target.value)} style={{width: '100%', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '11px 12px', outline: 'none', fontSize: 15, marginBottom: 12, fontFamily: 'inherit'}}>
                <option>+595 PY</option>
                <option>+34 ES</option>
                <option>+52 MX</option>
                <option>+54 AR</option>
                <option>+56 CL</option>
              </select>
              <label className="t-small" style={{display: 'block', marginBottom: 8, fontWeight: 500}}>Número de teléfono</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. 981 234 567"
                inputMode="numeric"
                style={{width: '100%', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '11px 12px', outline: 'none', fontSize: 15, fontFamily: 'inherit'}}
              />
              {error ? <p className="t-caption" style={{marginTop: 8, color: 'var(--danger)'}}>{error}</p> : null}
              <button className="btn btn--primary btn--full" style={{marginTop: 12, opacity: canGenerate ? 1 : 0.55}} disabled={!canGenerate} onClick={generateCode}>
                Generar código
              </button>
            </div>
          ) : (
            <>
              <div style={{
                background: 'var(--gray-50)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: '28px 16px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
                marginBottom: 24,
              }}>
                <span className="t-caption" style={{textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500}}>Tu código</span>
                <div className="row gap-3" style={{alignItems: 'center'}}>
                  <span className="t-mono" style={{fontSize: 42, fontWeight: 600, letterSpacing: '0.03em', color: 'var(--text)'}}>{code}</span>
                </div>
                <button className="btn btn--ghost btn--sm" onClick={copy} style={{color: copied ? 'var(--success)' : 'var(--accent)'}}>
                  {copied ? <><Icons.Check size={14} sw={2.5} /> Copiado</> : <><Icons.Copy size={14} /> Copiar</>}
                </button>
              </div>

              <ol style={{margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14}}>
                {[
                  <>Abre <b>WhatsApp</b> en tu móvil.</>,
                  <>Toca <b>Configuración</b> (o <b>Ajustes</b> según versión).</>,
                  <>Toca <b>Dispositivos vinculados</b>.</>,
                  <>Toca <b>Vincular un dispositivo</b>.</>,
                  <>Toca <b>Vincular con número de teléfono</b>.</>,
                  <>Introduce el código de arriba.</>,
                ].map((item, i) => (
                  <li key={i} style={{display: 'flex', gap: 14, alignItems: 'flex-start'}}>
                    <span className="t-mono" style={{
                      fontSize: 12, fontWeight: 600,
                      width: 22, height: 22, borderRadius: 6,
                      background: 'var(--gray-100)', color: 'var(--text-secondary)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: 1,
                    }}>{i + 1}</span>
                    <span style={{fontSize: 15, lineHeight: 1.5}}>{item}</span>
                  </li>
                ))}
              </ol>

              <div style={{
                marginTop: 28,
                background: 'var(--gray-50)',
                border: '1px dashed var(--border-strong)',
                borderRadius: 14,
                padding: 14,
                textAlign: 'center',
              }}>
                <div style={{
                  height: 140, borderRadius: 10,
                  background: 'repeating-linear-gradient(135deg, var(--gray-100) 0 8px, var(--gray-50) 8px 16px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 10,
                }}>
                  <span className="t-mono t-caption">[{/iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'android'}-tutorial.gif]</span>
                </div>
                <span className="t-caption">Tutorial visual del flujo en WhatsApp</span>
              </div>

              <div style={{
                marginTop: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                color: 'var(--text-secondary)', fontSize: 14,
              }}>
                <Spinner size={16} />
                <span>Esperando vinculación…</span>
              </div>
              {backendError ? <p className="t-caption" style={{marginTop: 10, color: 'var(--danger)', textAlign: 'center'}}>{backendError}</p> : null}

              <div className="col gap-2" style={{marginTop: 20}}>
                <button className="btn btn--secondary btn--full" onClick={onConnected}>
                  Simular vinculación exitosa
                </button>
                <button className="btn btn--text" onClick={() => setModal('timeout')}>Simular código caducado (+3 min)</button>
                <button className="btn btn--text" onClick={() => setBackendError('No pudimos validar la vinculación. Inténtalo de nuevo.')}>Simular error de backend</button>
                <button className="btn btn--text" onClick={() => { setBackendError(''); }}>Reintentar</button>
              </div>
            </>
          )}

        </div>
      </div>
      {modal === 'timeout' ? (
        <div style={{position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(15,20,30,0.35)', display: 'grid', placeItems: 'center', padding: 20}}>
          <div className="card" style={{width: '100%', maxWidth: 360, padding: 16}}>
            <p style={{margin: '0 0 12px', fontWeight: 600}}>El código ha caducado</p>
            <p className="t-small" style={{margin: '0 0 14px', color: 'var(--text-secondary)'}}>¿Quieres generar uno nuevo?</p>
            <div className="col gap-2">
              <button className="btn btn--primary btn--full" onClick={() => { setModal(null); setStep('number'); }}>Generar nuevo código</button>
              <button className="btn btn--secondary btn--full" onClick={() => setModal(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      ) : null}
      {modal === 'linked' ? (
        <div style={{position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(15,20,30,0.35)', display: 'grid', placeItems: 'center', padding: 20}}>
          <div className="card" style={{width: '100%', maxWidth: 360, padding: 16}}>
            <p style={{margin: '0 0 12px', fontWeight: 600}}>Este número ya tiene cuenta activa</p>
            <p className="t-small" style={{margin: '0 0 14px', color: 'var(--text-secondary)'}}>¿Quieres que la cerremos y usar esta nueva sesión?</p>
            <div className="col gap-2">
              <button className="btn btn--primary btn--full" onClick={() => { setModal(null); setError(''); setStep('code'); }}>Sí, continuar</button>
              <button className="btn btn--secondary btn--full" onClick={() => setModal(null)}>No, cancelar</button>
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SCREEN 3 Â· Lista de conversaciones (Chats)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function ChatsListScreen({ onOpenChat, onOpenQuota, empty = false, onNavigate, whatsappInterrupted = false, offline = false, onReconnectWhatsApp }) {
  const [searching, setSearching] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [activeFilter, setActiveFilter] = React.useState('all'); // all | favorites | unread | stale | recent
  const [lastRefreshAt, setLastRefreshAt] = React.useState('');
  const [sheet, setSheet] = React.useState(null); // 'new-chat' | 'new-contact' | null
  const [contactSearch, setContactSearch] = React.useState('');
  const [newContactName, setNewContactName] = React.useState('');
  const [newContactPhone, setNewContactPhone] = React.useState('');
  const [contacts, setContacts] = React.useState(() =>
    MATCHES.map(m => ({ ...m, phone: m.phone || '', favorite: Boolean(m.favorite), hasConversation: Boolean(m.last || m.messages) }))
  );
  const filtered = q ? contacts.filter(m => m.name.toLowerCase().includes(q.toLowerCase())) : contacts;
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
  const filteredForList = filterByMode(withConversation);
  const filteredContacts = contactSearch
    ? contacts.filter(m => m.name.toLowerCase().includes(contactSearch.toLowerCase()))
    : contacts;
  const refreshChats = () => {
    setLastRefreshAt(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    setMenuOpen(false);
  };
  const markAllRead = () => {
    setContacts(prev => prev.map(c => ({ ...c, unread: 0 })));
    setMenuOpen(false);
  };
  const toggleFavorite = (contactId) => {
    setContacts(prev => prev.map(c => (
      c.id === contactId ? { ...c, favorite: !c.favorite } : c
    )));
  };
  const startConversation = (contactId) => {
    setContacts(prev => prev.map(c => (
      c.id === contactId
        ? { ...c, hasConversation: true, last: c.last || 'Conversación iniciada', time: c.time || 'ahora', unread: 0 }
        : c
    )));
    setSheet(null);
    setContactSearch('');
    setMenuOpen(false);
    onOpenChat(contactId);
  };
  const createContact = () => {
    const name = newContactName.trim();
    const phone = newContactPhone.trim();
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    if (!name || cleanPhone.length < 7) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const baseId = slug || 'contacto';
    const uniqueId = MATCHES.some(m => m.id === baseId) ? (baseId + '-' + Date.now()) : baseId;
    const newContact = {
      id: uniqueId,
      name,
      phone: cleanPhone,
      last: '',
      mine: false,
      time: '',
      unread: 0,
      stale: false,
      messages: [],
      hasConversation: false,
    };
    MATCHES.push(newContact);
    setContacts(prev => [newContact, ...prev]);
    setNewContactName('');
    setNewContactPhone('');
    setSheet('new-chat');
  };
  const canSaveContact = newContactName.trim().length > 0 && newContactPhone.trim().replace(/[^\d+]/g, '').length >= 7;
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
            style={{flex: 1, border: 'none', outline: 'none', fontSize: 15, background: 'transparent'}}
          />
          <button className="btn btn--text" style={{fontSize: 14, padding: '4px 8px'}} onClick={() => { setSearching(false); setQ(''); }}>Cancelar</button>
        </div>
      ) : (
        <AppHeader
          title="Chats"
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
                  <div style={{
                    position: 'absolute', top: 36, right: 0, zIndex: 30,
                    width: 220, background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 12, boxShadow: 'var(--sh-card)', overflow: 'hidden',
                  }}>
                    <button onClick={refreshChats} style={menuActionStyle}>
                      <Icons.Refresh size={16} /> Refrescar
                    </button>
                    <button onClick={markAllRead} style={{...menuActionStyle, borderTop: '1px solid var(--border)'}}>
                      <Icons.Check size={16} /> Marcar todo leído
                    </button>
                    <button
                      onClick={() => { setSheet('new-chat'); setMenuOpen(false); }}
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
                    <div style={{borderTop: '1px solid var(--border)', padding: '8px 10px', background: 'var(--gray-50)'}}>
                      <span className="t-caption" style={{display: 'block', marginBottom: 6}}>Filtros</span>
                      <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
                        {[
                          ['all', 'Todos'],
                          ['favorites', '⭐ Favoritas'],
                          ['unread', 'No leídos'],
                          ['stale', 'Encalladas'],
                          ['recent', 'Recientes'],
                        ].map(([key, label]) => (
                          <button
                            key={key}
                            onClick={() => { setActiveFilter(key); setMenuOpen(false); }}
                            style={{
                              border: `1px solid ${activeFilter === key ? 'var(--accent)' : 'var(--border)'}`,
                              background: activeFilter === key ? 'var(--accent-softer)' : 'var(--bg)',
                              color: 'var(--text)',
                              borderRadius: 999,
                              padding: '5px 9px',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >{label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>}
        />
      )}
      {whatsappInterrupted && (
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
          <span className="t-small" style={{color: '#7a4d0b'}}>Reconecta tu WhatsApp</span>
          <button className="btn btn--text" style={{height: 26, color: '#7a4d0b', fontWeight: 600}} onClick={onReconnectWhatsApp}>Reconectar</button>
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
          <span className="t-small" style={{color: '#7a4d0b'}}>Sin conexión a internet, mostrando datos locales.</span>
        </div>
      )}
      <div style={{padding: '12px 16px 8px', borderBottom: '1px solid var(--border)'}}>
        <button onClick={onOpenQuota} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'transparent', border: 'none', padding: '4px 0', cursor: 'pointer',
        }}>
          <QuotaPill count={22} total={30} />
          <span className="t-caption">Plan Gratuito · ver →</span>
        </button>
        {lastRefreshAt && (
          <div className="t-caption" style={{textAlign: 'right', marginTop: 4}}>
            Actualizado: {lastRefreshAt}
          </div>
        )}
      </div>
      <div className="scroll-y">
        {empty ? (
          <EmptyState
            icon={<Icons.Empty size={32} sw={1.4} />}
            title="Aún no tienes chats activos"
            subtitle="Cuando hables con alguien por WhatsApp aparecerán aquí."
          />
        ) : (
          <div>
            {filteredForList.map(m => (
              <ConvCard
                key={m.id}
                match={m}
                onClick={() => onOpenChat(m.id)}
                onToggleFavorite={() => toggleFavorite(m.id)}
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
      <BottomSheet open={sheet === 'new-chat'} onClose={() => setSheet(null)} height="78%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '4px 18px 18px'}}>
          <div className="row gap-2" style={{alignItems: 'center', marginBottom: 10}}>
            <Icons.Chats size={18} style={{color: 'var(--accent)'}} />
            <span className="t-h3">Nueva conversación</span>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 8, background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', marginBottom: 12}}>
            <Icons.Search size={16} style={{color: 'var(--text-tertiary)', flexShrink: 0}} />
            <input
              autoFocus
              value={contactSearch}
              onChange={e => setContactSearch(e.target.value)}
              placeholder="Buscar en tus contactos..."
              style={{flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14.5}}
            />
          </div>
          <button className="btn btn--ghost btn--md" style={{justifyContent: 'flex-start', border: '1px dashed var(--border-strong)', marginBottom: 12}} onClick={() => setSheet('new-contact')}>
            <Icons.Plus size={16} /> Crear nuevo contacto
          </button>
          <div className="scroll-y" style={{margin: '0 -18px', padding: '0 18px'}}>
            {filteredContacts.map(c => (
              <button key={c.id} onClick={() => startConversation(c.id)} style={contactRowStyle}>
                <Avatar name={c.name} size={40} />
                <div className="col" style={{flex: 1, minWidth: 0}}>
                  <span style={{fontSize: 14.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{c.name}</span>
                  <span className="t-caption" style={{fontSize: 12}}>
                    {c.hasConversation ? 'Tiene historial de chat' : 'Sin conversación todavía'}{c.phone ? ` · ${c.phone}` : ''}
                  </span>
                </div>
                <Icons.Chevron size={15} sw={2} style={{color: 'var(--text-tertiary)'}} />
              </button>
            ))}
            {filteredContacts.length === 0 && (
              <div style={{padding: '30px 4px', textAlign: 'center'}}>
                <span className="t-small" style={{color: 'var(--text-secondary)'}}>No encontramos ese contacto.</span>
              </div>
            )}
          </div>
        </div>
      </BottomSheet>
      <BottomSheet open={sheet === 'new-contact'} onClose={() => setSheet(null)} height="62%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '4px 18px 18px'}}>
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
            style={{
              width: '100%',
              border: '1px solid var(--border-strong)',
              borderRadius: 12,
              padding: '11px 12px',
              outline: 'none',
              fontSize: 15,
              marginBottom: 14,
              fontFamily: 'inherit',
            }}
          />
          <label className="t-small" style={{marginBottom: 6, fontWeight: 500}}>Número de contacto</label>
          <input
            value={newContactPhone}
            onChange={e => setNewContactPhone(e.target.value)}
            placeholder="Ej. +34 612 345 678"
            inputMode="tel"
            style={{
              width: '100%',
              border: '1px solid var(--border-strong)',
              borderRadius: 12,
              padding: '11px 12px',
              outline: 'none',
              fontSize: 15,
              marginBottom: 14,
              fontFamily: 'inherit',
            }}
          />
          <div className="row gap-2" style={{marginTop: 'auto'}}>
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
    <div style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', background: 'transparent', border: 'none',
      borderBottom: '1px solid var(--border)', textAlign: 'left',
    }}>
      <button onClick={onClick} onMouseDown={startHold} onMouseUp={clearHold} onMouseLeave={clearHold} onTouchStart={startHold} onTouchEnd={clearHold} style={{
        display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0,
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0,
      }}>
        <Avatar name={match.name} size={44} />
      <div style={{flex: 1, minWidth: 0}}>
        <div className="row" style={{justifyContent: 'space-between', gap: 8, marginBottom: 2}}>
          <div className="row gap-1" style={{minWidth: 0}}>
            <span style={{fontWeight: match.unread ? 600 : 500, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{match.name}</span>
            {match.favorite && <span style={{fontSize: 12, lineHeight: 1, color: 'var(--warning)'}}>★</span>}
            {match.stale && <Icons.Hourglass size={13} sw={1.75} style={{color: 'var(--warning)', flexShrink: 0}} />}
          </div>
          <span className="t-caption" style={{fontSize: 12, color: match.unread ? 'var(--accent)' : 'var(--text-tertiary)', flexShrink: 0, fontVariantNumeric: 'tabular-nums'}}>{match.time}</span>
        </div>
        <div className="row" style={{justifyContent: 'space-between', gap: 8}}>
          <span style={{
            fontSize: 14, color: 'var(--text-secondary)',
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
      <button
        onClick={onToggleFavorite}
        aria-label={match.favorite ? 'Quitar de favoritas' : 'Marcar como favorita'}
        style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          color: match.favorite ? 'var(--warning)' : 'var(--text-tertiary)',
          fontSize: 18, lineHeight: 1, padding: '4px 2px',
        }}
      >
        {match.favorite ? '★' : '☆'}
      </button>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SCREEN 4 Â· Vista de conversación
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function ChatScreen({ matchId, onBack, onSuggest, onOpener, onRewrite, onAnalyze, offline = false }) {
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [editPhone, setEditPhone] = React.useState('');
  const [muted, setMuted] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [aiMenuOpen, setAiMenuOpen] = React.useState(false);
  const scrollRef = React.useRef(null);

  const match = MATCHES.find(m => m.id === matchId) || MATCHES[0];
  const isEmpty = !match.messages;
  const lastMessage = isEmpty ? null : match.messages[match.messages.length - 1];
  const ctaMode = isEmpty ? 'opener' : (lastMessage.from === 'me' ? 'rewrite' : 'suggest');

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [matchId, refreshKey]);

  React.useEffect(() => {
    setEditName(match.name || '');
    setEditPhone(match.phone || '');
  }, [matchId, refreshKey]);

  const saveContactEdits = () => {
    const name = editName.trim();
    const phone = editPhone.trim().replace(/[^\d+]/g, '');
    if (!name || phone.length < 7) return;

    const idx = MATCHES.findIndex(m => m.id === matchId);
    if (idx >= 0) {
      MATCHES[idx] = { ...MATCHES[idx], name, phone };
      setRefreshKey(v => v + 1);
      setEditOpen(false);
      setMenuOpen(false);
    }
  };
  const excludeConversation = () => {
    const idx = MATCHES.findIndex(m => m.id === matchId);
    if (idx >= 0) {
      MATCHES[idx] = { ...MATCHES[idx], excluded: true };
      setMenuOpen(false);
      onBack();
    }
  };
  const canSaveEdits = editName.trim().length > 0 && editPhone.trim().replace(/[^\d+]/g, '').length >= 7;

  return (
    <>
      <AppHeader
        title={match.name}
        subtitle="en línea hace 5 min"
        leading={<>
          <IconButton onClick={onBack} label="Atrás"><Icons.Back size={20} /></IconButton>
          <Avatar name={match.name} size={32} />
        </>}
        trailing={
          <div style={{position: 'relative'}}>
            <IconButton onClick={() => setMenuOpen(v => !v)} label="Más"><Icons.More size={20} /></IconButton>
            {menuOpen && (
              <>
                <button
                  onClick={() => setMenuOpen(false)}
                  aria-label="Cerrar menú"
                  style={{position: 'fixed', inset: 0, background: 'transparent', border: 'none', zIndex: 29}}
                />
                <div style={{
                  position: 'absolute', top: 36, right: 0, zIndex: 30,
                  width: 240, background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 12, boxShadow: 'var(--sh-card)', overflow: 'hidden',
                }}>
                  <button onClick={() => { setEditOpen(true); setMenuOpen(false); }} style={menuActionStyle}>
                    <Icons.Edit size={16} /> Editar nombre y número
                  </button>
                  <button onClick={() => { setMuted(v => !v); setMenuOpen(false); }} style={{...menuActionStyle, borderTop: '1px solid var(--border)'}}>
                    <Icons.Bell size={16} /> {muted ? 'Activar notificaciones' : 'Silenciar notificaciones'}
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

      <div ref={scrollRef} className="scroll-y" style={{background: 'var(--gray-50)', padding: '16px 14px 8px'}}>
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
        {isEmpty ? (
          <div style={{padding: '32px 16px', textAlign: 'center'}}>
            <div style={{
              display: 'inline-flex', padding: '4px 10px', borderRadius: 'var(--r-pill)',
              background: 'var(--accent-soft)', color: 'var(--accent)',
              fontSize: 12, fontWeight: 500, marginBottom: 14,
            }}>Match nuevo</div>
            <div className="t-h3" style={{margin: '0 0 6px'}}>Aún no habéis hablado</div>
            <div className="t-small" style={{color: 'var(--text-secondary)', maxWidth: 260, margin: '0 auto 18px'}}>
              Pídele a WaFli una apertura que no suene a copia-pega.
            </div>
            <button className="btn btn--secondary btn--md" onClick={onOpener}>
              <Icons.Sparkles size={16} /> Necesito abrir
            </button>
          </div>
        ) : (
          <ChatMessages messages={match.messages} />
        )}
      </div>

      {/* Suggest CTA bar */}
      <div style={{padding: '8px 14px', background: 'var(--gray-50)', borderTop: '1px solid var(--border)'}}>
        {ctaMode === 'suggest' && (
          <button onClick={onSuggest} disabled={offline} className="btn btn--primary btn--full" style={{height: 48, opacity: offline ? 0.55 : 1}}>
            <Icons.Sparkles size={16} /> Sugerir respuesta
          </button>
        )}
        {ctaMode === 'opener' && (
          <button onClick={onOpener} disabled={offline} className="btn btn--primary btn--full" style={{height: 48, opacity: offline ? 0.55 : 1}}>
            <Icons.Sparkles size={16} /> Necesito abrir
          </button>
        )}
        {ctaMode === 'rewrite' && (
          <button onClick={onRewrite} disabled={offline} className="btn btn--secondary btn--full" style={{height: 48, opacity: offline ? 0.55 : 1}}>
            <Icons.Sparkles size={16} /> Reescribir lo último
          </button>
        )}
      </div>

      {/* Composer */}
      <div style={{
        padding: '8px 12px 12px',
        background: 'var(--bg)',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'flex-end', gap: 8,
      }}>
        <button className="appheader__icon-btn" disabled={offline} style={{color: 'var(--text-secondary)', opacity: offline ? 0.45 : 1}} aria-label="Opciones IA" onClick={() => setAiMenuOpen(true)}><Icons.Sparkles size={20} /></button>
        <textarea
          rows={1}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Mensaje"
          style={{
            flex: 1, resize: 'none',
            border: '1px solid var(--border-strong)', borderRadius: 22,
            padding: '10px 14px', fontSize: 15, outline: 'none',
            fontFamily: 'inherit', background: 'var(--gray-50)',
            minHeight: 40, maxHeight: 120,
          }}
        />
        <button className="appheader__icon-btn" disabled={!draft.trim() || offline} style={{background: (draft.trim() && !offline) ? 'var(--accent)' : 'var(--gray-200)', color: (draft.trim() && !offline) ? 'white' : 'var(--text-tertiary)', transition: 'all 150ms', opacity: (draft.trim() && !offline) ? 1 : 0.7}} aria-label="Enviar">
          <Icons.Send size={18} sw={2} />
        </button>
      </div>
      <BottomSheet open={aiMenuOpen} onClose={() => setAiMenuOpen(false)} height="44%">
        <div style={{padding: '8px 18px 18px'}}>
          <div className="t-h3" style={{marginBottom: 12}}>Acciones IA</div>
          <button style={menuActionStyle} onClick={() => { setAiMenuOpen(false); onSuggest && onSuggest(); }}><Icons.Sparkles size={16} /> Sugerir respuesta</button>
          <button style={menuActionStyle} onClick={() => { setAiMenuOpen(false); onRewrite && onRewrite(); }}><Icons.Edit size={16} /> Reescribir lo que escribí</button>
          <button style={menuActionStyle} onClick={() => { setAiMenuOpen(false); onAnalyze && onAnalyze(); }}><Icons.Search size={16} /> ¿Qué quiere decir el último?</button>
        </div>
      </BottomSheet>
      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} height="56%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '4px 18px 18px'}}>
          <div className="row gap-2" style={{alignItems: 'center', marginBottom: 8}}>
            <Icons.Edit size={18} style={{color: 'var(--accent)'}} />
            <span className="t-h3">Editar contacto</span>
          </div>
          <label className="t-small" style={{marginBottom: 6, fontWeight: 500}}>Nombre del contacto</label>
          <input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            placeholder="Ej. Lucía"
            style={{
              width: '100%',
              border: '1px solid var(--border-strong)',
              borderRadius: 12,
              padding: '11px 12px',
              outline: 'none',
              fontSize: 15,
              marginBottom: 14,
              fontFamily: 'inherit',
            }}
          />
          <label className="t-small" style={{marginBottom: 6, fontWeight: 500}}>Número de contacto</label>
          <input
            value={editPhone}
            onChange={e => setEditPhone(e.target.value)}
            placeholder="Ej. +34 612 345 678"
            inputMode="tel"
            style={{
              width: '100%',
              border: '1px solid var(--border-strong)',
              borderRadius: 12,
              padding: '11px 12px',
              outline: 'none',
              fontSize: 15,
              marginBottom: 14,
              fontFamily: 'inherit',
            }}
          />
          <div className="row gap-2" style={{marginTop: 'auto'}}>
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

function ChatMessages({ messages, onLongPressMessage, messageError, onRetry }) {
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
    <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
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
        const mine = m.from === 'me';
        const prev = grouped[i - 1];
        const grouped_with_prev = prev && !prev.separator && prev.from === m.from;
        const holdRef = { current: null };
        const startHold = () => {
          if (!onLongPressMessage) return;
          holdRef.current = setTimeout(() => onLongPressMessage(m), 420);
        };
        const clearHold = () => {
          if (holdRef.current) clearTimeout(holdRef.current);
          holdRef.current = null;
        };
        return (
          <div key={m.id} style={{
            display: 'flex',
            justifyContent: mine ? 'flex-end' : 'flex-start',
            marginTop: grouped_with_prev ? 0 : 4,
          }}>
            <div onMouseDown={startHold} onMouseUp={clearHold} onMouseLeave={clearHold} onTouchStart={startHold} onTouchEnd={clearHold} style={{
              maxWidth: '78%',
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
            }}>{m.text}</div>
            {messageError === m.id && mine && (
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SCREEN 5 Â· Sugerir respuesta (bottom sheet content)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const TONES = ['Relajado', 'Desenfadado', 'Picante', 'Intelectual'];
const SUGGESTIONS = {
  Relajado: 'Me alegra leer eso. La verdad es que yo también lo había pensado, pero no quería pasarme. ¿Te apetece tomar algo el viernes y lo vemos en persona?',
  Desenfadado: 'Me dejas pensativo con eso. La verdad es que llevo toda la semana queriendo proponerte algo pero no encontraba el momento â€” Â¿te animas a tomar algo el viernes?',
  Picante: 'Vaya, eso me gusta mÃ¡s de lo que deberÃ­a. El viernes te invito a una caÃ±a y vemos hasta dÃ³nde llega lo de "convencerme".',
  Intelectual: 'Tomo nota. Los argumentos sÃ³lidos siempre se merecen una segunda parte en persona â€” Â¿el viernes te pillo cerca para una caÃ±a?',
};

function SuggestSheet({ onClose, onSent }) {
  const [tone, setTone] = React.useState('Desenfadado');
  const [text, setText] = React.useState(SUGGESTIONS['Desenfadado']);
  const [regenerating, setRegenerating] = React.useState(false);

  const handleTone = (t) => {
    setTone(t);
    setRegenerating(true);
    setTimeout(() => { setText(SUGGESTIONS[t]); setRegenerating(false); }, 500);
  };
  const regen = () => {
    setRegenerating(true);
    setTimeout(() => {
      // small variation
      const variants = [
        SUGGESTIONS[tone],
        'Esa frase merece respuesta cara a cara. ¿El viernes te animas a una caña por Malasaña?',
        'No me esperaba ese giro. Si te va el viernes, te invito a tomar algo y lo seguimos en persona.',
      ];
      setText(variants[Math.floor(Math.random() * variants.length)]);
      setRegenerating(false);
    }, 600);
  };

  return (
    <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '4px 18px 18px'}}>
      <div className="row gap-2" style={{marginBottom: 4, alignItems: 'center'}}>
        <Icons.Sparkles size={18} style={{color: 'var(--accent)'}} />
        <span className="t-h3">Sugerencia</span>
      </div>
      <p className="t-caption" style={{margin: '0 0 16px'}}>Edita lo que quieras antes de enviar.</p>

      {/* Tones */}
      <div style={{display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4, marginLeft: -18, marginRight: -18, padding: '0 18px 4px'}}>
        {TONES.map(t => (
          <span key={t} className={'chip ' + (tone === t ? 'chip--active' : '')} onClick={() => handleTone(t)}>{t}</span>
        ))}
      </div>

      {/* Textarea */}
      <div style={{position: 'relative', flex: 1, minHeight: 0, marginBottom: 12}}>
        <textarea
          className="textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          style={{
            height: '100%', width: '100%', fontSize: 15, lineHeight: 1.5, minHeight: 120,
            opacity: regenerating ? 0.4 : 1, transition: 'opacity 150ms',
          }}
        />
        {regenerating && (
          <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--accent)', fontSize: 13, fontWeight: 500}}>
            <Spinner size={16} /> generandoâ€¦
          </div>
        )}
      </div>

      {/* Secondary actions */}
      <div className="row gap-2" style={{marginBottom: 12}}>
        <button className="btn btn--ghost btn--md" style={{flex: 1, border: '1px solid var(--border-strong)', color: 'var(--text)'}} onClick={regen}>
          <Icons.Refresh size={16} /> Regenerar
        </button>
        <button className="btn btn--ghost btn--md" style={{flex: 1, border: '1px solid var(--border-strong)', color: 'var(--text)'}}>
          <Icons.Edit size={15} /> Editar
        </button>
      </div>

      {/* Send */}
      <button className="btn btn--primary btn--full" onClick={onSent}>Enviar</button>
      <div className="row gap-1" style={{justifyContent: 'center', marginTop: 10, color: 'var(--text-secondary)', fontSize: 12}}>
        <Icons.Bolt size={11} sw={2} fill="currentColor" />
        <span className="t-mono" style={{fontSize: 12}}>21 generaciones restantes</span>
      </div>
    </div>
  );
}

function RewriteSheet({ sourceText = '', onUse }) {
  const [tone, setTone] = React.useState('Desenfadado');
  const [rewritten, setRewritten] = React.useState(sourceText || 'Tu mensaje reescrito aparecerá aquí.');
  const regen = () => setRewritten(`(${tone}) ${sourceText || 'Mensaje original'} — versión más clara y natural.`);
  return (
    <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '4px 18px 18px'}}>
      <div className="row gap-2" style={{marginBottom: 4, alignItems: 'center'}}><Icons.Sparkles size={18} style={{color: 'var(--accent)'}} /><span className="t-h3">Reescribir</span></div>
      <div style={{display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 12, paddingBottom: 4}}>{TONES.map(t => <span key={t} className={'chip ' + (tone === t ? 'chip--active' : '')} onClick={() => setTone(t)}>{t}</span>)}</div>
      <div className="t-caption" style={{marginBottom: 6}}>Original</div>
      <div className="card" style={{padding: 10, marginBottom: 10, fontSize: 13.5}}>{sourceText || 'Escribe algo en el composer para reescribir.'}</div>
      <div className="t-caption" style={{marginBottom: 6}}>Reescrito</div>
      <textarea className="textarea" rows={6} value={rewritten} onChange={e => setRewritten(e.target.value)} style={{fontSize: 14.5, marginBottom: 12}} />
      <button className="btn btn--ghost btn--md" style={{marginBottom: 10}} onClick={regen}><Icons.Refresh size={16} /> Regenerar</button>
      <button className="btn btn--primary btn--full" onClick={() => onUse && onUse(rewritten)}>Usar este</button>
    </div>
  );
}

function AnalysisSheet({ message = '', onSuggest }) {
  return (
    <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '4px 18px 18px'}}>
      <div className="row gap-2" style={{marginBottom: 8, alignItems: 'center'}}><Icons.Search size={18} style={{color: 'var(--accent)'}} /><span className="t-h3">Análisis</span></div>
      <div className="t-caption" style={{marginBottom: 6}}>Mensaje analizado</div>
      <div className="card" style={{padding: 10, marginBottom: 12, fontSize: 13.5}}>{message || 'No hay mensaje seleccionado.'}</div>
      <div className="card" style={{padding: 12, marginBottom: 12}}>
        <p style={{margin: '0 0 8px'}}><b>Tono percibido:</b> 😏 Coqueto, abierto</p>
        <p style={{margin: '0 0 8px'}}><b>Lo que parece decir:</b> le interesa seguir conversando, pero está midiendo tu interés.</p>
        <p style={{margin: 0}}><b>Cómo podrías responder:</b> mantén el tono y cierra con una propuesta concreta.</p>
      </div>
      <button className="btn btn--primary btn--full" onClick={onSuggest}><Icons.Sparkles size={16} /> Sugerir respuesta</button>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SCREEN 6 Â· Necesito abrir (apertura para match nuevo)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function OpenerSheet({ matchName = 'Lucía', onClose, onUse }) {
  const [tone, setTone] = React.useState('Desenfadado');
  const [context, setContext] = React.useState('');
  const [selected, setSelected] = React.useState(0);

  const openers = [
    { kind: 'Directa', text: 'Bueno, ya estamos aquí. CuÃ©ntame algo que no se vea en tu perfil.' },
    { kind: 'Juguetona', text: 'Antes de saludarte como Dios manda necesito saber: Â¿cafÃ© o tÃ© por las mañanas? Es importante.' },
    { kind: 'Curiosa', text: 'Vi lo de los conciertos en tu perfil â€” Â¿al Ãºltimo que fuiste mereciÃ³ la pena o salisteis decepcionados?' },
  ];

  return (
    <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '4px 18px 18px'}}>
      <div className="row gap-2" style={{marginBottom: 4, alignItems: 'center'}}>
        <Icons.Sparkles size={18} style={{color: 'var(--accent)'}} />
        <span className="t-h3">Apertura para {matchName}</span>
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
            placeholder="Trabaja en X, le gusta Y, vimos en su perfil queâ€¦"
            style={{fontSize: 14}}
          />
        </div>

        {/* Tone */}
        <div style={{display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4}}>
          {TONES.map(t => (
            <span key={t} className={'chip ' + (tone === t ? 'chip--active' : '')} onClick={() => setTone(t)}>{t}</span>
          ))}
        </div>

        {/* Options */}
        <div className="t-small" style={{fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11, marginBottom: 8}}>Opciones de apertura</div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16}}>
          {openers.map((o, i) => (
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
          ))}
        </div>
      </div>

      <div className="row gap-2" style={{paddingTop: 8}}>
        <button className="btn btn--ghost btn--md" style={{flex: 1, border: '1px solid var(--border-strong)', color: 'var(--text)'}}>
          <Icons.Refresh size={16} /> Regenerar todas
        </button>
        <button className="btn btn--primary btn--md" style={{flex: 1.4}} onClick={onUse}>Usar elegida</button>
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SCREEN 7 Â· PestaÃ±a Plan
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function PlanScreen({ onNavigate, onOpenPlans, onOpenPacks, onOpenHistory }) {
  const total = 30;
  const used = 8;
  const remaining = total - used;
  const pct = Math.max(0, Math.min(1, remaining / total));
  const gaugeColor = pct > 0.25 ? 'var(--success)' : pct > 0.1 ? 'var(--warning)' : 'var(--danger)';
  const r = 78, cx = 100, cy = 100;
  const circ = Math.PI * r;
  const dash = circ * pct;
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const history = [
    { t: '18:42', kind: 'sugerir' },
    { t: '18:39', kind: 'reescribir' },
    { t: '17:14', kind: 'analizar' },
    { t: '12:01', kind: 'abrir' },
  ];

  return (
    <>
      <AppHeader title="Plan" />
      <div className="scroll-y">
        <div style={{padding: 16}}>
          <div className="card" style={{padding: 18}}>
            <div className="t-small" style={{color: 'var(--text-secondary)', marginBottom: 4}}>Plan: GRATUITO</div>
            <button onClick={onOpenHistory} style={{width: '100%', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer'}}>
              <div style={{display: 'flex', justifyContent: 'center'}}>
                <svg width="220" height="130" viewBox="0 0 200 120">
                  <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} stroke="var(--gray-100)" strokeWidth="14" fill="none" strokeLinecap="round" />
                  <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} stroke={gaugeColor} strokeWidth="14" fill="none" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />
                  <text x={cx} y={cy - 14} textAnchor="middle" style={{fontSize: 30, fontWeight: 700, fill: 'var(--text)', letterSpacing: '-0.02em'}}>{remaining}/{total}</text>
                  <text x={cx} y={cy + 8} textAnchor="middle" style={{fontSize: 12, fill: 'var(--text-secondary)'}}>restantes hoy</text>
                </svg>
              </div>
            </button>
            <p className="t-caption" style={{textAlign: 'center', margin: 0}}>Se renueva a las 00:00 (hora local)</p>
          </div>

          <div className="col gap-2" style={{marginTop: 14}}>
            <button className="btn btn--primary btn--full" onClick={onOpenPlans}>Ver planes</button>
            <button className="btn btn--secondary btn--full" onClick={onOpenPacks}>Comprar bolsa</button>
          </div>

          <div className="card" style={{marginTop: 16, padding: 0, overflow: 'hidden'}}>
            <button onClick={() => setHistoryOpen(v => !v)} style={{width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: '12px 14px', textAlign: 'left', display: 'flex', justifyContent: 'space-between'}}>
              <span style={{fontSize: 14.5, fontWeight: 600}}>Historial de uso</span>
              <span className="t-caption">{historyOpen ? '▲' : '▼'}</span>
            </button>
            {historyOpen ? (
              <div style={{borderTop: '1px solid var(--border)'}}>
                {history.map((h, i) => (
                  <div key={i} style={{padding: '10px 14px', borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 10}}>
                    <span className="t-mono" style={{fontSize: 12, width: 38, color: 'var(--text-tertiary)'}}>{h.t}</span>
                    <span className="t-small" style={{flex: 1}}>{h.kind}</span>
                    <span className="t-caption" style={{fontWeight: 600, color: 'var(--accent)'}}>-1 ⚡</span>
                  </div>
                ))}
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SCREEN 8 Â· Cuota agotada (modal full-screen)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
        <h1 className="t-h1" style={{margin: '0 0 8px', maxWidth: 320, textWrap: 'balance'}}>Has agotado tus generaciones de hoy</h1>
        <p style={{margin: '0 0 32px', color: 'var(--text-secondary)', fontSize: 15, maxWidth: 280, textWrap: 'pretty'}}>
          Para seguir, elige una opción. Tu próxima ración llega a las 00:00.
        </p>
        <div className="col gap-2" style={{width: '100%', maxWidth: 320}}>
          <button className="btn btn--primary btn--full" onClick={onOpenPlans}>Subir a Plan Plus</button>
          <button className="btn btn--secondary btn--full" onClick={onOpenPacks}>Comprar bolsa de 200 por €7.99</button>
          <button className="btn btn--text" style={{height: 44, marginTop: 4}} onClick={onClose}>Esperar a 00:00</button>
        </div>
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SCREEN 9 Â· PestaÃ±a Ajustes
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function SettingsScreen({ onNavigate, notificationPermission, notificationPrefs, onToggleNotification, onRequestNotificationPrompt }) {
  const SUPPORT_URL = 'https://tu-link-de-soporte.com';
  const [sheet, setSheet] = React.useState(null);
  const [email] = React.useState('carlos@wafli.app');
  const [alias, setAlias] = React.useState('');
  const [spanishVariant, setSpanishVariant] = React.useState('🌎 Neutro');
  const [toneBase, setToneBase] = React.useState('Desenfadado');
  const [language, setLanguage] = React.useState('ES');
  const [privacyImproveModel, setPrivacyImproveModel] = React.useState(false);
  const [notifications, setNotifications] = React.useState(notificationPrefs || {
    global: false,
    newMessage: true,
    stalled: true,
    quota: true,
    product: false,
  });
  const [cardHolder, setCardHolder] = React.useState('Carlos Méndez');
  const [cardNumber, setCardNumber] = React.useState('4242 4242 4242 4242');

  const rowButtonStyle = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 16px', background: 'transparent', border: 'none',
    borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left',
  };
  const canSaveBilling = cardHolder.trim().length > 0 && cardNumber.replace(/\s/g, '').length >= 12;

  React.useEffect(() => {
    if (notificationPrefs) setNotifications(notificationPrefs);
  }, [notificationPrefs]);
  const setNotification = (key) => {
    if (onToggleNotification) onToggleNotification(key);
    else setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const openSupport = () => window.open(SUPPORT_URL, '_blank', 'noopener,noreferrer');

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
      <AppHeader title="Ajustes" />
      <div className="scroll-y">
        <div style={{padding: 16}}>
          <div className="card" style={{padding: 0, overflow: 'hidden'}}>
            {item(<Icons.User size={17} />, 'Perfil', `${spanishVariant} · ${toneBase}`, () => setSheet('profile'))}
            {item(<Icons.Card size={17} />, 'Plan y facturación', 'Atajo a plan + pago + facturas', () => setSheet('billing'))}
            {item(<Icons.Lock size={17} />, 'Privacidad', 'Datos, exportación y eliminación', () => setSheet('privacy'))}
            {item(<Icons.Bell size={17} />, 'Notificaciones', notifications.global ? 'Encendidas' : 'Apagadas', () => setSheet('notifications'))}
            {item(<Icons.Globe size={17} />, 'Idioma de la app', language, () => setSheet('language'))}
            {item(<Icons.Help size={17} />, 'Soporte', 'FAQ, contacto y estado del servicio', () => setSheet('support'))}
            {item(<Icons.Doc size={17} />, 'Términos legales', 'T&C, privacidad, cookies y DPA', () => setSheet('terms'), true)}
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
          <label className="t-small" style={{fontWeight: 600, marginBottom: 6}}>Email</label>
          <div className="card" style={{padding: '10px 12px', marginBottom: 12, background: 'var(--gray-50)'}}>{email}</div>
          <label className="t-small" style={{fontWeight: 600, marginBottom: 6}}>Variante de español</label>
          <div className="row gap-2" style={{flexWrap: 'wrap', marginBottom: 12}}>
            {['🇪🇸 España', '🇲🇽 México', '🇦🇷 Argentina', '🇨🇱 Chile', '🌎 Neutro'].map((v) => (
              <button key={v} className={'chip ' + (spanishVariant === v ? 'chip--active' : '')} onClick={() => setSpanishVariant(v)}>{v}</button>
            ))}
          </div>
          <label className="t-small" style={{fontWeight: 600, marginBottom: 6}}>Tono base</label>
          <div className="row gap-2" style={{flexWrap: 'wrap', marginBottom: 12}}>
            {['Relajado', 'Desenfadado', 'Picante', 'Intelectual'].map((v) => (
              <button key={v} className={'chip ' + (toneBase === v ? 'chip--active' : '')} onClick={() => setToneBase(v)}>{v}</button>
            ))}
          </div>
          <label className="t-small" style={{fontWeight: 600, marginBottom: 6}}>Nombre o alias (opcional)</label>
          <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Tu alias" style={{width: '100%', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '11px 12px', outline: 'none', fontSize: 15, marginBottom: 14, fontFamily: 'inherit'}} />
          <button className="btn btn--primary btn--full" onClick={() => setSheet(null)}>Guardar</button>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'billing'} onClose={() => setSheet(null)} height="90%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '8px 18px 18px'}}>
          <span className="t-h3" style={{marginBottom: 10}}>Plan y facturación</span>
          <button className="btn btn--primary btn--md" style={{marginBottom: 10}} onClick={() => onNavigate('plan')}>Ir a mi plan</button>
          <label className="t-small" style={{fontWeight: 600, marginBottom: 6}}>Nombre en la tarjeta</label>
          <input value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} placeholder="Ej. Carlos Méndez" style={{width: '100%', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '11px 12px', outline: 'none', fontSize: 15, marginBottom: 12, fontFamily: 'inherit'}} />
          <label className="t-small" style={{fontWeight: 600, marginBottom: 6}}>Número de tarjeta</label>
          <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="4242 4242 4242 4242" inputMode="numeric" style={{width: '100%', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '11px 12px', outline: 'none', fontSize: 15, marginBottom: 12, fontFamily: 'inherit'}} />
          <div className="card" style={{padding: 12, marginBottom: 14}}>
            <div className="t-small" style={{fontWeight: 600, marginBottom: 8}}>Facturas descargables</div>
            <button className="btn btn--secondary btn--md" style={{width: '100%', marginBottom: 6}}>Descargar factura · Abril 2026</button>
            <button className="btn btn--secondary btn--md" style={{width: '100%'}}>Descargar factura · Marzo 2026</button>
          </div>
          <button className="btn btn--primary btn--full" style={{opacity: canSaveBilling ? 1 : 0.55}} disabled={!canSaveBilling} onClick={() => setSheet(null)}>Guardar cambios</button>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'privacy'} onClose={() => setSheet(null)} height="92%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '8px 18px 18px'}}>
          <span className="t-h3" style={{marginBottom: 10}}>Privacidad</span>
          <div className="card" style={{padding: 12, marginBottom: 12}}>
            <div className="t-small" style={{fontWeight: 600, marginBottom: 6}}>Datos almacenados</div>
            <p className="t-caption" style={{margin: 0, color: 'var(--text-secondary)'}}>Guardamos perfil, plan, eventos de uso y mensajes necesarios para generar respuestas. Política completa disponible.</p>
          </div>
          <div className="row" style={{justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
            <span className="t-small" style={{fontWeight: 500}}>Permitir uso de conversaciones para mejorar modelo</span>
            <button className="btn btn--secondary btn--sm" onClick={() => setPrivacyImproveModel(v => !v)}>{privacyImproveModel ? 'ON' : 'OFF'}</button>
          </div>
          <div className="col gap-2">
            <button className="btn btn--secondary btn--md">Descargar mis datos</button>
            <button className="btn btn--secondary btn--md">Borrar todo mi historial</button>
            <button className="btn btn--secondary btn--md" style={{color: 'var(--danger)', borderColor: 'var(--danger)'}}>Eliminar cuenta</button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'notifications'} onClose={() => setSheet(null)} height="82%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '8px 18px 18px', gap: 10}}>
          <span className="t-h3">Notificaciones</span>
          <p className="t-caption" style={{margin: 0, color: 'var(--text-secondary)'}}>
            Permiso del sistema: {notificationPermission || 'default'}
          </p>
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

      <BottomSheet open={sheet === 'language'} onClose={() => setSheet(null)} height="60%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '8px 18px 18px'}}>
          <span className="t-h3" style={{marginBottom: 10}}>Idioma de la app</span>
          {['ES', 'EN', 'PT'].map((opt) => (
            <button key={opt} className={'btn btn--md ' + (language === opt ? 'btn--primary' : 'btn--secondary')} style={{marginBottom: 8}} onClick={() => setLanguage(opt)}>{opt}</button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'support'} onClose={() => setSheet(null)} height="86%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '8px 18px 18px'}}>
          <span className="t-h3" style={{marginBottom: 10}}>Soporte</span>
          <div className="card" style={{padding: 12, marginBottom: 10}}>
            <div className="t-small" style={{fontWeight: 600, marginBottom: 6}}>FAQ</div>
            <div className="t-caption">• ¿Cómo vinculo WhatsApp?</div>
            <div className="t-caption">• ¿Cómo funciona la cuota?</div>
            <div className="t-caption">• ¿Puedo cambiar mi tono base?</div>
          </div>
          <div className="card" style={{padding: 12, marginBottom: 10}}>
            <div className="t-small" style={{fontWeight: 600, marginBottom: 6}}>Contacto</div>
            <div className="t-caption" style={{marginBottom: 8}}>soporte@wafli.app</div>
            <textarea rows={4} placeholder="Cuéntanos tu problema…" style={{width: '100%', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '10px 12px', outline: 'none', fontFamily: 'inherit', fontSize: 14}} />
          </div>
          <button className="btn btn--secondary btn--md" style={{marginBottom: 8}} onClick={openSupport}>Abrir centro de soporte</button>
          <button className="btn btn--text" style={{height: 36}} onClick={openSupport}>Estado del servicio</button>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'terms'} onClose={() => setSheet(null)} height="76%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '8px 18px 18px', gap: 8}}>
          <span className="t-h3">Términos legales</span>
          {['T&C', 'Política de Privacidad', 'Política de Cookies', 'DPA'].map((v) => (
            <button key={v} className="btn btn--secondary btn--md" style={{textAlign: 'left'}}>{v}</button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'logout'} onClose={() => setSheet(null)} height="42%">
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '8px 18px 18px'}}>
          <span className="t-h3" style={{marginBottom: 6}}>Cerrar sesión</span>
          <p className="t-small" style={{margin: '0 0 14px', color: 'var(--text-secondary)'}}>¿Seguro que quieres cerrar sesión en este dispositivo?</p>
          <div className="col gap-2" style={{marginTop: 'auto'}}>
            <button className="btn btn--primary btn--md" onClick={() => { setSheet(null); onNavigate('landing'); }}>Sí, cerrar sesión</button>
            <button className="btn btn--secondary btn--md" onClick={() => setSheet(null)}>Cancelar</button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}

function PlanSelectorSheet({ onChoose }) {
  const [billing, setBilling] = React.useState('monthly');
  const plans = [
    { id: 'free', name: 'Gratis', price: billing === 'monthly' ? '€0' : '€0', quota: '30/día', features: ['Sugerencias básicas', 'Sin compromiso'], current: true },
    { id: 'plus', name: 'Plus', price: billing === 'monthly' ? '€9.99' : '€95', quota: '200/día', features: ['Tonos avanzados', 'Prioridad de generación'] },
    { id: 'pro', name: 'Pro', price: billing === 'monthly' ? '€19.99' : '€190', quota: '500/día', features: ['Máxima cuota', 'Soporte prioritario'] },
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '8px 18px 18px'}}>
      <span className="t-h3" style={{marginBottom: 10}}>Ver planes</span>
      <div className="row gap-2" style={{marginBottom: 12}}>
        <button className={'btn btn--sm ' + (billing === 'monthly' ? 'btn--primary' : 'btn--secondary')} onClick={() => setBilling('monthly')}>Mensual</button>
        <button className={'btn btn--sm ' + (billing === 'yearly' ? 'btn--primary' : 'btn--secondary')} onClick={() => setBilling('yearly')}>Anual (20% dto)</button>
      </div>
      <div className="col gap-2" style={{overflow: 'auto'}}>
        {plans.map((p) => (
          <div key={p.id} className="card" style={{padding: 12}}>
            <div className="row" style={{justifyContent: 'space-between', alignItems: 'baseline'}}>
              <span style={{fontSize: 16, fontWeight: 700}}>{p.name}</span>
              <span className="t-mono" style={{fontWeight: 700}}>{p.price}</span>
            </div>
            <div className="t-caption" style={{margin: '4px 0 8px'}}>{p.quota}</div>
            {p.features.map((f, i) => <div key={i} className="t-small">• {f}</div>)}
            <button className={'btn btn--md ' + (p.current ? 'btn--secondary' : 'btn--primary')} style={{width: '100%', marginTop: 10}} onClick={() => !p.current && onChoose && onChoose(p.id)} disabled={p.current}>
              {p.current ? 'Plan actual' : 'Elegir'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PackSelectorSheet({ onBuy }) {
  const packs = [
    { id: '50', qty: 50, price: 2.99 },
    { id: '200', qty: 200, price: 7.99 },
    { id: '500', qty: 500, price: 14.99 },
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '8px 18px 18px'}}>
      <span className="t-h3" style={{marginBottom: 10}}>Comprar bolsa</span>
      <div className="col gap-2">
        {packs.map((p) => (
          <div key={p.id} className="card" style={{padding: 12}}>
            <div className="row" style={{justifyContent: 'space-between'}}>
              <span style={{fontSize: 15, fontWeight: 600}}>{p.qty} generaciones</span>
              <span className="t-mono" style={{fontWeight: 700}}>€{p.price.toFixed(2)}</span>
            </div>
            <div className="t-caption" style={{marginTop: 4}}>€{(p.price / p.qty).toFixed(3)} por generación</div>
            <button className="btn btn--primary btn--md" style={{width: '100%', marginTop: 10}} onClick={() => onBuy && onBuy(p.id)}>Comprar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsageHistorySheet() {
  const rows = [
    { t: 'Hoy 12:01', k: 'abrir' },
    { t: 'Hoy 11:32', k: 'sugerir' },
    { t: 'Hoy 11:20', k: 'analizar' },
    { t: 'Ayer 20:11', k: 'reescribir' },
    { t: 'Ayer 19:50', k: 'sugerir' },
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '8px 18px 18px'}}>
      <span className="t-h3" style={{marginBottom: 10}}>Historial de uso</span>
      <div className="card" style={{padding: 0, overflow: 'hidden'}}>
        {rows.map((r, i) => (
          <div key={i} style={{display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none'}}>
            <span className="t-caption" style={{width: 70}}>{r.t}</span>
            <span className="t-small" style={{flex: 1}}>{r.k}</span>
            <span className="t-caption" style={{color: 'var(--accent)', fontWeight: 700}}>-1 ⚡</span>
          </div>
        ))}
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
  LandingScreen, AuthScreen, LegalAcceptanceScreen, SpanishVariantScreen, ToneBaseScreen, ConnectScreen, ConnectedSuccessScreen, AddToHomeScreen, StaticInfoScreen, ChatsListScreen, ChatScreen,
  SuggestSheet, RewriteSheet, AnalysisSheet, OpenerSheet, PlanScreen, QuotaExhausted, SettingsScreen,
  PlanSelectorSheet, PackSelectorSheet, UsageHistorySheet, PaymentSuccessSheet,
  Spinner,
});



