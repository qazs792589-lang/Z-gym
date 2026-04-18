const CACHE_NAME = 'fitlog-v2';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/store.js',
    './manifest.json',
    './img/coach.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
        .then(response => response || fetch(event.request))
    );
});
