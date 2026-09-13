const CACHE_NAME = "my-diary-v6";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./auth.js",
  "./crypto.js",
  "./db.js",
  "./app.js",
  "./manifest.json"
];


// 설치
self.addEventListener(
  "install",
  event => {

    event.waitUntil(

      caches
        .open(CACHE_NAME)
        .then(cache => {
          return cache.addAll(
            FILES_TO_CACHE
          );
        })

    );

    self.skipWaiting();
  }
);


// 활성화
self.addEventListener(
  "activate",
  event => {

    event.waitUntil(

      caches
        .keys()
        .then(keys => {

          return Promise.all(

            keys
              .filter(
                key =>
                  key !== CACHE_NAME
              )
              .map(
                key =>
                  caches.delete(key)
              )

          );

        })

    );

    self.clients.claim();
  }
);


// 파일 요청
self.addEventListener(
  "fetch",
  event => {

    if (
      event.request.method !== "GET"
    ) {
      return;
    }

    event.respondWith(

      fetch(event.request)

        .then(response => {

          const copy =
            response.clone();

          caches
            .open(CACHE_NAME)
            .then(cache => {
              cache.put(
                event.request,
                copy
              );
            });

          return response;
        })

        .catch(() => {

          return caches.match(
            event.request
          );

        })

    );

  }
);