const cacheName = 'formkurva-v1';
const appShell = ['/', '/MyHome.html', '/gym.html', '/admin.html', '/manifest.webmanifest'];
self.addEventListener('install', event => { event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(appShell))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => { if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return; event.respondWith(fetch(event.request).catch(() => caches.match(event.request))); });
