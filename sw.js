var ONBELLEK_ADI = 'yks-kocu-v1';
var DOSYALAR = [
  './',
  './index.html',
  './stil.css',
  './depo.js',
  './analiz.js',
  './planlayici.js',
  './yz.js',
  './uygulama.js',
  './ekranlar-plan.js',
  './ekranlar-yks.js',
  './ekranlar-yz.js',
  './manifest.json',
  './simge.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(ONBELLEK_ADI).then(function (cache) {
      return cache.addAll(DOSYALAR);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (anahtarlar) {
      return Promise.all(
        anahtarlar.map(function (k) {
          if (k !== ONBELLEK_ADI) {
            return caches.delete(k);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  // Yalnızca GET isteklerini ve yerel dosyaları önbellekle (API isteklerini atla)
  if (e.request.method !== 'GET' || e.request.url.indexOf('http') !== 0) {
    return;
  }
  // Harici AI servis çağrılarını doğrudan ağa yönlendir
  if (e.request.url.indexOf('/chat/completions') >= 0 || e.request.url.indexOf('/api/') >= 0) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function (yanit) {
      if (yanit) {
        // Arka planda güncelle (stale-while-revalidate)
        fetch(e.request).then(function (canli) {
          if (canli && canli.status === 200) {
            var kopyasi = canli.clone();
            caches.open(ONBELLEK_ADI).then(function (cache) {
              cache.put(e.request, kopyasi);
            });
          }
        }).catch(function () {});
        return yanit;
      }
      return fetch(e.request).then(function (canli) {
        if (!canli || canli.status !== 200 || canli.type !== 'basic') {
          return canli;
        }
        var kopyasi = canli.clone();
        caches.open(ONBELLEK_ADI).then(function (cache) {
          cache.put(e.request, kopyasi);
        });
        return canli;
      });
    })
  );
});