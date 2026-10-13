// Service worker: guarda o app para funcionar offline na academia.
// Ao mudar qualquer arquivo de app/, aumente VERSAO para o iPhone baixar a nova versão.
const VERSAO = 'academia-v2';
const ARQUIVOS = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/main.js', 'js/progressao.js', 'js/armazenamento.js',
  'data/exercicios.json', 'data/escadas.json', 'data/treinos.json', 'data/guias.json',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  // Fotos dos exercícios (tests/guias.test.js confere que a lista bate com a pasta img/ex/).
  'img/ex/ab_roller-0.jpg', 'img/ex/ab_roller-1.jpg', 'img/ex/bodyweight_squat-0.jpg',
  'img/ex/bodyweight_squat-1.jpg', 'img/ex/bodyweight_walking_lunge-0.jpg', 'img/ex/bodyweight_walking_lunge-1.jpg',
  'img/ex/dumbbell_bench_press-0.jpg', 'img/ex/dumbbell_bench_press-1.jpg', 'img/ex/goblet_squat-0.jpg',
  'img/ex/goblet_squat-1.jpg', 'img/ex/incline_push_up-0.jpg', 'img/ex/incline_push_up-1.jpg',
  'img/ex/inverted_row-0.jpg', 'img/ex/inverted_row-1.jpg', 'img/ex/kettlebell_one_legged_deadlift-0.jpg',
  'img/ex/kettlebell_one_legged_deadlift-1.jpg', 'img/ex/leg_press-0.jpg', 'img/ex/leg_press-1.jpg',
  'img/ex/lying_leg_curls-0.jpg', 'img/ex/lying_leg_curls-1.jpg', 'img/ex/machine_bench_press-0.jpg',
  'img/ex/machine_bench_press-1.jpg', 'img/ex/natural_glute_ham_raise-0.jpg', 'img/ex/natural_glute_ham_raise-1.jpg',
  'img/ex/one_arm_dumbbell_row-0.jpg', 'img/ex/one_arm_dumbbell_row-1.jpg', 'img/ex/pallof_press-0.jpg',
  'img/ex/pallof_press-1.jpg', 'img/ex/parallel_bar_dip-0.jpg', 'img/ex/parallel_bar_dip-1.jpg', 'img/ex/plank-1.jpg',
  'img/ex/pullups-0.jpg', 'img/ex/pullups-1.jpg', 'img/ex/push_ups_close_triceps_position-0.jpg',
  'img/ex/push_ups_close_triceps_position-1.jpg', 'img/ex/pushups-0.jpg', 'img/ex/pushups-1.jpg',
  'img/ex/reverse_hyperextension-0.jpg', 'img/ex/reverse_hyperextension-1.jpg', 'img/ex/scapular_pull_up-0.jpg',
  'img/ex/scapular_pull_up-1.jpg', 'img/ex/seated_cable_rows-0.jpg', 'img/ex/seated_cable_rows-1.jpg',
  'img/ex/seated_dumbbell_press-0.jpg', 'img/ex/seated_dumbbell_press-1.jpg',
  'img/ex/split_squat_with_dumbbells-0.jpg', 'img/ex/split_squat_with_dumbbells-1.jpg',
  'img/ex/stiff_legged_dumbbell_deadlift-0.jpg', 'img/ex/stiff_legged_dumbbell_deadlift-1.jpg',
  'img/ex/suspended_row-0.jpg', 'img/ex/suspended_row-1.jpg', 'img/ex/wide_grip_lat_pulldown-0.jpg',
  'img/ex/wide_grip_lat_pulldown-1.jpg',
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
// Só arquivos do próprio app: o vídeo do YouTube não passa pelo cache.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
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
