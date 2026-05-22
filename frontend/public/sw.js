const CACHE_NAME = 'wafli-pwa-v6';
const APP_SHELL = [
  '/manifest.webmanifest',
  '/icons/wafli-icon-192.png',
  '/icons/wafli-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('wafli-pwa-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (
    url.origin !== self.location.origin ||
    request.mode === 'cors' ||
    request.destination === '' ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || !response.ok || response.type === 'opaque') return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      }).catch(() => cached || Response.error());
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = data.target || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'notification-click',
            notificationType: data.notificationType || 'new_message',
            chatId: data.chatId || null
          });
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(target);
      return undefined;
    })
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { title: 'WaFli', body: event.data ? event.data.text() : 'Tienes una novedad.' };
  }

  const title = payload.title || 'WaFli';
  const options = {
    body: payload.body || 'Tienes una novedad en tu WhatsApp.',
    icon: payload.icon || '/icons/wafli-icon-192.png',
    badge: payload.badge || '/icons/wafli-icon-192.png',
    tag: payload.tag || payload.chatId || payload.notificationType || 'wafli',
    renotify: payload.renotify === true,
    data: {
      target: payload.target || '/',
      notificationType: payload.notificationType || 'new_message',
      chatId: payload.chatId || null
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

