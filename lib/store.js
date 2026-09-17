// File-backed store for local dev. In prod, set DATABASE_URL to use Postgres (see db/schema.sql).
// Shapes match Postgres tables so migration is drop-in.
// Vercel-safe: the bundled repo filesystem is READ-ONLY at runtime (except /tmp).
// Reads come from the bundled data/ dir; writes go to /tmp on Vercel, ./data locally.
const fs = require("fs");
const path = require("path");
const READ_DIR = path.join(__dirname, "..", "data");
const IS_SERVERLESS = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_VERSION;
const WRITE_DIR = IS_SERVERLESS ? path.join("/tmp", "railbook-data") : READ_DIR;
try { fs.mkdirSync(WRITE_DIR, { recursive: true }); } catch (_) {}
function readBundled(name) {
  try {
    const p = path.join(READ_DIR, name);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (_) {}
  return undefined;
}
function file(name, fallback) {
  // 1) writable copy (local ./data, or /tmp on Vercel) wins when present
  try {
    const p = path.join(WRITE_DIR, name);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (_) {}
  // 2) fall back to bundled read-only data
  const bundled = readBundled(name);
  if (bundled !== undefined) return Array.isArray(bundled) ? bundled.slice() : (bundled && typeof bundled === "object" ? { ...bundled } : bundled);
  // 3) last resort: create writable copy from fallback (local dev only really)
  try { fs.writeFileSync(path.join(WRITE_DIR, name), JSON.stringify(fallback, null, 2)); } catch (_) {}
  return fallback.slice ? fallback.slice() : fallback;
}
function save(name, val) {
  try { fs.writeFileSync(path.join(WRITE_DIR, name), JSON.stringify(val, null, 2)); } catch (_) {}
}
function seed() {
  try {
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "db", "seed.json"), "utf8"));
    if (!fs.existsSync(path.join(WRITE_DIR, "stations.json")) && readBundled("stations.json") === undefined) save("stations.json", seed.stations);
    if (!fs.existsSync(path.join(WRITE_DIR, "specials.json")) && readBundled("specials.json") === undefined) save("specials.json", seed.specials);
  } catch (_) {}
  for (const [f, fb] of [["alerts.json", []], ["vendors.json", []], ["trips.json", []], ["events.json", []], ["otp.json", {}]]) {
    if (!fs.existsSync(path.join(WRITE_DIR, f)) && readBundled(f) === undefined) save(f, fb);
  }
}
seed();
let fullCache = null; // 8k+ open-data directory, parsed once (server-side only)
function stationsFull() {
  if (fullCache) return fullCache;
  try {
    const p = path.join(READ_DIR, "stations-full.json");
    if (!fs.existsSync(p)) return (fullCache = []);
    const v = JSON.parse(fs.readFileSync(p, "utf8"));
    fullCache = Array.isArray(v) ? v : [];
  } catch (_) { fullCache = []; }
  return fullCache;
}
module.exports = {
  stations: () => file("stations.json", []),
  stationsFull,
  specials: () => file("specials.json", []),
  alerts: () => file("alerts.json", []),
  saveAlerts: (v) => save("alerts.json", v),
  vendors: () => file("vendors.json", []),
  saveVendors: (v) => save("vendors.json", v),
  trips: () => file("trips.json", []),
  saveTrips: (v) => save("trips.json", v),
  events: () => file("events.json", []),
  saveEvents: (v) => save("events.json", v),
  otp: () => file("otp.json", {}),
  saveOtp: (v) => save("otp.json", v),
  usePostgres: () => !!process.env.DATABASE_URL
};
