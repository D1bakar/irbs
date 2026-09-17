// Copy to config.local.js for per-dev overrides (git-ignored).
// Example: point to staging API instead of same-origin.
// window.RAILBOOK_API_BASE = "https://staging.railbook.example.com";
// window.IRCTC_ENV = "staging-lp6";
//
// LIVE RAIL DATA (server-side env, see docs/REALDATA.md):
// Indian Railways has no free public API for PNR / live status / availability.
// Without keys the server honestly returns handoff/static data. To go live:
//   RAIL_PROVIDER=rapidapi
//   RAIL_API_BASE=https://<your-rapidapi-provider-host>
//   RAPIDAPI_KEY=<key>  RAPIDAPI_HOST=<same-host>
// Optional path overrides: RAIL_PNR_PATH, RAIL_LIVE_PATH, RAIL_SEARCH_PATH.
