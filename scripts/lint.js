// Minimal static lint: no inline event handlers with JS URLs, no hardcoded prod secrets, no tricolor CSS.
const fs = require("fs");
const path = require("path");
const base = path.join(__dirname, "..");
let fail = 0;
function ok(c, m) { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; }
const htmlFiles = ["index.html","tatkal.html","refunds.html","pnr-help.html","live-help.html","catering.html","concessions.html","contact.html","terms.html","privacy.html","cookies.html","404.html","stations.html","specials.html","alerts.html","stories.html","vendors.html"];
for (const f of htmlFiles) {
  const t = fs.readFileSync(path.join(base, f), "utf8");
  ok(!/javascript:/i.test(t), f + " no javascript: URLs");
  ok(!/IRCTC Concept/.test(t), f + " rebranded (no IRCTC Concept)");
  ok(t.includes('rel="canonical"'), f + " has canonical");
}
const css = fs.readFileSync(path.join(base, "style.css"), "utf8");
ok(!css.includes(".foot-tri"), "css has no tricolor");
const cfg = fs.readFileSync(path.join(base, "config.js"), "utf8");
ok(!/api\.example\.com/.test(cfg), "config has no example prod URLs");
console.log(fail ? fail + " FAILURES" : "LINT OK");
process.exit(fail ? 1 : 0);
