// Regenerate sitemap.xml with absolute URLs + lastmod today.
const fs = require("fs");
const path = require("path");
const base = path.join(__dirname, "..");
const CANON = process.env.RAILBOOK_CANON || "https://railbook.example.com";
const pages = ["index.html","tatkal.html","refunds.html","pnr-help.html","live-help.html","catering.html","concessions.html","contact.html","terms.html","privacy.html","cookies.html","stations.html","specials.html","alerts.html","stories.html","vendors.html"];
const today = new Date().toISOString().slice(0, 10);
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  pages.map(p => `  <url><loc>${CANON}/${p}</loc><lastmod>${today}</lastmod></url>`).join("\n") + `\n</urlset>\n`;
fs.writeFileSync(path.join(base, "sitemap.xml"), xml, "utf8");
console.log("sitemap written " + pages.length + " urls -> " + CANON);
