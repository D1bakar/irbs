// Staging demo endpoint. Serves fixture payloads so the "wire real search"
// slice can be executed end-to-end locally.
// Usage: node tests/mock-server.js [ok|wl|bad|off|empty] [port]
//   ok    -> search-ok, stations-ok, specials-ok, pnr-ok, live-ok (default)
//   wl    -> search-wl (others ok)
//   bad   -> invalid shape -> must fallback
//   empty -> valid [] -> must show empty state, NOT fallback
//   off   -> HTTP 500 (must fallback)
const http = require("http");
const fs = require("fs");
const path = require("path");
const mode = process.argv[2] || "ok";
const port = +(process.argv[3] || 8942);
const base = path.join(__dirname, "..");
const files = { ok: "search-ok.json", wl: "search-wl.json", bad: "search-bad.json", empty: "search-empty.json" };
function sendFile(res, name, latency) {
  setTimeout(() => {
    try {
      const data = fs.readFileSync(path.join(base, "tests/fixtures", name));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(data);
    } catch (e) { res.writeHead(500); res.end("{}"); }
  }, latency || 120);
}
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  if (req.method === "POST" && req.url === "/v1/search") {
    if (mode === "off") { res.writeHead(500, { "Content-Type": "application/json" }); return res.end('{"error":"down"}'); }
    let body = "";
    req.on("data", c => (body += c));
    req.on("end", () => sendFile(res, files[mode] || files.ok, 120));
    return;
  }
  if (req.method === "POST" && (req.url === "/v1/stations" || req.url === "/v1/specials" || req.url === "/v1/pnr" || req.url === "/v1/live")) {
    if (mode === "off") { res.writeHead(500, { "Content-Type": "application/json" }); return res.end('{"error":"down"}'); }
    let body = "";
    req.on("data", c => (body += c));
    req.on("end", () => {
      if (mode === "bad") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end('{"broken":true}'); }
      if (mode === "empty") {
        const emptyMap = { "/v1/stations": '{"stations":[]}', "/v1/specials": '{"specials":[]}', "/v1/search": "[]", "/v1/pnr": '{"broken":true}', "/v1/live": '{"broken":true}' };
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(emptyMap[req.url] || "{}");
      }
      const map = { "/v1/stations": "stations-ok.json", "/v1/specials": "specials-ok.json", "/v1/pnr": "pnr-ok.json", "/v1/live": "live-ok.json" };
      sendFile(res, map[req.url], 120);
    });
    return;
  }
  res.writeHead(404); res.end("not found");
});
server.listen(port, "127.0.0.1", () => console.log(`mock-search mode=${mode} on http://127.0.0.1:${port}/v1/search`));
