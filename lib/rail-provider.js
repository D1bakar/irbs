// Optional live-rail provider adapter. Zero deps, server-side only.
//
// Reality: Indian Railways publishes NO free public API for PNR / live running
// status / seat availability. Without a licensed key RailBook honestly returns
// {handoff:true} (official NTES/IRCTC links) and a static timetable — it never
// invents coach/seat/delay data.
//
// To go live: buy a key from a licensed aggregator (e.g. a RapidAPI "Indian
// Railways / IRCTC" provider), then set:
//   RAIL_PROVIDER=rapidapi  RAIL_API_BASE=https://<provider-host>
//   RAPIDAPI_KEY=<key>      RAPIDAPI_HOST=<provider-host>
// Optionally override paths (defaults suit most RapidAPI IRCTC providers):
//   RAIL_PNR_PATH=/getPNRStatus/{pnr}  RAIL_LIVE_PATH=/live-train/{train}/status
//   RAIL_SEARCH_PATH=/trains-between  (GET ?from=&to=&date=YYYY-MM-DD)
// All fetches time out in 8s and return null on any failure (caller falls back
// to handoff/static). No PII is logged.
const https = require("https");

function cfg() {
  return {
    provider: (process.env.RAIL_PROVIDER || "none").toLowerCase(),
    base: (process.env.RAIL_API_BASE || "").replace(/\/+$/, ""),
    key: process.env.RAPIDAPI_KEY || process.env.RAIL_API_KEY || "",
    host: process.env.RAPIDAPI_HOST || "",
    pnrPath: process.env.RAIL_PNR_PATH || "/getPNRStatus/{pnr}",
    livePath: process.env.RAIL_LIVE_PATH || "/live-train/{train}/status",
    searchPath: process.env.RAIL_SEARCH_PATH || "/trains-between"
  };
}
function enabled(c) {
  c = c || cfg();
  return c.provider !== "none" && !!c.base && !!c.key;
}
function get(url, headers) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const req = https.request({
        hostname: u.hostname, port: 443, path: u.pathname + u.search,
        method: "GET", headers: headers || {}, timeout: 8000
      }, (res) => {
        let s = "";
        res.on("data", (c) => { s += c; if (s.length > 5e5) req.destroy(); });
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) return resolve(null);
          try { resolve(JSON.parse(s)); } catch (_) { resolve(null); }
        });
      });
      req.on("timeout", () => { try { req.destroy(); } catch (_) {} resolve(null); });
      req.on("error", () => resolve(null));
      req.end();
    } catch (_) { resolve(null); }
  });
}
function headers(c) {
  const h = { Accept: "application/json" };
  if (c.host) h["X-RapidAPI-Host"] = c.host;
  if (c.key) { h["X-RapidAPI-Key"] = c.key; }
  return h;
}
// Normalize provider JSON -> our frozen shapes (or null when unusable).
function normPnr(pnr, v) {
  try {
    const d = (v && (v.data || v.result)) || v;
    if (!d || typeof d !== "object") return null;
    const status = d.status || d.currentStatus || d.bookingStatus || null;
    if (!status) return null; // never invent CNF/RAC/WL
    return {
      pnr: String(pnr), status: String(status),
      coach: d.coach || d.coachNo || "", seats: d.berth || d.seats || "",
      from: d.from || d.src || "", to: d.to || d.dst || "",
      chartInMin: +d.chartInMin || 0, wlNo: +d.wlNo || 0,
      timeline: Array.isArray(d.timeline) ? d.timeline : undefined,
      source: "live-provider"
    };
  } catch (_) { return null; }
}
function normLive(q, v) {
  try {
    const d = (v && (v.data || v.result)) || v;
    if (!d || typeof d !== "object") return null;
    if (typeof d.onTime !== "boolean" && d.delayMins === undefined && !d.currentStation) return null;
    return {
      q: String(q), onTime: d.onTime === undefined ? (+d.delayMins || 0) <= 0 : !!d.onTime,
      lateMin: +(d.lateMin || d.delayMins || 0) || 0,
      last: d.last || d.currentStation || "", next: d.next || d.nextStation || "",
      nextInMin: +(d.nextInMin || d.etaMins || 0) || 0,
      progress: +(d.progress || 0) || 0, source: "live-provider"
    };
  } catch (_) { return null; }
}
function normSearch(v) {
  try {
    const list = Array.isArray(v) ? v : (v.trains || v.data || v.result);
    if (!Array.isArray(list)) return null;
    const rows = list.map((r) => ({
      no: r.no || r.trainNo || r.number, name: r.name || r.trainName || "",
      dep: r.dep || r.departure || "", arr: r.arr || r.arrival || "",
      dur: r.dur || r.duration || "", days: r.days || r.runsOn || "",
      fare: +(r.fare || 0) || 0, status: r.status || "Timetable",
      seats: r.seats == null ? null : +r.seats, wl: +r.wl || 0
    })).filter((r) => r.no && r.name && r.dep && r.arr);
    return rows.length ? rows : null;
  } catch (_) { return null; }
}
async function pnrStatus(pnr, c) {
  c = c || cfg();
  if (!enabled(c) || !/^\d{10}$/.test(String(pnr))) return null;
  const v = await get(c.base + c.pnrPath.replace("{pnr}", encodeURIComponent(pnr)), headers(c));
  return v ? normPnr(pnr, v) : null;
}
async function liveStatus(q, c) {
  c = c || cfg();
  if (!enabled(c)) return null;
  const v = await get(c.base + c.livePath.replace("{train}", encodeURIComponent(q)), headers(c));
  return v ? normLive(q, v) : null;
}
async function trainsBetween(from, to, date, c) {
  c = c || cfg();
  if (!enabled(c) || !from || !to) return null;
  const v = await get(
    c.base + c.searchPath + "?from=" + encodeURIComponent(from) +
    "&to=" + encodeURIComponent(to) + "&date=" + encodeURIComponent(date || ""),
    headers(c));
  return v ? normSearch(v) : null;
}
module.exports = { cfg, enabled, pnrStatus, liveStatus, trainsBetween };
