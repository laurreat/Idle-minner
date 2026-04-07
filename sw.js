const CACHE_NAME = 'idle-miner-v2';
const ASSETS = [
  './', './index.html', './script.js', './manifest.json',
  './fondo.png',
  './Sprites/miner_idle.png', './Sprites/miner_walk_1.png',
  './Sprites/miner_walk_2.png', './Sprites/miner_walk_reverse_1.png',
  './Sprites/miner_walk_reverse_2.png', './Sprites/miner_elevador_0.png',
  './Sprites/miner_elevador_1.png', './Sprites/miner_elevador_2.png',
  './Sprites/miner_tolva_1.png', './Sprites/miner_tolva_2.png',
  './Sprites/miner_tolva_reverse_1.png', './Sprites/miner_tolva_reverse_2.png',
  './Sprites/miner_tolva_reverse_3.png', './Sprites/miner_tolva_reverse_4.png',
  './Sprites/miner_mine.png', './Sprites/tolva_miner_0.png',
  './Sprites/tolva_miner_1.png', './Sprites/tolva_miner_2.png',
  './Sprites/tolva_miner_3.png',
  './pwa/icon-192.png', './pwa/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res && res.status === 200) caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
      return res;
    }).catch(() => e.request.destination === 'document' ? caches.match('./index.html') : null))
  );
});
