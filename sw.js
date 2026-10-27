/* G/note. offline shell.
 *
 * The whole app is one HTML file plus the files in vendor/, so once a visit has
 * cached them the editor, the preview, Export and even Share keep working with
 * no connection at all.
 *
 * Two rules keep this safe to ship:
 *   - navigations are network-first, so an online visitor always gets the newest
 *     index.html and can never be pinned to an old build after a deploy;
 *   - everything else is cache-first with a background refresh, which is what
 *     makes vendor/ and the fonts instant on later visits.
 * Bump VERSION when the shell changes shape; old caches are dropped on activate.
 */
const VERSION = "1";
const CACHE = "gnote-shell-v" + VERSION;
const CORE = [
  "./",
  "./index.html",
  "./vendor/katex.min.css",
  "./vendor/katex.min.js",
  "./vendor/marked.min.js",
  "./vendor/purify.min.js",
  "./vendor/html2canvas.min.js",
  "./vendor/jspdf.umd.min.js",
];
/* The sheet and the formulas are set in local font files; without them an
   offline visit would fall back to system faces and re-flow the whole sheet. */
const FONTS = [
  "./vendor/fonts/KaTeX_AMS-Regular.woff2",
  "./vendor/fonts/KaTeX_Caligraphic-Bold.woff2",
  "./vendor/fonts/KaTeX_Caligraphic-Regular.woff2",
  "./vendor/fonts/KaTeX_Fraktur-Bold.woff2",
  "./vendor/fonts/KaTeX_Fraktur-Regular.woff2",
  "./vendor/fonts/KaTeX_Main-Bold.woff2",
  "./vendor/fonts/KaTeX_Main-BoldItalic.woff2",
  "./vendor/fonts/KaTeX_Main-Italic.woff2",
  "./vendor/fonts/KaTeX_Main-Regular.woff2",
  "./vendor/fonts/KaTeX_Math-BoldItalic.woff2",
  "./vendor/fonts/KaTeX_Math-Italic.woff2",
  "./vendor/fonts/KaTeX_SansSerif-Bold.woff2",
  "./vendor/fonts/KaTeX_SansSerif-Italic.woff2",
  "./vendor/fonts/KaTeX_SansSerif-Regular.woff2",
  "./vendor/fonts/KaTeX_Script-Regular.woff2",
  "./vendor/fonts/KaTeX_Size1-Regular.woff2",
  "./vendor/fonts/KaTeX_Size2-Regular.woff2",
  "./vendor/fonts/KaTeX_Size3-Regular.woff2",
  "./vendor/fonts/KaTeX_Size4-Regular.woff2",
  "./vendor/fonts/KaTeX_Typewriter-Regular.woff2",
  "./vendor/fonts/LiberationSans-Bold.woff2",
  "./vendor/fonts/LiberationSans-BoldItalic.woff2",
  "./vendor/fonts/LiberationSans-Italic.woff2",
  "./vendor/fonts/LiberationSans-Regular.woff2",
  "./vendor/fonts/LiberationSerif-Bold.woff2",
  "./vendor/fonts/LiberationSerif-BoldItalic.woff2",
  "./vendor/fonts/LiberationSerif-Italic.woff2",
  "./vendor/fonts/LiberationSerif-Regular.woff2",
  "./vendor/fonts/PlayfairDisplay-Italic-Variable.woff2",
  "./vendor/fonts/PlusJakartaSans-Variable.woff2",
];
const NAV_TIMEOUT = 3500;      // slow network still gets a cached shell quickly

// `cache: "reload"` matters: a plain add() can store a copy the browser had
// already cached from the *previous* build, which would then be served as the
// offline shell for a whole cycle. One retry covers a flaky mobile connection.
function precache(cache, url, tries = 2){
  const one = () => cache.add(new Request(url, { cache: "reload" })).catch(() => {});
  let p = one();
  for (let i = 1; i < tries; i++) p = p.then(() => cache.match(url)).then(hit => hit ? undefined : one());
  return p;
}
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // one failure must not abort the whole install
    await Promise.all(CORE.map(url => precache(cache, url)));
    self.skipWaiting();
    // fonts are ~1.5 MB: fill them in afterwards, without holding up activation
    Promise.all(FONTS.map(url => precache(cache, url))).catch(() => {});
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const isAsset = url => /\/vendor\//.test(url.pathname) || /\.(woff2?|ttf|css|js)$/i.test(url.pathname);

async function networkFirst(request){
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true }) || await cache.match("./index.html");
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), NAV_TIMEOUT)),
    ]);
    if (response && response.ok && response.status === 200 && response.type !== "opaque") cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch (_) {
    if (cached) return cached;
    try { return await fetch(request); } catch (e) { return Response.error(); }
  }
}

async function cacheFirst(request){
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached){
    // refresh in the background so a later offline visit has the newest copy
    fetch(request).then(r => { if (r && r.ok) cache.put(request, r.clone()); }).catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch (_) {
    return cached || Response.error();
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (request.headers.get("range")) return;      // let the browser stream media itself
  const url = new URL(request.url);
  /* never serve the worker script from its own cache — updates must land */
  if (url.pathname.endsWith("/sw.js")) return;
  if (url.origin !== self.location.origin) return;           // never touch third parties
  if (request.mode === "navigate") { event.respondWith(networkFirst(request)); return; }
  if (isAsset(url)) { event.respondWith(cacheFirst(request)); return; }
  event.respondWith((async () => {
    try { return await fetch(request); }
    catch (_) { const cache = await caches.open(CACHE); return (await cache.match(request, { ignoreSearch: true })) || Response.error(); }
  })());
});
