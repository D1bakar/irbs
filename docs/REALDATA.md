# Real data — what is live now, what needs a key

## Already real (no key, works offline)

- **60 curated majors with true GPS coordinates** (`db/seed.json`, `data/stations.json`):
  codes, names, states, platform counts and lat/lon are real station data.
- **Full all-India directory — 8,464 real stations** (`data/stations-full.json`,
  server-side only, built by `scripts/build-stations.js` from the open AskDisha
  snapshot). Type any station name or code (min 2 letters) in search,
  autocomplete, or the station directory — if it exists in Indian Railways,
  it is found, exact/code matches first. Smaller halts show as directory
  entries (name + code + state + GPS distance); the 60 majors additionally
  show platforms and amenities. Regenerate with:
  `node scripts/build-stations.js <stationupdated.json>`.
- **Nearby search**: tap **Use my location** on `stations.html`. The browser GPS
  position is sent to `POST /api/stations` as `{lat, lon, radiusKm}` and the
  server sorts by Haversine distance, returning `distKm` per station.
  Offline fallback (`api.js` 12-station list) does the same math on-device.
- Notes: GPS needs **HTTPS or localhost** plus user permission. If denied, the
  page keeps working with manual search. Your coordinates are used only for
  sorting — they are never stored (see `privacy.js`, `/api/account`).

## Needs a licensed provider key (honest handoff until then)

Indian Railways / IRCTC publish **no free public API** for:

- PNR status (10-digit), live train running status, seat availability / fare.

Scraping NTES (`enquiry.indianrail.gov.in`) violates its terms, so RailBook
does **not** scrape. Without a key:

- `POST /api/pnr`, `/api/live` → `{handoff:true, url: NTES}` (official CTA).
- `POST /api/search` → static timetable (`status:"Timetable"`, `seats:null`)
  with a "verify on IRCTC" note. Availability is never invented.

## Going live with a key

1. Subscribe to a licensed aggregator, e.g. a RapidAPI **"Indian Railways /
   IRCTC"** provider (live train status + PNR + trains-between endpoints).
2. Set server env (Vercel/Netlify dashboard or `.env` locally):
   `RAIL_PROVIDER=rapidapi`, `RAIL_API_BASE=https://<provider-host>`,
   `RAPIDAPI_KEY=<key>`, `RAPIDAPI_HOST=<provider-host>`.
   Path defaults suit most RapidAPI IRCTC providers; override with
   `RAIL_PNR_PATH=/getPNRStatus/{pnr}`, `RAIL_LIVE_PATH=/live-train/{train}/status`,
   `RAIL_SEARCH_PATH=/trains-between` if yours differs.
3. Restart / redeploy. Verify:
   `curl -X POST localhost:8906/api/live -d '{"q":"12301"}'` should return
   `source:"live-provider"` instead of `handoff:true`.
4. Code path: `lib/rail-provider.js` (8s timeout, null-on-failure) →
   `serve.js` (`/api/pnr`, `/api/live`, `/api/search`) → existing frozen
   client shapes, so no frontend change is needed.

## Data freshness

- Station coords: static, verified Sep 2026 against public railway maps
  (station-level accuracy, ±1 km is enough for nearby sorting).
- Timetable rows without a provider are **indicative only** — always confirm
  train numbers/times on IRCTC/NTES before travel.
