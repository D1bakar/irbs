// Optional AI chat provider adapter. Zero deps, server-side only. The API key
// never reaches the browser (CSP connect-src 'self' blocks direct calls anyway).
//
// Without a key RailBook stays honest: /api/chat answers rail questions from
// built-in facts + official links (the "handoff" pattern used for PNR/live).
// It never invents PNRs, seats, fares or live availability.
//
// To go live, set (any OpenAI-compatible /chat/completions endpoint works):
//   AI_PROVIDER=openai-compatible
//   AI_API_BASE=https://api.mistral.ai   (or api.openai.com, api.groq.com, ...)
//   AI_API_KEY=sk-...                    MISTRAL_API_KEY / OPENAI_API_KEY accepted too
//   AI_MODEL=mistral-small-latest        (optional, sensible default per provider)
// Optional overrides:
//   AI_CHAT_PATH=/v1/chat/completions    AI_TIMEOUT_MS=15000
const https = require("https");

function cfg() {
  return {
    provider: (process.env.AI_PROVIDER || "none").toLowerCase(),
    base: (process.env.AI_API_BASE || "").replace(/\/+$/, ""),
    key: process.env.AI_API_KEY || process.env.MISTRAL_API_KEY || process.env.OPENAI_API_KEY || "",
    model: process.env.AI_MODEL || "",
    path: process.env.AI_CHAT_PATH || "/v1/chat/completions",
    timeoutMs: +process.env.AI_TIMEOUT_MS || 15000
  };
}
function enabled(c) {
  c = c || cfg();
  return c.provider !== "none" && !!c.base && !!c.key;
}

// POST JSON, bounded response, resolves null on any failure (caller falls back).
function postJson(url, body, headers, timeoutMs) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const data = JSON.stringify(body);
      const req = https.request({
        hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search,
        method: "POST", headers: Object.assign({}, headers, {
          "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data)
        }), timeout: timeoutMs || 15000
      }, (res) => {
        let s = "";
        res.on("data", (c) => { s += c; if (s.length > 2e5) req.destroy(); }); // cap ~200KB
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) return resolve(null);
          try { resolve(JSON.parse(s)); } catch (_) { resolve(null); }
        });
      });
      req.on("timeout", () => { try { req.destroy(); } catch (_) {} resolve(null); });
      req.on("error", () => resolve(null));
      req.write(data);
      req.end();
    } catch (_) { resolve(null); }
  });
}

// System prompt: honest rail assistant. No live data, no PNR lookup, no bookings.
const SYSTEM = "You are RailBook's assistant on an Indian Railways information site. " +
  "Answer briefly (under 120 words), in the same language the user writes in, with easy words. " +
  "You help with: train timetables (general knowledge), stations, Tatkal rules, refunds/TDR deadlines, " +
  "quotas, food (139 / 1800-1034-139), and how to use this site. " +
  "You have NO live data: never invent PNR status, seat availability, fares, delays or running status - " +
  "point to official IRCTC (https://www.irctc.co.in) and NTES (https://enquiry.indianrail.gov.in) for those. " +
  "RailBook does not book tickets or take payments; it links to official IRCTC booking.";

function chat(c) {
  return async function aiChat(messages) {
    c = c || cfg();
    if (!enabled(c) || !Array.isArray(messages) || !messages.length) return null;
    const body = { model: c.model || "gpt-4o-mini", messages: [{ role: "system", content: SYSTEM }].concat(messages), temperature: 0.3, max_tokens: 300, stream: false };
    const v = await postJson(c.base + c.path, body, { Accept: "application/json", Authorization: "Bearer " + c.key }, c.timeoutMs);
    try {
      const txt = v && v.choices && v.choices[0] && v.choices[0].message && v.choices[0].message.content;
      return (typeof txt === "string" && txt.trim()) ? txt.trim().slice(0, 2000) : null;
    } catch (_) { return null; }
  };
}

module.exports = { cfg, enabled, SYSTEM, chat };
