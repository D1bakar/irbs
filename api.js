// IRCTC Concept data layer. Mock first, real fetch when configured.
//
// Contract (frozen v5 — 9 keys):
// - searchTrains({from,to,date,cls,quota,pax}) -> [{no,name,dep,arr,dur,days,from,to,date,cls,quota,fare,total,status,seats,wl}] ([] = valid empty, no trains)
// - checkPnr("6841523790") -> {pnr,status,coach,seats,from,to,chartInMin,wlNo,timeline[]}
// - trainLive("12301") -> {q,onTime,lateMin,last,next,nextInMin,progress}
// - createBooking({...}) -> {pnr,synced,pending,...} (local receipt cache, idempotent per key, queued when offline)
// - searchStations({q,state,amen,radius}) -> [{code,name,state,pf,amen,km}] ([] valid)
// - listSpecials({when,state}) -> [{id,name,from,to,dates,tag,when,state}] ([] valid)
// - subscribeAlert({type,ref,contact}) -> {id,...} or null when invalid (max 20, deduped)
// - createVendorDraft({kind,what,phone}) -> {id,...} or null when invalid (max 10)
// - auth.requestCode(phone)/auth.verifyCode(phone,code)/auth.session()/auth.signOut()
//
// Go live: set window.IRCTC_ENDPOINTS = { search, pnr, live, auth, booking, stations, specials, vendors, alerts }
// in config.local.js (per env, git-ignored). All methods validate + fall back to mock on failure.
(function () {
  var MOCK_DELAY = 450;

  /** @typedef {{from:string,to:string,date:string,cls:string,quota:string}} SearchQuery */
  /** @typedef {{no:number,name:string,dep:string,arr:string,dur:string,days:string,from:string,to:string,date:string,cls:string,status:string,seats:number,wl:number}} TrainRow */
  /** @typedef {{pnr:string,status:string,coach:string,seats:string,from:string,to:string,chartInMin:number,wlNo:number,timeline:string[]}} PnrResult */
  /** @typedef {{q:string,onTime:boolean,lateMin:number,last:string,next:string,nextInMin:number,progress:number}} LiveResult */
  /** @typedef {{code:string,name:string,state:string,pf:number,amen:string[],km:number}} Station */
  /** @typedef {{id:string,name:string,from:string,to:string,dates:string,org:string,by:string,when:string,state:string}} Special */

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function logFallback(fn, err) {
    try {
      var arr = JSON.parse(sessionStorage.getItem("irctc-fallback-log") || "[]");
      arr.push({ fn: fn, at: Date.now(), err: String((err && err.message) || err) });
      sessionStorage.setItem("irctc-fallback-log", JSON.stringify(arr.slice(-20)));
    } catch (_) {}
    // LP6: best-effort server beacon (Sentry-style, no PII)
    try {
      var payload = JSON.stringify({ name: "fallback:" + fn, meta: { err: String((err && err.message) || err).slice(0, 200) } });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/events", payload);
      else fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(function () {});
    } catch (_) {}
  }
  function seedOf(s) {
    var h = 0; s = String(s || "");
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }
  // Haversine km (offline fallback uses real station coords when lat/lon given).
  function havKm(a, b, c, d) {
    function r(x) { return x * Math.PI / 180; }
    var h = Math.sin(r(c - a) / 2), k = Math.sin(r(d - b) / 2);
    h = h * h + Math.cos(r(a)) * Math.cos(r(c)) * k * k;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }
  function hasGeo(o) {
    var la = +((o || {}).lat), lo = +((o || {}).lon);
    return isFinite(la) && isFinite(lo) && la >= -90 && la <= 90 && lo >= -180 && lo <= 180;
  }
  function isTrainRow(r) {
    return r && typeof r.no !== "undefined" && typeof r.name === "string" && typeof r.dep === "string" && typeof r.arr === "string";
  }
  function isFullTrainRow(r) {
    return isTrainRow(r) && (r.status === undefined || typeof r.status === "string");
  }
  /** Empty [] is valid (no trains that day). Null/non-array is invalid. */
  function isTrainList(v) { return Array.isArray(v) && v.every(isTrainRow); }
  function isNonEmptyTrainList(v) { return Array.isArray(v) && v.length > 0 && v.every(isTrainRow); }
  /** @returns {r is PnrResult} */
  function isPnr(v) { return v && typeof v.pnr === "string" && typeof v.status === "string" && (v.coach === undefined || typeof v.coach === "string") && (v.timeline === undefined || Array.isArray(v.timeline)); }
  /** @returns {r is LiveResult} */
  function isLive(v) { return v && typeof v.q !== "undefined" && typeof v.onTime === "boolean" && (v.nextInMin === undefined || typeof v.nextInMin === "number"); }

  function mockSearch(o) {
    var seed = seedOf((o.from || "") + (o.to || "") + (o.date || ""));
    var isTatkal = /tatkal/i.test(o.quota || "");
    var dayIdx = 0;
    try { dayIdx = new Date((o.date || "") + "T00:00:00").getDay() || 0; } catch (_) {}
    var rows = [
      { n: 12301, name: "Rajdhani Express", dep: "16:55", arr: "10:05", dur: "17h 10m", mins: 1030, days: "Daily", run: [0, 1, 2, 3, 4, 5, 6], fare: 1240 },
      { n: 12313, name: "Sealdah Rajdhani", dep: "18:10", arr: "10:55", dur: "16h 45m", mins: 1005, days: "Daily", run: [0, 1, 2, 3, 4, 5, 6], fare: 1290 },
      { n: 22895, name: "Vande Bharat Exp", dep: "06:00", arr: "12:30", dur: "6h 30m", mins: 390, days: "Except Tue", run: [0, 1, 3, 4, 5, 6], fare: 965 },
      { n: 13009, name: "Doon Express", dep: "20:25", arr: "06:10", dur: "9h 45m", mins: 585, days: "Daily", run: [0, 1, 2, 3, 4, 5, 6], fare: 585 },
      { n: 13151, name: "Jammu Tawi Exp", dep: "11:45", arr: "05:20", dur: "17h 35m", mins: 1055, days: "Mon · Sat", run: [1, 6], fare: 640 }
    ];
    var mult = /Sleeper|SL/i.test(o.cls || "") ? 0.4 : /2A/i.test(o.cls || "") ? 1.4 : /Chair|CC/i.test(o.cls || "") ? 0.9 : 1;
    if (isTatkal) mult = mult * 1.3;
    var pax = Math.max(1, Math.min(6, parseInt(o.pax || "1", 10) || 1));
    return rows
      .filter(function (r) { return r.run.indexOf(dayIdx) >= 0; })
      .map(function (r, i) {
        var ok = (seed + i + (isTatkal ? 1 : 0)) % 3 !== 2;
        var base = Math.round(r.fare * mult);
        return { no: r.n, name: r.name, dep: r.dep, arr: r.arr, dur: r.dur, mins: r.mins, days: r.days, from: o.from, to: o.to, date: o.date, cls: o.cls, quota: o.quota, fare: base, total: base * pax, pax: pax, status: ok ? "Available" : "Waitlist", seats: ok ? (12 + ((seed + i * 7) % 40)) : 0, wl: ok ? 0 : (4 + ((seed + i) % 18)) };
      });
  }
  function mockPnr(pnr) {
    var s = seedOf(pnr);
    var confirmed = s % 3 !== 1;
    return {
      pnr: pnr, status: confirmed ? "CNF" : (s % 3 === 1 ? "RAC" : "WL"),
      coach: "B4", seats: "32, 33", from: "Sealdah", to: "New Delhi",
      chartInMin: 135, wlNo: confirmed ? 0 : (3 + (s % 14)),
      timeline: ["Booked", "Chart prepared", "Board B4"]
    };
  }
  function mockLive(q) {
    var s = seedOf(String(q || "12301"));
    return { q: String(q || "12301"), onTime: s % 4 !== 0, lateMin: s % 4 === 0 ? (5 + (s % 40)) : 0, last: "Barddhaman Jn", next: "Durgapur", nextInMin: 28, progress: 62 };
  }
  var STATION_DB = [
    { code: "HWH", name: "Howrah Jn", state: "West Bengal", pf: 23, amen: ["Retiring room", "WiFi", "Food", "Wheelchair"], km: 4, lat: 22.5849, lon: 88.3423 },
    { code: "SDAH", name: "Sealdah", state: "West Bengal", pf: 21, amen: ["WiFi", "Food", "Wheelchair"], km: 7, lat: 22.5617, lon: 88.3634 },
    { code: "KOAA", name: "Kolkata", state: "West Bengal", pf: 5, amen: ["WiFi", "Food"], km: 9, lat: 22.6052, lon: 88.3422 },
    { code: "NJP", name: "New Jalpaiguri", state: "West Bengal", pf: 6, amen: ["Retiring room", "Food", "Wheelchair"], km: 510, lat: 26.682, lon: 88.4429 },
    { code: "NDLS", name: "New Delhi", state: "Delhi", pf: 16, amen: ["Retiring room", "WiFi", "Food", "Wheelchair"], km: 1450, lat: 28.6417, lon: 77.2207 },
    { code: "CSMT", name: "Mumbai CSMT", state: "Maharashtra", pf: 18, amen: ["Retiring room", "WiFi", "Food", "Wheelchair"], km: 1960, lat: 18.9401, lon: 72.8355 },
    { code: "MAS", name: "Chennai Central", state: "Tamil Nadu", pf: 12, amen: ["Retiring room", "WiFi", "Food"], km: 1670, lat: 13.0825, lon: 80.275 },
    { code: "PURI", name: "Puri", state: "Odisha", pf: 8, amen: ["Retiring room", "Food", "Wheelchair"], km: 500, lat: 19.8134, lon: 85.8314 },
    { code: "PNBE", name: "Patna Jn", state: "Bihar", pf: 10, amen: ["Retiring room", "WiFi", "Food"], km: 540, lat: 25.6022, lon: 85.1376 },
    { code: "BSB", name: "Varanasi Jn", state: "Uttar Pradesh", pf: 9, amen: ["Retiring room", "Food", "Wheelchair"], km: 690, lat: 25.3269, lon: 82.9857 },
    { code: "LKO", name: "Lucknow Charbagh", state: "Uttar Pradesh", pf: 9, amen: ["WiFi", "Food", "Wheelchair"], km: 1000, lat: 26.9155, lon: 80.9409 },
    { code: "BCT", name: "Mumbai Central", state: "Maharashtra", pf: 9, amen: ["WiFi", "Food"], km: 1965, lat: 18.9707, lon: 72.8194 }
  ];
  var SPECIAL_DB = [
    { id: "chhath-1", no: "03151", name: "Chhath Puja Special", from: "Howrah", to: "Patna", dates: "25–28 Oct 2026 · 4 runs", bookFrom: "Opens 25 Aug 2026", tag: "Filling fast", org: "Eastern Railway", by: "Howrah division", when: "month", state: "Bihar" , img: "https://images.pexels.com/photos/37067059/pexels-photo-37067059.jpeg?auto=compress&cs=tinysrgb&w=400" },
    { id: "puja-1", no: "03173", name: "Durga Puja Special", from: "Sealdah", to: "New Jalpaiguri", dates: "18–22 Oct 2026 · 5 runs", bookFrom: "Opens 18 Aug 2026", tag: "Seats open", org: "Eastern Railway", by: "Sealdah division", when: "month", state: "West Bengal" , img: "https://images.pexels.com/photos/2526935/pexels-photo-2526935.jpeg?auto=compress&cs=tinysrgb&w=400" },
    { id: "kumbh-1", no: "04217", name: "Kumbh Mela Special", from: "New Delhi", to: "Varanasi", dates: "This week · 3 runs", bookFrom: "Open now", tag: "Filling fast", org: "Northern Railway", by: "Lucknow division", when: "week", state: "Uttar Pradesh" , img: "https://images.pexels.com/photos/36945718/pexels-photo-36945718.jpeg?auto=compress&cs=tinysrgb&w=400" },
    { id: "diwali-1", no: "01045", name: "Diwali Special", from: "Mumbai CSMT", to: "Patna", dates: "8–12 Nov 2026 · 2 runs", bookFrom: "Opens 8 Sep 2026", tag: "Seats open", org: "Central Railway", by: "Mumbai division", when: "week", state: "Bihar" , img: "https://images.pexels.com/photos/37138401/pexels-photo-37138401.jpeg?auto=compress&cs=tinysrgb&w=400" },
    { id: "pongal-1", no: "06063", name: "Pongal Special", from: "Chennai Central", to: "Madurai", dates: "12–16 Jan 2027 · 5 runs", bookFrom: "Opens 12 Nov 2026", tag: "Seats open", org: "Southern Railway", by: "Chennai division", when: "month", state: "Tamil Nadu" , img: "https://images.pexels.com/photos/34046564/pexels-photo-34046564.jpeg?auto=compress&cs=tinysrgb&w=400" },
    { id: "eid-1", no: "03111", name: "Eid Special", from: "Howrah", to: "New Jalpaiguri", dates: "This week · 1 run", bookFrom: "Open now", tag: "Last seats", org: "Eastern Railway", by: "Howrah division", when: "week", state: "West Bengal" , img: "https://images.pexels.com/photos/28284985/pexels-photo-28284985.jpeg?auto=compress&cs=tinysrgb&w=400" },
    { id: "summer-1", no: "02393", name: "Summer Special", from: "Patna", to: "New Delhi", dates: "Daily till 30 Jun 2027", bookFrom: "Open now", tag: "Seats open", org: "East Central Railway", by: "Danapur division", when: "all", state: "Delhi" , img: "https://images.pexels.com/photos/22840300/pexels-photo-22840300.jpeg?auto=compress&cs=tinysrgb&w=400" },
    { id: "ganpati-1", no: "01127", name: "Ganpati Special", from: "Mumbai Central", to: "Ratnagiri", dates: "27 Aug–6 Sep 2026 · Daily", bookFrom: "Open now", tag: "Filling fast", org: "Western Railway", by: "Mumbai division", when: "all", state: "Maharashtra" , img: "https://images.pexels.com/photos/12120331/pexels-photo-12120331.jpeg?auto=compress&cs=tinysrgb&w=400" }
  ];
  /** @returns {r is Station} */
  function isStation(v) { return v && typeof v.code === "string" && typeof v.name === "string" && typeof v.state === "string" && (!v.amen || Array.isArray(v.amen)) && (v.pf === undefined || typeof v.pf === "number") && (v.km === undefined || typeof v.km === "number"); }
  /** @returns {r is Special} */
  function isSpecial(v) { return v && typeof v.id === "string" && typeof v.name === "string" && typeof v.dates === "string" && (v.from === undefined || typeof v.from === "string") && (v.when === undefined || typeof v.when === "string"); }
  function isAlert(o) { return o && typeof o.type === "string" && typeof o.ref === "string" && o.ref.trim().length >= 2 && typeof o.contact === "string" && ( /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.contact.trim()) || o.contact.replace(/\D/g, "").length >= 10 ); }
  function isVendorDraft(o) { return o && (o.kind === "stall" || o.kind === "tour") && typeof o.what === "string" && o.what.trim().length >= 3 && /^[6-9]\d{9}$/.test(String(o.phone || "").replace(/\D/g, "")); }
  function isPhone(p) { return /^[6-9]\d{9}$/.test(String(p || "").replace(/\D/g, "")); }
  function readAlerts() { try { return JSON.parse(localStorage.getItem("irctc-alerts") || "[]"); } catch (_) { return []; } }
  async function tryFetch(url, body, retries) {
    retries = (retries == null) ? 1 : retries;
    var lastErr = null;
    for (var a = 0; a <= retries; a++) {
      var ctl = new AbortController();
      var t = setTimeout(function () { ctl.abort(); }, 6000);
      try {
        var headers = { "Content-Type": "application/json" };
        try {
          var tok = sessionStorage.getItem("irctc-session");
          if (tok) headers["Authorization"] = "Bearer " + tok;
        } catch (_) {}
        var r = await fetch(url, { method: "POST", headers: headers, credentials: "include", body: JSON.stringify(body), signal: ctl.signal });
        clearTimeout(t);
        if (!r.ok) throw new Error("http " + r.status);
        return await r.json();
      } catch (e) { clearTimeout(t); lastErr = e; await delay(300 * (a + 1)); }
    }
    throw lastErr || new Error("fetch failed");
  }
  function genPnr() {
    var d = String(6 + Math.floor(Math.random() * 3));
    for (var i = 1; i < 10; i++) d += String(Math.floor(Math.random() * 10));
    return d;
  }
  function readBookings() { try { return JSON.parse(localStorage.getItem("irctc-demo-bookings") || "[]"); } catch (_) { return []; } }
  function saveBooking(b) { try { var a = readBookings(); a.unshift(b); localStorage.setItem("irctc-demo-bookings", JSON.stringify(a.slice(0, 10))); } catch (_) {} }

  window.IRCTC_API = {
    /** @param {SearchQuery} o @returns {Promise<TrainRow[]>} */
    searchTrains: async function (o) {
      var ep = (window.IRCTC_ENDPOINTS || {}).search;
      if (ep) {
        try {
          var v = await tryFetch(ep, o, 1);
          var list = Array.isArray(v) ? v : v.trains;
          if (Array.isArray(list) && list.every(isTrainRow)) return list;
          throw new Error("bad search shape");
        } catch (e) { logFallback("searchTrains", e); }
      }
      await delay(MOCK_DELAY);
      return mockSearch(o);
    },
    /** PNR: legal handoff only. Never invents CNF/RAC. Returns {handoff:true,url} when server says so. */
    checkPnr: async function (pnr) {
      var ep = (window.IRCTC_ENDPOINTS || {}).pnr;
      if (ep) {
        try {
          var v = await tryFetch(ep, { pnr: pnr }, 1);
          if (v && v.handoff) return v;
          var r = v.pnr ? v : v.result;
          if (isPnr(r)) return r;
          throw new Error("bad pnr shape");
        } catch (e) { logFallback("checkPnr", e); }
      }
      // LP6: no mock PNR. Handoff to official NTES/IRCTC.
      return { handoff: true, url: "https://enquiry.indianrail.gov.in/mntes/", msg: "Check your 10-digit PNR on official NTES/IRCTC. RailBook never invents coach/seat data." };
    },
    /** Live: legal handoff only. Never invents stations/times. */
    trainLive: async function (q) {
      var ep = (window.IRCTC_ENDPOINTS || {}).live;
      if (ep) {
        try {
          var v = await tryFetch(ep, { q: q }, 1);
          if (v && v.handoff) return v;
          var r = (v && typeof v.onTime === "boolean") ? v : v.result;
          if (isLive(r)) return r;
          throw new Error("bad live shape");
        } catch (e) { logFallback("trainLive", e); }
      }
      return { handoff: true, url: "https://enquiry.indianrail.gov.in/mntes/", msg: "Live running status is on official NTES. RailBook links you there — no invented delays." };
    },
    // LP6: booking removed. Use RB_HANDOFF.planTrip() -> /api/trips + Continue on IRCTC.
    // Kept for backward compat: validates, saves a *trip plan* (no PNR), returns handoff.
    createBooking: function (o) {
      o = o || {};
      if (!o.train || !o.from || !o.to || !o.date) { try { logFallback("createBooking", new Error("invalid trip plan")); } catch (_) {} return null; }
      var plan = { trainNo: String(o.train).split(" ")[0], from: o.from, to: o.to, date: o.date, cls: o.cls, quota: o.quota, pax: o.pax };
      try {
        if (window.RB_HANDOFF) { window.RB_HANDOFF.planTrip(plan); }
        else { fetch("/api/trips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plan) }).catch(function () {}); }
      } catch (_) {}
      return { handoff: true, plan: plan, url: "https://www.irctc.co.in/nget/train-search" };
    },
    readBookings: readBookings,
    /** @returns {Promise<Station[]>} */
    searchStations: async function (o) {
      o = o || {};
      var ep = (window.IRCTC_ENDPOINTS || {}).stations;
      if (ep) {
        try {
          var v = await tryFetch(ep, o, 1);
          var list = Array.isArray(v) ? v : v.stations;
          if (Array.isArray(list) && list.every(isStation)) return list;
          throw new Error("bad stations shape");
        } catch (e) { logFallback("searchStations", e); }
      }
      await delay(300);
      var q = String(o.q || "").trim().toLowerCase();
      var geo = hasGeo(o), rad = +(o.radiusKm || o.radius || 5000) || 5000;
      return STATION_DB.filter(function (s) {
        if (o.state && o.state !== "All" && s.state !== o.state) return false;
        if (o.amen && o.amen !== "All" && s.amen.indexOf(o.amen) < 0) return false;
        if (q && s.name.toLowerCase().indexOf(q) < 0 && s.code.toLowerCase().indexOf(q) < 0) return false;
        if (geo && typeof s.lat === "number") {
          if (havKm(+o.lat, +o.lon, s.lat, s.lon) > rad) return false;
        } else if (o.radius && s.km > +o.radius) return false;
        return true;
      }).map(function (s) {
        if (geo && typeof s.lat === "number") {
          var d = Math.round(havKm(+o.lat, +o.lon, s.lat, s.lon) * 10) / 10;
          return { code: s.code, name: s.name, state: s.state, pf: s.pf, amen: s.amen, km: s.km, lat: s.lat, lon: s.lon, distKm: d, _d: d };
        }
        return s;
      }).slice().sort(function (a, b) { return (a._d !== undefined && b._d !== undefined) ? a._d - b._d : a.km - b.km; });
    },
    /** @returns {Promise<Special[]>} */
    listSpecials: async function (o) {
      o = o || {};
      var ep = (window.IRCTC_ENDPOINTS || {}).specials;
      if (ep) {
        try {
          var v = await tryFetch(ep, o, 1);
          var list = Array.isArray(v) ? v : v.specials;
          if (Array.isArray(list) && list.every(isSpecial)) return list;
          throw new Error("bad specials shape");
        } catch (e) { logFallback("listSpecials", e); }
      }
      await delay(300);
      return SPECIAL_DB.filter(function (s) {
        if (o.state && o.state !== "All" && s.state !== o.state) return false;
        if (o.when && o.when !== "all" && s.when !== o.when && !(o.when === "month" && s.when === "week")) return false;
        return true;
      });
    },
    subscribeAlert: function (o) {
      o = o || {};
      if (!isAlert(o)) { try { logFallback("subscribeAlert", new Error("invalid alert")); } catch (_) {} return null; }
      var a = readAlerts();
      var normRef = String(o.ref).trim();
      var normContact = String(o.contact).trim();
      var dup = a.find(function (x) { return String(x.ref).toLowerCase() === normRef.toLowerCase() && String(x.contact).toLowerCase() === normContact.toLowerCase() && x.type === o.type; });
      if (dup) return dup;
      var item = { id: "a" + Date.now().toString(36), type: o.type, ref: normRef, contact: normContact, at: Date.now(), synced: !(window.IRCTC_ENDPOINTS || {}).alerts };
      a.unshift(item);
      try { localStorage.setItem("irctc-alerts", JSON.stringify(a.slice(0, 20))); } catch (_) {}
      var ep = (window.IRCTC_ENDPOINTS || {}).alerts;
      if (ep) { tryFetch(ep, item, 0).catch(function (e) { logFallback("subscribeAlert", e); }); }
      return item;
    },
    createVendorDraft: function (o) {
      o = o || {};
      if (!isVendorDraft(o)) { try { logFallback("createVendorDraft", new Error("invalid vendor")); } catch (_) {} return null; }
      var KEY = "irctc-vendor-drafts";
      var items = [];
      try { items = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (_) {}
      var cleanPhone = String(o.phone).replace(/\D/g, "");
      var dup = items.find(function (x) { return x.kind === o.kind && String(x.what).toLowerCase() === String(o.what).trim().toLowerCase() && x.phone === cleanPhone; });
      if (dup) return dup;
      var item = { id: "v" + Date.now().toString(36), kind: o.kind, what: String(o.what).trim(), phone: cleanPhone, at: Date.now(), synced: !(window.IRCTC_ENDPOINTS || {}).vendors };
      items.unshift(item);
      try { localStorage.setItem(KEY, JSON.stringify(items.slice(0, 10))); } catch (_) {}
      var ep = (window.IRCTC_ENDPOINTS || {}).vendors;
      if (ep) { tryFetch(ep, item, 0).catch(function (e) { logFallback("createVendorDraft", e); }); }
      return item;
    },
    readAlerts: readAlerts,
    removeAlert: function (id) {
      try { localStorage.setItem("irctc-alerts", JSON.stringify(readAlerts().filter(function (a) { return a.id !== id; }))); } catch (_) {}
    },
    auth: {
      requestCode: async function (phone) {
        if (!isPhone(phone)) return { ok: false, error: "invalid-phone" };
        var ep = (window.IRCTC_ENDPOINTS || {}).auth;
        if (ep) {
          try { return await tryFetch(ep + "/request", { phone: phone }, 1); }
          catch (e) { logFallback("auth.requestCode", e); }
        }
        await delay(300);
        var code = String(Math.floor(100000 + Math.random() * 900000));
        try { sessionStorage.setItem("irctc-demo-code", JSON.stringify({ phone: phone, code: code, exp: Date.now() + 120000 })); } catch (_) {}
        return { demo: true, code: code, expInSec: 120 };
      },
      verifyCode: async function (phone, code) {
        if (!isPhone(phone) || !/^\d{6}$/.test(String(code || ""))) return { ok: false, error: "invalid-code" };
        var ep = (window.IRCTC_ENDPOINTS || {}).auth;
        if (ep) {
          try {
            var v = await tryFetch(ep + "/verify", { phone: phone, code: code }, 1);
            if (v && (v.token || v.ok)) {
              try { if (v.token) sessionStorage.setItem("irctc-session", v.token); } catch (_) {}
              try { localStorage.setItem("irctc-demo-user", JSON.stringify({ phone: phone, at: Date.now(), real: true })); } catch (_) {}
              return { ok: true, real: true };
            }
            throw new Error("bad verify");
          } catch (e) { logFallback("auth.verifyCode", e); }
        }
        try {
          var s = JSON.parse(sessionStorage.getItem("irctc-demo-code") || "null");
          if (s && s.phone === phone && String(s.code) === String(code) && Date.now() < s.exp) {
            try { localStorage.setItem("irctc-demo-user", JSON.stringify({ phone: phone, at: Date.now() })); } catch (_) {}
            return { ok: true };
          }
        } catch (_) {}
        return { ok: false };
      },
      session: function () { try { return JSON.parse(localStorage.getItem("irctc-demo-user") || "null"); } catch (_) { return null; } },
      signOut: function () { try { localStorage.removeItem("irctc-demo-user"); sessionStorage.removeItem("irctc-session"); } catch (_) {} }
    }
  };
})();
