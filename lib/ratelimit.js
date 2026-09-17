// In-memory sliding-window rate limiter (per-IP + route). For multi-instance prod, put behind Upstash/Redis.
const hits = new Map();
function limit(ip, route, max = 30, windowMs = 60000) {
  const k = ip + "|" + route;
  const now = Date.now();
  const arr = (hits.get(k) || []).filter(t => now - t < windowMs);
  arr.push(now);
  hits.set(k, arr);
  return { ok: arr.length <= max, remaining: Math.max(0, max - arr.length) };
}
if (typeof module !== "undefined") module.exports = { limit };
