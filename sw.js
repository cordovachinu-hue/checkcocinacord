/* ============================================================
   CÓRDOVA RESTAURANTE — Service Worker
   Guarda en caché el "cascarón" de la app (HTML/CSS/JS/íconos)
   para que abra igual sin internet. Así el reloj y las alarmas
   (que son 100% locales) funcionan aunque no haya conexión.
   Sube CACHE_VERSION cada vez que despliegues cambios grandes.
   ============================================================ */

const CACHE_VERSION = "cordova-v1";
const APP_SHELL = [
  "./",
  "index.html",
  "estacion.html",
  "dashboard.html",
  "manifest.json",
  "css/style.css",
  "js/data.js",
  "js/alarms.js",
  "js/estacion.js",
  "js/dashboard.js",
  "js/firebase-init.js",
  "assets/logo.png",
  "assets/icon-192.png",
  "assets/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo controlamos peticiones de nuestro propio origen (mismo dominio).
  // Todo lo externo (Firebase, Google Fonts, Chart.js) va directo a la red:
  // así los datos del dashboard/checklists siempre son en vivo.
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r || caches.match("index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, res.clone()));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
