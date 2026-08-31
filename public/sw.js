// InboxFly Service Worker：静态外壳缓存（API 永远走网络，绝不缓存邮件数据）
const CACHE = 'inboxfly-static-v14';

self.addEventListener('install', e => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;                       // 变更请求直连
  if (url.pathname.startsWith('/api/')) return;                // API/邮件数据不缓存
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(e.request);
    const fresh = fetch(e.request)
      .then(res => { if (res && res.ok) cache.put(e.request, res.clone()); return res; })
      .catch(() => cached || new Response('offline', { status: 503 }));
    return cached || fresh;
  })());
});
