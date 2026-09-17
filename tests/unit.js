// LP6 unit tests (node:test, zero deps). Tests shared validators + business helpers.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const V = require("../lib/validate");

test("phone validator accepts Indian mobiles", () => {
  assert.equal(V.isPhone("9876543210"), true);
  assert.equal(V.isPhone("+91 98765 43210"), true);
  assert.equal(V.isPhone("12345"), false);
  assert.equal(V.isPhone("5876543210"), false);
});
test("alert validator", () => {
  assert.equal(!!V.isAlert({ type: "pnr", ref: "12301", contact: "a@b.com" }), true);
  assert.equal(!!V.isAlert({ type: "pnr", ref: "x", contact: "bad" }), false);
});
test("vendor validator", () => {
  assert.equal(!!V.isVendorDraft({ kind: "stall", what: "Tea stall", phone: "9876543210" }), true);
  assert.equal(!!V.isVendorDraft({ kind: "x", what: "ab", phone: "123" }), false);
});
test("train list validator", () => {
  assert.equal(V.isTrainList([{ no: 12301, name: "X", dep: "10:00", arr: "12:00" }]), true);
  assert.equal(V.isTrainList([{ no: 1 }]), false);
  assert.equal(V.isTrainList([]), true);
});
test("tdrAdvice", () => {
  assert.equal(V.tdrAdvice(10, false).action, "normal");
  assert.equal(V.tdrAdvice(1, false).action, "urgent");
  assert.equal(V.tdrAdvice(5, true).action, "auto");
});
test("tatkalScore", () => {
  assert.equal(V.tatkalScore({ login: true, saved: true, upi: true, fastNet: true, oneDevice: true }), 100);
  assert.equal(V.tatkalScore({}), 0);
});
test("esc prevents XSS", () => {
  assert.equal(V.esc('<img src=x onerror=1>').includes("<"), false);
});
test("station validator accepts real GPS coords", () => {
  const G = require("../lib/geo");
  assert.equal(!!V.isStation({ code: "HWH", name: "Howrah Jn", state: "West Bengal", lat: 22.5849, lon: 88.3423 }), true);
  assert.equal(!!V.isStation({ code: "HWH", name: "Howrah Jn", state: "West Bengal", lat: 999, lon: 0 }), false);
  assert.equal(G.isLatLon(22.56, 88.36), true);
  assert.equal(G.isLatLon(91, 0), false);
});
test("haversine orders nearby stations correctly", () => {
  const G = require("../lib/geo");
  const dHowrah = G.havKm(22.5617, 88.3634, 22.5849, 88.3423); // Sealdah->Howrah ~3.4km
  const dDelhi = G.havKm(22.5617, 88.3634, 28.6417, 77.2207); // Sealdah->NDLS ~1300km
  assert.ok(dHowrah > 1 && dHowrah < 10, "Howrah is a few km away, got " + dHowrah);
  assert.ok(dDelhi > 1200 && dDelhi < 1450, "Delhi is far, got " + dDelhi);
});
test("seed stations all carry valid coords", () => {
  const fs = require("fs"), path = require("path");
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "db", "seed.json"), "utf8"));
  assert.ok(seed.stations.length >= 50, "want 50+ real stations, got " + seed.stations.length);
  for (const s of seed.stations) assert.equal(!!V.isStation(s), true, "bad station " + s.code);
});
test("full directory finds any real station", () => {
  const store = require("../lib/store");
  const full = store.stationsFull();
  assert.ok(full.length >= 7000, "want 7000+ directory stations, got " + full.length);
  const byCode = (c) => full.find((s) => s.code === c);
  assert.ok(byCode("MA") && /MADHA/i.test(byCode("MA").name), "finds MADHA (MA)");
  assert.ok(byCode("BDHL") && byCode("BDHL").state === "Rajasthan", "finds BADHAL (BDHL)");
  assert.ok(byCode("GHY") && typeof byCode("GHY").lat === "number", "finds GUWAHATI (GHY) with coords");
  for (const s of full.slice(0, 500)) assert.equal(!!V.isStation(s), true, "bad dir station " + s.code);
});
