const CACHE = "spirit-island-v11";
const CORE = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "engine.js",
  "cinema3d.js",
  "vendor/three.module.min.js",
  "vendor/three.core.min.js",
  "manifest.webmanifest",
  "version.json",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "island-hero.png",
  "council-stage.png",
  "island_intro_music.mp3",
  "characters/faces/Alex.jpg",
  "characters/faces/Billy.jpg",
  "characters/faces/Catherine.jpg",
  "characters/faces/demarin.jpg",
  "characters/faces/elisa.jpg",
  "characters/faces/Ester.jpg",
  "characters/faces/Eva.jpg",
  "characters/faces/Evaggelia.jpg",
  "characters/faces/evelyn.jpg",
  "characters/faces/hope.jpg",
  "characters/faces/Ian.jpg",
  "characters/faces/irene.jpg",
  "characters/faces/Jasmine.jpg",
  "characters/faces/Luna.jpg",
  "characters/faces/Paul.jpg",
  "characters/faces/pauline.jpg",
  "characters/faces/phillip.jpg",
  "characters/faces/rino.jpg",
  "characters/faces/sargenie.jpg",
  "characters/faces/smaragda.jpg",
  "characters/faces/Sorina.jpg",
  "characters/faces/tony.jpg",
  "characters/faces/vicky.jpg",
  "characters/faces/Vincent.jpg",
  "characters/faces/Violet.jpg",
  "characters/faces/zoe.jpg",
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
