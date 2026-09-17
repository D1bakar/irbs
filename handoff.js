// RailBook LP6 handoff — legal booking handoff, no fake PNR.
// - Builds an opaque trip plan, saves to /api/trips when online, else to local outbox.
// - "Continue on IRCTC" deep-link carries only from/to/date (no invented PNR, no passenger PII in URL).
// - Exposes window.RB_HANDOFF {planTrip, irctcUrl}
(function () {
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function isoTodayPlus(days) {
    var d = new Date(); d.setDate(d.getDate() + (days || 0));
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function irctcUrl(o) {
    // Official IRCTC e-ticketing search (no affiliate tag by default; add ?utm only if program allows).
    // We pass only stations/date to avoid leaking PII.
    var q = new URLSearchParams({ from: o.from || "", to: o.to || "", date: o.date || "" });
    return "https://www.irctc.co.in/nget/train-search?" + q.toString();
  }
  async function planTrip(o) {
    o = o || {};
    var payload = {
      from: String(o.from || "").trim(),
      to: String(o.to || "").trim(),
      date: String(o.date || "").trim(),
      cls: String(o.cls || "").trim(),
      quota: String(o.quota || "").trim(),
      pax: Math.max(1, Math.min(6, parseInt(o.pax || "1", 10) || 1)),
      trainNo: o.trainNo || null,
      createdAt: new Date().toISOString()
    };
    // try server; fall back to outbox
    try {
      var r = await fetch("/api/trips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (r.ok) { var j = await r.json(); return { id: j.id, url: irctcUrl(payload), server: true }; }
    } catch (_) {}
    try {
      var q = JSON.parse(localStorage.getItem("rb-outbox-trips") || "[]");
      var id = "t_" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
      q.unshift({ id: id, payload: payload, at: Date.now() });
      localStorage.setItem("rb-outbox-trips", JSON.stringify(q.slice(0, 20)));
      if ("serviceWorker" in navigator && "SyncManager" in window) {
        navigator.serviceWorker.ready.then(function (reg) { try { return reg.sync.register("rb-outbox"); } catch (_) {} });
      }
      return { id: id, url: irctcUrl(payload), server: false, queued: true };
    } catch (e) { return { id: null, url: irctcUrl(payload), server: false }; }
  }
  window.RB_HANDOFF = { planTrip: planTrip, irctcUrl: irctcUrl, isoTodayPlus: isoTodayPlus };
})();
