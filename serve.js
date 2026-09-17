// Local + serverless API router. `node serve.js` serves static + /api/* with zero deps.
// Deploy: Vercel/Netlify functions can require ./api/*.js handlers (each exports async (req,res,ctx)).
// NOTE: this file is deliberately NOT named server.js — Vercel auto-detects a root
// server.js as the whole app's entrypoint and hijacks routing ("Using server.js as
// the root entrypoint"), breaking the api/* functions. Never rename it back.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { send, readJson, uid } = require("./lib/api");
const V = require("./lib/validate");
const store = require("./lib/store");
const { limit } = require("./lib/ratelimit");
const { havKm, isLatLon } = require("./lib/geo");
const provider = require("./lib/rail-provider");

const BASE = __dirname;
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".xml": "application/xml", ".txt": "text/plain" };

function ip(req) { return (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "local").split(",")[0].trim(); }
function secHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(self), microphone=(self), camera=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://images.pexels.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
}

// --- timetable search (static, honest: no live availability) ---
function staticSearch(o) {
  const stations = store.stations();
  const from = String(o.from || "").trim(), to = String(o.to || "").trim();
  if (!from || !to) return [];
  // Deterministic 3-row timetable so UX is testable; fares indicative.
  const day = (() => { try { return new Date((o.date || "") + "T00:00:00").getDay() || 0; } catch (_) { return 0; } })();
  const rows = [
    { no: 12301, name: "Rajdhani Express", dep: "16:55", arr: "10:05", dur: "17h 10m", days: "Daily", run: [0,1,2,3,4,5,6], fare: 1240 },
    { no: 22895, name: "Vande Bharat Exp", dep: "06:00", arr: "12:30", dur: "6h 30m", days: "Except Tue", run: [0,1,3,4,5,6], fare: 965 },
    { no: 13009, name: "Doon Express", dep: "20:25", arr: "06:10", dur: "9h 45m", days: "Daily", run: [0,1,2,3,4,5,6], fare: 585 }
  ];
  const mult = /Sleeper|SL/i.test(o.cls || "") ? 0.4 : /2A/i.test(o.cls || "") ? 1.4 : /Chair|CC/i.test(o.cls || "") ? 0.9 : 1;
  return rows.filter(r => r.run.includes(day)).map(r => ({
    no: r.no, name: r.name, dep: r.dep, arr: r.arr, dur: r.dur, days: r.days,
    from, to, date: o.date || "", cls: o.cls || "", quota: o.quota || "",
    fare: Math.round(r.fare * mult), total: Math.round(r.fare * mult) * (o.pax || 1),
    status: "Timetable", seats: null, wl: 0,
    note: "Static timetable. Check live availability on official IRCTC before travel."
  }));
}

async function handleApi(req, res) {
  const u = new URL(req.url, "http://local");
  const p = u.pathname;
  if (req.method === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" }); return res.end(); }

  // rate-limit writes
  if (req.method === "POST" && !limit(ip(req), p, 60).ok) return send(res, 429, { ok: false, error: "rate-limited" });

  if (p === "/api/health" && req.method === "GET") return send(res, 200, { ok: true, env: process.env.RAILBOOK_ENV || "dev-lp6", time: new Date().toISOString() });

  if (p === "/api/search" && req.method === "POST") {
    const b = await readJson(req);
    // Live provider first (real trains-between when RAIL_PROVIDER is configured).
    try {
      const live = await provider.trainsBetween(b.from, b.to, b.date);
      if (live && live.length) {
        const mult = /Sleeper|SL/i.test(b.cls || "") ? 0.4 : /2A/i.test(b.cls || "") ? 1.4 : /Chair|CC/i.test(b.cls || "") ? 0.9 : 1;
        return send(res, 200, live.map(r => ({
          ...r, from: b.from, to: b.to, date: b.date || "", cls: b.cls || "", quota: b.quota || "",
          fare: Math.round((r.fare || 800) * mult), total: Math.round((r.fare || 800) * mult) * (b.pax || 1),
          source: "live-provider"
        })));
      }
    } catch (_) {}
    return send(res, 200, staticSearch(b));
  }
  if (p === "/api/stations" && req.method === "POST") {
    const b = await readJson(req);
    const hasGeo = isLatLon(b.lat, b.lon);
    const radiusKm = +(b.radiusKm || b.radius || 5000) || 5000;
    const q = String(b.q || "").trim().toLowerCase();
    const normState = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
    const wantState = b.state && b.state !== "All" ? normState(b.state) : "";
    const matchState = (s) => !wantState || normState(s.state) === wantState;
    const matchQ = (s) => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
    const matchAmen = (s) => !b.amen || b.amen === "All" || (s.amen || []).includes(b.amen);
    // 1) curated majors (full detail: platforms, amenities, legacy km)
    let curated = store.stations().filter(s => {
      if (!matchState(s) || !matchQ(s) || !matchAmen(s)) return false;
      if (!hasGeo && b.radius && s.km > +b.radius) return false;
      return true;
    });
    // 2) full open-data directory (8,400+ real stations) when the user typed >=2 chars,
    // OR when GPS is on (nearest-first must work even with an empty query).
    // Scan-all is still sub-5ms; ranking + slice(60) keeps exact/code matches on top.
    let extra = [];
    if (q.length >= 2 || (hasGeo && !q)) {
      const have = new Set(curated.map(s => s.code));
      const noAmen = b.amen && b.amen !== "All"; // directory rows carry no amenity data
      for (const s of store.stationsFull()) {
        if (have.has(s.code) || noAmen || !matchState(s) || !matchQ(s)) continue;
        extra.push({ code: s.code, name: s.name, state: s.state, lat: s.lat, lon: s.lon, dir: true, amen: [] });
      }
    }
    const tag = (s) => {
      if (hasGeo && typeof s.lat === "number" && typeof s.lon === "number") {
        const d = Math.round(havKm(+b.lat, +b.lon, s.lat, s.lon) * 10) / 10;
        if (d > radiusKm) return null;
        return { ...s, distKm: d };
      }
      if (!hasGeo && b.radius && typeof s.km === "number" && s.km > +b.radius) return null;
      return s;
    };
    let list = [...curated, ...extra].map(tag).filter(Boolean);
    const rank = (s) => {
      if (!q) return 3;
      const code = s.code.toLowerCase(), nm = s.name.toLowerCase();
      if (code === q) return 0;
      if (code.startsWith(q)) return 1;
      if (nm.startsWith(q)) return 2;
      return 3;
    };
    list.sort((a, b2) => {
      if (hasGeo && a.distKm !== undefined && b2.distKm !== undefined && a.distKm !== b2.distKm) return a.distKm - b2.distKm;
      if (hasGeo && (a.distKm !== undefined) !== (b2.distKm !== undefined)) return a.distKm !== undefined ? -1 : 1;
      const ra = rank(a), rb = rank(b2);
      if (ra !== rb) return ra - rb;
      if ((a.dir ? 1 : 0) !== (b2.dir ? 1 : 0)) return (a.dir ? 1 : 0) - (b2.dir ? 1 : 0); // majors first
      return a.name.localeCompare(b.name);
    });
    return send(res, 200, list.slice(0, 60));
  }
  if (p === "/api/specials" && req.method === "POST") {
    const b = await readJson(req);
    let list = store.specials();
    list = list.filter(s => {
      if (b.state && b.state !== "All" && s.state !== b.state) return false;
      if (b.when && b.when !== "all" && s.when !== b.when) return false;
      return true;
    });
    return send(res, 200, list);
  }
  if (p === "/api/pnr" && req.method === "POST") {
    const b = await readJson(req).catch(() => ({}));
    // Real PNR when a licensed provider is configured; otherwise honest handoff.
    try {
      const live = await provider.pnrStatus(b.pnr);
      if (live) return send(res, 200, live);
    } catch (_) {}
    // Legal: no fake PNR. Return handoff so client shows official CTA.
    return send(res, 200, { handoff: true, url: "https://enquiry.indianrail.gov.in/mntes/", msg: "Enter your 10-digit PNR on official NTES/IRCTC. RailBook does not store PNRs." });
  }
  if (p === "/api/live" && req.method === "POST") {
    const b = await readJson(req).catch(() => ({}));
    try {
      const live = await provider.liveStatus(b.q);
      if (live) return send(res, 200, live);
    } catch (_) {}
    return send(res, 200, { handoff: true, url: "https://enquiry.indianrail.gov.in/mntes/", msg: "Live running status is on official NTES. RailBook links you there." });
  }
  if (p === "/api/alerts" && req.method === "POST") {
    const b = await readJson(req);
    if (!V.isAlert(b)) return send(res, 400, { ok: false, error: "invalid-alert" });
    const all = store.alerts();
    const dup = all.find(x => x.type === b.type && String(x.ref).toLowerCase() === String(b.ref).trim().toLowerCase() && String(x.contact).toLowerCase() === String(b.contact).trim().toLowerCase());
    if (dup) return send(res, 200, dup);
    const item = { id: uid("a"), type: b.type, ref: String(b.ref).trim(), contact: String(b.contact).trim(), at: Date.now(), confirmed: false };
    all.unshift(item); store.saveAlerts(all.slice(0, 500));
    return send(res, 200, item);
  }
  if (p === "/api/vendors" && req.method === "POST") {
    const b = await readJson(req);
    if (!V.isVendorDraft(b)) return send(res, 400, { ok: false, error: "invalid-vendor" });
    const all = store.vendors();
    const item = { id: uid("v"), kind: b.kind, what: String(b.what).trim(), phone: V.cleanPhone(b.phone), at: Date.now(), status: "pending" };
    all.unshift(item); store.saveVendors(all.slice(0, 500));
    return send(res, 200, item);
  }
  if (p === "/api/trips" && req.method === "POST") {
    const b = await readJson(req);
    if (!b.from || !b.to || !b.date) return send(res, 400, { ok: false, error: "from-to-date-required" });
    const all = store.trips();
    const item = { id: uid("t"), s_from: String(b.from).slice(0, 80), s_to: String(b.to).slice(0, 80), s_date: String(b.date).slice(0, 20), cls: String(b.cls || "").slice(0, 40), quota: String(b.quota || "").slice(0, 40), pax: Math.max(1, Math.min(6, +b.pax || 1)), train_no: b.trainNo ? String(b.trainNo).slice(0, 10) : null, at: Date.now() };
    all.unshift(item); store.saveTrips(all.slice(0, 500));
    return send(res, 200, { id: item.id });
  }
  if (p === "/api/trips" && req.method === "GET") {
    const id = u.searchParams.get("id");
    const hit = store.trips().find(t => t.id === id);
    if (!hit) return send(res, 404, { ok: false, error: "not-found" });
    return send(res, 200, hit);
  }
  if ((p === "/api/auth/request" || p === "/api/auth") && req.method === "POST") {
    const b = await readJson(req);
    if (!V.isPhone(b.phone)) return send(res, 400, { ok: false, error: "invalid-phone" });
    if (!limit(ip(req), "auth", 5).ok) return send(res, 429, { ok: false, error: "too-many-codes" });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const all = store.otp();
    all[V.cleanPhone(b.phone)] = { code, exp: Date.now() + 5 * 60 * 1000, attempts: 0 };
    store.saveOtp(all);
    // In dev, return code for testing. In prod (RAILBOOK_ENV=prod), do NOT return code — send via SMS provider.
    const dev = (process.env.RAILBOOK_ENV || "dev-lp6") !== "prod";
    try { console.log("[auth] code for " + V.cleanPhone(b.phone) + ": " + code); } catch (_) {}
    return send(res, 200, dev ? { ok: true, expInSec: 300, devCode: code } : { ok: true, expInSec: 300 });
  }
  if (p === "/api/auth/verify" && req.method === "POST") {
    const b = await readJson(req);
    if (!V.isPhone(b.phone) || !/^\d{6}$/.test(String(b.code || ""))) return send(res, 400, { ok: false, error: "invalid-code" });
    const all = store.otp();
    const rec = all[V.cleanPhone(b.phone)];
    if (!rec || Date.now() > rec.exp) return send(res, 400, { ok: false, error: "expired" });
    rec.attempts = (rec.attempts || 0) + 1;
    if (rec.attempts > 5) return send(res, 429, { ok: false, error: "too-many-attempts" });
    if (rec.code !== String(b.code)) { store.saveOtp(all); return send(res, 400, { ok: false, error: "wrong-code" }); }
    delete all[V.cleanPhone(b.phone)]; store.saveOtp(all);
    const token = uid("sess") + "." + uid("t");
    res.setHeader("Set-Cookie", `rb_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${process.env.RAILBOOK_ENV === "prod" ? "; Secure" : ""}`);
    return send(res, 200, { ok: true, token });
  }
  if (p === "/api/events" && req.method === "POST") {
    const b = await readJson(req);
    if (!b.name || typeof b.name !== "string") return send(res, 400, { ok: false });
    const all = store.events();
    all.unshift({ name: String(b.name).slice(0, 80), meta: b.meta || {}, at: Date.now(), ip: ip(req).slice(0, 40) });
    store.saveEvents(all.slice(0, 1000));
    return send(res, 200, { ok: true });
  }
  if (p === "/api/account" && req.method === "DELETE") {
    // Delete-my-data: client sends phone; server drops matching alerts/vendors/otp. Trips are anonymous IDs.
    const b = await readJson(req);
    const phone = V.cleanPhone(b.phone || "");
    if (phone) {
      store.saveAlerts(store.alerts().filter(a => V.cleanPhone(a.contact) !== phone));
      store.saveVendors(store.vendors().filter(v => v.phone !== phone));
      const otp = store.otp(); delete otp[phone]; store.saveOtp(otp);
    }
    res.setHeader("Set-Cookie", "rb_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    return send(res, 200, { ok: true, deleted: !!phone });
  }
  if (p === "/api/checkout" && req.method === "GET") {
    const plan = u.searchParams.get("plan") || "plus";
    // Stub: in prod, create Razorpay/Stripe Payment Link server-side and 302 there.
    // Never accept card data here.
    return send(res, 200, { ok: true, plan, url: "https://pay.example.com/railbook-" + encodeURIComponent(plan), note: "Hosted checkout only." });
  }
  return send(res, 404, { ok: false, error: "not-found" });
}

function serveStatic(req, res) {
  let p = new URL(req.url, "http://local").pathname;
  if (p === "/") p = "/index.html";
  const fp = path.join(BASE, decodeURIComponent(p).replace(/^\/+/, ""));
  if (!fp.startsWith(BASE) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) return false;
  const ext = path.extname(fp).toLowerCase();
  secHeaders(res);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600" });
  fs.createReadStream(fp).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) { secHeaders(res); return await handleApi(req, res); }
    if (req.method === "GET" && serveStatic(req, res)) return;
    secHeaders(res);
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end(fs.readFileSync(path.join(BASE, "404.html"), "utf8"));
  } catch (e) { try { send(res, 500, { ok: false }); } catch (_) {} }
});
if (require.main === module) {
  const port = process.env.PORT || 8906;
  server.listen(port, () => console.log("RailBook LP6 on http://localhost:" + port));
}
module.exports = { server, handleApi };
