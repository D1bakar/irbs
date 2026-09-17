# Observability — LP6

- Client beacons: `fallback:*`, `page:*`, `funnel:*` → `POST /api/events` (consent-gated, `sendBeacon`).
- Server: log `[auth] code`, 4xx/5xx + `ip` truncated. Wire to Sentry/OpenTelemetry in prod (`SENTRY_DSN`).
- Data: `data/events.json` locally; Postgres `api_events` in prod. Dashboard query: fallbacks by hour, top pages, funnel drop.
- SW: version `railbook-v6` in `caches.keys()` — old caches purged on activate.
