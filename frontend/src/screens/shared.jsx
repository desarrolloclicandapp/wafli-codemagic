import React from 'react';
import { Keyboard } from '@capacitor/keyboard';
const { Icons } = window;
// shared.jsx - shared WaFli components (avatars, header, bottom nav, toast, etc.)

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
  const [failedSrc, setFailedSrc] = React.useState('');
  const c = hashColor(name || '?');
  const cls = `avatar avatar--${size}`;
  React.useEffect(() => {
    setFailedSrc('');
  }, [src]);
  if (src && src !== failedSrc) {
    return <img src={src} className={cls} style={{objectFit: 'cover'}} alt={name} onError={() => setFailedSrc(src)} />;
  }
  return (
    <span className={cls} style={{background: c}}>{initials(name || '?')}</span>
  );
}

// iOS-style status bar
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
function AppHeader({ title, leading, trailing, subtitle, showQuota = false }) {
  const shouldShowQuota = showQuota && window.WaFliAPI?.client?.isAuthenticated?.();
  return (
    <div className="appheader">
      <div className="row gap-2" style={{minWidth: 0}}>
        {leading}
        <div className="col" style={{minWidth: 0}}>
          <span className="appheader__title" style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{title}</span>
          {subtitle && <span className="t-caption" style={{marginTop: -2}}>{subtitle}</span>}
        </div>
      </div>
      <div className="row gap-1">
        {shouldShowQuota ? (
          <button
            className="quota-header-button"
            onClick={() => window.dispatchEvent(new CustomEvent('wafli:navigate-plan'))}
            aria-label="Ver cuota de IA"
          >
            <QuotaPill compact />
          </button>
        ) : null}
        {trailing}
      </div>
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
    { id: 'tools', label: 'Herramientas', Icon: Icons.Sparkles },
    { id: 'chats', label: 'Chats', Icon: Icons.Chats },
    { id: 'plan', label: 'Plan', Icon: Icons.Plan },
    { id: 'settings', label: 'Ajustes', Icon: Icons.Settings },
  ];
  return (
    <nav className="botnav" aria-label="Navegación principal">
      {items.map(it => {
        const isActive = active === it.id;
        return (
          <button
            key={it.id}
            className={'botnav__item ' + (isActive ? 'botnav__item--active' : '')}
            onClick={() => onChange && onChange(it.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <it.Icon size={22} sw={isActive ? 2 : 1.75} />
            <span>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function DesktopSidebar({ active, onChange }) {
  const items = [
    { id: 'tools', label: 'Herramientas', helper: 'IA sin WhatsApp', Icon: Icons.Sparkles },
    { id: 'chats', label: 'Chats', helper: 'Conversaciones', Icon: Icons.Chats },
    { id: 'plan', label: 'Plan', helper: 'Cuota y pagos', Icon: Icons.Plan },
    { id: 'settings', label: 'Ajustes', helper: 'Preferencias', Icon: Icons.Settings },
  ];
  return (
    <aside className="desktop-sidebar" aria-label="Navegación principal">
      <div className="desktop-sidebar__brand">
        <span className="desktop-sidebar__logo"><Icons.Logo size={54} /></span>
      </div>
      <nav className="desktop-sidebar__nav">
        {items.map((it) => {
          const isActive = active === it.id;
          return (
            <button
              key={it.id}
              className={'desktop-sidebar__item ' + (isActive ? 'desktop-sidebar__item--active' : '')}
              onClick={() => onChange && onChange(it.id)}
            >
              <it.Icon size={19} sw={isActive ? 2 : 1.7} />
              <span className="col">
                <span className="desktop-sidebar__item-label">{it.label}</span>
                <span className="desktop-sidebar__item-helper">{it.helper}</span>
              </span>
            </button>
          );
        })}
      </nav>
      <div className="desktop-sidebar__footer">
        <span className="t-caption">IA para responder mejor</span>
      </div>
    </aside>
  );
}

const QUOTA_CACHE_KEY = 'wafli:quotaSnapshot';

function readQuotaSnapshot() {
  try {
    const saved = JSON.parse(localStorage.getItem(QUOTA_CACHE_KEY) || 'null');
    if (saved && typeof saved === 'object') return saved;
  } catch (_) {}
  return null;
}

function normalizeQuotaSnapshot(usage = {}) {
  const balance = usage.balance || usage;
  const summary = usage.summary || {};
  const includedLimit = Number(summary.includedLimit ?? balance?.included_limit ?? balance?.total ?? 0);
  const used = Number(summary.usedInPeriod ?? balance?.used_in_period ?? balance?.used ?? 0);
  const packBalance = Number(summary.packBalance ?? balance?.pack_balance ?? 0);
  const total = includedLimit + packBalance;
  const remaining = Number(summary.totalAvailable ?? (Math.max(0, includedLimit - used) + packBalance));
  return {
    total,
    used,
    remaining,
    packBalance,
    plan: balance?.plan_name || '',
    warning80: Boolean(summary.warning80),
    exhausted: Boolean(summary.exhausted),
    updatedAt: Date.now(),
  };
}

// Quota pill
function QuotaPill({ count = null, total = null, compact = false }) {
  const [snapshot, setSnapshot] = React.useState(() => readQuotaSnapshot());
  React.useEffect(() => {
    if (count !== null || total !== null) return undefined;
    let alive = true;
    const load = async () => {
      if (!window.WaFliAPI?.billing?.usage || !window.WaFliAPI?.client?.isAuthenticated?.()) return;
      try {
        const result = await window.WaFliAPI.billing.usage();
        const next = normalizeQuotaSnapshot(result.usage || {});
        localStorage.setItem(QUOTA_CACHE_KEY, JSON.stringify(next));
        if (alive) setSnapshot(next);
      } catch (_) {}
    };
    load();
    const interval = setInterval(load, 60 * 1000);
    window.addEventListener('wafli:quota-refresh', load);
    window.addEventListener('wafli:session-updated', load);
    return () => {
      alive = false;
      clearInterval(interval);
      window.removeEventListener('wafli:quota-refresh', load);
      window.removeEventListener('wafli:session-updated', load);
    };
  }, [count, total]);

  const resolvedTotal = total !== null ? Number(total) : Number(snapshot?.total || 0);
  const resolvedCount = count !== null ? Number(count) : Number(snapshot?.remaining || 0);
  if (!resolvedTotal) {
    return (
      <span className="quota-pill quota-pill--ok">
        <Icons.Bolt size={12} sw={2} fill="currentColor" />
        IA
      </span>
    );
  }
  const ratio = resolvedTotal > 0 ? resolvedCount / resolvedTotal : 0;
  const cls = ratio < 0.1 ? 'quota-pill--low' : ratio < 0.25 ? 'quota-pill--warn' : 'quota-pill--ok';
  return (
    <span className={'quota-pill ' + cls}>
      <Icons.Bolt size={12} sw={2} fill="currentColor" />
      {compact ? resolvedCount : `${resolvedCount}/${resolvedTotal} mensajes IA`}
    </span>
  );
}

// Bottom sheet
function BottomSheet({ open, onClose, height = '75%', children }) {
  const dragStartYRef = React.useRef(null);
  const dismissKeyboard = () => {
    const active = document.activeElement;
    if (active && typeof active.blur === 'function') active.blur();
  };
  const closeSheet = React.useCallback(() => {
    dismissKeyboard();
    onClose && onClose();
  }, [onClose]);
  React.useEffect(() => {
    if (!open) return undefined;
    document.documentElement.classList.add('sheet-open');
    document.body?.classList.add('sheet-open');
    const shouldLockNativeScroll = Boolean(window.WaFliAPI?.client?.IS_CAPACITOR_NATIVE && window.Capacitor?.getPlatform?.() === 'ios');
    if (shouldLockNativeScroll) Keyboard.setScroll({ isDisabled: true }).catch(() => {});
    const handleNativeBack = (event) => {
      event.preventDefault?.();
      closeSheet();
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeSheet();
    };
    window.addEventListener('wafli:native-back', handleNativeBack);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('wafli:native-back', handleNativeBack);
      window.removeEventListener('keydown', handleKeyDown);
      document.documentElement.classList.remove('sheet-open');
      document.body?.classList.remove('sheet-open');
      if (shouldLockNativeScroll) Keyboard.setScroll({ isDisabled: false }).catch(() => {});
    };
  }, [open, closeSheet]);
  if (!open) return null;
  const handleDragStart = (event) => {
    dragStartYRef.current = event.clientY ?? event.touches?.[0]?.clientY ?? null;
  };
  const handleDragEnd = (event) => {
    const startY = dragStartYRef.current;
    dragStartYRef.current = null;
    const endY = event.clientY ?? event.changedTouches?.[0]?.clientY ?? null;
    if (Number.isFinite(startY) && Number.isFinite(endY) && endY - startY > 56) closeSheet();
  };
  const viewportHeight = 'var(--visual-viewport-height)';
  const resolvedHeight = (() => {
    if (typeof height !== 'string') return height;
    const trimmed = height.trim();
    if (!trimmed.endsWith('%')) return trimmed;
    const percent = parseFloat(trimmed);
    if (!Number.isFinite(percent)) return trimmed;
    return `calc(${viewportHeight} * ${percent / 100})`;
  })();
  return (
    <div className="bottom-sheet" role="dialog" aria-modal="true" style={{position: 'fixed', inset: 0, zIndex: 260, animation: 'fade-in 180ms ease-out', overflow: 'hidden', pointerEvents: 'auto', touchAction: 'pan-y', overscrollBehavior: 'contain'}}>
      <button className="bottom-sheet__backdrop" aria-label="Cerrar panel" onClick={closeSheet} style={{position: 'fixed', inset: 0, background: 'rgba(20,20,30,0.32)', border: 0, padding: 0}} />
      <div className="bottom-sheet__panel" style={{
        position: 'fixed', left: 0, right: 0, bottom: 'var(--keyboard-offset)',
        height: resolvedHeight,
        maxHeight: `min(${viewportHeight}, calc(${viewportHeight} - max(12px, var(--safe-top))))`,
        width: '100%',
        maxWidth: '100vw',
        minWidth: '100%',
        minHeight: 0,
        background: 'var(--bg)',
        borderRadius: '20px 20px 0 0',
        boxShadow: 'var(--sh-modal)',
        animation: 'sheet-up 240ms cubic-bezier(.2,.8,.2,1)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        overscrollBehavior: 'contain',
        touchAction: 'pan-y',
        paddingBottom: 'var(--mobile-bottom-guard, var(--safe-bottom))',
      }}
      >
        <button
          type="button"
          className="bottom-sheet__handle"
          aria-label="Cerrar panel"
          onClick={closeSheet}
          onPointerDown={handleDragStart}
          onPointerUp={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchEnd={handleDragEnd}
          style={{display: 'flex', justifyContent: 'center', padding: '8px 0 4px', border: 0, background: 'transparent', width: '100%', cursor: 'grab', touchAction: 'pan-y'}}
        >
          <div style={{width: 36, height: 4, background: 'var(--gray-200)', borderRadius: 2}} />
        </button>
        <div className="bottom-sheet__body" style={{flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y'}}>
          {children}
        </div>
      </div>
    </div>
  );
}

// Full-screen modal
function FullModal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" style={{position: 'fixed', inset: 0, zIndex: 280, background: 'var(--bg)', animation: 'fade-in 200ms ease-out', display: 'flex', flexDirection: 'column', touchAction: 'pan-y', width: '100%', height: 'var(--visual-viewport-height)', maxHeight: 'var(--visual-viewport-height)', overscrollBehavior: 'contain', overflow: 'hidden'}}>
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
    <div className="toast" role="status" aria-live="polite" style={{
      position: 'absolute', left: '50%', bottom: 'calc(80px + var(--mobile-bottom-guard, var(--safe-bottom)))',
      transform: `translateX(-50%) translateY(${visible ? 0 : 20}px)`,
      opacity: visible ? 1 : 0,
      background: 'var(--gray-800)', color: 'white',
      padding: '10px 16px', borderRadius: 10,
      fontSize: 13, fontWeight: 500,
      transition: 'all 200ms', pointerEvents: 'none', zIndex: 320,
      boxShadow: 'var(--sh-modal)',
    }}>{msg}</div>
  );
}

Object.assign(window, { Avatar, hashColor, initials, StatusBar, AppHeader, IconButton, BottomNav, DesktopSidebar, QuotaPill, BottomSheet, FullModal, EmptyState, Toast });
