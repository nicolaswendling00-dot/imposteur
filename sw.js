// Service worker : réseau d'abord, cache en secours (toujours la dernière version, jouable hors ligne).
// cache: 'no-cache' évite le cache HTTP de GitHub Pages (10 min) qui servait encore l'ancienne version.
const CACHE_NAME = 'imposteur-v3';
const COQUILLE = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'data/paires.json',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(cles => Promise.all(cles.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(rep => {
        if (rep.ok && (new URL(req.url).origin === location.origin || req.url.includes('fonts.g'))) {
          const copie = rep.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copie));
        }
        return rep;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
