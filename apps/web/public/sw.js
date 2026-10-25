// The app shell for offline use. Static assets cache-first; pages network-first with the last copy
// (or /offline) when there is no network. API calls are never cached. Sign-out clears these caches.
const CACHE = "pluck-shell-v1";
const PAGES = /^\/(inbox|later|archive|items\/[a-f0-9]{24})$/;

// The offline page and what it needs to look right (its scripts, styles and the fonts they name): on a first visit
// the page's own assets loaded before this worker was there to keep them.
const found = (text) => text.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? [];
async function keepOffline(c) {
  const res = await fetch("/offline");
  if (!res.ok) throw new Error(`/offline: ${res.status}`);
  const assets = new Set(found(await res.clone().text()));
  for (const css of [...assets].filter((a) => a.endsWith(".css"))) {
    const sheet = await fetch(css).catch(() => null);
    if (sheet?.ok) found(await sheet.text()).forEach((a) => assets.add(a));
  }
  await Promise.all([...assets].map((a) => c.match(a).then((hit) => hit || c.add(a)).catch(() => {})));
  await c.put("/offline", res);
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(keepOffline));
});

// The app tells us its language on every load (components/Offline.tsx). When it is not the one the offline page was
// kept in (a new install, or a change in Settings or the site footer), the page is kept again in it, through the
// pluck_locale cookie this request carries, and pages kept in the old language go until they are visited again.
const LOCALE = "/__pluck/locale";
self.addEventListener("message", (event) => {
  const locale = event.data?.locale;
  if (typeof locale !== "string") return;
  event.waitUntil(
    caches.open(CACHE).then(async (c) => {
      const kept = await c.match(LOCALE);
      if (kept && (await kept.text()) === locale) return;
      await keepOffline(c);
      for (const req of await c.keys()) if (PAGES.test(new URL(req.url).pathname)) await c.delete(req);
      await c.put(LOCALE, new Response(locale));
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|woff2)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => (res.ok && caches.open(CACHE).then((c) => c.put(req, res.clone())), res))),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && PAGES.test(url.pathname)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(() => caches.match(url.pathname).then((hit) => hit || caches.match("/offline"))),
    );
  }
});
