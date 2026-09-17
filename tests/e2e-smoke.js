// LP6 smoke: boots serve.js on ephemeral port, hits /api/* + static HTML gates. Zero deps.
const { spawn } = require("child_process");
const path = require("path");
const base = path.join(__dirname, "..");
function fetchJson(url, opts) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? require("https") : require("http");
    const req = lib.request(url, { method: (opts && opts.method) || "GET", headers: (opts && opts.headers) || {} }, (res) => {
      let s = ""; res.on("data", c => s += c); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: s }));
    });
    req.on("error", reject);
    if (opts && opts.body) req.write(opts.body);
    req.end();
  });
}
async function main() {
  const port = 8911 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, [path.join(base, "serve.js")], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
  await new Promise(r => setTimeout(r, 900));
  let fail = 0;
  const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
  try {
    const h = await fetchJson(`http://localhost:${port}/api/health`);
    ok(h.status === 200 && h.body.includes('"ok":true'), "api health");
    const st = await fetchJson(`http://localhost:${port}/api/stations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: "Howrah" }) });
    ok(st.status === 200 && st.body.includes("HWH"), "api stations Howrah");
    const sp = await fetchJson(`http://localhost:${port}/api/specials`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ when: "all" }) });
    ok(sp.status === 200 && sp.body.includes("chhath"), "api specials");
    const pnr = await fetchJson(`http://localhost:${port}/api/pnr`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pnr: "1234567890" }) });
    ok(pnr.status === 200 && pnr.body.includes("handoff"), "api pnr handoff (no fake)");
    const idx = await fetchJson(`http://localhost:${port}/index.html`);
    ok(idx.status === 200 && idx.body.includes('rel="canonical"'), "index has canonical");
    ok(idx.body.includes("RailBook") && !idx.body.includes("IRCTC Concept"), "index rebranded");
    ok(idx.body.includes("consent.js") && idx.body.includes("handoff.js"), "index loads LP6 scripts");
    ok((idx.headers["content-security-policy"] || "").includes("default-src"), "CSP header present");
  } catch (e) { console.log("FAIL smoke exception " + e.message); fail++; }
  finally { try { child.kill(); } catch (_) {} }
  console.log(fail ? fail + " SMOKE FAILURES" : "SMOKE OK");
  process.exit(fail ? 1 : 0);
}
main();
