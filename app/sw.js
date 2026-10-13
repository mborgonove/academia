// Service worker: guarda o app para funcionar offline na academia.
// Ao mudar qualquer arquivo de app/, aumente VERSAO para o iPhone baixar a nova versão.
const VERSAO = 'academia-v1';
const ARQUIVOS = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/main.js', 'js/progressao.js', 'js/armazenamento.js',
  'data/exercicios.json', 'data/escadas.json', 'data/treinos.json',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Rede primeiro (pega atualizações quando há internet), cache quando offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const copia = resp.clone();
        caches.open(VERSAO).then((c) => c.put(e.request, copia));
        return resp;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))),
  );
});
