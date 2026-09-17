// Journey + kill tests. No deps. Run: node tests/journey.js
// Spins mock-server in ok/wl/bad/off/empty modes and asserts live-vs-fallback decisions.
const { spawn } = require("child_process");
const path = require("path");
let fail = 0;
function ok(c, m) { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; }
function isRow(r) { return r && r.no !== undefined && typeof r.name === "string" && typeof r.dep === "string" && typeof r.arr === "string"; }
function post(port, route, body) {
  return new Promise((resolve, reject) => {
    const http = require("http");
    const data = JSON.stringify(body);
    const req = http.request({ host: "127.0.0.1", port, path: route, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }, timeout: 6000 }, res => {
      let b = ""; res.on("data", c => (b += c)); res.on("end", () => resolve({ status: res.statusCode, body: b }));
    });
    req.on("error", reject); req.on("timeout", () => { req.destroy(new Error("timeout")); });
    req.write(data); req.end();
  });
}
async function postRetry(port, route, body) {
  let r = null, lastErr = null;
  for (let attempt = 0; attempt < 4 && !r; attempt++) {
    try { r = await post(port, route, body); }
    catch (e) { lastErr = e; await new Promise(x => setTimeout(x, 500)); }
  }
  if (!r) throw lastErr || new Error("no response");
  return r;
}
function withMock(mode) {
  return new Promise(resolve => {
    const p = spawn(process.execPath, [path.join(__dirname, "mock-server.js"), mode, "8943"], { stdio: "ignore" });
    setTimeout(() => resolve(p), 1000);
  });
}
(async () => {
  for (const mode of ["ok", "wl", "bad", "off", "empty"]) {
    const p = await withMock(mode);
    try {
      const r = await postRetry(8943, "/v1/search", { from: "HWH", to: "NDLS", date: "2026-10-01", cls: "AC 3 Tier (3A)", quota: "General" });
      const payload = r.status === 200 ? JSON.parse(r.body) : null;
      const list = Array.isArray(payload) ? payload : payload && payload.trains;
      const validNonEmpty = r.status === 200 && Array.isArray(list) && list.length > 0 && list.every(isRow);
      const validAny = r.status === 200 && Array.isArray(list) && list.every(isRow);
      if (mode === "ok") ok(validNonEmpty && list.length === 2, "live ok: 2 valid rows -> USE LIVE");
      if (mode === "wl") ok(validNonEmpty && list[0].status === "Waitlist", "live wl: waitlist row -> USE LIVE");
      if (mode === "bad") ok(!validAny, "live bad: invalid shape -> MUST FALLBACK to mock");
      if (mode === "off") ok(r.status !== 200, "live off: HTTP 500 -> MUST FALLBACK to mock");
      if (mode === "empty") ok(validAny && list.length === 0, "live empty: [] valid -> SHOW EMPTY, not fallback");
      if (mode === "ok") {
        const st = await postRetry(8943, "/v1/stations", { q: "" });
        const stPayload = JSON.parse(st.body);
        ok(st.status === 200 && Array.isArray(stPayload.stations) && stPayload.stations.length >= 1, "live stations ok -> USE LIVE");
        const sp = await postRetry(8943, "/v1/specials", { when: "all" });
        const spPayload = JSON.parse(sp.body);
        ok(sp.status === 200 && Array.isArray(spPayload.specials), "live specials ok -> USE LIVE");
        const pnr = await postRetry(8943, "/v1/pnr", { pnr: "6841523790" });
        ok(pnr.status === 200 && JSON.parse(pnr.body).pnr === "6841523790", "live pnr ok -> USE LIVE");
        const live = await postRetry(8943, "/v1/live", { q: "12301" });
        ok(live.status === 200 && JSON.parse(live.body).onTime === true, "live live ok -> USE LIVE");
      }
      if (mode === "empty") {
        const st = await postRetry(8943, "/v1/stations", { q: "" });
        ok(JSON.parse(st.body).stations.length === 0, "live stations empty -> SHOW EMPTY");
      }
    } catch (e) {
      ok(mode === "off", `live ${mode}: transport error -> ${mode === "off" ? "correctly FALLBACK" : "UNEXPECTED " + e.message}`);
    }
    p.kill();
    await new Promise(r => setTimeout(r, 800));
  }
  console.log(fail ? `\n${fail} FAILURES` : "\nJOURNEY/KILL ALL PASS");
  process.exit(fail ? 1 : 0);
})();
