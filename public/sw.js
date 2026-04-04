const CACHE_NAME = 'grinshaw-shell-v1';

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([
      '/icon-192.png',
      '/icon-512.png',
    ]))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const { title, body } = event.data.json();
    event.waitUntil(
      self.registration.showNotification(title ?? "Grinshaw", {
        body: body ?? "",
        icon: "/icon-192.png",
        badge: "/kopf-butler.png",
        data: { url: "/angelegenheiten" },
      })
    );
  } catch { /* malformed push data — ignorieren */ }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(event.notification.data?.url ?? "/");
    })
  );
});
