// Build the vendored full-India station directory from the open AskDisha snapshot.
// Usage: node scripts/build-stations.js <path-to-stationupdated.json>
// Source (open data, official IR feed via CDN backup):
//   https://github.com/ProgrammerNomad/indian-railway-station-search (public/data/stationupdated.json)
// Output: data/stations-full.json — slim [{code,name,state,lat,lon}], deduped by code.
// The file is server-side only (never shipped to the browser); /api/stations searches it.
const fs = require("fs");
const path = require("path");

const src = process.argv[2];
if (!src) { console.error("usage: node scripts/build-stations.js <stationupdated.json>"); process.exit(1); }
const raw = JSON.parse(fs.readFileSync(src, "utf8"));
const arr = Array.isArray(raw) ? raw : raw.stations || raw.data || [];
const normState = (s) => String(s || "").trim().replace(/\s+/g, " ");
const seen = new Map();
for (const r of arr) {
  const code = String(r.code || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{1,6}$/.test(code)) continue; // drop junk rows (XX-*, blanks)
  const name = String(r.name || "").trim().replace(/\s+/g, " ");
  if (!name) continue;
  const lat = +r.latitude, lon = +r.longitude;
  if (seen.has(code)) continue;
  seen.set(code, {
    code, name, state: normState(r.state),
    ...(Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : {})
  });
}
const out = [...seen.values()].sort((a, b) => a.code.localeCompare(b.code));
const dest = path.join(__dirname, "..", "data", "stations-full.json");
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`wrote ${out.length} stations -> ${dest} (${(fs.statSync(dest).size / 1024).toFixed(0)}KB)`);
const withGeo = out.filter((s) => typeof s.lat === "number").length;
console.log(`with coords: ${withGeo}`);
