const CACHE = "spirit-island-v2";
const CORE = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "engine.js",
  "manifest.webmanifest",
  "version.json",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "island-hero.png",
  "intro_music.mp3",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((k) =>
        Promise.all(
          k
            .filter((x) => x.startsWith("spirit-island-") && x !== CACHE)
            .map((x) => caches.delete(x)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  if (e.request.mode === "navigate" || u.pathname.endsWith("version.json")) {
    e.respondWith(fetch(e.request).catch(() => caches.match("./")));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(
      (c) =>
        c ||
        fetch(e.request).then((r) => {
          if (r.ok) caches.open(CACHE).then((x) => x.put(e.request, r.clone()));
          return r;
        }),
    ),
  );
});
