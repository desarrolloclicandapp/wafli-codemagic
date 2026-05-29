import React from 'react';

const { WaFliApp, RuntimeErrorBoundary, PublicLegalPage } = window;

const PUBLIC_LEGAL_ROUTES = {
  '/terms': 'terms',
  '/terminos': 'terms',
  '/legal/terms': 'terms',
  '/legal/terminos': 'terms',
  '/terms.html': 'terms',
  '/privacy': 'privacy',
  '/privacidad': 'privacy',
  '/legal/privacy': 'privacy',
  '/legal/privacidad': 'privacy',
  '/privacy.html': 'privacy',
  '/cookies': 'cookies',
  '/legal/cookies': 'cookies',
  '/cookies.html': 'cookies',
  '/faq': 'faq',
  '/help': 'faq',
  '/ayuda': 'faq',
  '/legal/faq': 'faq',
  '/faq.html': 'faq',
  '/delete-account': 'deletion',
  '/account-deletion': 'deletion',
  '/data-deletion': 'deletion',
  '/eliminar-cuenta': 'deletion',
  '/eliminacion-cuenta': 'deletion',
  '/legal/delete-account': 'deletion',
  '/legal/data-deletion': 'deletion',
  '/delete-account.html': 'deletion',
  '/data-deletion.html': 'deletion',
};

function currentPublicLegalRoute() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return PUBLIC_LEGAL_ROUTES[path] || null;
}

export function App() {
  const publicLegalType = currentPublicLegalRoute();
  const isNativeRuntime = Boolean(window.WaFliAPI?.client?.IS_CAPACITOR_NATIVE);
  const isPublicWebLegalRoute = Boolean(publicLegalType && !isNativeRuntime);

  React.useEffect(() => {
    document.documentElement.classList.toggle('public-legal-route', isPublicWebLegalRoute);
    document.body?.classList.toggle('public-legal-route', isPublicWebLegalRoute);
    return () => {
      document.documentElement.classList.remove('public-legal-route');
      document.body?.classList.remove('public-legal-route');
    };
  }, [isPublicWebLegalRoute]);

  if (isPublicWebLegalRoute) {
    return (
      <RuntimeErrorBoundary>
        <div className="public-legal-shell">
          <PublicLegalPage type={publicLegalType} />
        </div>
      </RuntimeErrorBoundary>
    );
  }

  return (
    <RuntimeErrorBoundary>
      <div className={'phone ' + (publicLegalType ? 'phone--public-legal-native' : '')}>
        {publicLegalType ? <PublicLegalPage type={publicLegalType} /> : <WaFliApp initialScreen="landing" />}
      </div>
    </RuntimeErrorBoundary>
  );
}
