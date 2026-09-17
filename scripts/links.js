// Static internal-link checker (no network). Fails on dead relative hrefs.
const fs = require("fs");
const path = require("path");
const base = path.join(__dirname, "..");
const htmlFiles = ["index.html","tatkal.html","refunds.html","pnr-help.html","live-help.html","catering.html","concessions.html","contact.html","terms.html","privacy.html","cookies.html","404.html","stations.html","specials.html","alerts.html","stories.html","vendors.html"];
const okFiles = new Set([...htmlFiles, "style.css","og-image.svg","icon-192.svg","icon-512.svg","icon-192.png","icon-512.png","manifest.webmanifest","sitemap.xml","robots.txt","config.js","api.js","main.js","lang.js","consent.js","handoff.js","analytics.js","sw.js"]);
let fail = 0;
for (const f of htmlFiles) {
  const t = fs.readFileSync(path.join(base, f), "utf8");
  for (const m of t.matchAll(/href="([^"]+)"/g)) {
    const h = m[1];
    if (/^(https?:|mailto:|tel:|#)/.test(h)) continue;
    if (h.startsWith("/api/")) continue;
    const file = path.basename(h.split("#")[0].split("?")[0]);
    if (!file) continue;
    if (!okFiles.has(file) && !fs.existsSync(path.join(base, file))) { console.log("FAIL " + f + " -> " + h); fail++; }
  }
}
console.log(fail ? fail + " broken links" : "LINKS OK");
process.exit(fail ? 1 : 0);
