/* Maheshika & Moksha · Kalutara. One page, no framework.
   Loaded after config.js and api.js (the personal greeting in guest.js needs both). */

const REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE_POINTER = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/* The motion tokens live in :root (css/styles.css); JS reads them so there is one source of truth. */
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const cssMs = (name) => { const v = cssVar(name); return parseFloat(v) * (v.endsWith("ms") ? 1 : 1000); };
let EASE = "ease", T_FAST = 250, T_BASE = 600, T_SLOW = 1000;

document.addEventListener("DOMContentLoaded", () => {
  EASE = cssVar("--ease") || EASE;
  T_FAST = cssMs("--t-fast") || T_FAST; T_BASE = cssMs("--t-base") || T_BASE; T_SLOW = cssMs("--t-slow") || T_SLOW;
  setupPinGate();
  setupNav();
  splitNames();
  splitHeadings();
  setupReveals();
  setupCountdown();
  setupInvitation();
  setupProgress();
  setupParallax();
  setupTilt();
  setupPetals();
});

/* ---------- PIN gate ----------
   A four-digit code from the invitation, remembered on the device. The hash is SHA-256
   of the code. This is a courtesy curtain, not security: the page is delivered before the
   gate and a four-digit code is guessable. Keeping the site out of search engines is done
   by robots.txt and the noindex meta tag. Never write the code itself in this public file.
   A personal link (?g=guestid) is its own key: it unlocks the device and skips the gate.
   While the gate is up, <html class="gated"> (set inline in <head> before first paint)
   keeps the page out of sight and holds the hero intro; it is cleared here on success
   or straight away when no gate is needed. */

const PIN_HASH = "44c59909f17c296d6f2ec4a53efac3a951add75aa67616d9c5d9d2f5fbb44f04";
const PIN_KEY = "mnm-key";
/* "gated": the PIN gate is up. "covered": the sealed invitation is up. Both hold the hero. */
const isGated = () => { const c = document.documentElement.classList; return c.contains("gated") || c.contains("covered"); };
const guestParam = () => new URLSearchParams(location.search).get("g");

function setupPinGate() {
  const root = document.documentElement;
  const ungate = () => root.classList.remove("gated");
  let unlocked = false;
  try {
    if (guestParam()) { localStorage.setItem(PIN_KEY, "1"); ungate(); return; }
    unlocked = localStorage.getItem(PIN_KEY) === "1";
  } catch (e) {
    ungate(); return; // storage unavailable: never lock a guest out
  }
  if (unlocked || !window.crypto || !crypto.subtle) { ungate(); return; }
  root.classList.add("gated"); // normally already set by the inline snippet in <head>

  const gate = document.createElement("div");
  gate.className = "pin-gate";
  gate.innerHTML =
    '<div class="pin-box">' +
    '<div class="pin-mono">M &amp; M</div>' +
    '<p class="pin-title">A private celebration</p>' +
    '<p class="pin-sub">enter the code from your invitation</p>' +
    '<input class="pin-input" inputmode="numeric" pattern="[0-9]*" maxlength="4" aria-label="4 digit code" autocomplete="one-time-code">' +
    '<p class="pin-err" aria-live="polite"></p>' +
    "</div>";
  document.body.appendChild(gate);
  document.body.classList.add("no-scroll");

  const input = gate.querySelector(".pin-input");
  const box = gate.querySelector(".pin-box");
  const err = gate.querySelector(".pin-err");

  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  input.addEventListener("input", async () => {
    err.textContent = "";
    const v = input.value.replace(/\D/g, "");
    input.value = v;
    if (v.length !== 4) return;
    if ((await sha256(v)) === PIN_HASH) {
      try { localStorage.setItem(PIN_KEY, "1"); } catch (e) {}
      gate.classList.add("open");
      document.body.classList.remove("no-scroll");
      ungate(); // the hero intro starts while the gate fades out
      document.dispatchEvent(new Event("mnm:unlock"));
      setTimeout(() => gate.remove(), T_BASE);
    } else {
      input.value = "";
      box.classList.add("shake");
      err.textContent = "That's not it. Try the code on your invitation";
      setTimeout(() => box.classList.remove("shake"), T_BASE);
    }
  });
  setTimeout(() => input.focus(), 100);
}

/* ---------- Hero visibility: one observer shared by everything that should only
   run while the hero is on screen, the tab is visible and the gate is down ---------- */

const heroWatchers = [];
let heroOnScreen = false;

function onHeroVisible(cb) {
  heroWatchers.push(cb);
  if (heroWatchers.length > 1) { cb(heroOnScreen && !document.hidden && !isGated()); return; }
  const hero = document.querySelector(".hero");
  if (!hero || !("IntersectionObserver" in window)) { heroOnScreen = true; cb(true); return; }
  const notify = () => { const on = heroOnScreen && !document.hidden && !isGated(); heroWatchers.forEach((fn) => fn(on)); };
  new IntersectionObserver((en) => { heroOnScreen = en[0].isIntersecting; notify(); }, { threshold: 0.05 }).observe(hero);
  document.addEventListener("visibilitychange", notify);
  document.addEventListener("mnm:unlock", notify);
  document.addEventListener("mnm:enter", notify);
}

/* ---------- Nav: glass header, smooth scroll with offset,
   active-section highlight, mobile menu ---------- */

function setupNav() {
  const nav = document.getElementById("nav");
  const links = document.getElementById("links");
  const burger = document.getElementById("burger");
  const anchors = [...links.querySelectorAll("a[href^='#']")];
  const navH = () => nav.getBoundingClientRect().height;

  const onScroll = () => nav.classList.toggle("solid", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  document.querySelectorAll("a[href^='#']").forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href").slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      const top = id === "home" ? 0 : target.getBoundingClientRect().top + window.scrollY - navH() + 1;
      window.scrollTo({ top, behavior: REDUCED ? "auto" : "smooth" });
      history.replaceState(null, "", location.search + "#" + id); // keeps ?g= in the address bar
    });
  });

  const sections = anchors.map((a) => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean);
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        anchors.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id));
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  sections.forEach((s) => spy.observe(s));

  function closeMenu(returnFocus) {
    const wasOpen = links.classList.contains("open");
    links.classList.remove("open");
    nav.classList.remove("menu-open");
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", "Open menu");
    document.body.classList.remove("no-scroll");
    if (wasOpen && returnFocus) burger.focus();
  }
  burger.addEventListener("click", () => {
    const open = !links.classList.contains("open");
    links.classList.toggle("open", open);
    nav.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("no-scroll", open);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(true); });

  // the fixed quick-action pills step aside while the contact cards are on screen
  const pills = document.querySelector(".pills");
  const contact = document.querySelector(".contact");
  if (pills && contact && "IntersectionObserver" in window) {
    new IntersectionObserver((en) => pills.classList.toggle("hide", en[0].isIntersecting)).observe(contact);
  }
}

/* ---------- Text motion: names rise line by line, headings word by word ---------- */

function splitNames() {
  document.querySelectorAll(".names .line").forEach((line) => {
    const inner = document.createElement("span");
    inner.className = "line-in";
    while (line.firstChild) inner.appendChild(line.firstChild);
    line.appendChild(inner);
  });
}

function splitHeadings() {
  document.querySelectorAll("h2[data-split]").forEach((h) => {
    const words = h.textContent.trim().split(/\s+/);
    h.textContent = "";
    words.forEach((w, i) => {
      const outer = document.createElement("span");
      outer.className = "w";
      const inner = document.createElement("span");
      inner.textContent = w;
      inner.style.transitionDelay = `${i * 60}ms`;
      outer.appendChild(inner);
      h.appendChild(outer);
      if (i < words.length - 1) h.appendChild(document.createTextNode(" "));
    });
  });
}

/* ---------- Scroll reveals (sections, cards, photos) ----------
   Elements that come into view together are staggered 70ms apart (capped), in
   document order; an element that arrives alone gets no delay. Once the entrance
   has settled the .reveal class and the inline delay are dropped, so hover lifts
   and each element's own transitions are not slowed down by the entrance. */

function setupReveals() {
  const els = document.querySelectorAll(".reveal, .img-reveal, h2[data-split]");
  const settle = (el, delay) => {
    if (!el.classList.contains("reveal")) return;
    // margin covers children that start a little later (the scene times wait --t-fast)
    setTimeout(() => { el.classList.remove("reveal"); el.style.transitionDelay = ""; }, delay + T_SLOW + T_FAST + 100);
  };
  if (!("IntersectionObserver" in window)) { els.forEach((el) => { el.classList.add("in"); settle(el, 0); }); return; }
  let pending = els.length;
  const io = new IntersectionObserver(
    (entries) => {
      let k = 0;
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        const delay = el.classList.contains("reveal") ? Math.min(k++, 6) * 70 : 0;
        if (delay) el.style.transitionDelay = `${delay}ms`;
        el.classList.add("in");
        settle(el, delay);
        io.unobserve(el);
        if (--pending === 0) io.disconnect();
      });
    },
    // the element's top edge crossing 90% of the viewport reveals it, whatever its height
    { threshold: 0, rootMargin: "0px 0px -10% 0px" }
  );
  els.forEach((el) => io.observe(el));
}

/* ---------- Countdown to the poruwa ----------
   Ticks only while the hero is on screen (and the tab visible); on return it catches up at once. */

function setupCountdown() {
  const box = document.getElementById("countdown");
  if (!box) return;
  const target = new Date("2026-12-21T17:00:00+05:30"); // guests arrive, 5 PM Sri Lanka time, Monday 21 December
  const f = (sel) => box.querySelector(`[data-cd="${sel}"]`);
  const pad = (n) => String(n).padStart(2, "0");
  const set = (sel, v) => {
    const el = f(sel);
    if (el.textContent === String(v)) return;
    el.textContent = v;
    if (REDUCED || !el.animate) return;
    // the new digit drops in; Web Animations restart cleanly with no forced reflow
    el.animate([{ transform: "translateY(-.35em)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: T_FAST, easing: EASE });
  };
  let timer = 0, live = false;
  function tick() {
    timer = 0;
    const diff = target - Date.now();
    if (diff <= 0) {
      box.innerHTML = '<div style="flex:1"><b style="font-size:1.4rem">It\'s today!</b><span>see you at Anantara Kalutara</span></div>';
      return;
    }
    const s = Math.floor(diff / 1000);
    set("d", Math.floor(s / 86400));
    set("h", pad(Math.floor((s % 86400) / 3600)));
    set("m", pad(Math.floor((s % 3600) / 60)));
    set("s", pad(s % 60));
    if (live) timer = setTimeout(tick, 1000 - (Date.now() % 1000));
  }
  tick(); // the numbers are right from the first paint, even behind the gate
  onHeroVisible((on) => {
    live = on;
    clearTimeout(timer); timer = 0;
    if (on) tick();
  });
}

/* ---------- The sealed invitation (cover + wax seal) ----------
   Greets every visit to the main page once the PIN gate is down: tapping the seal opens
   the cover and the card rises out. Skipped when arriving from the site's own navigation
   (the photos page), so browsing back does not replay it. A personal link (?g=guestid)
   always shows it, with the guest's name filled in by guest.js. */

function setupInvitation() {
  const overlay = document.getElementById("card-overlay");
  if (!overlay) return;
  const params = new URLSearchParams(location.search);
  const personal = params.get("g") || params.get("name");
  const cameFromInside = document.referrer.startsWith(location.origin);
  if (cameFromInside && !personal) { overlay.remove(); return; }

  const root = document.documentElement;
  root.classList.add("covered");
  const show = () => { overlay.classList.remove("hidden"); document.body.classList.add("no-scroll"); };
  if (root.classList.contains("gated")) document.addEventListener("mnm:unlock", show, { once: true });
  else show();

  function open(e) {
    e.stopPropagation();
    if (overlay.classList.contains("opening")) return;
    overlay.classList.add("opening");
    if (REDUCED) { overlay.classList.add("risen", "presented"); return; }
    setTimeout(() => overlay.classList.add("risen"), 700);
    setTimeout(() => overlay.classList.add("presented"), 1400);
  }
  function done() {
    overlay.classList.add("leaving");
    document.body.classList.remove("no-scroll");
    root.classList.remove("covered"); // the hero intro starts while the overlay fades out
    document.dispatchEvent(new Event("mnm:enter"));
    setTimeout(() => overlay.remove(), T_BASE + 150);
  }
  const cover = overlay.querySelector(".cover");
  cover.addEventListener("click", open);
  cover.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") open(e); });
  overlay.querySelector(".wax-seal").addEventListener("click", open);
  overlay.querySelector(".inv-enter").addEventListener("click", (e) => { e.stopPropagation(); done(); });
  overlay.querySelector(".skip-link").addEventListener("click", done);
  // the RSVP link on the card closes the overlay first, then the nav handler scrolls to the form
  overlay.querySelector(".ovl-rsvp-link").addEventListener("click", done, { capture: true });
}

/* ---------- Scroll progress line ---------- */

function setupProgress() {
  const bar = document.getElementById("progress");
  if (!bar || REDUCED) return;
  let raf = 0;
  const update = () => {
    raf = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
  update();
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
}

/* ---------- Parallax: elements with data-parallax drift relative to the
   scroll. Negative lags behind the page, positive leads it. ---------- */

function setupParallax() {
  if (REDUCED) return;
  const els = [...document.querySelectorAll("[data-parallax]")].map((el) => ({ el, k: parseFloat(el.dataset.parallax), py: null }));
  if (!els.length) return;
  let raf = 0;
  const update = () => {
    raf = 0;
    const mid = innerHeight / 2;
    // read every rect first, then write, so no frame forces a second layout
    const rects = els.map(({ el }) => el.getBoundingClientRect());
    els.forEach((p, i) => {
      const r = rects[i];
      if (r.bottom < -400 || r.top > innerHeight + 400) return;
      const d = ((r.top + r.height / 2 - mid) * p.k).toFixed(1);
      if (d === p.py) return;
      p.py = d;
      p.el.style.setProperty("--py", `${d}px`);
    });
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
  update();
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
}

/* ---------- Pointer tilt on the hero photo (desktop only, very gentle) ---------- */

function setupTilt() {
  if (REDUCED || !FINE_POINTER) return;
  const el = document.querySelector(".tilt");
  if (!el) return;
  const img = el.querySelector("img");
  let raf = 0, tx = 0, ty = 0;
  const apply = () => { raf = 0; img.style.transform = `scale(1.04) translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`; };
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * -10;
    ty = ((e.clientY - r.top) / r.height - 0.5) * -10;
    if (!raf) raf = requestAnimationFrame(apply);
  });
  el.addEventListener("pointerleave", () => { cancelAnimationFrame(raf); raf = 0; tx = 0; ty = 0; img.style.transform = ""; });
}

/* ---------- Araliya blossoms drifting through the hero, only while it is on screen ---------- */

function setupPetals() {
  const canvas = document.getElementById("petals");
  if (!canvas || REDUCED) return;
  const ctx = canvas.getContext("2d");
  const COLORS = ["#fbf7ee", "#f6efdc", "#f4e3b8", "#f7d9a8", "#f2c9c9"];
  let W = 0, H = 0, dpr = 1, petals = [], running = false, raf = 0, last = 0;

  function size() {
    const w = canvas.clientWidth, h = canvas.clientHeight, d = Math.min(2, devicePixelRatio || 1);
    if (w === W && h === H && d === dpr) return;
    const widthChanged = w !== W;
    W = w; H = h; dpr = d;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // a new flock only when the width changes; a taller or shorter hero (mobile URL bar) keeps the petals where they are
    if (widthChanged || !petals.length) {
      const n = W < 700 ? 26 : Math.round(Math.min(30, Math.max(14, W / 50)));
      petals = Array.from({ length: n }, () => make(true));
    }
  }
  function make(anywhere) {
    const s = 4 + Math.random() * 6;
    return {
      x: Math.random() * W, y: anywhere ? Math.random() * H : -20,
      rx: s, ry: s * (0.45 + Math.random() * 0.2),
      vy: 12 + Math.random() * 18, vx: -6 + Math.random() * 12,
      phase: Math.random() * Math.PI * 2, sway: 8 + Math.random() * 14,
      a: Math.random() * Math.PI * 2, spin: -0.5 + Math.random(),
      c: COLORS[Math.floor(Math.random() * COLORS.length)], o: 0.45 + Math.random() * 0.35,
    };
  }
  function frame(t) {
    if (!running) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      p.phase += dt * 1.3; p.y += p.vy * dt; p.x += (p.vx + Math.sin(p.phase) * p.sway) * dt; p.a += p.spin * dt;
      if (p.y > H + 20 || p.x < -30 || p.x > W + 30) { petals[i] = make(false); continue; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = p.o; ctx.fillStyle = p.c;
      // a five-petal araliya: rounded petals overlapping around a yellow heart
      for (let q = 0; q < 5; q++) {
        ctx.beginPath(); ctx.ellipse(0, -p.rx * 0.8, p.rx * 0.62, p.rx * 0.9, 0, 0, Math.PI * 2); ctx.fill(); ctx.rotate(Math.PI * 2 / 5);
      }
      ctx.fillStyle = "#f6c453"; ctx.beginPath(); ctx.arc(0, 0, p.rx * 0.34, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  size();
  let sizeRaf = 0;
  addEventListener("resize", () => { cancelAnimationFrame(sizeRaf); sizeRaf = requestAnimationFrame(size); });
  onHeroVisible((on) => (on ? start() : stop()));
}
