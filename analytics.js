// RailBook LP6 analytics: consent-gated, beacon to /api/events (no PII, no fingerprint).
// Migrates legacy irctc-consent-v1 -> rb-consent-v1 via consent.js.
(function () {
  function enabled() {
    try {
      if (window.RB_CONSENT) return window.RB_CONSENT.analytics();
      var c = JSON.parse(localStorage.getItem("rb-consent-v1") || localStorage.getItem("irctc-consent-v1") || "null");
      return !!(c && c.analytics);
    } catch (_) { return false; }
  }
  function read() { try { return JSON.parse(localStorage.getItem("irctc-counts") || "{}"); } catch (_) { return {}; } }
  function bump(key) {
    if (!enabled()) return;
    try {
      var c = read(); c[key] = (c[key] || 0) + 1; c._at = Date.now();
      localStorage.setItem("irctc-counts", JSON.stringify(c));
    } catch (_) {}
    // best-effort server beacon (nameless counters only)
    try {
      if (navigator.sendBeacon) navigator.sendBeacon("/api/events", JSON.stringify({ name: key }));
      else fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: key }), keepalive: true }).catch(function () {});
    } catch (_) {}
  }
  window.IRCTC_STATS = {
    read: read,
    event: bump,
    page: function () {
      try { var pg = location.pathname.split("/").pop() || "index.html"; bump("page:" + pg); } catch (_) {}
    }
  };
  try {
    window.IRCTC_STATS.page();
    document.addEventListener("rb:consent", function () { window.IRCTC_STATS.page(); });
  } catch (_) {}
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("#search,#bkGo,#bkConfirm,#pnrBtn,#liveBtn");
    if (!t) return;
    bump("funnel:" + t.id);
  }, { passive: true });
})();
