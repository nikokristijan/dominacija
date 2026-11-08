/* Dominacija service worker: osnovni offline shell + push obavijesti.
   API pozivi (/api) se NIKADA ne cachiraju — stanje igre uvijek dolazi sa servera. */
const CACHE = 'dominacija-v1';
const SHELL = ['/', '/prijava', '/icon.svg', '/manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match(req).then((hit) => hit || caches.match('/'))));
  }
});
self.addEventListener('push', (e) => {
  let data = { title: 'Dominacija', body: 'Nova obavijest', url: '/igra' };
  try { data = { ...data, ...e.data.json() }; } catch (_) { /* tekst */ }
  e.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: data.url }, tag: 'dominacija' }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/igra';
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => { for (const c of cs) if ('focus' in c) { c.navigate(url); return c.focus(); } return self.clients.openWindow(url); }));
});
