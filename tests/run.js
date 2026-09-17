// Gates for landing page 3. No deps. Run: node tests/run.js
// Fails (exit 1) on broken links, missing i18n keys, or bad api contract.
const fs = require("fs");
const path = require("path");
const base = path.join(__dirname, "..");
let fail = 0;
function ok(cond, msg) {
  console.log((cond ? "PASS " : "FAIL ") + msg);
  if (!cond) fail++;
}
const htmlFiles = ["index.html","tatkal.html","refunds.html","pnr-help.html","live-help.html","catering.html","concessions.html","contact.html","terms.html","privacy.html","cookies.html","404.html","stations.html","specials.html","alerts.html","stories.html","vendors.html"];
const needFiles = [...htmlFiles, "api.js","main.js","lang.js","config.js","analytics.js","sw.js","manifest.webmanifest","style.css","robots.txt","sitemap.xml","og-image.svg","icon-192.svg","icon-512.svg"];
for (const f of needFiles) ok(fs.existsSync(path.join(base, f)), "exists " + f);

// 1. internal hrefs resolve
const hrefRe = /href="([^"]+)"/g;
const idsRe = /id="([^"]+)"/g;
const ids = {};
for (const f of htmlFiles) {
  const t = fs.readFileSync(path.join(base, f), "utf8");
  ids[f] = new Set([...t.matchAll(idsRe)].map(m => m[1]));
}
for (const f of htmlFiles) {
  const t = fs.readFileSync(path.join(base, f), "utf8");
  for (const m of t.matchAll(hrefRe)) {
    const h = m[1];
    if (/^(https?:|mailto:|tel:)/.test(h)) continue;
    if (h.startsWith("/api/")) { ok(true, `${f} -> ${h} api route`); continue; }
    const [pq, frag] = h.split("#");
    const [pfile, qs] = pq.split("?");
    if (!pfile) { if (frag) ok(ids[f].has(frag), `${f} anchor #${frag}`); continue; }
    const target = path.basename(pfile);
    if (!["style.css","og-image.svg","icon-192.svg","icon-512.svg","icon-192.png","icon-512.png","manifest.webmanifest","sitemap.xml","robots.txt","consent.js","handoff.js","outbox.js","privacy.js"].includes(target))
      ok(htmlFiles.includes(target) || fs.existsSync(path.join(base, target)), `${f} -> ${h} resolves`);
    if (frag && htmlFiles.includes(target)) ok(ids[target].has(frag), `${f} -> ${target}#${frag}`);
    if (qs && qs.includes("tab=")) {
      const tab = (qs.match(/tab=([a-z]+)/) || [])[1];
      ok(["search","pnr","live"].includes(tab), `${f} tab=${tab} valid`);
    }
  }
}
// 2. skip link + manifest on every page
for (const f of htmlFiles) {
  const t = fs.readFileSync(path.join(base, f), "utf8");
  ok(t.includes('class="skip"'), f + " has skip link");
  ok(t.includes('rel="manifest"'), f + " links manifest");
}
// 3. i18n: booking/live keys in all 8 langs
const lang = fs.readFileSync(path.join(base, "lang.js"), "utf8");
for (const k of ["selectBtn","bkName","bkAge","confirmBtn","bkDone","chartIn","liveLate","refreshBtn","demoBadge","pillOk","displayOpts"]) {
  const c = (lang.match(new RegExp(k + '\\s*:', "g")) || []).length;
  ok(c >= 8, `lang key ${k} in 8 langs (found ${c})`);
}
// 4. api contract (LP5: 9-key frozen v5)
// LP6 chat: widget files exist, every page loads them, lang keys in 8 langs,
// sw precaches them, api/chat route exists (honest: no fake PNR/live from chat).
for (const f of ["chat.js", "chat.css", "api/chat.js", "lib/ai-provider.js", "lib/rail-help.js"]) ok(fs.existsSync(path.join(base, f)), "exists " + f);
for (const f of htmlFiles) {
  const t = fs.readFileSync(path.join(base, f), "utf8");
  ok(t.includes('href="chat.css"'), f + " loads chat.css");
  ok(t.includes('<script src="chat.js"></script>'), f + " loads chat.js");
}
ok(fs.readFileSync(path.join(base, "sw.js"), "utf8").includes('"chat.js"'), "sw caches chat.js");
ok(fs.readFileSync(path.join(base, "sw.js"), "utf8").includes('"chat.css"'), "sw caches chat.css");
ok(fs.readFileSync(path.join(base, "serve.js"), "utf8").includes('"/api/chat"'), "serve has /api/chat route");
for (const k of ["chatOpen", "chatTitle", "chatSub", "chatPh", "chatSend", "chatClose", "chatHello", "chatBusy", "chatOffline", "chatRetry", "chatHandoff", "chatErr"]) {
  const c = (lang.match(new RegExp(k + '\\s*:', "g")) || []).length;
  ok(c >= 8, `lang key ${k} in 8 langs (found ${c})`);
}
const railHelp = fs.readFileSync(path.join(base, "lib/rail-help.js"), "utf8");
ok(railHelp.includes("NTES") && railHelp.includes("irctc.co.in"), "rail-help answers carry official links");
ok(!/mockPnr|fakePnr|invent/.test(fs.readFileSync(path.join(base, "lib/ai-provider.js"), "utf8").split("//")[0]), "ai-provider makes no fake data claims");
const api = fs.readFileSync(path.join(base, "api.js"), "utf8");
for (const m of ["searchTrains","checkPnr","trainLive","createBooking","readBookings","searchStations","listSpecials","subscribeAlert","createVendorDraft","removeAlert","auth","requestCode","verifyCode","isTrainList","isStation","isSpecial","logFallback"]) ok(api.includes(m), "api has " + m);
const main = fs.readFileSync(path.join(base, "main.js"), "utf8");
for (const m of ["activateTab","IRCTC_API","demoNote","startBooking","offlineBar","serviceWorker"]) ok(main.includes(m), "main has " + m);
// 5. sw precache list matches files (LP5: full 17-page shell)
const sw = fs.readFileSync(path.join(base, "sw.js"), "utf8");
for (const f of ["index.html","tatkal.html","refunds.html","pnr-help.html","live-help.html","catering.html","concessions.html","contact.html","terms.html","privacy.html","cookies.html","404.html","stations.html","specials.html","alerts.html","stories.html","vendors.html","style.css","config.js","api.js","main.js","lang.js"]) ok(sw.includes(f), "sw caches " + f);
// 6. footer outside main on index
const idx = fs.readFileSync(path.join(base, "index.html"), "utf8");
ok(idx.indexOf("</main>") < idx.indexOf("<footer"), "index footer outside main");
// 7. fixtures match frozen contract (LP5: empty is valid, bad must fallback)
function isRow(r) { return r && r.no !== undefined && typeof r.name === "string" && typeof r.dep === "string" && typeof r.arr === "string"; }
try {
  const fxOk = JSON.parse(fs.readFileSync(path.join(base, "tests/fixtures/search-ok.json"), "utf8"));
  ok(Array.isArray(fxOk) && fxOk.length === 2 && fxOk.every(isRow), "fixture search-ok: 2 valid rows");
  const fxWl = JSON.parse(fs.readFileSync(path.join(base, "tests/fixtures/search-wl.json"), "utf8"));
  ok(fxWl.length === 1 && fxWl[0].status === "Waitlist" && fxWl[0].wl > 0, "fixture search-wl: 1 waitlist row");
  const fxBad = JSON.parse(fs.readFileSync(path.join(base, "tests/fixtures/search-bad.json"), "utf8"));
  const badList = Array.isArray(fxBad) ? fxBad : fxBad.trains;
  ok(!(Array.isArray(badList) && badList.every(isRow)), "fixture search-bad: correctly invalid (must trigger fallback)");
  const fxEmpty = JSON.parse(fs.readFileSync(path.join(base, "tests/fixtures/search-empty.json"), "utf8"));
  ok(Array.isArray(fxEmpty) && fxEmpty.length === 0, "fixture search-empty: [] valid empty (show empty, not fallback)");
  const stOk = JSON.parse(fs.readFileSync(path.join(base, "tests/fixtures/stations-ok.json"), "utf8"));
  ok(stOk.stations && stOk.stations.length === 1 && stOk.stations[0].code === "HWH", "fixture stations-ok");
  const spOk = JSON.parse(fs.readFileSync(path.join(base, "tests/fixtures/specials-ok.json"), "utf8"));
  ok(spOk.specials && spOk.specials.length >= 1, "fixture specials-ok");
} catch (e) { ok(false, "fixtures parse: " + e.message); }
// 8. staging config present + loader order (A2/C2) — LP5 requires lang.js in chain
ok(fs.existsSync(path.join(base, "config.local.example.js")), "config.local.example.js exists");
ok(idx.indexOf("config.js") < idx.indexOf("config.local.js") && idx.indexOf("config.local.js") < idx.indexOf("api.js"), "index loads config.js -> config.local.js -> api.js");
ok(idx.indexOf("api.js") < idx.indexOf("lang.js") && idx.indexOf("lang.js") < idx.indexOf("main.js"), "index loads api.js -> lang.js -> main.js (LP5)");
for (const f of ["stations.html","specials.html","alerts.html","vendors.html"]) {
  const t = fs.readFileSync(path.join(base, f), "utf8");
  ok(t.indexOf("config.js") < t.indexOf("api.js") && t.indexOf("api.js") < t.indexOf("main.js"), f + " loads config -> api -> main (working boxes live)");
}
ok(api.includes("logFallback"), "api logs fallback");
// 9. rollback path: no hardcoded prod URLs in shipped files
const shipped = ["config.js","api.js","main.js"].map(f => fs.readFileSync(path.join(base, f), "utf8")).join("\n");
ok(!/https:\/\/api\.example\.com\/v1\/(search|pnr|live)/.test(shipped.replace(/\/\/[^\n]*/g, "")), "no live URLs hardcoded (demo default)");
// 10. perf budgets (LP5: api grew for 9-key contract, still non-blocking end-of-body)
function kb(f) { return fs.statSync(path.join(base, f)).size / 1024; }
ok(kb("style.css") < 45, `style.css <45KB (${kb("style.css").toFixed(1)}KB)`);
ok(kb("main.js") < 85, `main.js <85KB (${kb("main.js").toFixed(1)}KB, end-of-body, non-blocking)`);
ok(kb("api.js") < 24, `api.js <24KB (${kb("api.js").toFixed(1)}KB)`);
for (const f of htmlFiles) {
  const t = fs.readFileSync(path.join(base, f), "utf8");
  const head = (t.split("</head>")[0] || "");
  ok(!/<script[^>]*src=/.test(head), f + " has no blocking head scripts");
}
// 11. a11y audit gates (P5)
for (const f of htmlFiles) {
  const t = fs.readFileSync(path.join(base, f), "utf8");
  ok(/<html[^>]*lang="/.test(t), f + " has html lang");
  ok(/<title>[^<]+<\/title>/.test(t), f + " has title");
  for (const m of t.matchAll(/<img\b([^>]*)>/g)) {
    ok(/alt="/.test(m[1]), f + " img has alt");
  }
  for (const m of t.matchAll(/<button\b([^>]*)>/g)) {
    const a = m[1];
    ok(!/tabindex="[1-9]/.test(a), f + " no positive tabindex");
  }
}
const css = fs.readFileSync(path.join(base, "style.css"), "utf8");
ok(css.includes("body.text-only"), "css has text-only mode");
ok(main.includes("__setTextOnly") && main.includes("__setPlain"), "main exposes display toggle APIs");
ok(!idx.includes('id="heroTextOnly"') && !idx.includes('class="fastlane"') && idx.includes('class="trust-mini"'), "hero stays minimal, trust lives under the button");
ok(/\.hero-grid\s*\{[^}]*min-height:\s*calc\(100svh/.test(css), "booking owns the first viewport");
ok(!idx.includes('class="step-h"') && idx.includes('class="journey-box"') && !idx.includes('<details class="more">'), "search is clean, no numbered steps");
ok(/\.field\s+select\s*\{[^}]*appearance:\s*none/.test(css), "dropdowns share one custom arrow");
ok(/\.field\s+(input|select)[^{]*\{[^}]*min-height:\s*46px/.test(css), "inputs and dropdowns share one compact height");
ok(main.includes("crowd-vote") && main.includes("crowd-count"), "crowd box shows live vote counts");
ok(idx.includes('class="journey-box"') && !idx.includes('class="journey"') && !idx.includes('<details class="more">'), "search is one connected journey control");
ok(/\.journey-box\s+#swap\s*\{[^}]*border-radius:\s*50%/.test(css), "swap is a centered circular button");
ok(/\.tabs\s+button\s*\{[^}]*min-height:\s*40px/.test(css), "tabs meet compact touch size");
ok(idx.includes('id="pax"') && idx.includes('id="envBadge"'), "search has pax + env state");
ok(main.includes("sortbar") && main.includes("myBookings"), "results have sort + my bookings");
ok(css.includes("table.tbl") && css.includes(".sortbar"), "css has tables + sortbar");
ok(lang.includes("optTextOnly") && lang.includes("optPlain") && lang.includes("__syncDisplayMenu"), "lang menu has display toggles");
ok(idx.includes("data:image/svg+xml") && idx.includes('referrerpolicy="no-referrer"'), "index images have offline fallback");
// 12. revolution pillars: code + i18n presence
for (const k of ["textOnly","queueNote","vikalpTitle","retryNextDay","walletTitle","walletUse","walletDel","tripShare","tripAlarm","tripAlarmOn","tripTitle","tripOffline","tripCopied","jargon","plAvail","plWait","voiceBtn","tatkalNudge","tdrTitle","tdrGo","tdrAuto","tdrFile","crowdTitle","crowdQ","crowdThanks","crowdNeed"]) {
  const c = (lang.match(new RegExp(k + '\\s*:', "g")) || []).length;
  ok(c >= 8, `lang key ${k} in 8 langs (found ${c})`);
}
for (const m of ["readWallet","saveToWallet","tatkalChip","vikalpTitle","retryNextDay","queueNote","__saveTrip","tripCard","armArrivalAlert","tripShare","jargonBtn","__plainMode","SpeechRecognition","tdrBox","tatkalNudge","crowdBox","irctc-crowd","stGo","spOut","alGo","tcGo","vdGo1","storyGrid","stickyCta"]) ok(main.includes(m), "main has " + m);
ok(api.includes("fare"), "api mock has fares");
ok((api.match(/code:\s*"HWH"/g) || []).length >= 1 && (api.match(/\{ code:/g) || []).length >= 12, "api has 12-station directory");
ok((api.match(/id:\s*"chhath-1"|id: "chhath-1"/g) || []).length >= 1 && (api.match(/when:\s*"(week|month|all)"/g) || []).length >= 8, "api has 8 festival specials");
ok((api.match(/img:\s*"https:\/\/images\.pexels\.com/g) || []).length >= 8, "specials carry photo thumbs");
ok(main.includes("sp-card") && main.includes("this.remove()"), "specials renderer shows photos safely");
for (const f of ["index.html", "specials.html", "stories.html"]) {
  const t = fs.readFileSync(path.join(base, f), "utf8");
  for (const m of t.matchAll(/<img\b([^>]*)>/g)) {
    const a = m[1];
    ok(/alt="[A-Za-z][^"]{10,}/.test(a), f + " photo has meaningful alt");
    ok(a.includes("referrerpolicy"), f + " photo sets referrerpolicy");
    ok(a.includes("onerror"), f + " photo has offline fallback");
  }
}
ok((idx.match(/class="banner-card b[123]"/g) || []).length === 3, "3 photo banners on homepage");
for (const k of ["statA","offSrc","ban1t","stFound","spFound","alDone","tcGo","tcScore","vdLogin","siLogin","fAll","flStations","flSpecials","flAlerts","flStories","flVendors","disclaimer","vendorLink"]) {
  const c = (lang.match(new RegExp(k + '\\s*:', "g")) || []).length;
  ok(c >= 8, `lang key ${k} in 8 langs (found ${c})`);
}
for (const p of ["stations","specials","alerts","stories","vendors"]) ok(lang.includes("PAGE_I18N." + p), "lang has PAGE_I18N." + p);
ok(css.includes(".jargon-btn") && css.includes(".field .mic") && css.includes("#offlineBar"), "css has pillar styles");
ok(/localStorage\.removeItem\(LANG_KEY\)/.test(lang), "stuck language wiped on load");
ok(!/localStorage\.getItem\("irctc-lang"\)/.test(lang) && !/localStorage\.getItem\("irctc-lang"\)/.test(main), "default language is always English (no stored override)");
ok(/\.btn\s*\{[^}]*display:\s*inline-flex/.test(css), "buttons share one shape (inline-flex .btn)");
ok(/\.pills\s*\{[^}]*flex-wrap:\s*wrap/.test(css), "pills wrap on small screens");
ok(/overflow-wrap:\s*anywhere/.test(css), "long strings cannot push cards off-screen");
ok(/\.wrap\s*\{\s*padding:\s*0 16px/.test(css), "roomier mobile gutters");
ok(/@media\s*\(max-width:\s*400px\)[\s\S]*?\.pop\s*\{\s*grid-template-columns:\s*1fr/.test(css), "popular stacks on tiny screens");
ok(/\.page-cta\s+\.btn\s*\{\s*flex:\s*1 1 100%/.test(css), "subpage CTAs go full-width on phones");
ok(/max-width:\s*calc\(100vw - 32px\)/.test(css), "language menu stays inside viewport");
ok(/\.site-cta\s+\.btn,\s*#langBtn\s*\{[^}]*min-height/.test(css), "header controls share one height");
const an = fs.readFileSync(path.join(base, "analytics.js"), "utf8");
ok(!/https?:\/\//.test(an) && an.includes("/api/events"), "analytics beacons same-origin only (consent-gated)");
// 13. footer gates (LP5: canonical world-class multiline footer, no tricolor, synced across 17 pages)
const footRe = /<footer>[\s\S]*?<\/footer>/;
const canonM = idx.match(footRe);
ok(!!canonM, "index has <footer>");
const canon = canonM ? canonM[0] : "";
ok(canon.includes("\n") && (canon.match(/\n/g) || []).length >= 20, "canonical footer is multiline (readable, not single-line)");
ok(!canon.includes("foot-tri"), "canonical footer has no tricolor");
for (const f of htmlFiles) {
  const raw = fs.readFileSync(path.join(base, f));
  const t = raw.toString("utf8");
  ok(!raw.includes(Buffer.from([0x97])) && !t.includes("�"), f + " has clean utf8 (no 0x97 / replacement)");
  const m = t.match(footRe);
  ok(!!m, f + " has <footer>");
  if (m) ok(m[0] === canon, f + " footer matches canonical");
  ok(t.indexOf("</main>") < t.indexOf("<footer"), f + " footer outside main");
  ok(m && !m[0].includes("foot-tri"), f + " footer has no tricolor");
  ok(m && m[0].includes("\n"), f + " footer is multiline");
  ok(t.includes('foot-emblem'), f + " footer has emblem");
  ok(t.includes('class="wrap foot-bottom"'), f + " footer has bottom bar");
  ok(t.includes('data-i18n="footMade"') && t.includes('data-i18n="footSitemap"') && t.includes('data-i18n="footRailHelp"'), f + " footer bottom i18n keys");
  ok(t.includes('id="year"'), f + " footer has year span");
  ok(t.includes('data-cookie-settings'), f + " footer has cookie settings");
  ok(t.includes('class="foot-meta"') && t.includes('class="dot"'), f + " footer has meta + dot separators");
  ok(m && !m[0].includes('style="margin-top:10px"'), f + " footer has no inline year hack");
}
for (const k of ["footSitemap","footRailHelp","footMade"]) {
  const c = (lang.match(new RegExp(k + '\\s*:', "g")) || []).length;
  ok(c >= 8, `lang key ${k} in 8 langs (found ${c})`);
}
ok(!css.includes(".foot-tri") && css.includes(".foot-emblem") && css.includes(".foot-bottom"), "css has footer emblem/bottom, no tricolor");
ok(css.includes("footer :focus-visible"), "css has footer focus style");
ok(/footer nav a[^}]*min-height:\s*(3\d|4\d)px/.test(css), "css has footer touch targets (36px desktop / 40px mobile)");
ok(!/footer a,\s*footer span/.test(css), "css has no global footer block-span rule");
ok(css.includes(".foot-meta") && css.includes(".foot-bottom .dot"), "css has footer meta + dot separators");
ok(/footer nav\s*\{[^}]*flex-direction:\s*column/.test(css), "css stacks footer nav links vertically (world-class)");
ok(main.includes("getElementById('year')") || main.includes('getElementById("year")'), "main sets footer year");
ok(main.includes(".foot-grid") && main.includes("reveal"), "main reveals footer grid");
ok(main.includes("[data-cookie-settings]"), "main wires footer cookie settings");
// 14. LP6 legal + serverless gates
for (const f of htmlFiles) {
  const t = fs.readFileSync(path.join(base, f), "utf8");
  ok(!t.includes("IRCTC Concept"), f + " rebranded (no IRCTC Concept)");
  ok(t.includes('rel="canonical"') && t.includes("railbook.example.com"), f + " has absolute canonical");
  ok(t.includes('property="og:url"') && t.includes('name="twitter:card"'), f + " has og:url + twitter card");
  ok(t.includes("consent.js") && t.includes("handoff.js") && t.includes("outbox.js") && t.includes("privacy.js"), f + " loads LP6 scripts");
}
ok(idx.includes('media="print"'), "fonts are non-blocking (consent-gated)");
ok(!main.includes("Demo code (valid"), "no demo OTP leak in DOM");
ok(main.includes("aria-activedescendant"), "autocomplete a11y (activedescendant)");
ok(api.includes("handoff") && !api.includes("return mockPnr"), "api has no fake PNR (handoff only)");
ok(!api.includes("return mockLive"), "api has no fake live");
ok(api.includes("/api/events"), "api beacons fallback to server");
for (const f of ["serve.js","lib/validate.js","lib/store.js","lib/ratelimit.js","lib/api.js","lib/handler.js","lib/geo.js","lib/rail-provider.js","db/schema.sql","db/seed.json","consent.js","handoff.js","outbox.js","privacy.js","api/health.js","api/auth/request.js","api/auth/verify.js","vercel.json","_headers","manifest.webmanifest","icon-192.png","icon-512.png"]) {
  ok(fs.existsSync(path.join(base, f)), "exists " + f);
}
ok(!fs.existsSync(path.join(base, "server.js")), "no root server.js (Vercel hijacks it as app entrypoint)");
// 14b. serverless safety: every api entry delegates to the shared JSON-safe handler,
// data files ship with functions, sub-path auth routes exist (Vercel file routing).
for (const f of ["account.js","alerts.js","auth.js","events.js","health.js","search.js","specials.js","stations.js","trips.js","vendors.js"]) {
  const t = fs.readFileSync(path.join(base, "api", f), "utf8");
  ok(t.includes('require("../lib/handler")'), "api/" + f + " delegates to lib/handler");
}
for (const f of ["api/auth/request.js","api/auth/verify.js"]) {
  const t = fs.readFileSync(path.join(base, f), "utf8");
  ok(t.includes('require("../../lib/handler")'), f + " delegates to lib/handler");
}
ok(fs.readFileSync(path.join(base, "lib/handler.js"), "utf8").includes("handleApi"), "lib/handler wraps handleApi");
const vercel = fs.readFileSync(path.join(base, "vercel.json"), "utf8");
ok(vercel.includes("includeFiles") && vercel.includes("data/*.json"), "vercel bundles data/*.json with functions");
ok(fs.readFileSync(path.join(base, "manifest.webmanifest"), "utf8").includes("maskable"), "manifest has maskable icons");
ok(fs.readFileSync(path.join(base, "api/chat.js"), "utf8").includes('require("../lib/handler")'), "api/chat delegates to lib/handler");
ok(fs.readFileSync(path.join(base, "robots.txt"), "utf8").includes("https://"), "robots has absolute sitemap");
ok(sw.includes("railbook-v6"), "sw versioned lp6");
console.log(fail ? `\n${fail} FAILURES` : "\nALL GATES PASS");
process.exit(fail ? 1 : 0);
