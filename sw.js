var CACHE = 'familytree-shell-v1';
var SHELL = [
  './',
  './index.html',
  './people.html',
  './person.html',
  './tree.html',
  './gallery.html',
  './admin.html',
  './manifest.json',
  './assets/css/style.css',
  './assets/css/brief-message.css',
  './assets/css/contextual-help.css',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/js/config/app-config.js',
  './assets/js/utils/api.js',
  './assets/js/utils/brief-message.js',
  './assets/js/utils/confirm-dialog.js',
  './assets/js/utils/family-graph.js',
  './assets/js/utils/formatters.js',
  './assets/js/utils/gen-date.js',
  './assets/js/utils/help-catalog.js',
  './assets/js/utils/image-compress.js',
  './assets/js/utils/kinship.js',
  './assets/js/utils/layout-descendants.js',
  './assets/js/utils/layout-fan.js',
  './assets/js/utils/layout-hourglass.js',
  './assets/js/utils/layout-pedigree.js',
  './assets/js/utils/tree-access.js',
  './assets/js/components/contextual-help.js',
  './assets/js/components/descendants-chart.js',
  './assets/js/components/fan-chart.js',
  './assets/js/components/lightbox.js',
  './assets/js/components/media-uploader.js',
  './assets/js/components/pedigree-chart.js',
  './assets/js/components/shell.js',
  './assets/js/pages/admin.js',
  './assets/js/pages/gallery.js',
  './assets/js/pages/home.js',
  './assets/js/pages/people.js',
  './assets/js/pages/person.js',
  './assets/js/pages/tree.js',
  './assets/js/main.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(SHELL);
  }));
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key !== CACHE; }).map(function (key) {
      return caches.delete(key);
    }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).then(function (response) {
    var copy = response.clone();
    caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
    return response;
  }).catch(function () {
    return caches.match(event.request);
  }));
});
