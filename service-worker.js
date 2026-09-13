const CACHE_NAME = "my-diary-v15";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./auth.js",
  "./crypto.js",
  "./db.js",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];


// =========================
// 설치
// =========================

self.addEventListener(
  "install",
  event => {

    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then(cache =>
          cache.addAll(FILES_TO_CACHE)
        )
    );

    // 새 버전 즉시 대기 해제
    self.skipWaiting();
  }
);


// =========================
// 활성화
// =========================

self.addEventListener(
  "activate",
  event => {

    event.waitUntil(
      caches
        .keys()
        .then(cacheNames => {

          return Promise.all(
            cacheNames.map(name => {

              if (
                name !== CACHE_NAME
              ) {
                return caches.delete(name);
              }

            })
          );

        })
        .then(() =>
          self.clients.claim()
        )
    );

  }
);


// =========================
// 네트워크 우선
// =========================

self.addEventListener(
  "fetch",
  event => {

    const request =
      event.request;


    // GET 요청만 처리
    if (
      request.method !== "GET"
    ) {
      return;
    }


    const url =
      new URL(request.url);


    // 외부 사이트는 건드리지 않음
    if (
      url.origin !==
      self.location.origin
    ) {
      return;
    }


    event.respondWith(

      fetch(
        request,
        {
          cache: "no-store"
        }
      )
        .then(response => {

          // 최신 파일을 캐시에 저장
          const copy =
            response.clone();

          caches
            .open(CACHE_NAME)
            .then(cache => {
              cache.put(
                request,
                copy
              );
            });


          return response;

        })
        .catch(async () => {

          // 인터넷이 없을 때
          // 기존 캐시 사용
          const cached =
            await caches.match(
              request
            );

          if (cached) {
            return cached;
          }


          // 페이지 요청이면
          // index.html을 마지막 대안으로 사용
          if (
            request.mode ===
            "navigate"
          ) {

            return caches.match(
              "./index.html"
            );

          }


          throw new Error(
            "Network and cache unavailable"
          );

        })

    );

  }
);