// LP6 static a11y gates (zero deps, complements manual axe run).
const fs = require("fs");
const path = require("path");
const base = path.join(__dirname, "..");
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const htmlFiles = ["index.html","tatkal.html","refunds.html","pnr-help.html","live-help.html","catering.html","concessions.html","contact.html","terms.html","privacy.html","cookies.html","404.html","stations.html","specials.html","alerts.html","stories.html","vendors.html"];
for (const f of htmlFiles) {
  const t = fs.readFileSync(path.join(base, f), "utf8");
  ok(t.includes('class="skip"'), f + " skip link");
  ok(/<html[^>]*lang="/.test(t), f + " html lang");
}
const main = fs.readFileSync(path.join(base, "main.js"), "utf8");
ok(main.includes("aria-activedescendant"), "autocomplete uses aria-activedescendant");
ok(main.includes("aria-selected"), "options use aria-selected");
ok(main.includes(".skip") && main.includes("focus"), "toTop returns focus");
ok(!/Demo code \(valid/.test(main), "no demo OTP in DOM");
const sw = fs.readFileSync(path.join(base, "sw.js"), "utf8");
ok(sw.includes("timeoutFetch") || sw.includes("3000"), "SW has timeout");
console.log(fail ? fail + " A11Y FAILURES" : "A11Y OK");
process.exit(fail ? 1 : 0);
