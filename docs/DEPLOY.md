# Deploy — LP6

## Local
`npm run serve` → `http://localhost:8906` (static + /api). Data in `data/*.json` (git-ignored in prod).

## Vercel / Netlify
- **Root Directory MUST be the `landing page 6` folder** (the one containing
  `package.json`, `api/` and `index.html). Deploying its parent is the #1 cause
  of "Function invocation failed" — Vercel then finds no functions/config.
  In the Vercel dashboard: Project → Settings → General → Root Directory →
  `built it first/landing page 6`.
- Framework Preset: **Other**. Build Command: empty. Output Directory: empty
  (static files sit at the root).
- Functions = `api/*.js` (each delegates to `serve.js handleApi` via
  `lib/handler.js`, which converts any throw into JSON — never a blank 500).
- **Never add a root `server.js`.** Vercel auto-detects that filename as the whole
  app's entrypoint ("Using server.js as the root entrypoint") and hijacks
  routing away from `api/*` functions. The local dev server is `serve.js`
  for this reason (`tests/run.js` fails the build if `server.js` reappears).
  `lib/handler.js`, which converts any throw into JSON — never a blank 500).
  Sub-paths exist as files because Vercel maps path segments to files:
  `api/auth/request.js`, `api/auth/verify.js`.
- `vercel.json` pins `data/*.json + db/seed.json + lib/*.js` into the function
  bundle (`includeFiles`) — without this the 8,464-station directory may be
  missing at runtime and lookups return empty.
- Env: `RAILBOOK_ENV=prod`, `DATABASE_URL` (Neon/Supabase), `SMS_PROVIDER_KEY`.
  AI chat (optional): any OpenAI-compatible provider — `AI_PROVIDER=openai-compatible`, `AI_API_BASE=https://api.mistral.ai`, `AI_API_KEY=...`, `AI_MODEL=mistral-small-latest`. Without it, `/api/chat` answers from built-in rail facts and hands off to NTES/IRCTC (never fake answers). The key is server-side only; the browser calls same-origin `/api/chat`.
  Live rail data (optional): `RAIL_PROVIDER`, `RAIL_API_BASE`, `RAPIDAPI_KEY`,
  `RAPIDAPI_HOST` — see `REALDATA.md`.
- Headers: `vercel.json` / `_headers` already set (CSP/HSTS/X-Frame).
- Post-deploy: `npm run sitemap` with `RAILBOOK_CANON=https://your.domain`, verify `/api/health`, `node tests/run.js` against prod URL.

## Postgres
`psql $DATABASE_URL -f db/schema.sql`, import `db/seed.json` stations/specials.

## Rollback
Static + API versioned together (`railbook-v6` SW). Rollback = redeploy previous commit; clients fall back to cache + outbox.
