// Built-in rail helper: deterministic answers for common questions. Zero deps.
// Used by /api/chat when no AI provider is configured, so the widget always
// works offline-first and never invents live data. This is honest fallback,
// not fake AI.
const NTES = "https://enquiry.indianrail.gov.in/mntes/";
const IRCTC = "https://www.irctc.co.in";

const TOPICS = [
  {
    id: "tatkal",
    test: /(tatkal)/i,
    a: "Tatkal opens one day before travel: AC classes 10:00, non-AC 11:00. Extra fare applies and refunds are rare — book only when sure. Open the Tatkal page here for the checklist, or book on official IRCTC."
  },
  {
    id: "pnr",
    test: /\bpnr\b/i,
    a: "RailBook does not store or read PNRs. Enter your 10-digit PNR on official NTES for the real status: " + NTES + " (works on phone too). The PNR guide here explains CNF/RAC/WL in easy words."
  },
  {
    id: "live",
    test: /(live status|running status|where is my train|is my train late|train late|delay)/i,
    a: "Live running status is on official NTES: " + NTES + ". RailBook links you there instead of guessing — delays change every minute."
  },
  {
    id: "refund",
    test: /(refund|cancel|tdr|money back)/i,
    a: "Cancelled by railway = automatic refund, no TDR. You cancel = file TDR within 3 days of the journey on IRCTC. Keep your PNR and ticket screenshot ready. The Refunds page here has the full timeline."
  },
  {
    id: "food",
    test: /(food|meal|catering|e-catering|hungry|eat)/i,
    a: "Order food to your seat via IRCTC eCatering, or call 1800-1034-139. Rail helpline 139 works day and night. The Food page here lists what works at major stations."
  },
  {
    id: "book",
    test: /(book|ticket|reservation|reserve)/i,
    a: "RailBook does not book or take payments. Search trains here to pick one, then book on official IRCTC: " + IRCTC + ". Check the class and quota before paying."
  },
  {
    id: "availability",
    test: /(available|availability|seat|berth|waitlist|wl|rac|chart)/i,
    a: "Live seat availability changes minute to minute, so RailBook does not guess. Check on official IRCTC after signing in: " + IRCTC + ". Our search shows the timetable so you can shortlist trains first."
  },
  {
    id: "helpline",
    test: /(helpline|phone|call|complaint|security|lost|139)/i,
    a: "Rail helpline 139 (calls, SMS, app) handles enquiry, complaints and security. Food help: 1800-1034-139. For accidents/security, also use the 182 helpline inside stations."
  },
  {
    id: "station",
    test: /(station|platform|amenity|wifi|cloack|cloak|retiring|waiting room)/i,
    a: "Try the Stations page here — search 8,400+ stations with platforms and amenities. For retiring rooms and lockers, check official IRCTC tourism: " + IRCTC + "."
  },
  {
    id: "special",
    test: /(special|festival|festival special|extra train|holiday|puja|chhath)/i,
    a: "Festival and holiday specials are listed on the Specials page here, with dates and alerts. Book them early on IRCTC — they fill fast."
  }
];

// Returns {text, topic} or null. Deterministic: same question -> same answer.
function helpAnswer(q) {
  const s = String(q || "").trim();
  if (!s) return null;
  for (const t of TOPICS) {
    try { if (t.test.test(s)) return { text: t.a, topic: t.id }; } catch (_) {}
  }
  return null;
}

module.exports = { helpAnswer, TOPICS, NTES, IRCTC };
