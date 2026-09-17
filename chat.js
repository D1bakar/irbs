// RailBook LP6 AI chat widget. Zero deps, separate file (main.js is at its 85KB gate).
// Asks same-origin /api/chat (API key stays server-side). Offline-safe: a failed
// fetch shows an honest message. History stays on-device only, never sent back.
(function () {
  if (window.__RB_CHAT__) return; // idempotent across re-includes
  window.__RB_CHAT__ = true;

  // lang.js declares `const LANGS` at script top level: visible as a global lexical
  // binding to later classic scripts, but NOT as window.LANGS. Read defensively.
  function L() {
    try { if (typeof LANGS !== "undefined" && LANGS) return LANGS; } catch (_) {}
    try { if (window.LANGS) return window.LANGS; } catch (_) {}
    return null;
  }
  function T(code) {
    try {
      var A = L();
      if (A && A[code] && A[code].s) return A[code].s;
    } catch (_) {}
    try { return L().en.s; } catch (_) {}
    return {};
  }
  var S = T(document.documentElement.lang || "en");

  var TEXT = {
    open: S.chatOpen || "Ask RailBook",
    title: S.chatTitle || "Ask RailBook",
    sub: S.chatSub || "Quick answers. Official links for live data.",
    ph: S.chatPh || "Type your question…",
    send: S.chatSend || "Send",
    close: S.chatClose || "Close chat",
    hello: S.chatHello || "Namaste! Ask me about Tatkal, refunds, food, stations or bookings. For live PNR or running status, I will point you to official NTES.",
    busy: S.chatBusy || "Thinking…",
    offline: S.chatOffline || "No connection right now — please try again when you are back online.",
    retry: S.chatRetry || "Chat is not reachable right now. Official help: 139.",
    handoff: S.chatHandoff || "Open official NTES",
    err: S.chatErr || "Something went wrong. Please try again."
  };

  function linkify(s) {
    // URLs -> safe <a> (rel/noopener). Text is escaped first.
    var e = document.createElement("span");
    e.textContent = s;
    var html = e.innerHTML.replace(/(https?:\/\/[^\s<]+)/g, function (m) {
      return '<a href="' + m + '" target="_blank" rel="noopener noreferrer">' + m + "</a>";
    });
    return html;
  }

  var fab, panel, log, input, btn, lastFocus = null, busy = false;

  function build() {
    fab = document.createElement("button");
    fab.type = "button";
    fab.id = "chatFab";
    fab.className = "chat-fab";
    fab.setAttribute("aria-haspopup", "dialog");
    fab.setAttribute("aria-expanded", "false");
    fab.setAttribute("aria-controls", "chatPanel");
    fab.setAttribute("aria-label", TEXT.open);
    fab.textContent = "💬";

    panel = document.createElement("div");
    panel.id = "chatPanel";
    panel.className = "chat-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-label", TEXT.title);
    panel.hidden = true;
    panel.innerHTML =
      '<div class="chat-head">' +
      '<div class="chat-head-t"><strong id="chatTitleEl">' + TEXT.title + "</strong>" +
      '<small class="chat-sub">' + TEXT.sub + "</small></div>" +
      '<button type="button" class="chat-x" aria-label="' + TEXT.close + '">&times;</button>' +
      "</div>" +
      '<div class="chat-log" id="chatLog" role="log" aria-live="polite" aria-relevant="additions"></div>' +
      '<form class="chat-form" id="chatForm">' +
      '<input id="chatInput" class="chat-in" type="text" autocomplete="off" maxlength="500" placeholder="' + TEXT.ph + '" aria-label="' + TEXT.ph + '" />' +
      '<button id="chatGo" class="chat-go" type="submit" aria-label="' + TEXT.send + '">' + TEXT.send + "</button>" +
      "</form>";

    document.body.appendChild(fab);
    document.body.appendChild(panel);
    log = panel.querySelector("#chatLog");
    input = panel.querySelector("#chatInput");
    btn = panel.querySelector("#chatGo");

    fab.addEventListener("click", toggle);
    panel.querySelector(".chat-x").addEventListener("click", close);
    panel.querySelector("#chatForm").addEventListener("submit", onSend);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) close();
    });
    // Live language switch: re-apply static texts when <html lang> changes.
    try {
      var mo = new MutationObserver(function () {
        var N = T(document.documentElement.lang || "en");
        if (!N || N === S) return;
        S = N;
        TEXT.open = N.chatOpen || TEXT.open; TEXT.title = N.chatTitle || TEXT.title;
        TEXT.ph = N.chatPh || TEXT.ph; TEXT.send = N.chatSend || TEXT.send;
        TEXT.close = N.chatClose || TEXT.close; TEXT.handoff = N.chatHandoff || TEXT.handoff;
        fab.setAttribute("aria-label", TEXT.open);
        panel.setAttribute("aria-label", TEXT.title);
        var tEl = panel.querySelector("#chatTitleEl"); if (tEl) tEl.textContent = TEXT.title;
        var sEl = panel.querySelector(".chat-sub"); if (sEl) sEl.textContent = N.chatSub || "";
        var x = panel.querySelector(".chat-x"); if (x) x.setAttribute("aria-label", TEXT.close);
        input.setAttribute("placeholder", TEXT.ph); input.setAttribute("aria-label", TEXT.ph);
        btn.textContent = TEXT.send; btn.setAttribute("aria-label", TEXT.send);
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    } catch (_) {}
    addMsg("bot", TEXT.hello);
  }

  function open() {
    lastFocus = document.activeElement;
    panel.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    fab.classList.add("open");
    setTimeout(function () { input.focus({ preventScroll: true }); }, 60);
  }
  function close() {
    panel.hidden = true;
    fab.setAttribute("aria-expanded", "false");
    fab.classList.remove("open");
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  function toggle() { panel.hidden ? open() : close(); }

  function addMsg(who, text, opts) {
    opts = opts || {};
    var m = document.createElement("div");
    m.className = "chat-msg " + who;
    var b = document.createElement("div");
    b.className = "chat-bubble";
    if (opts.html) b.innerHTML = linkify(text);
    else b.textContent = text;
    m.appendChild(b);
    if (opts.cta) {
      var a = document.createElement("a");
      a.className = "chat-cta";
      a.href = opts.cta;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = TEXT.handoff;
      m.appendChild(a);
    }
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }

  function onSend(e) {
    e.preventDefault();
    if (busy) return;
    var q = (input.value || "").trim();
    if (!q) return;
    input.value = "";
    addMsg("me", q);
    busy = true;
    btn.disabled = true;
    var wait = addMsg("bot", TEXT.busy);
    var done = function () { busy = false; btn.disabled = false; input.focus({ preventScroll: true }); };

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: q })
    }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    }).then(function (j) {
      wait.remove();
      if (j && j.handoff) addMsg("bot", j.msg || TEXT.err, { html: true, cta: j.url });
      else if (j && j.reply) addMsg("bot", j.reply, { html: true });
      else addMsg("bot", TEXT.err);
      done();
    }).catch(function () {
      wait.remove();
      var offline = (typeof navigator !== "undefined" && navigator.onLine === false);
      addMsg("bot", offline ? TEXT.offline : TEXT.retry);
      done();
    });
  }

  function boot() {
    if (document.getElementById("chatFab")) return;
    build();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
