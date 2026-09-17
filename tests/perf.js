// LP6 perf budgets (static). Fails if bundles grow or render-blocking regresses.
const fs = require("fs");
const path = require("path");
const base = path.join(__dirname, "..");
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
function kb(f) { return fs.statSync(path.join(base, f)).size / 1024; }
ok(kb("style.css") < 50, `style.css <50KB (${kb("style.css").toFixed(1)}KB)`);
ok(kb("main.js") < 95, `main.js <95KB (${kb("main.js").toFixed(1)}KB)`);
ok(kb("api.js") < 30, `api.js <30KB (${kb("api.js").toFixed(1)}KB)`);
ok(kb("lang.js") < 260, `lang.js <260KB (${kb("lang.js").toFixed(1)}KB, split planned)`);
const idx = fs.readFileSync(path.join(base, "index.html"), "utf8");
const head = idx.split("</head>")[0] || "";
ok(!/<script[^>]*src=/.test(head), "no blocking head scripts");
ok(idx.includes('media="print"'), "fonts non-blocking");
ok(idx.includes('rel="canonical"'), "canonical present");
ok(fs.existsSync(path.join(base, "icon-192.png")) && fs.existsSync(path.join(base, "icon-512.png")), "PNG icons exist");
console.log(fail ? fail + " PERF FAILURES" : "PERF OK");
process.exit(fail ? 1 : 0);
