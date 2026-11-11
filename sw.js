// Caches the app so it opens with no internet. Bump VERSION after changing any file.
const VERSION = 'skyware-leads-test-v16';
const OCR_CACHE = 'skyware-ocr-5.1.1';   // card reader files (~7 MB); kept across app updates
const FILES = ['./', 'index.html', 'app.js', 'card.js', 'config.js', 'xlsx.js', 'brand.css', 'app.css',
  'logo.png', 'logo-rv.png', 'icon-180.png', 'icon-512.png', 'manifest.webmanifest',
  'ocr/tesseract.min.js', 'ocr/worker.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== OCR_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Big OCR engine + language files: cache first (they never change for a given version).
  if (url.origin === location.origin && /\/ocr\/.+\.(wasm\.js|wasm|traineddata\.gz)$/.test(url.pathname)) {
    e.respondWith(caches.open(OCR_CACHE).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }))));
    return;
  }
  // Everything else: network first (so updates arrive when online), cache when offline.
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && url.origin === location.origin) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
