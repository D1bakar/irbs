// RailBook LP6 offline shell. Network-first with timeout for navigations, SWR for shell.
// POST /api/* passes through; offline writes are queued client-side (see main.js outbox) and
// retried on `sync` / online event. No fake data here.
var V = "railbook-v6";
var SHELL = ["index.html", "tatkal.html", "refunds.html", "pnr-help.html", "live-help.html", "catering.html", "concessions.html", "contact.html", "terms.html", "privacy.html", "cookies.html", "404.html", "stations.html", "specials.html", "alerts.html", "stories.html", "vendors.html", "style.css", "config.js", "api.js", "main.js", "lang.js", "analytics.js", "consent.js", "handoff.js", "outbox.js", "privacy.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-192.svg", "icon-512.svg", "og-image.svg", "robots.txt", "sitemap.xml"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) { return k === V ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function timeoutFetch(req, ms) {
  return new Promise(function (resolve, reject) {
    var to = setTimeout(function () { reject(new Error("timeout")); }, ms || 3000);
    fetch(req).then(function (r) { clearTimeout(to); resolve(r); }, function (e) { clearTimeout(to); reject(e); });
  });
}
self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== "GET") return; // POST API handled by client outbox + server
  if (u.origin !== location.origin) return; // fonts/Pexels stay network (consent-gated in page)
  e.respondWith(
    timeoutFetch(e.request, 3000).then(function (r) {
      var copy = r.clone();
      caches.open(V).then(function (c) { c.put(e.request, copy); });
      return r;
    }).catch(function () {
      return caches.match(e.request).then(function (m) { return m || caches.match("index.html"); });
    })
  );
});
self.addEventListener("sync", function (e) {
  if (e.tag === "rb-outbox") {
    e.waitUntil((async function () {
      var clients = await self.clients.matchAll();
      clients.forEach(function (c) { c.postMessage({ type: "RB_FLUSH_OUTBOX" }); });
    })());
  }
});
