// RailBook LP6 privacy: TTL cleanup + delete-my-data.
// - Prunes legacy demo keys older than TTL.
// - Exposes window.RB_PRIVACY.wipe() -> clears local + calls DELETE /api/account.
(function () {
  var TTL = { "irctc-demo-bookings": 90, "irctc-passengers": 90, "irctc-trip": 90, "irctc-alerts": 365, "irctc-vendor-drafts": 365 };
  function prune() {
    try {
      // bookings carry `at`; drop older than TTL days
      var now = Date.now();
      ["irctc-demo-bookings", "irctc-alerts", "irctc-vendor-drafts"].forEach(function (k) {
        try {
          var arr = JSON.parse(localStorage.getItem(k) || "[]");
          if (!Array.isArray(arr)) return;
          var days = TTL[k] || 90;
          var kept = arr.filter(function (x) { return !x.at || (now - x.at) < days * 864e5; });
          if (kept.length !== arr.length) localStorage.setItem(k, JSON.stringify(kept));
        } catch (_) {}
      });
    } catch (_) {}
  }
  async function wipe(phone) {
    try {
      if (phone) {
        await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: phone }) });
      } else {
        await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      }
    } catch (_) {}
    try {
      ["irctc-demo-bookings","irctc-passengers","irctc-last-pnr","irctc-booking-queue","irctc-trip","irctc-alerts","irctc-vendor-drafts","irctc-demo-user","irctc-counts","rb-outbox-trips","rb-outbox"].forEach(function (k) { localStorage.removeItem(k); });
      sessionStorage.clear();
    } catch (_) {}
    try { document.dispatchEvent(new CustomEvent("rb:wiped")); } catch (_) {}
  }
  window.RB_PRIVACY = { prune: prune, wipe: wipe };
  try { prune(); } catch (_) {}
})();
