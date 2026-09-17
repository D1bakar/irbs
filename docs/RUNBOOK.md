# Runbook — LP6

## Alerts/vendors spam
Rate-limit 429 → check `data/events.json` + provider logs. Block IP at edge, require OTP for writes.

## OTP abuse
`too-many-codes` → 5 req/min/IP. `too-many-attempts` → 5 tries/code. Rotate SMS key, enable captcha.

## Fallback spike (`fallback:searchTrains`)
Check DB/CPU, `GET /api/health`, recent deploy. Clients show “Sample data” pill automatically.

## PII deletion request
`DELETE /api/account {phone}` + verify `data/alerts.json`, `vendors.json`, `otp.json` clean. Reply within 72h (DPDP).

## Uptime
Monitor `GET /api/health`, SW version `railbook-v6`, `sitemap.xml` freshness. Status page = `docs/STATUS.md`.
