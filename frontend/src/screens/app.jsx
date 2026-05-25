import React from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';

// Pull dependencies exposed by sibling modules (icons, shared, screens)
// onto window. These imports must run BEFORE this module is evaluated; main.jsx
// guarantees that order via side-effect imports.
const {
  Icons, WaFliAPI,
  BottomSheet, FullModal, Toast, StatusBar, DesktopSidebar,
  LandingScreen, AuthScreen, LegalAcceptanceScreen, SpanishVariantScreen, ToneBaseScreen,
  ConnectScreen, ConnectedSuccessScreen, AddToHomeScreen,
  ChatsListScreen, ChatScreen,
  SuggestSheet, OpenerSheet, RewriteSheet, AnalysisSheet,
  PlanScreen, QuotaExhausted, SettingsScreen,
} = window;
const LOCAL_CONVERSATIONS = [];

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
const PRIVATE_SCREENS = new Set([
  'legal', 'spanish-variant', 'tone-base', 'connect', 'connected', 'install',
  'chats', 'chats-empty', 'chat', 'chat-empty', 'plan', 'settings'
]);
const WHATSAPP_REQUIRED_SCREENS = new Set(['chats', 'chats-empty', 'chat', 'chat-empty']);
const PWA_INSTALL_SEEN_KEY = 'wafli:pwaInstallOpportunitySeen';
const PWA_INSTALLED_KEY = 'wafli:pwaInstalled';

function isPwaStandalone() {
  return Boolean(
    window.navigator?.standalone ||
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.matchMedia?.('(display-mode: fullscreen)')?.matches
  );
}

const screenForOnboardingStep = (nextStep) => {
  const step = String(nextStep || '').replace(/_/g, '-').toLowerCase();
  if (step === 'legal') return 'legal';
  if (step === 'profile' || step === 'spanish-variant') return 'spanish-variant';
  if (step === 'tone' || step === 'tone-base' || step === 'base-tone') return 'tone-base';
  if (step === 'whatsapp' || step === 'connect') return 'connect';
  return 'chats';
};

function AppLoadingScreen({ label = 'Preparando WaFli...' }) {
  return (
    <div className="app-loading">
      <div className="app-loading__mark">
        <Icons.Logo size={34} />
        <span className="app-loading__ring" aria-hidden="true" />
      </div>
      <span className="t-small">{label}</span>
    </div>
  );
}

// WaFliApp - main navigation state machine
function WaFliApp({ initialScreen = 'landing', tweakHook }) {
  const params = new URLSearchParams(window.location.search);
  const allowPreviewNavigation = Boolean(WaFliAPI?.client?.ALLOW_PREVIEW_FALLBACK);
  const isCapacitorNative = Boolean(WaFliAPI?.client?.IS_CAPACITOR_NATIVE);
  const flagScreen = allowPreviewNavigation ? params.get('screen') : null;
  const flagState = allowPreviewNavigation ? params.get('state') : null;
  const flagModal = allowPreviewNavigation ? params.get('modal') : null;
  // Multi-tab navigation: track current tab + screen + active chat
  const [screen, setScreen] = React.useState(flagScreen || initialScreen);
  const [activeChat, setActiveChat] = React.useState('');
  const [sheet, setSheet] = React.useState(null); // 'suggest' | 'reactivate' | 'opener' | 'rewrite' | 'analysis' | null
  const [modal, setModal] = React.useState(flagModal === 'quota' ? 'quota' : null); // 'quota' | null
  const [billingSheet, setBillingSheet] = React.useState(null); // plans | packs | history | success
  const [toast, setToast] = React.useState(null);
  const [analysisMessage, setAnalysisMessage] = React.useState('');
  const [composerSeed, setComposerSeed] = React.useState('');
  const [aiContext, setAiContext] = React.useState(null);
  const [returnScreen, setReturnScreen] = React.useState('landing');
  const [authReady, setAuthReady] = React.useState(false);
  const [theme, setTheme] = React.useState(() => localStorage.getItem('wafli:theme') || 'system');
  const [notificationPermission, setNotificationPermission] = React.useState(
    (typeof Notification !== 'undefined' && Notification.permission) ? Notification.permission : 'default'
  );
  const [notificationPrefs, setNotificationPrefs] = React.useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('wafli:notificationPrefs') || 'null');
      if (saved && typeof saved === 'object') return saved;
    } catch (e) {}
    return {
      global: false,
      newMessage: true,
      stalled: true,
      quota: true,
      product: false,
    };
  });
  const [showNotifPrePrompt, setShowNotifPrePrompt] = React.useState(flagModal === 'notifications');
  const [notifReminderAt, setNotifReminderAt] = React.useState(() => {
    const saved = localStorage.getItem('wafli:notifReminderAt');
    return saved ? Number(saved) : null;
  });
  const [systemState, setSystemState] = React.useState({
    whatsappInterrupted: flagState === 'whatsapp-interrupted',
    whatsappPausedModal: flagState === 'whatsapp-paused',
    offline: flagState === 'offline',
    maintenance: flagState === 'maintenance',
    maintenanceReason: 'Mejora de infraestructura',
    maintenanceUntil: Date.now() + (45 * 60 * 1000),
    systemError: flagState === 'error' ? 'No pudimos completar la accion. Reintenta.' : null,
  });
  const [whatsappState, setWhatsappState] = React.useState({
    ready: false,
    connected: false,
    status: 'unknown',
    phone: null,
    checkedAt: 0,
  });
  const [pwaInstallSeen, setPwaInstallSeen] = React.useState(() => isCapacitorNative || localStorage.getItem(PWA_INSTALL_SEEN_KEY) === '1');
  const [pwaInstalled, setPwaInstalled] = React.useState(() => isCapacitorNative || localStorage.getItem(PWA_INSTALLED_KEY) === '1' || isPwaStandalone());
  const screenRef = React.useRef(initialScreen);
  const sheetRef = React.useRef(sheet);
  const modalRef = React.useRef(modal);
  const billingSheetRef = React.useRef(billingSheet);
  const notifPromptRef = React.useRef(showNotifPrePrompt);

  React.useEffect(() => { setScreen(flagScreen || initialScreen); }, [flagScreen, initialScreen]);
  React.useEffect(() => { screenRef.current = screen; }, [screen]);
  React.useEffect(() => {
    WaFliAPI?.analytics?.trackScreen?.(screen, {
      authenticated: Boolean(WaFliAPI?.client?.isAuthenticated?.()),
      native_app: isCapacitorNative,
    }).catch(() => {});
  }, [screen, isCapacitorNative]);
  React.useEffect(() => { sheetRef.current = sheet; }, [sheet]);
  React.useEffect(() => { modalRef.current = modal; }, [modal]);
  React.useEffect(() => { billingSheetRef.current = billingSheet; }, [billingSheet]);
  React.useEffect(() => { notifPromptRef.current = showNotifPrePrompt; }, [showNotifPrePrompt]);
  React.useEffect(() => {
    let alive = true;
    const boot = async () => {
      if (!WaFliAPI) {
        setAuthReady(true);
        return;
      }
      try {
        if (params.get('logout') === '1' || params.get('fresh') === '1') {
          WaFliAPI.client.clearSession();
          localStorage.removeItem('wafli:notificationPrefs');
          localStorage.removeItem('wafli:notifReminderAt');
          const url = new URL(window.location.href);
          url.searchParams.delete('logout');
          url.searchParams.delete('fresh');
          window.history.replaceState({}, '', url.toString());
          goTo('landing');
          return;
        }
        let shouldRoute = false;
        if (WaFliAPI.client.isAuthenticated()) {
          shouldRoute = true;
          if (WaFliAPI.client.getRefreshToken?.()) await WaFliAPI.auth.refresh().catch(() => null);
        } else if (WaFliAPI.client.getRefreshToken?.()) {
          const restored = await WaFliAPI.auth.refresh().catch(() => null);
          shouldRoute = Boolean(restored?.accessToken);
        }
        if (shouldRoute) {
          const profile = await WaFliAPI.auth.me();
          const user = profile?.user || profile?.account || profile;
          await WaFliAPI.analytics?.setUser?.(user?.id || user?.email || null, {
            auth_state: 'authenticated',
            onboarding_step: profile?.nextStep || '',
          }).catch(() => {});
        }
        if (shouldRoute && alive) {
          if (sessionStorage.getItem('wafli:forceOnboardingFlow') === '1') {
            sessionStorage.removeItem('wafli:forceOnboardingFlow');
            goTo('legal');
            return;
          }
          const status = await WaFliAPI.me.onboardingStatus().catch(() => null);
          goTo(screenForOnboardingStep(status?.nextStep));
        } else if (alive) {
          goTo('landing', { replace: true });
        }
      } catch (error) {
        WaFliAPI.client.clearSession();
        if (alive) {
          goTo('landing', { replace: true });
        }
      } finally {
        if (alive) setAuthReady(true);
      }
    };
    boot();
    return () => { alive = false; };
  }, []);
  React.useEffect(() => {
    localStorage.setItem('wafli:notificationPrefs', JSON.stringify(notificationPrefs));
  }, [notificationPrefs]);
  React.useEffect(() => {
    if (!authReady || !WaFliAPI?.client?.isAuthenticated?.() || !WaFliAPI?.push?.preferences) return undefined;
    let alive = true;
    WaFliAPI.push.preferences()
      .then((result) => {
        if (!alive || !result?.preferences) return;
        const prefs = result.preferences;
        setNotificationPrefs({
          global: Boolean(prefs.global_enabled),
          newMessage: prefs.new_message !== false,
          stalled: prefs.stalled !== false,
          quota: prefs.quota !== false,
        });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [authReady]);
  React.useEffect(() => {
    if (isCapacitorNative || !authReady || notificationPermission !== 'granted' || !notificationPrefs.global || !WaFliAPI?.client?.isAuthenticated?.()) return;
    registerPushSubscription().catch(() => {});
  }, [authReady, isCapacitorNative, notificationPermission, notificationPrefs.global]);
  React.useEffect(() => {
    if (!isCapacitorNative || !authReady || !notificationPrefs.global || !WaFliAPI?.client?.isAuthenticated?.()) return undefined;
    let cancelled = false;
    registerNativePushSubscription().catch(() => {});
    const registrations = [];
    PushNotifications.addListener('registration', async ({ value }) => {
      if (cancelled || !value) return;
      const nativePushPlatform = window.Capacitor?.getPlatform?.() === 'ios' ? 'ios' : 'android';
      await WaFliAPI?.push?.subscribeNative?.({ token: value, platform: nativePushPlatform }).catch(() => {});
      await WaFliAPI?.push?.updatePreferences?.({ global_enabled: true }).catch(() => {});
      setNotificationPermission('granted');
    }).then((handle) => registrations.push(handle)).catch(() => {});
    PushNotifications.addListener('registrationError', () => {
      if (!cancelled) showToast('No pudimos registrar notificaciones en este dispositivo.');
    }).then((handle) => registrations.push(handle)).catch(() => {});
    PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const data = notification?.data || {};
      if (data.chatId) openChat(data.chatId);
      else if (data.notificationType === 'quota_low' || data.notificationType === 'quota_exhausted') goTo('plan');
    }).then((handle) => registrations.push(handle)).catch(() => {});
    return () => {
      cancelled = true;
      registrations.forEach((handle) => handle?.remove?.());
    };
  }, [authReady, isCapacitorNative, notificationPrefs.global]);
  React.useEffect(() => {
    if (theme === 'system') {
      localStorage.removeItem('wafli:theme');
      document.documentElement.removeAttribute('data-theme');
    } else {
      localStorage.setItem('wafli:theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);
  React.useEffect(() => {
    if (isCapacitorNative) {
      window.WaFliInstallPrompt = null;
      localStorage.setItem(PWA_INSTALL_SEEN_KEY, '1');
      localStorage.setItem(PWA_INSTALLED_KEY, '1');
      setPwaInstallSeen(true);
      setPwaInstalled(true);
      return undefined;
    }
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      window.WaFliInstallPrompt = event;
      window.dispatchEvent(new Event('wafli:pwa-install-ready'));
    };
    const handleAppInstalled = () => {
      window.WaFliInstallPrompt = null;
      localStorage.setItem(PWA_INSTALLED_KEY, '1');
      setPwaInstalled(true);
      window.dispatchEvent(new Event('wafli:pwa-installed'));
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isCapacitorNative]);
  React.useEffect(() => {
    const handleSessionCleared = () => {
      WaFliAPI?.analytics?.resetUser?.().catch(() => {});
      setSheet(null);
      setModal(null);
      setBillingSheet(null);
      setActiveChat('');
      goTo('landing');
    };
    window.addEventListener('wafli:session-cleared', handleSessionCleared);
    return () => window.removeEventListener('wafli:session-cleared', handleSessionCleared);
  }, []);
  React.useEffect(() => {
    const handleWhatsappRequired = async () => {
      setSheet(null);
      setModal(null);
      setBillingSheet(null);
      setActiveChat('');
      showToast('Conecta tu WhatsApp para ver chats e IA');
      const status = await WaFliAPI?.me?.onboardingStatus?.().catch(() => null);
      goTo(screenForOnboardingStep(status?.nextStep || 'whatsapp'));
    };
    window.addEventListener('wafli:whatsapp-required', handleWhatsappRequired);
    return () => window.removeEventListener('wafli:whatsapp-required', handleWhatsappRequired);
  }, []);
  React.useEffect(() => {
    const refreshSession = () => {
      if (!WaFliAPI?.auth?.refresh || !WaFliAPI?.client?.getRefreshToken?.()) return;
      WaFliAPI.auth.refresh().catch(() => {});
    };
    const handleVisible = () => {
      if (document.visibilityState === 'visible') refreshSession();
    };
    const interval = setInterval(refreshSession, 10 * 60 * 1000);
    window.addEventListener('focus', refreshSession);
    document.addEventListener('visibilitychange', handleVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshSession);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, []);
  React.useEffect(() => {
    const handleNavigatePlan = () => goTo('plan');
    window.addEventListener('wafli:navigate-plan', handleNavigatePlan);
    return () => window.removeEventListener('wafli:navigate-plan', handleNavigatePlan);
  }, []);
  React.useEffect(() => {
    if (notifReminderAt) localStorage.setItem('wafli:notifReminderAt', String(notifReminderAt));
  }, [notifReminderAt]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };
  React.useEffect(() => {
    const handleQuotaConsumed = (event) => {
      const usage = event?.detail || {};
      const summary = usage.summary || {};
      const balance = usage.balance || {};
      const nextResetAt = summary.nextResetAt || balance.next_reset_at || 'period';
      const warningKey = `wafli:quota80:${balance.plan_name || summary.planName || 'plan'}:${nextResetAt}`;
      if (summary.exhausted) {
        setModal('quota');
        return;
      }
      if (summary.warning80 && localStorage.getItem(warningKey) !== '1') {
        localStorage.setItem(warningKey, '1');
        showToast('Ya usaste el 80% de tu cuota IA');
      }
    };
    window.addEventListener('wafli:quota-consumed', handleQuotaConsumed);
    return () => window.removeEventListener('wafli:quota-consumed', handleQuotaConsumed);
  }, []);
  const retrySystemError = () => {
    setSystemState((s) => ({ ...s, systemError: null }));
    showToast('Reintentando…');
  };

  // Navigation helpers
  const goTo = (s, options = {}) => {
    const target = s || 'landing';
    const current = screenRef.current;
    screenRef.current = target;
    setScreen(target);
    setSheet(null);
    setModal(null);
    setBillingSheet(null);
    setAiContext(null);

    if (typeof window !== 'undefined' && options.history !== false) {
      const currentState = window.history.state || {};
      const nextState = { ...currentState, wafliApp: true, wafliScreen: target };
      if (options.replace) {
        window.history.replaceState(nextState, '', window.location.href);
      } else if (current !== target || currentState.wafliScreen !== target) {
        window.history.pushState(nextState, '', window.location.href);
      }
    }
  };
  const navigate = (tab) => {
    if (tab === 'connect' || tab === 'landing') setActiveChat('');
    goTo(tab);
  };
  const openChat = (id) => { setActiveChat(id); goTo('chat'); };
  const reconnectWhatsApp = () => {
    setSystemState((s) => ({ ...s, whatsappInterrupted: false }));
    goTo('connect');
  };
  const closeTopOverlay = React.useCallback(() => {
    const active = document.activeElement;
    if (active && active !== document.body && typeof active.blur === 'function') {
      active.blur();
      return true;
    }
    const backEvent = new CustomEvent('wafli:native-back', { cancelable: true });
    window.dispatchEvent(backEvent);
    if (backEvent.defaultPrevented) return true;
    if (sheetRef.current || modalRef.current || billingSheetRef.current || notifPromptRef.current) {
      setSheet(null);
      setModal(null);
      setBillingSheet(null);
      setShowNotifPrePrompt(false);
      setAiContext(null);
      return true;
    }
    return false;
  }, []);
  const markInstallOpportunitySeen = React.useCallback(() => {
    localStorage.setItem(PWA_INSTALL_SEEN_KEY, '1');
    setPwaInstallSeen(true);
    if (isCapacitorNative || isPwaStandalone()) {
      localStorage.setItem(PWA_INSTALLED_KEY, '1');
      setPwaInstalled(true);
    }
  }, [isCapacitorNative]);
  const openInstallGuide = React.useCallback((options = {}) => {
    markInstallOpportunitySeen();
    if (isCapacitorNative) return;
    setReturnScreen(options?.returnScreen || screenRef.current || 'chats');
    goTo('install');
  }, [isCapacitorNative, markInstallOpportunitySeen]);
  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const currentState = window.history.state || {};
    if (!currentState.wafliApp) {
      window.history.replaceState(
        { ...currentState, wafliApp: true, wafliScreen: screenRef.current },
        '',
        window.location.href
      );
      window.history.pushState(
        { wafliApp: true, wafliGuard: true, wafliScreen: screenRef.current },
        '',
        window.location.href
      );
    }

    const closeOverlays = () => {
      setSheet(null);
      setModal(null);
      setBillingSheet(null);
      setAiContext(null);
    };

    const handlePopState = (event) => {
      const target = event.state?.wafliScreen;
      const authenticated = Boolean(WaFliAPI?.client?.isAuthenticated?.());

      if (target && target !== screenRef.current) {
        if (authenticated && (target === 'landing' || target === 'auth') && PRIVATE_SCREENS.has(screenRef.current)) {
          window.history.pushState(
            { ...(window.history.state || {}), wafliApp: true, wafliGuard: true, wafliScreen: screenRef.current },
            '',
            window.location.href
          );
          closeOverlays();
          return;
        }
        screenRef.current = target;
        setScreen(target);
        closeOverlays();
        if (target === 'landing' || target === 'connect' || target === 'chats') setActiveChat('');
        return;
      }

      if (authenticated) {
        const fallback = screenRef.current === 'chat' || screenRef.current === 'chat-empty'
          ? 'chats'
          : screenRef.current;
        window.history.pushState(
          { ...(window.history.state || {}), wafliApp: true, wafliGuard: true, wafliScreen: fallback },
          '',
          window.location.href
        );
        if (fallback !== screenRef.current) {
          screenRef.current = fallback;
          setScreen(fallback);
          setActiveChat('');
        }
        closeOverlays();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  React.useEffect(() => {
    if (!isCapacitorNative || !CapacitorApp?.addListener) return undefined;
    let backHandle;
    let disposed = false;
    const navigateBackInsideApp = () => {
      if (closeTopOverlay()) return;
      const current = screenRef.current;
      if (current === 'chat' || current === 'chat-empty') {
        setActiveChat('');
        goTo('chats', { replace: true });
        return;
      }
      if (current === 'plan' || current === 'settings') {
        CapacitorApp.minimizeApp?.();
        return;
      }
      if (current === 'install') {
        goTo(returnScreen || 'chats', { replace: true });
        return;
      }
      if (current === 'auth') {
        goTo('landing', { replace: true });
        return;
      }
      if (current === 'legal') {
        goTo('auth', { replace: true });
        return;
      }
      if (current === 'spanish-variant') {
        goTo('legal', { replace: true });
        return;
      }
      if (current === 'tone-base') {
        goTo('spanish-variant', { replace: true });
        return;
      }
      if (current === 'connect') {
        goTo('tone-base', { replace: true });
        return;
      }
      if (current === 'connected') {
        goTo('connect', { replace: true });
        return;
      }
      if (current === 'chats' || current === 'chats-empty' || current === 'landing') {
        CapacitorApp.minimizeApp?.();
      }
    };
    CapacitorApp.addListener('backButton', navigateBackInsideApp).then((handle) => {
      if (disposed) handle.remove();
      else backHandle = handle;
    });
    return () => {
      disposed = true;
      backHandle?.remove?.();
    };
  }, [closeTopOverlay, isCapacitorNative, returnScreen]);
  const applyWhatsappStatus = React.useCallback((payload) => {
    const status = payload?.status || payload || {};
    const connected = Boolean(status.connected || status.status === 'connected');
    const normalized = {
      ready: true,
      connected,
      status: status.status || (connected ? 'connected' : 'disconnected'),
      phone: status.phone || null,
      checkedAt: Date.now(),
    };

    setWhatsappState((previous) => {
      if (
        previous.ready === normalized.ready &&
        previous.connected === normalized.connected &&
        previous.status === normalized.status &&
        previous.phone === normalized.phone
      ) {
        return { ...previous, checkedAt: normalized.checkedAt };
      }
      return normalized;
    });

    return connected;
  }, []);
  const registerPushSubscription = async () => {
    if (isCapacitorNative) return false;
    const vapidPublicKey = await WaFliAPI?.push?.publicKey?.();
    if (!navigator.serviceWorker?.ready || !vapidPublicKey) return false;
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    await WaFliAPI.push.subscribe(subscription);
    return true;
  };

  const registerNativePushSubscription = async () => {
    if (!isCapacitorNative || !WaFliAPI?.client?.isAuthenticated?.()) return false;
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      setNotificationPermission('denied');
      showToast('Notificaciones bloqueadas. Puedes activarlas en Ajustes de Android.');
      return false;
    }
    setNotificationPermission('granted');
    await PushNotifications.createChannel?.({
      id: 'wafli_default',
      name: 'WaFli',
      description: 'Alertas de chats, cuota y estado de WaFli',
      importance: 5,
      visibility: 1,
      sound: 'default'
    }).catch(() => {});
    await PushNotifications.register();
    return true;
  };

  const askNotificationPermission = async () => {
    if (isCapacitorNative) {
      setNotificationPrefs((prev) => ({ ...prev, global: true }));
      await WaFliAPI?.push?.updatePreferences?.({ global_enabled: true }).catch(() => {});
      const ok = await registerNativePushSubscription().catch(() => false);
      showToast(ok ? 'Notificaciones Android activadas' : 'No pudimos activar notificaciones Android.');
      return ok;
    }
    if (typeof Notification === 'undefined') {
      showToast('Tu navegador no soporta notificaciones.');
      return false;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        showToast('Notificaciones activadas');
        if (await registerPushSubscription().catch(() => false)) {
          await WaFliAPI.push.updatePreferences({ global_enabled: true }).catch(() => {});
          setNotificationPrefs((prev) => ({ ...prev, global: true }));
        } else {
          showToast('Permiso concedido, pero falta configurar VAPID para push.');
        }
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
  const handleAuthReady = async (options = {}) => {
    if (options.forceOnboardingFlow || options.firstTime) {
      goTo('legal');
      return;
    }
    try {
      const status = await WaFliAPI?.me?.onboardingStatus?.();
      goTo(screenForOnboardingStep(status?.nextStep));
    } catch (_) {
      goTo('legal');
    }
  };
  const handleLegalContinue = async () => {
    try {
      await WaFliAPI?.me?.acceptLegal?.({ isAdult: true, termsVersion: '2026-05', privacyVersion: '2026-05' });
    } catch (error) {
      if (WaFliAPI?.client?.isAuthenticated?.()) showToast(WaFliAPI.client.toUserMessage(error));
      return;
    }
    goTo('spanish-variant');
  };
  const handleSpanishContinue = async (spanishVariant = 'España') => {
    try {
      await WaFliAPI?.me?.updateProfile?.({ spanishVariant });
    } catch (error) {
      if (WaFliAPI?.client?.isAuthenticated?.()) showToast(WaFliAPI.client.toUserMessage(error));
      return;
    }
    goTo('tone-base');
  };
  const handleToneContinue = async (baseTone = 'Desenfadado') => {
    try {
      await WaFliAPI?.me?.updateProfile?.({ baseTone });
    } catch (error) {
      if (WaFliAPI?.client?.isAuthenticated?.()) showToast(WaFliAPI.client.toUserMessage(error));
      return;
    }
    goTo('connect');
  };
  const openNotificationPrePrompt = () => {
    if (isCapacitorNative) {
      setNotificationPermission('native-pending');
      setNotificationPrefs((prev) => ({ ...prev, global: true }));
      WaFliAPI?.push?.updatePreferences?.({ global_enabled: true }).catch(() => {});
      registerNativePushSubscription()
        .then((ok) => showToast(ok ? 'Notificaciones Android activadas' : 'No pudimos activar notificaciones Android.'))
        .catch(() => showToast('No pudimos activar notificaciones Android.'));
      return;
    }
    if (notificationPermission === 'granted') return;
    setShowNotifPrePrompt(true);
  };
  const onToggleNotification = (key) => {
    if (key === 'global') {
      const turningOn = !notificationPrefs.global;
      if (turningOn && isCapacitorNative) {
        setNotificationPermission('native-pending');
        setNotificationPrefs((prev) => ({ ...prev, global: true }));
        WaFliAPI?.push?.updatePreferences?.({ global_enabled: true }).catch(() => {});
        registerNativePushSubscription()
          .then((ok) => showToast(ok ? 'Notificaciones Android activadas' : 'No pudimos activar notificaciones Android.'))
          .catch(() => showToast('No pudimos activar notificaciones Android.'));
        return;
      }
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
        if (data.chatId) openChat(data.chatId);
      } else if (data.notificationType === 'quota_low' || data.notificationType === 'quota_exhausted') {
        goTo('plan');
      }
    };
    navigator.serviceWorker?.addEventListener?.('message', handler);
    return () => navigator.serviceWorker?.removeEventListener?.('message', handler);
  }, []);

  React.useEffect(() => {
    if (!authReady) return;
    if (PRIVATE_SCREENS.has(screen) && !WaFliAPI?.client?.isAuthenticated?.()) {
      goTo('landing');
    }
  }, [authReady, screen]);
  React.useEffect(() => {
    if (!authReady || !WaFliAPI?.client?.isAuthenticated?.() || !WHATSAPP_REQUIRED_SCREENS.has(screen)) return undefined;
    let alive = true;
    const guardWhatsappAccess = async () => {
      const status = await WaFliAPI?.me?.onboardingStatus?.().catch(() => null);
      if (!alive || !status) return;
      const target = screenForOnboardingStep(status.nextStep);
      if (target !== 'chats') {
        setActiveChat('');
        goTo(target);
      }
    };
    guardWhatsappAccess();
    return () => { alive = false; };
  }, [authReady, screen]);

  React.useEffect(() => {
    if (!authReady || !WaFliAPI?.client?.isAuthenticated?.()) {
      setWhatsappState({
        ready: false,
        connected: false,
        status: 'unknown',
        phone: null,
        checkedAt: 0,
      });
      return undefined;
    }

    let alive = true;
    let lastConnected = null;

    const refreshWhatsappStatus = async ({ silentInitial = false } = {}) => {
      const result = await WaFliAPI?.whatsapp?.status?.().catch(() => null);
      if (!alive || !result) return;

      const connected = applyWhatsappStatus(result);
      const isProtectedScreen = WHATSAPP_REQUIRED_SCREENS.has(screen);
      const changed = lastConnected !== null && lastConnected !== connected;

      if (connected) {
        setSystemState((state) => ({
          ...state,
          offline: false,
          whatsappInterrupted: false,
        }));

        if (screen === 'connect') {
          if (!silentInitial) {
            showToast('Tu WhatsApp está conectado');
          }
          goTo('connected');
        } else if (changed && isProtectedScreen) {
          setSystemState((state) => ({
            ...state,
            whatsappInterrupted: false,
          }));
        }
      } else if (isProtectedScreen) {
        setActiveChat('');
        setSheet(null);
        setSystemState((state) => ({
          ...state,
          whatsappInterrupted: true,
        }));
        goTo('connect');
      }

      lastConnected = connected;
    };

    refreshWhatsappStatus({ silentInitial: true });

    const intervalMs = screen === 'connect' || screen === 'connected' ? 4000 : 30000;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshWhatsappStatus();
    }, intervalMs);
    const handleFocus = () => refreshWhatsappStatus();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshWhatsappStatus();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      alive = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [authReady, screen, applyWhatsappStatus]);

  // For Tweaks-controlled screen jumping. Disabled outside local preview.
  React.useEffect(() => {
    if (!allowPreviewNavigation || !tweakHook) return;
    const target = tweakHook.screen;
    if (target === 'chats-empty') { goTo('chats'); return; }
    if (target === 'suggest') { setActiveChat(''); setScreen('chat'); setSheet('suggest'); setModal(null); return; }
    if (target === 'opener') { setActiveChat(''); setScreen('chat-empty'); setSheet('opener'); setModal(null); return; }
    if (target === 'quota') { setScreen('chats'); setSheet(null); setModal('quota'); return; }
    if (target === 'chat') { setActiveChat(''); setScreen('chat'); setSheet(null); setModal(null); return; }
    setScreen(target); setSheet(null); setModal(null);
  }, [tweakHook && tweakHook.screen]);

  const isAuthenticated = Boolean(WaFliAPI?.client?.isAuthenticated?.());
  const effectiveScreen = !isAuthenticated && PRIVATE_SCREENS.has(screen) ? 'landing' : screen;
  const whatsappUnavailable = Boolean(whatsappState.ready && !whatsappState.connected);

  let body;
  if (!authReady) {
    body = <AppLoadingScreen />;
  } else if (effectiveScreen === 'landing') {
    body = <LandingScreen onStart={() => goTo('auth')} onLogin={() => goTo('auth')} />;
  } else if (effectiveScreen === 'auth') {
    body = <AuthScreen onBack={() => goTo('landing')} onMagicLink={handleAuthReady} onGoogleContinue={handleAuthReady} onShowToast={showToast} />;
  } else if (effectiveScreen === 'legal') {
    body = <LegalAcceptanceScreen onBack={() => goTo('auth')} onContinue={handleLegalContinue} />;
  } else if (effectiveScreen === 'spanish-variant') {
    body = <SpanishVariantScreen onBack={() => goTo('legal')} onContinue={handleSpanishContinue} />;
  } else if (effectiveScreen === 'tone-base') {
    body = <ToneBaseScreen onBack={() => goTo('spanish-variant')} onContinue={handleToneContinue} />;
  } else if (effectiveScreen === 'connect') {
    body = <ConnectScreen onBack={() => goTo('tone-base')} onConnected={() => { showToast('Tu WhatsApp quedó vinculado'); goTo('connected'); }} />;
  } else if (effectiveScreen === 'connected') {
    body = <ConnectedSuccessScreen isNativeApp={isCapacitorNative} onContinue={() => { markInstallOpportunitySeen(); goTo('chats'); }} onInstall={openInstallGuide} onInstallOpportunitySeen={markInstallOpportunitySeen} />;
  } else if (effectiveScreen === 'install') {
    const installReturnTarget = returnScreen && !['install', 'connected'].includes(returnScreen) ? returnScreen : 'chats';
    body = <AddToHomeScreen
      onBack={() => goTo(returnScreen || 'connected')}
      onDone={() => { markInstallOpportunitySeen(); if (isPwaStandalone()) setPwaInstalled(true); openNotificationPrePrompt(); goTo(installReturnTarget); }}
      onLater={() => { markInstallOpportunitySeen(); goTo(installReturnTarget); }}
    />;
  } else if (effectiveScreen === 'chats' || effectiveScreen === 'chats-empty') {
    body = <ChatsListScreen
      empty={effectiveScreen === 'chats-empty'}
      onOpenChat={openChat}
      onOpenQuota={() => goTo('plan')}
      onNavigate={navigate}
      whatsappInterrupted={systemState.whatsappInterrupted || whatsappUnavailable}
      offline={systemState.offline || whatsappUnavailable}
      onReconnectWhatsApp={reconnectWhatsApp}
    />;
  } else if (effectiveScreen === 'chat') {
    body = <ChatScreen matchId={activeChat} composerSeed={composerSeed} onBack={() => goTo('chats')} onSuggest={(context = {}) => { setAiContext(context); setSheet('suggest'); }} onOpener={() => setSheet('opener')} onReactivate={(context = {}) => { setAiContext(context); setSheet('reactivate'); }} onRewrite={(sourceText = '') => { setComposerSeed(sourceText); setSheet('rewrite'); }} onAnalyze={() => { setAnalysisMessage((LOCAL_CONVERSATIONS.find(m => m.id === activeChat)?.messages || []).slice(-1)[0]?.text || ''); setSheet('analysis'); }} offline={systemState.offline || whatsappUnavailable} showInstallShortcut={Boolean(!isCapacitorNative && whatsappState.connected && pwaInstallSeen && !pwaInstalled)} onInstallApp={() => openInstallGuide({ returnScreen: 'chat' })} aiSheetOpen={Boolean(sheet)} />;
  } else if (effectiveScreen === 'chat-empty') {
    body = <ChatScreen matchId="" composerSeed={composerSeed} onBack={() => goTo('chats')} onSuggest={(context = {}) => { setAiContext(context); setSheet('suggest'); }} onOpener={() => setSheet('opener')} onReactivate={(context = {}) => { setAiContext(context); setSheet('reactivate'); }} onRewrite={(sourceText = '') => { setComposerSeed(sourceText); setSheet('rewrite'); }} onAnalyze={() => { setAnalysisMessage(''); setSheet('analysis'); }} offline={systemState.offline || whatsappUnavailable} showInstallShortcut={Boolean(!isCapacitorNative && whatsappState.connected && pwaInstallSeen && !pwaInstalled)} onInstallApp={() => openInstallGuide({ returnScreen: 'chat-empty' })} aiSheetOpen={Boolean(sheet)} />;
  } else if (effectiveScreen === 'plan') {
    body = <PlanScreen
      onNavigate={navigate}
      onOpenPlans={() => setBillingSheet('plans')}
      onOpenPacks={() => setBillingSheet('packs')}
      onOpenHistory={() => setBillingSheet('history')}
    />;
  } else if (effectiveScreen === 'settings') {
    body = <SettingsScreen onNavigate={navigate} onShowToast={showToast} notificationPermission={notificationPermission} notificationPrefs={notificationPrefs} onToggleNotification={onToggleNotification} onRequestNotificationPrompt={openNotificationPrePrompt} theme={theme} onThemeChange={setTheme} isNativeApp={isCapacitorNative} />;
  } else {
    // Safety fallback: if an unknown screen id is loaded from persisted tweaks/state,
    // render landing instead of leaving a blank screen.
    body = <LandingScreen onStart={() => goTo('auth')} onLogin={() => goTo('auth')} />;
  }

  // Density adjustment
  const densityScale = tweakHook?.density === 'compact' ? 0.92 : tweakHook?.density === 'comfy' ? 1.06 : 1;
  const rootTab = effectiveScreen === 'plan' || effectiveScreen === 'settings' ? effectiveScreen : 'chats';
  const showSidebar = ['chats', 'chats-empty', 'chat', 'chat-empty', 'plan', 'settings'].includes(effectiveScreen);

  return (
    <div className="phone__content" style={{fontSize: `${15 * densityScale}px`}}>
      {showSidebar ? <DesktopSidebar active={rootTab} onChange={navigate} /> : null}
      <main className="app-main">
        {body}
      </main>

      <BottomSheet open={sheet === 'suggest'} onClose={() => { setAiContext(null); setSheet(null); }} height="78%">
        <SuggestSheet chatId={activeChat} quotedMessage={aiContext?.quotedMessage || null} mediaContext={aiContext?.mediaContext || null} onClose={() => { setAiContext(null); setSheet(null); }} onQuota={() => { setAiContext(null); setSheet(null); setModal('quota'); }} onSent={() => { setAiContext(null); setSheet(null); showToast('Mensaje enviado OK'); }} />
      </BottomSheet>

      <BottomSheet open={sheet === 'reactivate'} onClose={() => { setAiContext(null); setSheet(null); }} height="78%">
        <SuggestSheet chatId={activeChat} action="reactivate" title="Reactivar hilo" caption="Una vuelta suave para retomar sin presionar." mediaContext={aiContext?.mediaContext || null} onClose={() => { setAiContext(null); setSheet(null); }} onQuota={() => { setAiContext(null); setSheet(null); setModal('quota'); }} onSent={() => { setAiContext(null); setSheet(null); showToast('Mensaje enviado OK'); }} />
      </BottomSheet>

      <BottomSheet open={sheet === 'opener'} onClose={() => setSheet(null)} height="88%">
        <OpenerSheet chatId={activeChat} matchName={LOCAL_CONVERSATIONS.find(m => m.id === activeChat)?.name || 'Chat'} onClose={() => setSheet(null)} onQuota={() => { setSheet(null); setModal('quota'); }} onUse={(text) => { setComposerSeed(text || ''); setSheet(null); showToast('Apertura insertada en el composer'); }} />
      </BottomSheet>
      <BottomSheet open={sheet === 'rewrite'} onClose={() => setSheet(null)} height="82%">
        <RewriteSheet chatId={activeChat} sourceText={composerSeed} onQuota={() => { setSheet(null); setModal('quota'); }} onUse={(text) => { setComposerSeed(text || ''); setSheet(null); showToast('Texto reescrito cargado en composer'); }} />
      </BottomSheet>
      <BottomSheet open={sheet === 'analysis'} onClose={() => setSheet(null)} height="78%">
        <AnalysisSheet chatId={activeChat} message={analysisMessage} onQuota={() => { setSheet(null); setModal('quota'); }} onSuggest={() => setSheet('suggest')} />
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
            <div className="t-small">- Cuando un match te escriba</div>
            <div className="t-small">- Cuando una conversación se enfríe</div>
            <div className="t-small">- Avisos de cuota</div>
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
          <h2 className="t-h2" style={{marginTop: 0}}>Tu WhatsApp pausó la conexión un rato</h2>
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

// Billing sheets used by WaFliApp
function nativePaymentsBlocked() {
  const caps = WaFliAPI?.billing?.capabilities?.();
  return Boolean(caps?.nativePurchases?.nativePurchasePlatform && !caps?.nativePurchases?.nativePurchasesConfigured && !caps?.externalCheckoutAllowed);
}

function NativePaymentsNotice() {
  if (!nativePaymentsBlocked()) return null;
  return (
    <div className="card" style={{padding: 12, borderColor: 'rgba(14, 165, 143, 0.18)', background: 'var(--accent-soft)'}}>
      <div className="t-small" style={{fontWeight: 800, color: 'var(--accent)', marginBottom: 4}}>Compras nativas</div>
      <div className="t-caption" style={{color: 'var(--text-secondary)'}}>
        Las compras dentro de Android se habilitan con Google Play Billing. Esta version no abre pagos externos.
      </div>
    </div>
  );
}

function PlanSelectorSheet({ onChoose }) {
  const [period, setPeriod] = React.useState('monthly');
  const [loadingPlan, setLoadingPlan] = React.useState('');
  const [error, setError] = React.useState('');
  const blocked = nativePaymentsBlocked();
  const plans = [
    { id: 'free', name: 'Gratis', monthly: '€0', yearly: '€0', quota: '5 generaciones/día', features: ['Sugerir y reescribir', 'No acumulable'] },
    { id: 'plus', name: 'Plus', monthly: '€4.99/mes', yearly: 'Pronto', quota: '150 generaciones/mes', features: ['Más generaciones mensuales', 'Sugerir, reescribir y abrir'] },
  ];
  return (
    <div style={{padding: '8px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10}}>
      <span className="t-h3">Selector de plan</span>
      <div className="row gap-2">
        <button className={'btn btn--sm ' + (period === 'monthly' ? 'btn--primary' : 'btn--secondary')} onClick={() => setPeriod('monthly')}>Mensual</button>
        <button className="btn btn--sm btn--secondary" disabled style={{opacity: 0.55}}>Anual pronto</button>
      </div>
      <NativePaymentsNotice />
      {plans.map((p) => (
        <div key={p.id} className="card" style={{padding: 12}}>
          <div className="row" style={{justifyContent: 'space-between', alignItems: 'center'}}>
            <span style={{fontWeight: 700}}>{p.name}</span>
            <span className="t-small" style={{fontWeight: 700}}>{period === 'monthly' ? p.monthly : p.yearly}</span>
          </div>
          <p className="t-caption" style={{margin: '4px 0 8px'}}>{p.quota}</p>
          {p.features.map((f, i) => <div key={i} className="t-small">- {f}</div>)}
          {p.id === 'free' ? (
            <span className="t-caption" style={{display: 'inline-block', marginTop: 8}}>Plan gratuito</span>
          ) : (
            <button className="btn btn--primary btn--md" style={{marginTop: 10}} disabled={loadingPlan === p.id} onClick={async () => {
              if (blocked) {
                setError('Las compras nativas todavia no estan configuradas para esta version.');
                return;
              }
              setLoadingPlan(p.id);
              setError('');
              try {
                if (WaFliAPI?.billing?.checkoutPlan && WaFliAPI?.client?.isAuthenticated?.()) {
                  const result = await WaFliAPI.billing.checkoutPlan(p.id);
                  if (result.url) {
                    window.location.href = result.url;
                    return;
                  }
                }
                onChoose && onChoose();
              } catch (apiError) {
                setError(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No pudimos abrir el checkout.');
              } finally {
                setLoadingPlan('');
              }
            }}>{loadingPlan === p.id ? 'Abriendo...' : 'Elegir'}</button>
          )}
        </div>
      ))}
      {error ? <p className="t-caption" style={{color: 'var(--danger)', margin: 0}}>{error}</p> : null}
    </div>
  );
}

function PackSelectorSheet({ onBuy }) {
  const [loadingPack, setLoadingPack] = React.useState('');
  const [error, setError] = React.useState('');
  const blocked = nativePaymentsBlocked();
  const packs = [
    { qty: 50, price: '€2.99' },
  ];
  return (
    <div style={{padding: '8px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10}}>
      <span className="t-h3">Comprar packs</span>
      <NativePaymentsNotice />
      {packs.map((p, i) => (
        <div key={i} className="card" style={{padding: 12}}>
          <div className="row" style={{justifyContent: 'space-between', alignItems: 'center'}}>
            <span style={{fontWeight: 700}}>{p.qty} mensajes IA</span>
            <span className="t-small" style={{fontWeight: 700}}>{p.price}</span>
          </div>
          <p className="t-caption" style={{margin: '4px 0 10px'}}>No caducan nunca.</p>
          <button className="btn btn--primary btn--md" disabled={loadingPack === String(p.qty)} onClick={async () => {
            if (blocked) {
              setError('Las compras nativas todavia no estan configuradas para esta version.');
              return;
            }
            setLoadingPack(String(p.qty));
            setError('');
            try {
              if (WaFliAPI?.billing?.checkoutPack && WaFliAPI?.client?.isAuthenticated?.()) {
                const result = await WaFliAPI.billing.checkoutPack(p.qty);
                if (result.url) {
                  window.location.href = result.url;
                  return;
                }
              }
              onBuy && onBuy();
            } catch (apiError) {
              setError(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No pudimos abrir el checkout.');
            } finally {
              setLoadingPack('');
            }
          }}>{loadingPack === String(p.qty) ? 'Abriendo...' : 'Comprar'}</button>
        </div>
      ))}
      {error ? <p className="t-caption" style={{color: 'var(--danger)', margin: 0}}>{error}</p> : null}
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
    opener: 'Apertura de conversación',
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
    opener: 'Se gastó al pedir una apertura.',
    reactivate: 'Se gastó al reactivar un hilo frío.',
    analyze: 'Se gastó al analizar un mensaje.'
  }[String(row.action || '').toLowerCase()] || 'Se gastó al usar una acción de IA.';
  return { detail, reason, statusLabel };
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
        if (alive) setError(WaFliAPI?.client?.toUserMessage?.(apiError) || 'No pudimos cargar el historial.');
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, []);
  return (
    <div style={{padding: '8px 18px 18px'}}>
      <span className="t-h3" style={{display: 'block', marginBottom: 4}}>Historial detallado</span>
      <p className="t-caption" style={{margin: '0 0 12px', color: 'var(--text-secondary)'}}>Cada fila muestra qué acción consumió cuota y en qué chat ocurrió.</p>
      <div className="card" style={{padding: 0}}>
        {loading ? (
          <div style={{padding: '12px'}}><span className="t-small">Cargando historial...</span></div>
        ) : error ? (
          <div style={{padding: '12px'}}><span className="t-small" style={{color: 'var(--danger)'}}>{error}</span></div>
        ) : rows.length ? rows.map((r, i) => (
          <div key={i} style={{padding: '12px', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 10, alignItems: 'flex-start'}}>
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

// Phone wrapper (statusbar + WaFliApp)
function Phone({ initialScreen = 'landing', tweakHook }) {
  return (
    <div className="phone">
      <StatusBar />
      <WaFliApp initialScreen={initialScreen} tweakHook={tweakHook} />
    </div>
  );
}

// Runtime error boundary
class RuntimeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    this.lastError = error;
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding: 16, fontFamily: 'system-ui, sans-serif'}}>
          <h2 style={{margin: '0 0 8px'}}>Algo no cargó bien</h2>
          <p style={{margin: '0 0 8px'}}>Actualiza la página e inténtalo de nuevo.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Expose for sibling modules and the production entry point.
Object.assign(window, {
  WaFliApp,
  Phone,
  PlanSelectorSheet,
  PackSelectorSheet,
  UsageHistorySheet,
  PaymentSuccessSheet,
  RuntimeErrorBoundary,
});


