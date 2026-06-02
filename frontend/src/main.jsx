import React from 'react';
import ReactDOM from 'react-dom/client';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { Keyboard } from '@capacitor/keyboard';

import './styles.css';
import './api/index.js';      // window.WaFliAPI
import { installClientMonitoring } from './api/monitoring.js';
import { initializeAnalytics } from './api/analytics.js';

// Side-effect imports that populate window with the screen graph.
// Order matters: each module reads what the previous ones exposed.
import './screens/icons.jsx';   // window.Icons, window.Icon
import './screens/shared.jsx';  // Avatar, StatusBar, AppHeader, IconButton, BottomNav, QuotaPill, BottomSheet, FullModal, EmptyState, Toast
import './screens/screens.jsx'; // LandingScreen, AuthScreen, ..., SuggestSheet, OpenerSheet, ...
import './screens/app.jsx';     // WaFliApp, Phone, PlanSelectorSheet, ..., RuntimeErrorBoundary

import { App } from './App.jsx';

const AdminPanelApp = React.lazy(() =>
  import('./admin/AdminPanelApp.jsx').then((module) => ({ default: module.AdminPanelApp }))
);

const KEYBOARD_OFFSET_THRESHOLD = 80;
const KEYBOARD_FOCUS_SELECTOR = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]';
let stableViewportHeight = 0;
let stableViewportWidth = 0;
let viewportFrame = 0;
let nativeKeyboardHeight = 0;
let nativeKeyboardVisible = false;

const detectMobilePlatform = () => {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const isIPadOSDesktopMode = platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || isIPadOSDesktopMode;
  const isAndroid = /Android/i.test(ua);
  const isNative = Boolean(window.WaFliAPI?.client?.IS_CAPACITOR_NATIVE);
  const coarsePointer = Boolean(window.matchMedia?.('(pointer: coarse)')?.matches);
  const narrowViewport = Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 820;
  const mobileBrowser = /Mobile|Android|iPhone|iPod|IEMobile|Opera Mini/i.test(ua) || (isIOS && coarsePointer);
  const isMobileWeb = !isNative && Boolean(coarsePointer && narrowViewport && (mobileBrowser || isIOS || isAndroid));
  const isStandalone = Boolean(
    window.navigator?.standalone ||
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.matchMedia?.('(display-mode: fullscreen)')?.matches
  );
  const root = document.documentElement;
  const body = document.body;
  const appRoot = document.getElementById('root');
  const classTargets = [root, body, appRoot].filter(Boolean);

  classTargets.forEach((target) => {
    target.classList.toggle('cap-ios', isIOS);
    target.classList.toggle('cap-android', isAndroid);
    target.classList.toggle('cap-native', isNative);
    target.classList.toggle('web-mobile', isMobileWeb);
    target.classList.toggle('web-ios', isMobileWeb && isIOS);
    target.classList.toggle('web-android', isMobileWeb && isAndroid);
    target.classList.toggle('pwa-standalone', isStandalone);
  });
  root.dataset.mobilePlatform = isIOS ? 'ios' : isAndroid ? 'android' : 'web';
  if (body) body.dataset.mobilePlatform = root.dataset.mobilePlatform;
  if (appRoot) appRoot.dataset.mobilePlatform = root.dataset.mobilePlatform;
};

const hasKeyboardFocus = () => {
  const active = document.activeElement;
  if (!active || active === document.body || active === document.documentElement) return false;
  return Boolean(active.matches?.(KEYBOARD_FOCUS_SELECTOR) || active.closest?.('[contenteditable="true"], [contenteditable=""]'));
};

const applyViewportBounds = () => {
  viewportFrame = 0;
  const root = document.documentElement;
  const visual = window.visualViewport;
  const layoutWidth = Math.ceil(window.innerWidth || root.clientWidth || 0);
  const layoutHeight = Math.ceil(window.innerHeight || root.clientHeight || 0);
  const visualWidth = Math.ceil(visual?.width || layoutWidth || 0);
  const visualHeight = Math.ceil(visual?.height || layoutHeight || 0);
  const visualOffsetTop = Math.ceil(visual?.offsetTop || 0);
  const focused = hasKeyboardFocus();

  if (!stableViewportWidth || !focused) stableViewportWidth = layoutWidth || visualWidth || stableViewportWidth;
  if (!stableViewportHeight || !focused) stableViewportHeight = layoutHeight || visualHeight || stableViewportHeight;

  const baseHeight = stableViewportHeight || layoutHeight || visualHeight;
  const rawKeyboardOffset = Math.max(0, baseHeight - visualHeight - visualOffsetTop);
  const viewportKeyboardOffset = focused && rawKeyboardOffset > KEYBOARD_OFFSET_THRESHOLD ? Math.ceil(rawKeyboardOffset) : 0;
  const pluginKeyboardOffset = nativeKeyboardVisible ? Math.max(0, Math.ceil(nativeKeyboardHeight || 0)) : 0;
  const keyboardOffset = (focused || nativeKeyboardVisible) ? Math.max(viewportKeyboardOffset, pluginKeyboardOffset) : 0;
  const visibleHeight = keyboardOffset > 0
    ? Math.max(320, baseHeight - keyboardOffset)
    : (visualHeight || baseHeight);

  root.style.setProperty('--viewport-width', `${stableViewportWidth || layoutWidth || visualWidth}px`);
  root.style.setProperty('--viewport-height', `${baseHeight}px`);
  root.style.setProperty('--visual-viewport-width', `${visualWidth || stableViewportWidth || layoutWidth}px`);
  root.style.setProperty('--visual-viewport-height', `${visualHeight || baseHeight}px`);
  root.style.setProperty('--keyboard-visible-height', `${visibleHeight}px`);
  root.style.setProperty('--keyboard-offset', `${keyboardOffset}px`);
  const keyboardOpen = keyboardOffset > 0;
  root.classList.toggle('keyboard-open', keyboardOpen);
  document.body?.classList.toggle('keyboard-open', keyboardOpen);
};

const syncViewportBounds = () => {
  if (viewportFrame) window.cancelAnimationFrame(viewportFrame);
  viewportFrame = window.requestAnimationFrame(applyViewportBounds);
};

const resetStableViewportBounds = () => {
  stableViewportHeight = 0;
  stableViewportWidth = 0;
  syncViewportBounds();
  window.setTimeout(syncViewportBounds, 260);
};

window.addEventListener('load', syncViewportBounds, { passive: true });
window.addEventListener('resize', syncViewportBounds, { passive: true });
window.addEventListener('resize', detectMobilePlatform, { passive: true });
window.addEventListener('focusin', syncViewportBounds, { passive: true });
window.addEventListener('focusout', () => window.setTimeout(syncViewportBounds, 80), { passive: true });
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncViewportBounds, { passive: true });
  window.visualViewport.addEventListener('scroll', syncViewportBounds, { passive: true });
}
window.addEventListener('orientationchange', resetStableViewportBounds, { passive: true });
window.addEventListener('orientationchange', detectMobilePlatform, { passive: true });
if (window.WaFliAPI?.client?.IS_CAPACITOR_NATIVE) {
  Keyboard.setAccessoryBarVisible?.({ isVisible: false }).catch(() => {});
  Keyboard.addListener('keyboardWillShow', (info) => {
    nativeKeyboardVisible = true;
    nativeKeyboardHeight = Number(info?.keyboardHeight || 0);
    syncViewportBounds();
  }).catch(() => {});
  Keyboard.addListener('keyboardDidShow', (info) => {
    nativeKeyboardVisible = true;
    nativeKeyboardHeight = Number(info?.keyboardHeight || nativeKeyboardHeight || 0);
    syncViewportBounds();
  }).catch(() => {});
  Keyboard.addListener('keyboardWillHide', () => {
    nativeKeyboardVisible = false;
    nativeKeyboardHeight = 0;
    syncViewportBounds();
  }).catch(() => {});
  Keyboard.addListener('keyboardDidHide', () => {
    nativeKeyboardVisible = false;
    nativeKeyboardHeight = 0;
    window.setTimeout(syncViewportBounds, 60);
  }).catch(() => {});
}

detectMobilePlatform();
syncViewportBounds();
installClientMonitoring();
initializeAnalytics().catch(() => {});

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault?.();
  window.location.reload();
});

const isCapacitorNativeRuntime = Boolean(window.WaFliAPI?.client?.IS_CAPACITOR_NATIVE);
const isAdminPanelRoute = window.location.pathname.replace(/\/+$/, '') === '/adminpanel';

if (isCapacitorNativeRuntime && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations?.()
    .then((registrations) => registrations.forEach((registration) => registration.unregister()))
    .catch(() => {});
  window.caches?.keys?.()
    .then((keys) => Promise.all(keys.map((key) => window.caches.delete(key))))
    .catch(() => {});
}

const socialLoginConfig = {};
const nativePlatform = window.Capacitor?.getPlatform?.() || '';

const canInitializeGoogleSocialLogin = Boolean(
  window.WaFliAPI?.client?.GOOGLE_CLIENT_ID &&
  (!isCapacitorNativeRuntime || nativePlatform !== 'ios' || window.WaFliAPI?.client?.GOOGLE_IOS_CLIENT_ID)
);

if (canInitializeGoogleSocialLogin) {
  socialLoginConfig.google = {
    webClientId: window.WaFliAPI.client.GOOGLE_CLIENT_ID,
    iOSServerClientId: window.WaFliAPI.client.GOOGLE_CLIENT_ID,
    mode: 'online',
  };
  if (window.WaFliAPI.client.GOOGLE_IOS_CLIENT_ID) {
    socialLoginConfig.google.iOSClientId = window.WaFliAPI.client.GOOGLE_IOS_CLIENT_ID;
  }
}

if (window.WaFliAPI?.client?.APPLE_CLIENT_ID || (isCapacitorNativeRuntime && nativePlatform === 'ios' && window.WaFliAPI?.client?.APPLE_IOS_CLIENT_ID)) {
  socialLoginConfig.apple = nativePlatform === 'ios'
    ? {
      clientId: window.WaFliAPI.client.APPLE_IOS_CLIENT_ID || 'com.wafli.app',
    }
    : {
      clientId: window.WaFliAPI.client.APPLE_CLIENT_ID,
      redirectUrl: window.WaFliAPI.client.APPLE_REDIRECT_URI,
      useProperTokenExchange: true,
    };
}

if (Object.keys(socialLoginConfig).length) {
  SocialLogin.initialize(socialLoginConfig).catch(() => {});
  window.WaFliSocialLogin = SocialLogin;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdminPanelRoute ? (
      <React.Suspense fallback={<main className="admin-shell admin-shell--center">Cargando admin...</main>}>
        <AdminPanelApp nativeBlocked={isCapacitorNativeRuntime} />
      </React.Suspense>
    ) : <App />}
  </React.StrictMode>
);

if (import.meta.env.PROD && !isCapacitorNativeRuntime && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      return registration.update();
    }).catch(() => {});
  });
}

