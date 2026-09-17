# RailBook LP6 — Architecture

Static frontend (17 HTML, no build) + same-origin `/api/*` serverless.

- `config.js` → `IRCTC_ENDPOINTS` points to `/api/*`. Override via `RAILBOOK_API_BASE`.
- `api.js` validates shapes, beacons `fallback:*` to `/api/events`, never invents PNR/live.
- `serve.js` serves static + JSON API. Deploy as Node or split `api/*.js` to Vercel functions.
- `lib/store.js` is JSON-file in `data/` locally; set `DATABASE_URL` + run `db/schema.sql` for Postgres.
- Auth: `POST /api/auth/request` → 6-digit OTP (5 min, 5 tries), `POST /api/auth/verify` → `HttpOnly rb_session`. Dev returns `devCode` in JSON + server log; prod sends SMS.
- Trips: `POST /api/trips` → opaque `t_*` ID. Share `?trip=ID` resolves server-side (no PII in URL).
- PNR/live: `POST /api/pnr|live` → `{handoff:true, url: NTES}`. No fake coach/seat.
- Offline: `sw.js` network-first 3s timeout + `RB_OUTBOX` (`outbox.js`) flush on `online` / `sync:rb-outbox`.
- Privacy: `consent.js` (`rb-consent-v1`), `privacy.js` TTL prune + `DELETE /api/account`, `analytics.js` beacons only with consent.
- AI chat: `chat.js`+`chat.css` floating widget (all 17 pages) → `POST /api/chat`. Order: built-in rail facts (`lib/rail-help.js`) → optional LLM (`lib/ai-provider.js`, OpenAI-compatible, key server-side only) → honest NTES handoff. Never invents PNR/live/fares. Rate-limited like all writes.
- Security headers: `vercel.json` + `_headers` + `serve.js secHeaders` (CSP, HSTS, X-Frame DENY).
