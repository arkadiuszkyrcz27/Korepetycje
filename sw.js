// Service worker: pliki aplikacji z pamięci telefonu (szybki start), dane zawsze z chmury.
const WERSJA = "korepetycje-v1";
const PLIKI = ["./", "index.html", "app.css", "app.js", "logika.js", "konfiguracja.js", "supabase.js",
  "manifest.webmanifest", "ikona-192.png", "ikona-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(WERSJA).then(c => c.addAll(PLIKI))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== WERSJA).map(x => caches.delete(x)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;     // Supabase i mapy - zawsze sieć
  // najpierw sieć (świeża wersja po aktualizacji), bez sieci - kopia z pamięci
  e.respondWith(fetch(e.request).then(r => { const k = r.clone(); caches.open(WERSJA).then(c => c.put(e.request, k)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
