// Shared API helpers: JSON I/O, CORS, method guard.
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  res.end(body);
}
function readJson(req) {
  return new Promise((resolve) => {
    let s = "";
    req.on("data", c => { s += c; if (s.length > 1e6) req.destroy(); });
    req.on("end", () => { try { resolve(s ? JSON.parse(s) : {}); } catch (_) { resolve({}); } });
  });
}
function uid(prefix) {
  return (prefix || "id") + "_" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}
module.exports = { send, readJson, uid };
