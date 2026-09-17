// Per-environment endpoints. LP6 serverless-first.
// Default points to same-origin /api/* (works on Vercel/Netlify/Cloudflare + `node serve.js` locally).
// Set window.RAILBOOK_API_BASE to override (e.g. staging URL). Pure demo only if endpoints unreachable —
// api.js validates shapes and falls back to on-device timetable with a "Sample data" pill.
window.RAILBOOK_API_BASE = window.RAILBOOK_API_BASE || "";
window.IRCTC_ENDPOINTS = window.IRCTC_ENDPOINTS || {
  search: "/api/search",
  pnr: "/api/pnr",
  live: "/api/live",
  auth: "/api/auth",
  booking: "/api/trips",
  stations: "/api/stations",
  specials: "/api/specials",
  vendors: "/api/vendors",
  alerts: "/api/alerts",
  events: "/api/events",
  account: "/api/account"
};
window.IRCTC_ENV = window.IRCTC_ENV || "prod-lp6";
// Legacy alias: config.local.js (git-ignored) may still override per-env.
