// shared.jsx — shared WaFli components (avatars, header, bottom nav, toast, etc.)

// Hash-based color for initial avatars
const AVATAR_COLORS = [
  '#7B89E5', '#8E7BD3', '#5D9C9C', '#C97C5D', '#A88B5F',
  '#7DA37D', '#9577B5', '#6B95C9', '#B57080', '#5F8FA8'
];
function hashColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
}

function Avatar({ name, size = 44, src }) {
  const c = hashColor(name || '?');
  const cls = `avatar avatar--${size}`;
  if (src) {
    return <img src={src} className={cls} style={{objectFit: 'cover'}} alt={name} />;
  }
  return (
    <span className={cls} style={{background: c}}>{initials(name || '?')}</span>
  );
}

// iOS status bar (mock)
function StatusBar({ time = '9:41' }) {
  return (
    <div className="phone__statusbar">
      <span>{time}</span>
      <span className="phone__statusbar-icons">
        <Icons.Cellular size={15} />
        <Icons.Wifi size={14} sw={2} />
        <Icons.Battery size={22} sw={1.5} />
      </span>
    </div>
  );
}

// App header
function AppHeader({ title, leading, trailing, subtitle }) {
  return (
    <div className="appheader">
      <div className="row gap-2" style={{minWidth: 0}}>
        {leading}
        <div className="col" style={{minWidth: 0}}>
          <span className="appheader__title" style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{title}</span>
          {subtitle && <span className="t-caption" style={{marginTop: -2}}>{subtitle}</span>}
        </div>
      </div>
      <div className="row gap-1">{trailing}</div>
    </div>
  );
}

function IconButton({ onClick, children, label }) {
  return (
    <button className="appheader__icon-btn" onClick={onClick} aria-label={label}>{children}</button>
  );
}

// Bottom navigation
function BottomNav({ active, onChange }) {
  const items = [
    { id: 'chats', label: 'Chats', Icon: Icons.Chats },
    { id: 'plan', label: 'Plan', Icon: Icons.Plan },
    { id: 'settings', label: 'Ajustes', Icon: Icons.Settings },
  ];
  return (
    <nav className="botnav">
      {items.map(it => {
        const isActive = active === it.id;
        return (
          <button
            key={it.id}
            className={'botnav__item ' + (isActive ? 'botnav__item--active' : '')}
            onClick={() => onChange && onChange(it.id)}
          >
            <it.Icon size={22} sw={isActive ? 2 : 1.75} />
            <span>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// Quota pill
function QuotaPill({ count = 22, total = 30 }) {
  const ratio = count / total;
  const cls = ratio < 0.1 ? 'quota-pill--low' : ratio < 0.25 ? 'quota-pill--warn' : 'quota-pill--ok';
  return (
    <span className={'quota-pill ' + cls}>
      <Icons.Bolt size={12} sw={2} fill="currentColor" />
      {count} generaciones
    </span>
  );
}

// Bottom sheet
function BottomSheet({ open, onClose, height = '75%', children }) {
  if (!open) return null;
  return (
    <div style={{position: 'absolute', inset: 0, zIndex: 50, animation: 'fade-in 180ms ease-out'}}>
      <div onClick={onClose} style={{position: 'absolute', inset: 0, background: 'rgba(20,20,30,0.32)'}} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height,
        background: 'var(--bg)',
        borderRadius: '20px 20px 0 0',
        boxShadow: 'var(--sh-modal)',
        animation: 'sheet-up 240ms cubic-bezier(.2,.8,.2,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{display: 'flex', justifyContent: 'center', padding: '8px 0 4px'}}>
          <div style={{width: 36, height: 4, background: 'var(--gray-200)', borderRadius: 2}} />
        </div>
        {children}
      </div>
    </div>
  );
}

// Full-screen modal
function FullModal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div style={{position: 'absolute', inset: 0, zIndex: 60, background: 'var(--bg)', animation: 'fade-in 200ms ease-out', display: 'flex', flexDirection: 'column'}}>
      {children}
    </div>
  );
}

// Empty state
function EmptyState({ icon, title, subtitle, cta }) {
  return (
    <div style={{padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16}}>
      <div style={{
        width: 72, height: 72, borderRadius: 18,
        background: 'var(--gray-50)',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--gray-400)'
      }}>{icon}</div>
      <div className="col gap-1" style={{maxWidth: 280}}>
        <span className="t-h3">{title}</span>
        <span className="t-small" style={{color: 'var(--text-secondary)'}}>{subtitle}</span>
      </div>
      {cta && <div style={{marginTop: 8}}>{cta}</div>}
    </div>
  );
}

// Toast
function Toast({ msg, visible }) {
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 80,
      transform: `translateX(-50%) translateY(${visible ? 0 : 20}px)`,
      opacity: visible ? 1 : 0,
      background: 'var(--gray-800)', color: 'white',
      padding: '10px 16px', borderRadius: 10,
      fontSize: 13, fontWeight: 500,
      transition: 'all 200ms', pointerEvents: 'none', zIndex: 100,
      boxShadow: 'var(--sh-modal)',
    }}>{msg}</div>
  );
}

Object.assign(window, { Avatar, hashColor, initials, StatusBar, AppHeader, IconButton, BottomNav, QuotaPill, BottomSheet, FullModal, EmptyState, Toast });
