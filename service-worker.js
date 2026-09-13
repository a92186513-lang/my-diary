const CACHE_NAME = "my-diary-cache";

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
          cache.addAll(
            FILES_TO_CACHE
          )
        )
    );

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

            cacheNames.map(
              name => {

                if (
                  name !==
                  CACHE_NAME
                ) {

                  return caches.delete(
                    name
                  );

                }

              }
            )

          );

        })
        .then(
          () =>
            self.clients.claim()
        )

    );

  }
);


// =========================
// 최신 파일 우선
// =========================

self.addEventListener(
  "fetch",
  event => {

    const request =
      event.request;


    // GET만 처리
    if (
      request.method !==
      "GET"
    ) {

      return;

    }


    const url =
      new URL(
        request.url
      );


    // 우리 사이트 파일만 처리
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
          cache:
            "no-store"
        }
      )

        .then(response => {

          // 정상 응답만 캐시에 저장
          if (
            response &&
            response.ok
          ) {

            const copy =
              response.clone();


            caches
              .open(
                CACHE_NAME
              )
              .then(
                cache => {

                  cache.put(
                    request,
                    copy
                  );

                }
              );

          }


          return response;

        })

        .catch(
          async () => {

            // 인터넷이 없으면
            // 저장된 캐시 사용
            const cached =
              await caches.match(
                request
              );


            if (cached) {

              return cached;

            }


            // 오프라인에서
            // 페이지 요청이면
            // index.html 표시
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

          }
        )

    );

  }
);