/* ReadX service worker: the website keeps working offline after one visit.
 *
 * At build time, the PRECACHE placeholder below is replaced with the list of every file the build produced
 * (see vite.config.ts). On install all of them are saved, so the reader, PDF/EPUB engines etc.
 * work offline even if they were never opened online. Each build has its own cache; old ones are
 * deleted when a new version activates. Book files live in a separate cache and are never touched.
 *
 * Only the app's own files are handled. Firebase / Supabase requests pass straight through;
 * Firestore has its own offline cache.
 */
const PRECACHE = {"version":"0af4ffae9afc","files":["apple-touch-icon.png","assets/ReaderPage-C4AvQUhE.css","assets/ReaderPage-CY-6vuB9.js","assets/index-CdF5_09V.css","assets/index-tPzTLRW3.js","assets/pdf.worker.min-CIqJB0yW.mjs","assets/rolldown-runtime-COiEfhsA.js","assets/src-C7g9dNs6.js","assets/uploadBook-HH0JJHCf.js","assets/web-CzZ00z84.js","assets/web-NOElhpQR.js","icon.svg"]} || { version: 'dev', files: [] };
const CACHE = `readx-app-${PRECACHE.version}`;
const SCOPE = new URL(self.registration.scope).pathname; // e.g. /readx/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll([SCOPE, ...PRECACHE.files.map((f) => SCOPE + f)]))
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
            .filter((k) => (k.startsWith('readx-app-') && k !== CACHE) || k === 'readx-shell-v1' || k === 'readx-assets-v1')
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Save a copy. The clone must be taken before the response is handed back (its body is read once). */
function keep(key, res) {
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(key, copy));
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;

  if (req.mode === 'navigate') {
    // Network first so a new deploy is picked up; the saved page when offline
    event.respondWith(
      fetch(req)
        .then((res) => keep(SCOPE, res))
        .catch(() => caches.open(CACHE).then((c) => c.match(SCOPE)).then((r) => r || Response.error())),
    );
    return;
  }

  // App files: saved copy first (build file names contain a content hash), else network + save
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => keep(req, res))));
});
