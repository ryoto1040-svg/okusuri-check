/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;
declare const __PRECACHE__: string[];
declare const __CACHE_NAME__: string;
declare const __CACHE_PREFIX__: string;
declare const __BASE_PATH__: string;
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(__CACHE_NAME__)
      .then((cache) => cache.addAll(__PRECACHE__))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(__CACHE_PREFIX__) && key !== __CACHE_NAME__)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(__BASE_PATH__)
  )
    return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(
        async () =>
          (await (await caches.open(__CACHE_NAME__)).match(`${__BASE_PATH__}index.html`)) ??
          Response.error(),
      ),
    );
    return;
  }
  if (__PRECACHE__.includes(url.pathname))
    event.respondWith(
      caches
        .open(__CACHE_NAME__)
        .then((cache) => cache.match(event.request))
        .then((cached) => cached ?? fetch(event.request)),
    );
});
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'okusuri:offline-status' || !event.ports[0]) return;
  const paths: unknown = event.data.paths;
  if (
    !Array.isArray(paths) ||
    !paths.every((path) => typeof path === 'string' && __PRECACHE__.includes(path))
  ) {
    event.ports[0].postMessage({ ready: false });
    return;
  }
  event.waitUntil(
    caches.open(__CACHE_NAME__).then(async (cache) => {
      const results = await Promise.all(
        [`${__BASE_PATH__}index.html`, ...paths].map((path) => cache.match(path)),
      );
      event.ports[0].postMessage({ ready: results.every(Boolean) });
    }),
  );
});
export {};
