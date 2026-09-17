// RailBook LP6 consent manager (DPDP-first).
// - Consent stored in localStorage `rb-consent-v1` {necessary:true, functional, analytics, ts}
// - Google Fonts / Pexels / analytics only enabled after explicit opt-in.
// - Legacy `irctc-consent-v1` migrated automatically.
// - Exposes window.RB_CONSENT {get, set, onChange, has}
(function () {
  var KEY = "rb-consent-v1";
  var LEGACY = "irctc-consent-v1";
  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || "null");
      if (v) return v;
      var old = JSON.parse(localStorage.getItem(LEGACY) || "null");
      if (old) {
        var m = { necessary: true, functional: !!old.functional, analytics: !!old.analytics, ts: Date.now(), migrated: true };
        try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (_) {}
        return m;
      }
    } catch (_) {}
    return null;
  }
  function write(patch) {
    var cur = read() || { necessary: true, functional: false, analytics: false };
    var next = { necessary: true, functional: !!patch.functional, analytics: !!patch.analytics, ts: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (_) {}
    try { document.dispatchEvent(new CustomEvent("rb:consent", { detail: next })); } catch (_) {}
    // enable functional assets (fonts) on opt-in
    if (next.functional) enableFunctional();
    return next;
  }
  function enableFunctional() {
    try {
      document.querySelectorAll('link[data-consent="functional"][media="print"]').forEach(function (l) { l.media = "all"; });
    } catch (_) {}
  }
  window.RB_CONSENT = {
    get: read,
    set: write,
    has: function () { return !!read(); },
    functional: function () { var c = read(); return !!(c && c.functional); },
    analytics: function () { var c = read(); return !!(c && c.analytics); }
  };
  // If consent already granted, enable fonts immediately
  try { if (read() && read().functional) enableFunctional(); } catch (_) {}
})();
