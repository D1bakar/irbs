// RailBook LP6 outbox: offline queue for alerts/vendors/trips. Flushes on online + SW sync message.
(function () {
  var KEYS = ["rb-outbox-alerts", "rb-outbox-vendors", "rb-outbox-trips"];
  async function post(url, body) {
    var r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error("http " + r.status);
    return r.json();
  }
  async function flush() {
    var routes = { "rb-outbox-alerts": "/api/alerts", "rb-outbox-vendors": "/api/vendors", "rb-outbox-trips": "/api/trips" };
    for (const k of KEYS) {
      let q = [];
      try { q = JSON.parse(localStorage.getItem(k) || "[]"); } catch (_) { q = []; }
      if (!q.length) continue;
      const rest = [];
      for (const item of q) {
        try { await post(routes[k], item.payload || item); }
        catch (_) { rest.push(item); }
      }
      try { localStorage.setItem(k, JSON.stringify(rest)); } catch (_) {}
    }
  }
  function enqueue(key, payload) {
    try {
      var q = JSON.parse(localStorage.getItem(key) || "[]");
      q.unshift({ payload: payload, at: Date.now() });
      localStorage.setItem(key, JSON.stringify(q.slice(0, 20)));
    } catch (_) {}
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      try { navigator.serviceWorker.ready.then(function (reg) { return reg.sync.register("rb-outbox").catch(function () { flush(); }); }); }
      catch (_) { flush(); }
    }
  }
  window.RB_OUTBOX = { flush: flush, enqueue: enqueue };
  window.addEventListener("online", flush);
  try {
    if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", function (e) { if (e.data && e.data.type === "RB_FLUSH_OUTBOX") flush(); });
  } catch (_) {}
  try { setTimeout(flush, 3000); } catch (_) {}
})();
