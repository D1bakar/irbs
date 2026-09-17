// Shared validators (used by server + tests/unit.js). No deps.
function cleanPhone(p) { var d = String(p || "").replace(/\D/g, ""); if (d.length === 12 && d.startsWith("91")) d = d.slice(2); if (d.length === 11 && d.startsWith("0")) d = d.slice(1); return d; }
function isPhone(p) { return /^[6-9]\d{9}$/.test(cleanPhone(p)); }
function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim()); }
function isAlert(o) {
  return o && typeof o.type === "string" && typeof o.ref === "string" && o.ref.trim().length >= 2 &&
    typeof o.contact === "string" && (isEmail(o.contact) || String(o.contact).replace(/\D/g, "").length >= 10);
}
function isVendorDraft(o) {
  return o && (o.kind === "stall" || o.kind === "tour") &&
    typeof o.what === "string" && o.what.trim().length >= 3 && isPhone(o.phone);
}
function isTrainRow(r) {
  return r && typeof r.no !== "undefined" && typeof r.name === "string" && typeof r.dep === "string" && typeof r.arr === "string";
}
function isTrainList(v) { return Array.isArray(v) && v.every(isTrainRow); }
function isStation(v) {
  return v && typeof v.code === "string" && typeof v.name === "string" && typeof v.state === "string" &&
    (v.lat === undefined || (typeof v.lat === "number" && v.lat >= -90 && v.lat <= 90)) &&
    (v.lon === undefined || (typeof v.lon === "number" && v.lon >= -180 && v.lon <= 180)) &&
    (v.distKm === undefined || typeof v.distKm === "number");
}
function isSpecial(v) {
  return v && typeof v.id === "string" && typeof v.name === "string" && typeof v.dates === "string";
}
// TDR deadline helper: cancelled -> auto refund; otherwise TDR within 3 days of travel.
function tdrAdvice(daysUntilTravel, trainCancelled) {
  if (trainCancelled) return { action: "auto", msg: "Train cancelled — refund is automatic, no TDR needed." };
  if (daysUntilTravel < 0) return { action: "late", msg: "Travel date passed — file TDR immediately, approval is not guaranteed." };
  if (daysUntilTravel <= 3) return { action: "urgent", msg: "File TDR within 3 days. Keep PNR + ticket screenshot ready." };
  return { action: "normal", msg: "You have time. File TDR online and track status." };
}
// Tatkal readiness score (0-100) from checklist booleans.
function tatkalScore(checks) {
  const keys = ["login", "saved", "upi", "fastNet", "oneDevice"];
  let s = 0;
  for (const k of keys) if (checks && checks[k]) s += 20;
  return Math.max(0, Math.min(100, s));
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
if (typeof module !== "undefined") {
  module.exports = { isPhone, isEmail, isAlert, isVendorDraft, isTrainRow, isTrainList, isStation, isSpecial, cleanPhone, tdrAdvice, tatkalScore, esc };
}
