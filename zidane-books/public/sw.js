// Zidane Books service worker: makes the app installable, opens fast on a weak connection, and shows push alerts.
// Data (/api) is never cached: figures always come live from the server.
const SHELL = "zb-shell-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/", OFFLINE, "/icons/icon-192.png", "/favicon.svg", "/logo-white.svg"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  // pages: network first (always the latest app), the cached shell when offline
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(SHELL).then((c) => c.put("/", copy)); return r; })
      .catch(() => caches.match("/").then((r) => r || caches.match(OFFLINE))));
    return;
  }
  // built files have a hash in their name, so a cached copy is always right
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(SHELL).then((c) => c.put(e.request, copy)); } return r; })));
  }
});

// push alerts from the server (same as the bell in the app)
self.addEventListener("push", (e) => {
  let n = {};
  try { n = e.data ? e.data.json() : {}; } catch { n = { title: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(n.title || "Zidane Books", {
    body: n.body || "", icon: "/icons/icon-192.png", badge: "/icons/badge-96.png", tag: n.tag || undefined, data: { link: n.link || "/" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const link = e.notification.data?.link || "/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
    const w = wins.find((x) => new URL(x.url).origin === location.origin);
    if (w) { w.focus(); return w.navigate(link); }
    return self.clients.openWindow(link);
  }));
});
