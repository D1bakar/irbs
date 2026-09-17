// RailBook LP6 frontend. Plans trips locally, books on official IRCTC (handoff).
// lang.js is loaded via <script> in HTML — do NOT double-load here (perf fix LP6).
const STATIONS = [
  { name: 'Howrah Jn', code: 'HWH' },
  { name: 'Sealdah', code: 'SDAH' },
  { name: 'Kolkata', code: 'KOAA' },
  { name: 'New Delhi', code: 'NDLS' },
  { name: 'Mumbai CSMT', code: 'CSMT' },
  { name: 'Mumbai Central', code: 'BCT' },
  { name: 'Chennai Central', code: 'MAS' },
  { name: 'Puri', code: 'PURI' },
  { name: 'New Jalpaiguri', code: 'NJP' },
  { name: 'Patna Jn', code: 'PNBE' },
  { name: 'Varanasi Jn', code: 'BSB' },
  { name: 'Lucknow Charbagh', code: 'LKO' }
];

function autocomplete(inputId, boxId) {
  const input = document.getElementById(inputId);
  const box = document.getElementById(boxId);
  if (!input || !box) return;
  box.setAttribute('role', 'listbox');
  box.setAttribute('aria-label', inputId === 'from' ? 'From stations' : 'To stations');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', boxId);
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('role', 'combobox');
  let active = -1, deb = null, seq = 0;
  function paint() {
    [...box.children].forEach((b, i) => {
      const on = i === active;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on && b.id) input.setAttribute('aria-activedescendant', b.id);
    });
    if (active < 0) input.removeAttribute('aria-activedescendant');
  }
  // Full-directory suggest: local majors instantly, then server top-up (8,400+ real stations).
  async function serverHits(q, mySeq) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch('/api/stations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: q }), signal: ctl.signal });
      clearTimeout(t);
      const j = await r.json();
      if (mySeq !== seq || input.value.trim().toLowerCase() !== q) return;
      const seen = new Set(hits.map(h => h.code));
      (Array.isArray(j) ? j : []).forEach(h => { if (h && h.code && !seen.has(h.code)) { seen.add(h.code); hits.push({ name: h.name, code: h.code }); } });
      if (hits.length) paintHits();
    } catch (_) {}
  }
  let hits = [];
  function paintHits() {
    box.innerHTML = '';
    active = -1;
    input.removeAttribute('aria-activedescendant');
    if (!hits.length) { box.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
    hits.slice(0, 6).forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.id = boxId + '-opt-' + i;
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', 'false');
      b.textContent = `${s.name} (${s.code})`;
      b.addEventListener('click', () => { input.value = `${s.name} (${s.code})`; box.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); input.focus(); });
      box.appendChild(b);
    });
    box.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  function render() {
    const q = input.value.trim().toLowerCase();
    hits = STATIONS.filter(s => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)).slice(0, 5);
    paintHits();
    if (q.length >= 2) {
      const mySeq = ++seq;
      clearTimeout(deb);
      deb = setTimeout(() => serverHits(q, mySeq), 250);
    }
  }
  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  input.addEventListener('keydown', (e) => {
    const n = box.children.length;
    if (e.key === 'Escape') { box.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
    if (box.hidden || !n) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % n; paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + n) % n; paint(); }
    else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      const b = box.children[active];
      if (b) { input.value = b.textContent; box.hidden = true; input.setAttribute('aria-expanded', 'false'); }
    }
  });
  document.addEventListener('click', e => { if (e.target !== input && !box.contains(e.target)) { box.hidden = true; input.setAttribute('aria-expanded', 'false'); } });
}
autocomplete('from', 'fromSuggest');
autocomplete('to', 'toSuggest');

const swapBtn = document.getElementById('swap');
if (swapBtn) swapBtn.addEventListener('click', (e) => {
  const f = document.getElementById('from');
  const t = document.getElementById('to');
  if (!f || !t) return;
  const v = f.value; f.value = t.value; t.value = v;
  const btn = e.currentTarget;
  btn.classList.remove('spin');
  void btn.offsetWidth; // restart animation
  btn.classList.add('spin');
  // tiny press feedback on inputs
  [f, t].forEach(el => { if (el.animate) el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-2px)' }, { transform: 'translateY(0)' }], { duration: 250, easing: 'cubic-bezier(.22,.61,.21,1)' }); });
});

const dateEl = document.getElementById('date');
if (dateEl) {
const _fmtD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
dateEl.min = _fmtD(new Date());
dateEl.max = _fmtD(new Date(Date.now() + 120 * 86400000));
if (!dateEl.value) dateEl.value = _fmtD(new Date(Date.now() + 86400000));
}
// Env badge: Demo data vs Live backend
try {
  const eb = document.getElementById('envBadge');
  if (eb) {
    const live = !!(window.IRCTC_ENDPOINTS && (window.IRCTC_ENDPOINTS.search || window.IRCTC_ENDPOINTS.pnr));
    eb.textContent = live ? 'Live backend' : 'Demo data';
    eb.style.color = live ? '#147a5a' : '#8a4b00';
  }
} catch (_) {}

function codeOf(v) {
  const m = v.match(/\(([A-Z0-9]+)\)/) || v.match(/—\s*([A-Z0-9]+)/);
  if (m) return m[1];
  const hit = STATIONS.find(s => v.toLowerCase().includes(s.name.toLowerCase()));
  return hit ? hit.code : null;
}
// Typed any real station name/code without picking a suggestion? Resolve via the
// full directory (8,400+ stations) so search still finds it.
async function resolveCode(v) {
  const c = codeOf(v);
  if (c) return c;
  const q = String(v || '').trim();
  if (q.length < 2) return null;
  try {
    const r = await fetch('/api/stations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: q }) });
    const j = await r.json();
    if (Array.isArray(j) && j.length && j[0].code) return j[0].code;
  } catch (_) {}
  return null;
}

// Text in the visitor's language (URL ?lang= first, then storage, then English)
function T(key, fallback) {
  try {
    const q = new URLSearchParams(location.search).get("lang");
    const c = (q && window.LANGS && LANGS[q]) ? q : "en";
    if (window.LANGS && LANGS[c] && LANGS[c].s[key]) return LANGS[c].s[key];
    if (window.LANGS && LANGS.en && LANGS.en.s[key]) return LANGS.en.s[key];
  } catch (_) {}
  return fallback;
}

const searchBtn = document.getElementById('search');
if (searchBtn) searchBtn.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const err = document.getElementById('err');
  const out = document.getElementById('results');
  if (!err || !out) return;
  err.textContent = '';
  out.innerHTML = '';
  const fromEl = document.getElementById('from');
  const toEl = document.getElementById('to');
  if (!fromEl || !toEl || !dateEl) return;
  const f0 = codeOf(fromEl.value.trim());
  const t0 = codeOf(toEl.value.trim());
  let f = f0, t = t0;
  if (!f || !t) {
    err.textContent = T('resolving', 'Resolving station names…');
    if (!f) f = await resolveCode(fromEl.value.trim());
    if (!t) t = await resolveCode(toEl.value.trim());
  }
  if (!f) { err.textContent = T('errFrom', 'Pick your start station from the list.'); err.focus(); return; }
  if (!t) { err.textContent = T('errTo', 'Pick your end station from the list.'); err.focus(); return; }
  if (f === t) { err.textContent = T('errSame', 'Start and end are the same.'); err.focus(); return; }
  if (!dateEl || !dateEl.value) { err.textContent = T('errDate', 'Pick a travel date.'); err.focus(); return; }

  // loading micro-feedback + honest queue line (ranges only, never fake precision)
  const original = btn.textContent;
  btn.disabled = true;
  btn.classList.add('loading');
  btn.textContent = T('finding', 'Finding trains');
  const qLine = document.createElement('div');
  qLine.className = 'muted'; qLine.style.cssText = 'font-size:.85rem;margin-top:8px';
  qLine.textContent = T('queueNote', 'Many booking now — a moment…');
  out.appendChild(qLine);

  try {
    const cls = document.getElementById('cls').value;
    const quota = (document.getElementById('quota') || {}).value || 'General';
    const pax = Math.max(1, Math.min(6, parseInt((document.getElementById('pax') || {}).value || '1', 10) || 1));
    try {
      const picked = new Date(dateEl.value + 'T00:00:00');
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const maxD = new Date(today); maxD.setDate(maxD.getDate() + 120);
      if (picked < today) { err.textContent = T('errDatePast', 'That date has passed. Pick today or later.'); err.focus(); return; }
      if (picked > maxD) { err.textContent = T('errDateFar', 'Bookings open 120 days ahead. Pick an earlier date.'); err.focus(); return; }
    } catch (_) {}
    const api = window.IRCTC_API;
    const rows = api ? await api.searchTrains({ from: f, to: t, date: dateEl.value, cls: cls, quota: quota, pax: String(pax) })
      : [{ no: 12301, name: 'Rajdhani Express', dep: '16:55', arr: '10:05', dur: '', days: '', from: f, to: t, date: dateEl.value, cls: cls, status: 'Available' }];
    qLine.remove();
    if (!rows.length) {
      out.innerHTML = '<div class="train"><strong>' + T('noRun', 'No trains on this date') + '</strong><div class="meta">' + T('noRunSub', 'This route does not run every day. Try the next day.') + '</div></div>';
      return;
    }
    var sortMode = 'fast';
    const sortBar = document.createElement('div');
    sortBar.className = 'sortbar';
    sortBar.innerHTML = '<button type="button" data-s="fast" class="on"></button><button type="button" data-s="cheap"></button><button type="button" data-s="avail"></button>';
    sortBar.querySelector('[data-s="fast"]').textContent = T('sortFast', 'Fastest');
    sortBar.querySelector('[data-s="cheap"]').textContent = T('sortCheap', 'Cheapest');
    sortBar.querySelector('[data-s="avail"]').textContent = T('sortAvail', 'Available first');
    out.appendChild(sortBar);
    const listHost = document.createElement('div');
    listHost.className = 'sortlist';
    out.appendChild(listHost);
    const paintRows = () => {
      listHost.innerHTML = '';
      const ordered = rows.slice().sort((a, b) => {
        if (sortMode === 'cheap') return (a.total || a.fare || 0) - (b.total || b.fare || 0);
        if (sortMode === 'avail') return (a.status === 'Waitlist' ? 1 : 0) - (b.status === 'Waitlist' ? 1 : 0);
        return (a.mins || 9999) - (b.mins || 9999);
      });
      ordered.forEach((r, i) => {
      const ok = r.status !== 'Waitlist';
      const d = document.createElement('div');
      d.className = 'train';
      d.style.animationDelay = `${i * 60}ms`;
      d.innerHTML = '<strong></strong><div class="meta"></div><div class="pills"></div><div class="train-actions"></div>';
      d.querySelector('strong').textContent = `${r.no} — ${r.name}`;
      const fareTxt = (r.total || r.fare) ? ' · ₹' + (r.total || r.fare) + (pax > 1 ? ' for ' + pax : '') : '';
      d.querySelector('.meta').textContent = `${r.dep} ${r.from || f} → ${r.arr} ${r.to || t} · ${r.date || dateEl.value} · ${r.cls || cls} · ${quota}${r.dur ? ' · ' + r.dur : ''}${r.days ? ' · ' + r.days : ''}${fareTxt}`;
      const pill = document.createElement('span');
      pill.className = 'pill ' + (ok ? 'ok' : 'wl');
      pill.textContent = __plainMode
        ? (ok ? (plainAvail() + (r.seats ? ' · ' + r.seats : '')) : (plainWait() + (r.wl ? ' ' + r.wl : '')))
        : (ok ? (T('pillOk', 'Available') + (r.seats ? ' · ' + r.seats : '')) : (T('pillWl', 'Waitlist') + (r.wl ? ' ' + r.wl : '')));
      d.querySelector('.pills').appendChild(pill);
      const nb = demoNote();
      if (nb && i === 0) { const em = document.createElement('div'); em.className = 'pills'; em.innerHTML = nb; d.appendChild(em); }
      const sel = document.createElement('button');
      sel.type = 'button'; sel.className = 'btn btn-secondary btn-block';
      sel.style.marginTop = '10px';
      sel.textContent = T('selectBtn', 'Select') + ((r.total || r.fare) ? ' · ₹' + (r.total || r.fare) : '');
      sel.addEventListener('click', () => startBooking(r, { from: f, to: t, date: dateEl.value, cls: cls, quota: quota, pax: pax }));
      d.querySelector('.train-actions').appendChild(sel);
      listHost.appendChild(d);
      });
    };
    sortBar.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      sortMode = b.dataset.s;
      sortBar.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      paintRows();
    }));
    paintRows();
    // Vikalp: all sold out -> one-tap next-day General retry (query preserved)
    if (rows.length && rows.every(function (r) { return r.status === 'Waitlist'; })) {
      const vk = document.createElement('div');
      vk.className = 'train';
      vk.innerHTML = '<strong></strong><div class="meta"></div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-primary" type="button" style="flex:1"></button></div>';
      vk.querySelector('strong').textContent = T('vikalpTitle', 'Sold out? Try Vikalp');
      vk.querySelector('.meta').textContent = T('vikalpSub', 'Same route, next day General — one tap, query kept.');
      const rb = vk.querySelector('button');
      rb.textContent = T('retryNextDay', 'Try next day');
      rb.addEventListener('click', function () {
        try {
          const dd = new Date(dateEl.value + 'T00:00:00');
          dd.setDate(dd.getDate() + 1);
          dateEl.value = dd.toISOString().slice(0, 10);
          const q = document.getElementById('quota');
          if (q) q.value = [...q.options].some(function (o) { return o.text === 'General'; }) ? 'General' : q.value;
          if (window.__refreshQuota) window.__refreshQuota();
        } catch (_) {}
        searchBtn.click();
      });
      out.appendChild(vk);
    }
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.textContent = original;
  }
});
// ---- Demo/offline note: shown when api fell back to sample data ----
function demoNote() {
  try {
    var arr = JSON.parse(sessionStorage.getItem("irctc-fallback-log") || "[]");
    if (!arr.length) return "";
    var last = arr[arr.length - 1];
    if (Date.now() - last.at > 120000) return "";
    return ' <span class="pill wl">' + T('demoBadge', 'Sample data') + '</span>';
  } catch (_) { return ""; }
}

// ---- Tatkal countdown chip (device clock, honest ranges) ----
(function () {
  var pane = document.getElementById('searchPane');
  var btn = document.getElementById('search');
  if (!pane || !btn) return;
  var chip = document.createElement('div');
  chip.className = 'pills'; chip.id = 'tatkalChip'; chip.style.margin = '0 0 10px';
  btn.parentNode.insertBefore(chip, btn);
  function paint() {
    var now = new Date();
    function at(h) { var d = new Date(now); d.setHours(h, 0, 0, 0); return d; }
    var t10 = at(10), t11 = at(11), txt;
    if (now < t10) txt = T('tatkalOpensIn', 'Tatkal AC opens in ') + fmt(t10 - now);
    else if (now < t11) txt = T('tatkalOpenNow', 'Tatkal AC open now · Non-AC at 11:00');
    else txt = T('tatkalOpenBoth', 'Tatkal open now (AC + Non-AC)');
    chip.innerHTML = '<span class="pill ok">' + txt + '</span>';
  }
  function fmt(ms) {
    var m = Math.max(1, Math.round(ms / 60000));
    var h = Math.floor(m / 60);
    return h ? (h + 'h ' + (m % 60) + 'm') : (m + 'm');
  }
  paint();
  setInterval(paint, 60000);
})();
// ---- Passenger wallet (this device only, max 6) ----
function readWallet() { try { return JSON.parse(localStorage.getItem("irctc-passengers") || "[]"); } catch (_) { return []; } }
function saveToWallet(p) {
  try {
    var a = readWallet().filter(function (x) { return (x.name || "").toLowerCase() !== p.name.toLowerCase() || String(x.age) !== String(p.age); });
    a.unshift(p);
    localStorage.setItem("irctc-passengers", JSON.stringify(a.slice(0, 6)));
  } catch (_) {}
}
function delFromWallet(i) {
  try { var a = readWallet(); a.splice(i, 1); localStorage.setItem("irctc-passengers", JSON.stringify(a)); } catch (_) {}
}
function startBooking(train, ctx) {
  const out = document.getElementById('results');
  if (!out) return;
  out.innerHTML = '';
  const d = document.createElement('div');
  d.className = 'train book-flow';
  d.innerHTML = '<strong></strong><div class="meta"></div>'
    + '<div class="field" style="margin-top:12px"><label for="bkName">' + T('bkName', 'Passenger name') + '</label><input id="bkName" autocomplete="off" placeholder="e.g. Dibakar Roy" /></div>'
    + '<div class="field-row"><div class="field"><label for="bkAge">' + T('bkAge', 'Age') + '</label><input id="bkAge" inputmode="numeric" maxlength="3" placeholder="e.g. 28" /></div>'
    + '<div class="field"><label for="bkBerth">' + T('bkBerth', 'Berth') + '</label><select id="bkBerth"><option>' + T('bkNoPref', 'No preference') + '</option><option>Lower</option><option>Middle</option><option>Upper</option><option>Side Lower</option></select></div></div>'
    + '<p class="error" id="bkErr" role="alert" tabindex="-1"></p>'
    + '<div style="display:flex;gap:8px"><button class="btn btn-secondary" id="bkBack" type="button" style="flex:1">' + T('backBtn', 'Back') + '</button><button class="btn btn-primary" id="bkGo" type="button" style="flex:1">' + T('reviewBtn', 'Review') + '</button></div>'
    + '<div id="bkOut" style="margin-top:10px"></div>';
  d.querySelector('strong').textContent = train.no + ' — ' + train.name;
  d.querySelector('.meta').textContent = train.dep + ' ' + ctx.from + ' → ' + train.arr + ' ' + ctx.to + ' · ' + ctx.date + ' · ' + ctx.cls;
  out.appendChild(d);
  // wallet chips
  (function () {
    var w = readWallet();
    if (!w.length) return;
    var wrap = document.createElement('div');
    wrap.className = 'pills'; wrap.style.margin = '10px 0 0';
    var lab = document.createElement('span');
    lab.className = 'muted'; lab.style.cssText = 'font-size:.82rem;width:100%';
    lab.textContent = T('walletTitle', 'Saved passengers');
    wrap.appendChild(lab);
    w.forEach(function (p, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'pill ok'; b.style.cursor = 'pointer';
      b.textContent = p.name + ' · ' + p.age + ' — ' + T('walletUse', 'Use');
      b.setAttribute('aria-label', T('walletUse', 'Use') + ' ' + p.name);
      b.addEventListener('click', function () {
        d.querySelector('#bkName').value = p.name;
        d.querySelector('#bkAge').value = p.age;
        var bs = d.querySelector('#bkBerth');
        if (bs) [...bs.options].forEach(function (o) { if (o.text === p.berth) bs.value = o.text; });
        d.querySelector('#bkName').focus();
      });
      var x = document.createElement('button');
      x.type = 'button'; x.className = 'pill wl'; x.style.cursor = 'pointer';
      x.textContent = '×'; x.setAttribute('aria-label', T('walletDel', 'Remove') + ' ' + p.name);
      x.addEventListener('click', function () { delFromWallet(i); b.remove(); x.remove(); });
      wrap.appendChild(b); wrap.appendChild(x);
    });
    d.insertBefore(wrap, d.querySelector('.field'));
  })();
  d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const bkNameEl = d.querySelector('#bkName');
  if (bkNameEl) bkNameEl.focus({ preventScroll: true });
  d.querySelector('#bkBack').addEventListener('click', () => { document.getElementById('search').click(); });
  d.querySelector('#bkGo').addEventListener('click', () => {
    const name = d.querySelector('#bkName').value.trim();
    const age = d.querySelector('#bkAge').value.trim();
    const berth = d.querySelector('#bkBerth').value;
    const berr = d.querySelector('#bkErr');
    berr.textContent = '';
    if (name.length < 3) { berr.textContent = T('bkErrName', 'Type the passenger name (3+ letters).'); berr.focus(); return; }
    if (!/^\d{1,3}$/.test(age) || +age < 1 || +age > 110) { berr.textContent = T('bkErrAge', 'Type a valid age.'); berr.focus(); return; }
    const bkOut = d.querySelector('#bkOut');
    var nudge = /tatkal/i.test(ctx.quota || '') ? ' · ' + T('tatkalNudge', 'Tatkal costs more and rarely refunds') : '';
    var fareLine = (train.total || train.fare) ? ' · ₹' + (train.total || train.fare) + ((ctx.pax || 1) > 1 ? ' for ' + ctx.pax + ' pax' : '') + ' · pay on IRCTC' : '';
    bkOut.innerHTML = '';
    var rev = document.createElement('div'); rev.className = 'train';
    var rs = document.createElement('strong'); rs.textContent = T('bkReview', 'Review — ') + name + ', ' + age + ' · ' + berth;
    var rm = document.createElement('div'); rm.className = 'meta';
    rm.textContent = train.no + ' ' + (train.name || '') + ' · ' + ctx.date + ' · ' + ctx.cls + ' · ' + (ctx.quota || 'General') + fareLine + nudge;
    var btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:8px;margin-top:10px';
    var cf = document.createElement('button'); cf.className = 'btn btn-primary'; cf.type = 'button'; cf.id = 'bkConfirm'; cf.style.flex = '1';
    cf.textContent = 'Save plan + Continue on IRCTC';
    btnRow.appendChild(cf);
    var note = document.createElement('div'); note.className = 'meta'; note.style.marginTop = '6px';
    note.textContent = 'RailBook plans — booking + payment happen on official IRCTC. No fake PNR.';
    rev.appendChild(rs); rev.appendChild(rm); rev.appendChild(btnRow); rev.appendChild(note);
    bkOut.appendChild(rev);
    cf.addEventListener('click', async () => {
      if (cf.disabled) return; cf.disabled = true;
      try { saveToWallet({ name: name, age: age, berth: berth }); } catch (_) {}
      var plan = { trainNo: String(train.no), from: ctx.from, to: ctx.to, date: ctx.date, cls: ctx.cls, quota: ctx.quota, pax: ctx.pax };
      var handoff = null;
      try { if (window.RB_HANDOFF) handoff = await window.RB_HANDOFF.planTrip(plan); } catch (_) {}
      var url = (handoff && handoff.url) || ('https://www.irctc.co.in/nget/train-search?from=' + encodeURIComponent(ctx.from) + '&to=' + encodeURIComponent(ctx.to) + '&date=' + encodeURIComponent(ctx.date));
      try { if (window.__saveTrip) window.__saveTrip({ train: train.no + ' ' + train.name, from: ctx.from, to: ctx.to, date: ctx.date, cls: ctx.cls, tripId: handoff && handoff.id }); } catch (_) {}
      bkOut.innerHTML = '';
      var done = document.createElement('div'); done.className = 'train';
      var ds = document.createElement('strong'); ds.textContent = 'Plan saved' + (handoff && handoff.id ? ' — ' + handoff.id : '');
      var dm = document.createElement('div'); dm.className = 'meta';
      dm.textContent = 'Continue on official IRCTC to pay + get a real PNR. RailBook never invents PNRs.' + (handoff && handoff.queued ? ' (Saved offline — will sync.)' : '');
      var row2 = document.createElement('div'); row2.style.cssText = 'display:flex;gap:8px;margin-top:10px';
      var a = document.createElement('a'); a.className = 'btn btn-primary'; a.style.flex = '1'; a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Continue on IRCTC →';
      row2.appendChild(a);
      done.appendChild(ds); done.appendChild(dm); done.appendChild(row2);
      bkOut.appendChild(done);
    });
  });
}

function activateTab(name) {
  const panes = { search: 'searchPane', pnr: 'pnrPane', live: 'livePane' };
  Object.entries(panes).forEach(([key, id]) => {
    const pane = document.getElementById(id);
    if (pane) pane.hidden = key !== name;
  });
  document.querySelectorAll('.tabs [role="tab"]').forEach(b => {
    const on = b.dataset.tab === panes[name];
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.tabIndex = on ? 0 : -1;
  });
}
document.querySelectorAll('.tabs [role="tab"]').forEach(b => {
  b.addEventListener('click', () => activateTab(b.dataset.tab.replace('Pane', '')));
});
// Arrow keys move between tabs (roving tabindex)
const tabList = document.querySelector('.tabs[role="tablist"]');
if (tabList) {
  const tabs = [...tabList.querySelectorAll('[role="tab"]')];
  const syncTabs = () => tabs.forEach(b => { b.tabIndex = b.getAttribute('aria-selected') === 'true' ? 0 : -1; });
  syncTabs();
  tabs.forEach((b, i) => {
    b.addEventListener('keydown', (e) => {
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = tabs.length - 1;
      if (j == null) return;
      e.preventDefault();
      tabs[j].focus();
      tabs[j].click();
    });
  });
  tabList.addEventListener('click', syncTabs);
}

// Quota summary always shows the picked quota, in the visitor's language
window.__refreshQuota = function () {
  try {
    const q = document.getElementById('quota');
    const s = document.querySelector('.more summary');
    if (!q || !s) return;
    s.textContent = T('quotaWord', 'Quota') + ': ' + q.value;
  } catch (_) {}
};
const quotaSel = document.getElementById('quota');
if (quotaSel) {
  quotaSel.addEventListener('change', () => window.__refreshQuota());
  window.__refreshQuota();
}

// Priority strip + guide shortcuts open the right tab
document.querySelectorAll('[data-goto-pnr]').forEach(a => {
  a.addEventListener('click', () => activateTab('pnr'));
});
document.querySelectorAll('[data-goto-live]').forEach(a => {
  a.addEventListener('click', () => activateTab('live'));
});

const pnrBtn = document.getElementById('pnrBtn');
if (pnrBtn) pnrBtn.addEventListener('click', async () => {
  const v = document.getElementById('pnrInput').value.trim();
  const out = document.getElementById('pnrOut');
  if (!out) return;
  if (!/^\d{10}$/.test(v)) { out.innerHTML = '<p class="error">' + T('errPnr', 'Type the 10-digit PNR number.') + '</p>'; return; }
  out.innerHTML = '<div class="train"><strong>' + T('finding', 'Finding trains') + '…</strong></div>';
  try {
    const api = window.IRCTC_API;
    const r = api ? await api.checkPnr(v) : { handoff: true };
    out.innerHTML = '';
    var box = document.createElement('div'); box.className = 'train';
    var hs = document.createElement('strong'); hs.textContent = 'PNR ' + v + ' — check on official NTES';
    var hm = document.createElement('div'); hm.className = 'meta';
    hm.textContent = (r && r.msg) || 'RailBook does not store or invent PNR data. Tap below — your PNR stays in your browser.';
    var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;margin-top:10px';
    var a = document.createElement('a'); a.className = 'btn btn-primary'; a.style.flex = '1';
    a.href = (r && r.url) || 'https://enquiry.indianrail.gov.in/mntes/'; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = 'Check on NTES →';
    row.appendChild(a); box.appendChild(hs); box.appendChild(hm); box.appendChild(row);
    out.appendChild(box);
  } catch (_) {
    out.textContent = 'Could not reach server. Check on official NTES/IRCTC.';
  }
});

const liveBtn = document.getElementById('liveBtn');
if (liveBtn) liveBtn.addEventListener('click', async () => {
  const inp = document.getElementById('liveInput');
  const out = document.getElementById('liveOut');
  if (!inp || !out) return;
  const raw = inp.value.trim() || '12301';
  out.innerHTML = '<div class="train"><strong>' + T('finding', 'Finding trains') + '…</strong></div>';
  try {
    const api = window.IRCTC_API;
    const r = api ? await api.trainLive(raw) : { handoff: true };
    out.innerHTML = '';
    var box = document.createElement('div'); box.className = 'train';
    var hs = document.createElement('strong'); hs.textContent = 'Train ' + raw + ' — live on NTES';
    var hm = document.createElement('div'); hm.className = 'meta';
    hm.textContent = (r && r.msg) || 'RailBook links to official live status. No invented delays.';
    var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;margin-top:10px';
    var a = document.createElement('a'); a.className = 'btn btn-primary'; a.style.flex = '1';
    a.href = (r && r.url) || 'https://enquiry.indianrail.gov.in/mntes/'; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = 'Track on NTES →';
    row.appendChild(a); box.appendChild(hs); box.appendChild(hm); box.appendChild(row);
    out.appendChild(box);
  } catch (_) {
    out.textContent = 'Could not reach server. Track on official NTES.';
  }
});

const POP = [
  ['Howrah to New Delhi', '12301 Rajdhani · Daily · 17h 10m'],
  ['Howrah to Puri', '22895 Vande Bharat · 6h 25m'],
  ['Sealdah to New Jalpaiguri', '22301 Vande Bharat · 7h 30m']
];
const popEl = document.getElementById('popular');
if (popEl) POP.forEach(p => {
  const d = document.createElement('div');
  d.className = 'pop reveal';
  d.innerHTML = '<div><strong></strong><small></small></div><button type="button">' + T('useRoute', 'Use route') + '</button>';
  d.querySelector('strong').textContent = p[0];
  d.querySelector('small').textContent = p[1];
  d.querySelector('button').addEventListener('click', () => {
    const f = document.getElementById('from');
    const t = document.getElementById('to');
    if (f) f.value = p[0].split(' to ')[0];
    if (t) t.value = p[0].split(' to ')[1];
    try { activateTab('search'); } catch (_) {}
    const book = document.getElementById('book');
    if (book) book.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => { const s = document.getElementById('search'); if (s) s.click(); }, 450);
  });
  popEl.appendChild(d);
});

// My trip plans on this device (PNR tab) — LP6: plans, not fake bookings.
(function () {
  const out = document.getElementById('pnrOut');
  const inp = document.getElementById('pnrInput');
  if (!out || !inp || document.getElementById('myBookings')) return;
  const box = document.createElement('div');
  box.id = 'myBookings';
  box.innerHTML = '<div class="meta" style="margin-top:10px"></div><div class="sortlist"></div>';
  out.parentNode.insertBefore(box, out);
  const paint = () => {
    const list = box.querySelector('.sortlist');
    const meta = box.querySelector('.meta');
    let items = [];
    try { items = JSON.parse(localStorage.getItem('rb-outbox-trips') || '[]').map(x => x.payload || x); } catch (_) {}
    try {
      var legacy = (window.IRCTC_API && window.IRCTC_API.readBookings ? window.IRCTC_API.readBookings() : []) || [];
      legacy.forEach(function (b) { if (b && b.train) items.push({ trainNo: String(b.train).split(' ')[0], from: b.from, to: b.to, date: b.date }); });
    } catch (_) {}
    if (!items.length) { meta.textContent = ''; list.innerHTML = ''; return; }
    meta.textContent = 'My trip plans on this device · ' + items.length;
    list.innerHTML = '';
    items.slice(0, 5).forEach(b => {
      const d = document.createElement('div');
      d.className = 'train';
      d.innerHTML = '<strong></strong><div class="meta"></div>';
      d.querySelector('strong').textContent = (b.trainNo || b.train || 'Trip') + ' — ' + (b.from || '') + ' → ' + (b.to || '');
      d.querySelector('.meta').textContent = (b.date || '') + ' · Continue on IRCTC for real PNR';
      d.style.cursor = 'pointer';
      d.addEventListener('click', () => { try { document.getElementById('from').value = b.from || ''; document.getElementById('to').value = b.to || ''; } catch (_) {} });
      list.appendChild(d);
    });
  };
  paint();
  document.addEventListener('click', (e) => { if (e.target && (e.target.id === 'bkConfirm')) setTimeout(paint, 800); });
})();

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Prefill from Specials → Check trains
try {
  const pre = JSON.parse(sessionStorage.getItem('irctc-prefill') || 'null');
  if (pre && (pre.from || pre.to)) {
    const f = document.getElementById('from');
    const t = document.getElementById('to');
    if (f && pre.from) f.value = pre.from;
    if (t && pre.to) t.value = pre.to;
    sessionStorage.removeItem('irctc-prefill');
    setTimeout(() => { const s = document.getElementById('search'); if (s && document.getElementById('book')) s.click(); }, 600);
  }
} catch (_) {}

// Open correct tab from ?tab=pnr|live|search (used by subpages)
try {
  const qs = new URLSearchParams(location.search);
  const tab = qs.get('tab');
  if (tab && ['search', 'pnr', 'live'].includes(tab)) activateTab(tab);
  // LP5: deep-link ?pnr=10digits → fill PNR tab and auto-check
  const deepPnr = (qs.get('pnr') || '').replace(/\D/g, '');
  if (/^\d{10}$/.test(deepPnr)) {
    try { activateTab('pnr'); } catch (_) {}
    const pi = document.getElementById('pnrInput');
    if (pi) {
      pi.value = deepPnr;
      setTimeout(() => { const pb = document.getElementById('pnrBtn'); if (pb) pb.click(); }, 400);
    }
  }
} catch (_) {}

// ---- Citizen-portal motion: light, fast, functional ----
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = document.getElementById('siteHeader');
  const progress = document.getElementById('progress');
  const toTop = document.getElementById('toTop');

  // Hero entrance
  const heroCopy = document.querySelector('.hero-copy');
  const card = document.querySelector('.card');
  if (heroCopy && !reduce) {
    [...heroCopy.children].forEach((el, i) => { el.style.animationDelay = `${i * 80}ms`; el.classList.add('enter'); });
  }
  if (card && !reduce) card.classList.add('enter', 'enter-d1');

  // Scroll: header + progress + toTop only (no heavy parallax — portal must stay fast)
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (header) header.classList.toggle('scrolled', y > 12);
      if (progress) progress.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
      if (toTop) toTop.classList.toggle('show', y > 700);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); try { var sk = document.querySelector('.skip'); if (sk) sk.focus({ preventScroll: true }); } catch (_) {} });

  // Reveal targets for scroll — no counters, no tilt: keep first paint calm
  const revealTargets = document.querySelectorAll('.strip-inner a, .guides .guide-card, #trains .wrap, #help .wrap, .foot-grid > div');
  revealTargets.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.setProperty('--d', `${(i % 5) * 70}ms`);
  });
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
  }

  // Scrollspy
  const navLinks = [...document.querySelectorAll('#mainNav a')];
  const sections = ['book', 'guides', 'trains', 'help'].map(id => document.getElementById(id)).filter(Boolean);
  if ('IntersectionObserver' in window && navLinks.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${e.target.id}`));
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(s => spy.observe(s));
  }

  // Guide cards actually do something — jump to the right tab
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'pnr') activateTab('pnr');
      if (action === 'live') activateTab('live');
      if (action === 'book') activateTab('search');
      const book = document.getElementById('book');
      if (book) book.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
      setTimeout(() => {
        const f = action === 'pnr' ? document.getElementById('pnrInput') : action === 'live' ? document.getElementById('liveInput') : document.getElementById('from');
        if (f) f.focus({ preventScroll: true });
      }, 450);
    });
  });
})();

// ---- Cookie consent (shared across all 10+ pages) ----
(function () {
  const KEY = 'irctc-consent-v1';
  function read() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (_) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_) {} }
  function ensureBanner() {
    if (document.getElementById('cookieBar')) return;
    const bar = document.createElement('div');
    bar.className = 'cookie-bar';
    bar.id = 'cookieBar';
    bar.innerHTML = '<p>We use cookies for booking, security and optional analytics. Read our <a href="cookies.html">Cookie Policy</a>.</p><div class="cookie-actions"><button class="btn btn-outline-light" id="cookieCustom" type="button">Customise</button><button class="btn btn-light" id="cookieAccept" type="button">Accept all</button></div>';
    document.body.appendChild(bar);
    const modal = document.createElement('div');
    modal.className = 'cookie-modal';
    modal.id = 'cookieModal';
    modal.hidden = true;
    modal.innerHTML = '<div class="cookie-box" role="dialog" aria-modal="true" aria-labelledby="ckTitle"><h2 id="ckTitle">Cookie likes</h2><p class="muted" id="ckSub" style="margin:0 0 8px">Pick what we may keep. Must-have is always on.</p><div class="cookie-row"><div><strong id="ckNec">Must-have</strong><small id="ckNecD">Login, booking, safety. Always on.</small></div><label class="switch"><input type="checkbox" checked disabled aria-label="Necessary always on"><span></span></label></div><div class="cookie-row"><div><strong id="ckFun">Remembers for you</strong><small id="ckFunD">Saves stations, class, last searches.</small></div><label class="switch"><input type="checkbox" id="ckFunc" checked><span></span></label></div><div class="cookie-row"><div><strong id="ckAna">Counts</strong><small id="ckAnaD">Nameless counts to make pages better.</small></div><label class="switch"><input type="checkbox" id="ckAnal"><span></span></label></div><div style="display:flex;gap:8px;margin-top:16px"><button class="btn btn-secondary" id="ckSave" type="button" style="flex:1">Save my pick</button><button class="btn btn-primary" id="ckAll" type="button" style="flex:1">Take all</button></div></div>';
    document.body.appendChild(modal);
    document.getElementById('cookieAccept').addEventListener('click', () => { save({ necessary: true, functional: true, analytics: true, at: Date.now() }); bar.remove(); modal.remove(); });
    document.getElementById('cookieCustom').addEventListener('click', () => { modal.hidden = false; });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { modal.hidden = true; return; }
      if (e.key !== 'Tab') return;
      const f = [...modal.querySelectorAll('button, input')].filter(el => !el.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.getElementById('ckSave').addEventListener('click', () => {
      save({ necessary: true, functional: document.getElementById('ckFunc').checked, analytics: document.getElementById('ckAnal').checked, at: Date.now() });
      bar.remove(); modal.remove();
    });
    document.getElementById('ckAll').addEventListener('click', () => { save({ necessary: true, functional: true, analytics: true, at: Date.now() }); bar.remove(); modal.remove(); });
  }
  if (!read()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureBanner);
    else ensureBanner();
  }
  document.querySelectorAll('[data-cookie-settings]').forEach(b => b.addEventListener('click', () => {
    try { localStorage.removeItem(KEY); } catch (_) {}
    ensureBanner();
    const m = document.getElementById('cookieModal');
    if (m) { m.hidden = false; const f = m.querySelector('#ckSave'); if (f) f.focus(); }
  }));
})();

// ---- Seamless clicks: exit glide + prefetch, works on file:// too ----
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // back-button (bfcache) must never restore the exit animation state
  document.body.classList.remove('leaving');
  window.addEventListener('pageshow', () => document.body.classList.remove('leaving'));
  const seen = new Set();
  function isPageLink(a) {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
    if (a.target === '_blank' || a.hasAttribute('download') || a.hasAttribute('data-cookie-settings')) return false;
    return /\.html(\?.*)?(#.*)?$/.test(href);
  }
  function samePage(href) {
    try {
      const u = new URL(href, location.href);
      const here = new URL(location.href);
      return u.pathname.replace(/\\/g, '/') === here.pathname.replace(/\\/g, '/') && !u.search;
    } catch (_) { return false; }
  }
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || !isPageLink(a)) return;
    if (samePage(a.getAttribute('href'))) return; // pure #anchor: let smooth scroll do it
    // same page, only the tab differs: switch in place, no reload
    try {
      const u = new URL(a.getAttribute('href'), location.href);
      const here = new URL(location.href);
      if (u.pathname.replace(/\\/g, '/') === here.pathname.replace(/\\/g, '/')) {
        const tab = u.searchParams.get('tab');
        if (tab && ['search', 'pnr', 'live'].includes(tab) && document.getElementById('book')) {
          e.preventDefault();
          activateTab(tab);
          const t = u.hash ? document.querySelector(u.hash) : document.getElementById('book');
          if (t) t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
          return;
        }
        // same page + same query: just scroll, never reload
        if (u.search === here.search) {
          e.preventDefault();
          const t = u.hash ? document.querySelector(u.hash) : null;
          if (t) t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
          else window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
          return;
        }
      }
    } catch (_) {}
    e.preventDefault();
    // carry the language in the link so the next page opens translated
    // even where browser storage does not survive page jumps (file://)
    let dest = a.href;
    try {
      const u = new URL(a.href, location.href);
      let lang = "en";
      try {
        lang = new URLSearchParams(location.search).get("lang") || "en";
      } catch (_) {}
      if (lang && lang !== "en" && !u.searchParams.has("lang")) {
        u.searchParams.set("lang", lang);
        dest = u.toString();
      }
    } catch (_) {}
    const go = () => { location.href = dest; };
    if (reduce) { go(); return; }
    document.body.classList.add('leaving');
    setTimeout(go, 180);
    setTimeout(go, 1200); // safety: never trap the user
  });
  // Hover-prefetch for instant feel on http(s); harmless on file://
  document.addEventListener('mouseover', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || !isPageLink(a) || seen.has(a.href)) return;
    seen.add(a.href);
    try {
      const l = document.createElement('link');
      l.rel = 'prefetch';
      l.href = a.href;
      document.head.appendChild(l);
    } catch (_) {}
  }, { passive: true });
})();

// ---- Jargon toggle: railway words <-> plain words (persisted, repaints results) ----
var __plainMode = false;
try { __plainMode = localStorage.getItem("irctc-plain") === "1"; } catch (_) {}
function plainAvail() { return T('plAvail', 'Fixed seats'); }
function plainWait() { return T('plWait', 'Waiting line'); }
function repaintJargon() {
  try {
    if (document.getElementById('results') && document.getElementById('results').children.length && document.getElementById('search')) document.getElementById('search').click();
    else if (document.getElementById('pnrOut') && document.getElementById('pnrOut').children.length && /^\d{10}$/.test((document.getElementById('pnrInput') || {}).value || '')) document.getElementById('pnrBtn').click();
  } catch (_) {}
  var b = document.getElementById('jargonBtn');
  if (b) { b.setAttribute('aria-pressed', __plainMode ? 'true' : 'false'); b.textContent = T('jargon', 'Plain words'); }
}
(function () {
  function build() {
    // header button retired: toggles live in the language menu (see lang.js displayOpt)
    repaintJargon();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
window.__isPlain = function () { return !!__plainMode; };
window.__setPlain = function (v) {
  __plainMode = !!v;
  try { localStorage.setItem("irctc-plain", __plainMode ? "1" : "0"); } catch (_) {}
  try { if (typeof paintHeroDisplay === "function") paintHeroDisplay(); } catch (_) {}
  repaintJargon();
};
// ---- Voice input on station fields (feature-detected, typed fallback stays) ----
(function () {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  [["from", "fromSuggest"], ["to", "toSuggest"]].forEach(function (pair) {
    var inp = document.getElementById(pair[0]);
    if (!inp || inp.parentNode.querySelector('.mic')) return;
    inp.classList.add('has-mic');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'mic'; b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', T('voiceBtn', 'Speak station name'));
    b.textContent = '🎤';
    b.addEventListener('click', function () {
      var rec;
      try { rec = new SR(); } catch (_) { b.remove(); return; }
      try { rec.lang = document.documentElement.lang || 'en-IN'; } catch (_) {}
      b.setAttribute('aria-pressed', 'true');
      rec.onresult = function (ev) {
        try {
          var txt = ev.results[0][0].transcript || '';
          inp.value = txt.trim();
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.focus();
        } catch (_) {}
      };
      var stop = function () { b.setAttribute('aria-pressed', 'false'); };
      rec.onend = stop; rec.onerror = stop;
      try { rec.start(); } catch (_) { stop(); }
    });
    inp.parentNode.appendChild(b);
  });
})();
// ---- PWA: register SW + offline badge (all pages) ----
// ---- Text-only mode API (button lives in language menu; see lang.js displayOpt) ----
window.__isTextOnly = function () { try { return localStorage.getItem("irctc-textonly") === "1"; } catch (_) { return false; } };
window.__setTextOnly = function (v) {
  try { localStorage.setItem("irctc-textonly", v ? "1" : "0"); } catch (_) {}
  try { document.body.classList.toggle("text-only", !!v); } catch (_) {}
  try { if (typeof paintHeroDisplay === "function") paintHeroDisplay(); } catch (_) {}
};
try { document.body.classList.toggle("text-only", window.__isTextOnly()); } catch (_) {}
// Hero display row (index.html) + menu options share one paint
function paintHeroDisplay() {
  try {
    var t = document.getElementById('heroTextOnly');
    if (t) t.setAttribute('aria-pressed', window.__isTextOnly() ? 'true' : 'false');
    var p = document.getElementById('heroPlain');
    if (p) p.setAttribute('aria-pressed', window.__isPlain() ? 'true' : 'false');
  } catch (_) {}
}
try { window.__paintDisplay = paintHeroDisplay; } catch (_) {}
(function () {
  function wire() {
    var t = document.getElementById('heroTextOnly');
    if (t && !t.dataset.wired) {
      t.dataset.wired = "1";
      t.addEventListener('click', function () { window.__setTextOnly(!window.__isTextOnly()); paintHeroDisplay(); });
    }
    var p = document.getElementById('heroPlain');
    if (p && !p.dataset.wired) {
      p.dataset.wired = "1";
      p.addEventListener('click', function () { window.__setPlain(!window.__isPlain()); paintHeroDisplay(); });
    }
    paintHeroDisplay();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();
(function () {
  try {
    if ("serviceWorker" in navigator && /^https?:|^file:/.test(location.protocol)) {
      window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
    }
  } catch (_) {}
  function paintOffline() {
    var bar = document.getElementById("offlineBar");
    var off = false;
    try { off = navigator.onLine === false; } catch (_) {}
    if (off && !bar) {
      bar = document.createElement("div");
      bar.id = "offlineBar";
      bar.setAttribute("role", "status");
      bar.textContent = "Offline — showing saved demo. Booking still works with sample data.";
      document.body.prepend(bar);
    } else if (!off && bar) { bar.remove(); }
  }
  window.addEventListener("online", paintOffline);
  window.addEventListener("offline", paintOffline);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paintOffline);
  else paintOffline();
})();

// ---- Refund tracker (refunds.html only, honest ranges) ----
(function () {
  try {
    if (!location.pathname.split("/").pop().startsWith("refunds")) return;
    var host = document.querySelector('.prose[data-i18n-html="body"]');
    if (!host || document.getElementById('tdrBox')) return;
    var box = document.createElement('div');
    box.id = 'tdrBox'; box.className = 'train'; box.style.marginTop = '12px';
    box.innerHTML = '<strong></strong>'
      + '<div class="field" style="margin-top:10px"><label for="tdrDate"></label><input id="tdrDate" type="date" /></div>'
      + '<div class="field"><label for="tdrWhy"></label><select id="tdrWhy"><option value="auto"></option><option value="me"></option><option value="svc"></option></select></div>'
      + '<button class="btn btn-secondary btn-block" id="tdrGo" type="button"></button>'
      + '<div id="tdrOut" aria-live="polite" style="margin-top:8px"></div>';
    box.querySelector('strong').textContent = T('tdrTitle', 'When is my money back?');
    box.querySelector('label[for="tdrDate"]').textContent = T('tdrWhen', 'Journey date');
    box.querySelector('label[for="tdrWhy"]').textContent = T('tdrWhy', 'What happened?');
    var opts = box.querySelectorAll('#tdrWhy option');
    opts[0].textContent = T('tdrR1', 'Train cancelled by railway');
    opts[1].textContent = T('tdrR2', 'I cancelled / did not travel');
    opts[2].textContent = T('tdrR3', 'Lower seat / AC failed / very late');
    box.querySelector('#tdrGo').textContent = T('tdrGo', 'Check my deadline');
    host.appendChild(box);
    box.querySelector('#tdrGo').addEventListener('click', function () {
      var out = box.querySelector('#tdrOut');
      var w = box.querySelector('#tdrWhy').value;
      if (w === 'auto') out.innerHTML = '<div class="meta">' + T('tdrAuto', 'Auto refund — no form. Money in 3–7 work days.') + '</div>';
      else out.innerHTML = '<div class="meta">' + T('tdrFile', 'File TDR within 2 days of travel. Keep PNR + ticket.') + '</div>';
    });
  } catch (_) {}
})();

// ---- Journey companion: offline trip card + arrival alert + share (?trip=) ----
(function () {
  var KEY = "irctc-trip";
  function readTrip() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { return null; } }
  window.__saveTrip = function (t) { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (_) {} renderTrip(); };
  function shareUrl(t) {
    try {
      var u = new URL(location.href);
      u.searchParams.set("trip", [t.train, t.from, t.to, t.date, String(t.pnr || "").slice(-4)].map(encodeURIComponent).join("."));
      return u.toString();
    } catch (_) { return location.href; }
  }
  function renderTrip() {
    var pane = document.getElementById('pnrPane');
    if (!pane || document.getElementById('tripCard')) return;
    var fromLink = null;
    try {
      var tp = new URLSearchParams(location.search).get("trip");
      if (tp) {
        var p = tp.split(".").map(decodeURIComponent);
        if (p.length >= 4) fromLink = { train: p[0], from: p[1], to: p[2], date: p[3], shared: true };
      }
    } catch (_) {}
    var t = fromLink || readTrip();
    if (!t) return;
    var card = document.createElement('div');
    card.className = 'train'; card.id = 'tripCard';
    card.innerHTML = '<strong></strong><div class="meta"></div><div class="pills"><span class="pill ok"></span></div>'
      + '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn btn-secondary" id="tripShare" type="button" style="flex:1">' + T('tripShare', 'Share trip') + '</button>'
      + '<button class="btn btn-secondary" id="tripAlarm" type="button" style="flex:1">' + T('tripAlarm', 'Alert before arrival') + '</button></div>'
      + '<div id="tripOut" aria-live="polite" style="margin-top:8px"></div>';
    card.querySelector('strong').textContent = (fromLink ? T('tripFromLink', 'Shared trip') + ' — ' : T('tripTitle', 'My trip') + ' — ') + (t.train || '');
    card.querySelector('.meta').textContent = (t.from || '') + ' → ' + (t.to || '') + ' · ' + (t.date || '');
    card.querySelector('.pill').textContent = T('tripOffline', 'Saved on this device — works offline');
    pane.insertBefore(card, pane.firstChild);
    card.querySelector('#tripShare').addEventListener('click', function () {
      var out = card.querySelector('#tripOut');
      var url = shareUrl(t);
      function showUrl() {
        out.innerHTML = '';
        var d = document.createElement('div'); d.className = 'meta';
        var a = document.createElement('a'); a.href = url; a.textContent = url; a.rel = 'noopener';
        d.appendChild(a); out.appendChild(d);
      }
      function done() { out.textContent = ''; var d = document.createElement('div'); d.className = 'meta'; d.textContent = T('tripCopied', 'Link copied — full PNR never shared.'); out.appendChild(d); }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, showUrl);
        else showUrl();
      } catch (_) { showUrl(); }
    });
    card.querySelector('#tripAlarm').addEventListener('click', function (ev) {
      armArrivalAlert((t.train || '12301').split(' ')[0], ev.currentTarget);
    });
  }
  var timer = null;
  function armArrivalAlert(q, btn) {
    function banner(msg) {
      var pane = document.getElementById('livePane');
      var d = document.createElement('div');
      d.className = 'train'; d.setAttribute('role', 'status');
      d.innerHTML = '<strong>' + msg + '</strong>';
      if (pane) { pane.appendChild(d); d.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    }
    async function check() {
      try {
        var api = window.IRCTC_API;
        var r = api ? await api.trainLive(q) : null;
        if (r && r.nextInMin != null && r.nextInMin <= 20) {
          if (timer) clearInterval(timer);
          var msg = T('tripAlarmNow', 'Get ready — arriving in ~') + r.nextInMin + ' min (' + (r.next || '') + ')';
          try {
            if (Notification.permission === 'granted') new Notification(msg);
            else banner(msg);
          } catch (_) { banner(msg); }
          if (btn) btn.textContent = T('tripAlarm', 'Alert before arrival');
        }
      } catch (_) {}
    }
    try {
      var go = function () {
        if (timer) clearInterval(timer);
        timer = setInterval(check, 5 * 60 * 1000);
        if (btn) btn.textContent = T('tripAlarmOn', 'Alert on — 20 min before');
        check();
      };
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().then(go, go);
      else go();
    } catch (_) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderTrip);
  else renderTrip();
})();

// ---- Crowd reports: rate-your-coach card with live on-device counts ----
(function () {
  try {
    var host = document.querySelector('#help .wrap');
    if (!host || document.getElementById('crowdBox')) return;
    var box = document.createElement('div');
    box.id = 'crowdBox'; box.className = 'crowd-card';
    box.innerHTML = '<p class="eyebrow"></p><strong></strong><p class="muted"></p>'
      + '<div class="crowd-votes" id="crowdVotes"></div>'
      + '<p class="crowd-note" id="crowdNote"></p>'
      + '<p class="crowd-tips" id="crowdTips"></p>'
      + '<div id="crowdOut" aria-live="polite"></div>';
    box.querySelector('.eyebrow').textContent = T('crowdLive', 'Live from riders');
    box.querySelector('strong').textContent = T('crowdRate', 'Riding now? Rate your coach');
    box.querySelector('.muted').textContent = T('crowdSub', 'One tap helps the next passenger find a seat.');
    host.appendChild(box);
    function consent() { try { var c = JSON.parse(localStorage.getItem("irctc-consent-v1") || "null"); return !!(c && c.analytics); } catch (_) { return false; } }
    function counts() { try { return JSON.parse(localStorage.getItem("irctc-crowd") || "{}"); } catch (_) { return {}; } }
    var votes = box.querySelector('#crowdVotes');
    var OPTS = [["crowdEmpty", "Empty"], ["crowdSome", "Some seats"], ["crowdPacked", "Packed"]];
    function paint() {
      var c = counts();
      votes.innerHTML = '';
      OPTS.forEach(function (kv) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'crowd-vote';
        var n = c[kv[0]] || 0;
        b.innerHTML = '<span></span><span class="crowd-count"></span>';
        b.querySelector('span').textContent = T(kv[0], kv[1]);
        b.querySelector('.crowd-count').textContent = n + ' ' + T('crowdVotes', 'votes');
        b.setAttribute('aria-label', T(kv[0], kv[1]) + ' — ' + n + ' ' + T('crowdVotes', 'votes'));
        b.addEventListener('click', function () {
          var out = box.querySelector('#crowdOut');
          if (!consent()) { out.innerHTML = '<p class="crowd-note">' + T('crowdNeed', 'Allow Counts in Cookie settings to vote.') + '</p>'; return; }
          try {
            var cc = counts();
            cc[kv[0]] = (cc[kv[0]] || 0) + 1;
            localStorage.setItem("irctc-crowd", JSON.stringify(cc));
          } catch (_) {}
          out.innerHTML = '<p class="crowd-note">' + T('crowdThanks', 'Thanks — saved on this device.') + '</p>';
          paint();
        });
        votes.appendChild(b);
      });
    }
    paint();
    box.querySelector('#crowdNote').textContent = '';
    box.querySelector('#crowdTips').textContent = T('crowdTip1', 'Howrah 6–9pm rush — reach 45 min early.') + ' ' + T('crowdTip2', 'Sealdah mornings — check the board first, then the coach.');
  } catch (_) {}
})();

// ---- Sticky quick-action bar: PNR · Live · 139 (dismissible, all pages) ----
(function () {
  var KEY = "irctc-sticky-off";
  function dismissed() { try { return sessionStorage.getItem(KEY) === "1"; } catch (_) { return false; } }
  function build() {
    if (document.getElementById('stickyCta') || dismissed()) return;
    var bar = document.createElement('div');
    bar.id = 'stickyCta'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Quick actions');
    bar.innerHTML = '<button type="button" data-s="pnr"></button><button type="button" data-s="live"></button><a href="tel:139">139</a><button type="button" class="x" aria-label="Dismiss">×</button>';
    var btns = bar.querySelectorAll('button[data-s]');
    window.__paintSticky = function () {
      try {
        btns[0].textContent = T('stripPnr', 'PNR status');
        btns[1].textContent = T('stripLive', 'Live running');
      } catch (_) {}
    };
    window.__paintSticky();
    btns[0].className = 'go'; btns[1].className = '';
    function go(tab) {
      var pane = document.getElementById(tab + 'Pane');
      if (pane && document.getElementById('book')) {
        activateTab(tab);
        document.getElementById('book').scrollIntoView({ behavior: 'smooth' });
      } else {
        var u = 'index.html?tab=' + tab + '#book';
        try {
          var lang = new URLSearchParams(location.search).get("lang") || "en";
          if (lang !== "en") u = 'index.html?tab=' + tab + '&lang=' + lang + '#book';
        } catch (_) {}
        location.href = u;
      }
    }
    btns[0].addEventListener('click', function () { go('pnr'); });
    btns[1].addEventListener('click', function () { go('live'); });
    bar.querySelector('.x').addEventListener('click', function () {
      try { sessionStorage.setItem(KEY, "1"); } catch (_) {}
      bar.remove();
      try { document.body.classList.remove('has-sticky'); } catch (_) {}
    });
    document.body.appendChild(bar);
    try { document.body.classList.add('has-sticky'); } catch (_) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();

// ---- Animated stat counters (index stats row) ----
(function () {
  var els = document.querySelectorAll('[data-count]');
  if (!els.length) return;
  function run(el) {
    var target = parseFloat(el.dataset.count);
    var suffix = el.dataset.suffix || '';
    var dec = parseInt(el.dataset.decimals || '0', 10);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = (dec ? target.toFixed(dec) : Math.round(target).toLocaleString('en-IN')) + suffix;
      return;
    }
    var t0 = performance.now(), dur = 1200;
    (function frame(t) {
      var k = Math.min((t - t0) / dur, 1);
      var v = target * (1 - Math.pow(1 - k, 3));
      el.textContent = (dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-IN')) + suffix;
      if (k < 1) requestAnimationFrame(frame);
    })(t0);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.5 });
    els.forEach(function (el) { io.observe(el); });
  } else els.forEach(run);
})();

// ---- Station directory (stations.html) ----
(function () {
  var go = document.getElementById('stGo');
  if (!go) return;
  var geoPos = null; // {lat, lon} after user taps "Use my location"
  function run() {
    var out = document.getElementById('stOut');
    var count = document.getElementById('stCount');
    var q = (document.getElementById('stInput') || {}).value || '';
    var state = (document.getElementById('stState') || {}).value || 'All';
    var amen = (document.getElementById('stAmen') || {}).value || 'All';
    var radius = (document.getElementById('stRadius') || {}).value || '5000';
    out.innerHTML = '<div class="train"><strong>' + T('finding', 'Finding trains') + '…</strong></div>';
    var api = window.IRCTC_API;
    var query = { q: q, state: state, amen: amen, radius: radius };
    if (geoPos) { query.lat = geoPos.lat; query.lon = geoPos.lon; query.radiusKm = radius; }
    var p = api ? api.searchStations(query) : Promise.resolve([]);
    p.then(function (rows) {
      out.innerHTML = '';
      rows = Array.isArray(rows) ? rows : [];
      count.textContent = rows.length + ' ' + T('stFound', 'station(s) found') + (geoPos ? ' · nearest first (GPS)' : '');
      if (!rows.length) {
        out.innerHTML = '<div class="train"><strong>' + T('stEmpty', 'Nothing this close.') + '</strong><div class="meta">' + T('stNear', 'Try Anywhere, or start from Howrah / New Delhi.') + '</div></div>';
        return;
      }
      rows.forEach(function (s, i) {
        var d = document.createElement('div');
        d.className = 'train'; d.style.animationDelay = (i * 70) + 'ms';
        d.innerHTML = '<strong></strong><div class="meta"></div><div class="pills"></div><div style="margin-top:10px"><button type="button" class="btn btn-secondary btn-block"></button></div>';
        d.querySelector('strong').textContent = s.name + ' (' + s.code + ')';
        var dist = (s.distKm !== undefined && s.distKm !== null) ? ('~' + s.distKm + ' km away') : ((s.km !== undefined && s.km !== null) ? ('~' + s.km + ' km') : '');
        var meta = s.state + (s.pf ? ' · ' + s.pf + ' ' + T('stPf', 'platforms') : ' · all-India directory') + (dist ? ' · ' + dist : '');
        d.querySelector('.meta').textContent = meta;
        (s.amen || []).forEach(function (a) {
          var pill = document.createElement('span');
          pill.className = 'pill ok'; pill.textContent = a;
          d.querySelector('.pills').appendChild(pill);
        });
        var ub = d.querySelector('button');
        ub.textContent = T('useRoute', 'Use route');
        ub.addEventListener('click', function () {
          try { sessionStorage.setItem('irctc-prefill', JSON.stringify({ from: s.name + ' (' + s.code + ')', to: '' })); } catch (_) {}
          location.href = 'index.html?tab=search#book';
        });
        out.appendChild(d);
      });
    }).catch(function () {
      out.innerHTML = '<div class="train"><strong>' + T('stEmpty', 'Nothing this close.') + '</strong><div class="meta">' + T('stNear', 'Try Anywhere, or start from Howrah / New Delhi.') + '</div></div>';
    });
  }
  go.addEventListener('click', run);
  var stInput = document.getElementById('stInput');
  if (stInput) stInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); run(); } });
  // GPS nearby.
  var geoBtn = document.getElementById('stGeo');
  if (geoBtn) geoBtn.addEventListener('click', function () {
    var msg = document.getElementById('stGeoMsg');
    function say(t) { if (msg) msg.textContent = t; }
    if (!('geolocation' in navigator)) { say('Not supported — type a station.'); return; }
    try { if (window.isSecureContext === false) { say('Needs HTTPS — open the https:// site or type a station.'); return; } } catch (_) {}
    say('Locating…');
    geoBtn.disabled = true;
    var done = false;
    function fin(fn) { if (done) return; done = true; geoBtn.disabled = false; fn(); }
    var timer = setTimeout(function () { fin(function () { say('Timed out — turn on GPS.'); }); }, 12000);
    navigator.geolocation.getCurrentPosition(function (pos) {
      clearTimeout(timer);
      fin(function () {
        if (!pos || !pos.coords) { say('No location — search manually.'); return; }
        geoPos = { lat: Math.round(pos.coords.latitude * 1e4) / 1e4, lon: Math.round(pos.coords.longitude * 1e4) / 1e4 };
        try { var r = document.getElementById('stRadius'); if (r && r.value === '5000' && !(document.getElementById('stInput') || {}).value) r.value = '50'; } catch (_) {}
        say('Location set — nearest first.');
        run();
      });
    }, function (err) {
      clearTimeout(timer);
      fin(function () {
        var c = err && err.code;
        say(c === 1 ? 'Denied — allow Location, then retry.' : c === 2 ? 'Unavailable — turn on GPS.' : 'Try again, or search manually.');
      });
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
  });
  run();
})();
// ---- Festival specials (specials.html) ----
(function () {
  var tabs = document.querySelectorAll('[data-sp]');
  var out = document.getElementById('spOut');
  if (!tabs.length || !out) return;
  var when = 'all';
  function paint() {
    tabs.forEach(function (b) {
      var on = b.dataset.sp === when;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var state = (document.getElementById('spState') || {}).value || 'All';
    var count = document.getElementById('spCount');
    out.innerHTML = '<div class="train"><strong>' + T('finding', 'Finding trains') + '…</strong></div>';
    var api = window.IRCTC_API;
    var p = api ? api.listSpecials({ when: when, state: state }) : Promise.resolve([]);
    p.then(function (rows) {
      out.innerHTML = '';
      rows = Array.isArray(rows) ? rows : [];
      if (count) count.textContent = rows.length + ' ' + T('spFound', 'special(s) found');
      if (!rows.length) {
        out.innerHTML = '<div class="train"><strong>' + T('spEmpty', 'No specials here yet.') + '</strong><div class="meta">' + T('spEmptySub', 'Try All dates, or set an alert below.') + '</div><div style="margin-top:10px"><a class="btn btn-secondary btn-block" href="alerts.html">' + T('spAlert', 'Get alerts') + '</a></div></div>';
        return;
      }
      rows.forEach(function (s, i) {
        var d = document.createElement('div');
        d.className = 'train sp-card'; d.style.animationDelay = (i * 70) + 'ms';
        // LP6 XSS fix: allow-list image host, escape alt via DOM (no string concat of untrusted fields)
        var safeImg = (typeof s.img === "string" && /^https:\/\/images\.pexels\.com\//.test(s.img)) ? s.img : null;
        var img = '';
        if (safeImg) {
          var im = document.createElement('img');
          im.decoding = 'async'; im.width = 112; im.height = 112;
          im.alt = String(s.name || 'Special') + ', ' + String(s.from || '') + ' to ' + String(s.to || '');
          im.loading = 'lazy'; im.referrerPolicy = 'no-referrer';
          im.src = safeImg;
          im.onerror = function () { this.remove(); };
          // serialize safely after DOM build (append below instead of string)
          d.appendChild(im);
          // re-query after append: build body separately
        }
        var tagCls = /fast|last/i.test(s.tag || '') ? 'wl' : 'ok';
        var body = document.createElement('div');
        body.className = 'sp-body';
        body.innerHTML = '<strong></strong><div class="meta"></div><div class="pills"><span class="pill"></span></div><div class="sp-actions"><a class="btn btn-primary" href="index.html?tab=search#book"></a><a class="btn btn-secondary" href="alerts.html"></a></div>';
        body.querySelector('strong').textContent = (s.no ? s.no + ' — ' : '') + String(s.name || '');
        body.querySelector('.meta').textContent = String(s.from || '') + ' → ' + String(s.to || '') + ' · ' + String(s.dates || '') + ' · ' + String(s.bookFrom || '');
        body.querySelector('.pill').className = 'pill ' + tagCls;
        body.querySelector('.pill').textContent = String(s.tag || '');
        body.querySelectorAll('.sp-actions a')[0].textContent = T('spCheck', 'Check trains');
        body.querySelectorAll('.sp-actions a')[1].textContent = T('spAlert', 'Get alerts');
        d.appendChild(body);
        var check = d.querySelectorAll('.sp-actions a')[0];
        check.addEventListener('click', function () {
          try { sessionStorage.setItem('irctc-prefill', JSON.stringify({ from: s.from, to: s.to })); } catch (_) {}
        });
        out.appendChild(d);
      });
    }).catch(function () { out.innerHTML = '<div class="train"><strong>' + T('spEmpty', 'No specials here yet.') + '</strong><div class="meta">' + T('spEmptySub', 'Try All dates, or set an alert below.') + '</div><div style="margin-top:10px"><button type="button" class="btn btn-secondary btn-block">' + T('refreshBtn', 'Refresh') + '</button></div></div>'; var rb = out.querySelector('button'); if (rb) rb.addEventListener('click', paint); });
  }
  tabs.forEach(function (b) { b.addEventListener('click', function () { when = b.dataset.sp; paint(); }); });
  var ss = document.getElementById('spState');
  if (ss) ss.addEventListener('change', paint);
  paint();
})();
// ---- Travel alerts (alerts.html, on-device only) ----
(function () {
  var go = document.getElementById('alGo');
  if (!go) return;
  var list = document.getElementById('alList');
  function paint() {
    if (!list) return;
    list.innerHTML = '';
    var api = window.IRCTC_API;
    var items = api ? api.readAlerts() : [];
    if (!items.length) { list.innerHTML = '<div class="meta">' + T('alEmpty', 'No alerts yet — set one above.') + '</div>'; return; }
    items.forEach(function (a) {
      var d = document.createElement('div');
      d.className = 'pop';
      d.innerHTML = '<div><strong></strong><small></small></div><button type="button">' + T('alDel', 'Remove') + '</button>';
      d.querySelector('strong').textContent = a.type + ' · ' + a.ref;
      d.querySelector('small').textContent = a.contact;
      d.querySelector('button').addEventListener('click', function () { api.removeAlert(a.id); paint(); });
      list.appendChild(d);
    });
  }
  go.addEventListener('click', function () {
    var err = document.getElementById('alErr');
    var out = document.getElementById('alOut');
    err.textContent = ''; out.innerHTML = '';
    var type = (document.getElementById('alType') || {}).value || 'seats';
    var ref = ((document.getElementById('alRef') || {}).value || '').trim();
    var contact = ((document.getElementById('alContact') || {}).value || '').trim();
    if (ref.length < 2) { err.textContent = T('alErrRef', 'Type a train number or station.'); err.setAttribute('tabindex', '-1'); try { err.focus(); } catch (_) {} return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) && contact.replace(/\D/g, '').length < 10) { err.textContent = T('alErrContact', 'Type a valid phone or email.'); err.setAttribute('tabindex', '-1'); try { err.focus(); } catch (_) {} return; }
    var api = window.IRCTC_API;
    var item = api ? api.subscribeAlert({ type: type, ref: ref, contact: contact }) : null;
    if (!item) { err.textContent = T('alErrContact', 'Type a valid phone or email.'); err.setAttribute('tabindex', '-1'); try { err.focus(); } catch (_) {} return; }
    if (item) {
      out.innerHTML = '<div class="train"><strong>' + T('alDone', 'Alert set — we will tell you here.') + '</strong></div>';
      paint();
    }
  });
  paint();
})();

// ---- Tatkal readiness checker (index, % gauge + fixes) ----
(function () {
  var go = document.getElementById('tcGo');
  var host = document.getElementById('tcQs');
  if (!go || !host) return;
  var QS = ["tcQ1", "tcQ2", "tcQ3", "tcQ4", "tcQ5"];
  var QT = ["Logged in before 09:55", "Passengers saved", "UPI / card ready", "Fast internet", "ID proof in hand"];
  var FT = ["tcF1", "tcF2", "tcF3", "tcF4", "tcF5"];
  var FF = ["Login by 09:55 on tatkal day.", "Save passengers tonight (booking step).", "Keep UPI PIN ready — pay in 3 minutes.", "Use fast net; close video apps.", "Carry the same ID as the ticket."];
  QS.forEach(function (k, i) {
    var lab = document.createElement('label');
    lab.className = 'tc-item simple';
    lab.innerHTML = '<input type="checkbox"><span class="tc-txt"></span>';
    lab.querySelector('.tc-txt').textContent = T(k, QT[i]);
    host.appendChild(lab);
  });
  go.textContent = T('tcGo', 'Check my score');
  go.addEventListener('click', function () {
    var boxes = host.querySelectorAll('input[type="checkbox"]');
    var on = 0, fixes = [];
    boxes.forEach(function (b, i) {
      if (b.checked) on++;
      else fixes.push(T(FT[i], FF[i]));
    });
    var pct = Math.round((on / QS.length) * 100);
    var out = document.getElementById('tcOut');
    var fixesHtml = fixes.length
      ? '<ul class="tc-fixes">' + fixes.map(function (f) { return '<li>' + f.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</li>'; }).join('') + '</ul>'
      : '<div class="tc-ok">' + T('tcAllSet', 'All set — be ready by 09:55.') + '</div>';
    out.innerHTML = '<div class="tc-result-simple"><strong>' + T('tcScore', 'You are ') + pct + T('tcReady', '% ready') + ' (' + on + '/5)</strong>' + fixesHtml + '</div>';
  });
})();

// ---- Vendor drafts (vendors.html, on-device only) ----
(function () {
  var go1 = document.getElementById('vdGo1');
  if (!go1 && !document.getElementById('vdGo2')) return;
  var KEY = "irctc-vendor-drafts";
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (_) { return []; } }
  function paint() {
    var list = document.getElementById('vdList');
    if (!list) return;
    list.innerHTML = '';
    var items = read();
    if (!items.length) { list.innerHTML = '<div class="meta">' + T('vdEmpty', 'No drafts yet — apply above.') + '</div>'; return; }
    items.forEach(function (d) {
      var row = document.createElement('div');
      row.className = 'pop';
      row.innerHTML = '<div><strong></strong><small></small></div><button type="button">' + T('alDel', 'Remove') + '</button>';
      row.querySelector('strong').textContent = (d.kind === 'tour' ? T('vdTourT', 'Tour operator') : T('vdStallT', 'Food stall')) + ' · ' + d.what;
      row.querySelector('small').textContent = d.phone;
      row.querySelector('button').addEventListener('click', function () {
        try { localStorage.setItem(KEY, JSON.stringify(read().filter(function (x) { return x.id !== d.id; }))); } catch (_) {}
        paint();
      });
      list.appendChild(row);
    });
  }
  function apply(kind, whatId, phoneId, errId) {
    var err = document.getElementById(errId);
    err.textContent = '';
    var what = ((document.getElementById(whatId) || {}).value || '').trim();
    var phone = ((document.getElementById(phoneId) || {}).value || '').replace(/\D/g, '');
    if (what.length < 3) { err.textContent = T('vdErrWhat', 'Describe your stall or route (3+ letters).'); err.setAttribute('tabindex', '-1'); try { err.focus(); } catch (_) {} return; }
    if (!/^[6-9]\d{9}$/.test(phone)) { err.textContent = T('vdErrPhone', 'Type a valid 10-digit phone.'); err.setAttribute('tabindex', '-1'); try { err.focus(); } catch (_) {} return; }
    var api = window.IRCTC_API;
    var item = api && api.createVendorDraft ? api.createVendorDraft({ kind: kind, what: what, phone: phone }) : null;
    if (!item) { err.textContent = T('vdErrWhat', 'Describe your stall or route (3+ letters).'); return; }
    paint();
  }
  go1.addEventListener('click', function () { apply('stall', 'vdStall', 'vdPhone', 'vdErr1'); });
  var go2 = document.getElementById('vdGo2');
  if (go2) go2.addEventListener('click', function () { apply('tour', 'vdTour', 'vdPhone2', 'vdErr2'); });
  paint();
})();

// ---- Story filter chips (stories.html) ----
(function () {
  var chips = document.querySelectorAll('#storyChips [data-tag]');
  var grid = document.getElementById('storyGrid');
  if (!chips.length || !grid) return;
  var labels = { all: 'fAll', tatkal: 'fTatkal', refunds: 'fRefunds', guides: 'fGuides' };
  var fb = { all: 'All', tatkal: 'Tatkal', refunds: 'Refunds', guides: 'Guides' };
  chips.forEach(function (c) { c.textContent = T(labels[c.dataset.tag] || 'fAll', fb[c.dataset.tag] || 'All'); });
  function applyTag(tag, push) {
    chips.forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.tag === tag ? 'true' : 'false'); });
    var visible = 0;
    grid.querySelectorAll('[data-tag]').forEach(function (card) {
      var show = (tag === 'all' || card.dataset.tag === tag);
      card.hidden = !show;
      if (show) visible++;
    });
    var count = document.getElementById('storyCount');
    if (count) count.textContent = visible + ' ' + T('spFound', 'special(s) found');
    var empty = document.getElementById('storyEmpty');
    if (empty) empty.hidden = visible > 0;
    if (push !== false) { try { var u = new URL(location.href); u.searchParams.set('tag', tag); history.replaceState(null, '', u.toString()); } catch (_) {} }
  }
  chips.forEach(function (c) {
    c.addEventListener('click', function () { applyTag(c.dataset.tag, true); });
  });
  var initial = 'all';
  try { initial = new URLSearchParams(location.search).get('tag') || 'all'; } catch (_) {}
  if (!['all', 'tatkal', 'refunds', 'guides'].includes(initial)) initial = 'all';
  applyTag(initial, false);
})();

// ---- Demo Sign in with OTP (shared across all pages, no backend) ----
(function () {
  var KEY = 'irctc-demo-user';
  function readUser() { try { var a = window.IRCTC_API && window.IRCTC_API.auth.session(); if (a) return a; } catch (_) {} try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; } }
  function paint() {
    var u = readUser();
    document.querySelectorAll('.signin').forEach(function (a) {
      if (u) { a.textContent = (u.role === 'vendor' ? 'Vendor ' : 'Hi ') + String(u.phone).slice(-5) + ' · Out'; a.setAttribute('data-out', '1'); }
      else { a.textContent = 'Sign in'; a.removeAttribute('data-out'); }
    });
  }
  function ensureModal() {
    if (document.getElementById('signinModal')) return document.getElementById('signinModal');
    const m = document.createElement('div');
    m.className = 'cookie-modal signin-modal';
    m.id = 'signinModal';
    m.hidden = true;
    m.innerHTML = '<div class="cookie-box" role="dialog" aria-modal="true" aria-labelledby="siTitle"><h2 id="siTitle">Sign in</h2><p class="muted" style="margin:0 0 12px">OTP to your mobile. Session is HttpOnly, expires in 30 days. Never share bank OTPs.</p><div class="field"><label for="siPhone">Mobile number</label><input id="siPhone" inputmode="numeric" maxlength="10" placeholder="e.g. 98765 43210" autocomplete="off" /></div><div class="field" id="siOtpWrap" hidden><label for="siOtp">6-digit code</label><input id="siOtp" inputmode="numeric" maxlength="6" placeholder="Check SMS" autocomplete="off" /><p class="muted" id="siOtpHint" style="margin:6px 0 0"></p></div><p class="error" id="siErr" role="alert"></p><div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-secondary" id="siClose" type="button" style="flex:1">Close</button><button class="btn btn-primary" id="siGo" type="button" style="flex:1">Send code</button></div><div id="siOut" aria-live="polite" style="margin-top:10px"></div></div>';
    document.body.appendChild(m);
    const close = () => { m.hidden = true; };
    m.addEventListener('click', (e) => { if (e.target === m) close(); });
    m.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      const f = [...m.querySelectorAll('button, input')].filter(el => !el.disabled && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    m.querySelector('#siClose').addEventListener('click', close);
    let code = null, phone = null, exp = 0, serverMode = false;
    m.querySelector('#siGo').addEventListener('click', async () => {
      const err = m.querySelector('#siErr');
      const out = m.querySelector('#siOut');
      err.textContent = '';
      const api = window.IRCTC_API;
      if (!code) {
        phone = m.querySelector('#siPhone').value.replace(/\D/g, '');
        if (!/^[6-9]\d{9}$/.test(phone)) { err.textContent = 'Type a 10-digit mobile number starting with 6-9.'; return; }
        try {
          if (api) {
            const r = await api.auth.requestCode(phone);
            // LP6: never render OTP in DOM. Server logs it in dev, sends SMS in prod.
            serverMode = true;
            code = 'server';
            exp = Date.now() + (r.expInSec || 300) * 1000;
            if (r && r.devCode) { try { console.info('[RailBook] dev OTP (not shown in UI):', r.devCode); } catch (_) {} }
          } else { code = 'server'; exp = Date.now() + 300000; }
        } catch (_) { code = 'server'; exp = Date.now() + 300000; }
        m.querySelector('#siOtpWrap').hidden = false;
        m.querySelector('#siOtpHint').textContent = 'Code sent by SMS (valid 5 min). In local dev, check server logs.';
        m.querySelector('#siGo').textContent = 'Verify';
        out.innerHTML = '';
        m.querySelector('#siOtp').focus();
      } else {
        const v = m.querySelector('#siOtp').value.replace(/\D/g, '');
        if (Date.now() > exp) { err.textContent = 'Code expired. Close and try again.'; code = null; m.querySelector('#siGo').textContent = 'Send code'; return; }
        let ok = false;
        try { if (api) { const r = await api.auth.verifyCode(phone, v); ok = !!(r && r.ok); } } catch (_) { ok = false; }
        if (!ok) { err.textContent = 'Wrong code. Check SMS and try again.'; return; }
        try { var uu = JSON.parse(localStorage.getItem(KEY) || 'null'); if (uu) { uu.role = m.dataset.mode === 'vendor' ? 'vendor' : 'user'; localStorage.setItem(KEY, JSON.stringify(uu)); } } catch (_) {}
        paint();
        out.textContent = '';
        var doneBox = document.createElement('div'); doneBox.className = 'train';
        var st = document.createElement('strong'); st.textContent = 'Signed in — ' + phone.slice(0, 5) + ' ' + phone.slice(5);
        var mt = document.createElement('div'); mt.className = 'meta'; mt.textContent = 'Session is HttpOnly. Trip plans sync when online.';
        doneBox.appendChild(st); doneBox.appendChild(mt); out.appendChild(doneBox);
        setTimeout(close, 900);
      }
    });
    return m;
  }
  document.querySelectorAll('.signin').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (a.getAttribute('data-out')) { try { if (window.IRCTC_API) window.IRCTC_API.auth.signOut(); localStorage.removeItem(KEY); } catch (_) {} paint(); return; }
      const m = ensureModal();
      const vendor = a.id === 'vendorLink';
      m.dataset.mode = vendor ? 'vendor' : 'user';
      const h = m.querySelector('#siTitle');
      if (h) h.textContent = vendor ? T('vdLogin', 'Vendor sign in — demo only') : T('siLogin', 'Sign in — demo only');
      m.hidden = false;
      const inp = m.querySelector('#siPhone');
      if (inp) inp.focus();
    });
  });
  paint();
})();
