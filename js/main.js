/* Shared behaviour: mobile nav, countdown, personalized invitation overlay. */

document.addEventListener("DOMContentLoaded", () => {
  setupPinGate();
  setupNav();
  setupCountdown();
  setupInvitation();
  setupMotion();
});

/* ---------- Privacy gate ----------
   Guests with a personal ?g= link walk straight in (the link is the key).
   Everyone else is asked once for the 4-digit code from the invitation;
   the device remembers. Wedding-grade privacy, not bank-grade security. */

const PIN_HASH = "44c59909f17c296d6f2ec4a53efac3a951add75aa67616d9c5d9d2f5fbb44f04";

function setupPinGate() {
  let unlocked = false;
  try {
    if (new URLSearchParams(location.search).get("g")) {
      localStorage.setItem("mnm-key", "1");
      return;
    }
    unlocked = localStorage.getItem("mnm-key") === "1";
  } catch (e) {
    return; // storage unavailable — never lock a guest out
  }
  if (unlocked || !window.crypto || !crypto.subtle) return;

  const gate = document.createElement("div");
  gate.className = "pin-gate";
  gate.innerHTML =
    '<div class="pin-box">' +
    '<div class="pin-mono">M<span>&amp;</span>M</div>' +
    '<p class="pin-title">A Private Celebration</p>' +
    '<p class="pin-sub">enter the code from your invitation</p>' +
    '<input class="pin-input" inputmode="numeric" pattern="[0-9]*" maxlength="4" aria-label="4 digit code" autofocus>' +
    '<p class="pin-err" aria-live="polite"></p>' +
    "</div>";
  document.body.appendChild(gate);
  document.body.classList.add("no-scroll");

  const input = gate.querySelector(".pin-input");
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
      try { localStorage.setItem("mnm-key", "1"); } catch (e) {}
      gate.classList.add("open");
      document.body.classList.remove("no-scroll");
      setTimeout(() => gate.remove(), 600);
    } else {
      input.value = "";
      gate.querySelector(".pin-box").classList.add("shake");
      err.textContent = "That's not it — try the code on your invitation";
      setTimeout(() => gate.querySelector(".pin-box").classList.remove("shake"), 500);
    }
  });
  setTimeout(() => input.focus(), 100);
}

/* ---------- Scroll-driven motion: glass header + section reveals ---------- */

function setupMotion() {
  // glass header solidifies once the hero is scrolled past
  const glass = document.querySelector(".site-header.glass");
  if (glass) {
    const onScroll = () => glass.classList.toggle("scrolled", window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // sections fade up as they enter the viewport (once each)
  const revealed = document.querySelectorAll(".reveal");
  if (!revealed.length) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    revealed.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  revealed.forEach((el) => io.observe(el));

  // the timeline's dotted spine draws itself as the page scrolls
  const spine = document.querySelector(".tl2");
  if (spine) {
    const draw = () => {
      const r = spine.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.8 - r.top) / r.height));
      spine.querySelector(".tl2-spine span").style.setProperty("--spine", progress.toFixed(3));
      spine.querySelector(".tl2-spine span").style.transform = `scaleY(${progress.toFixed(3)})`;
    };
    draw();
    window.addEventListener("scroll", draw, { passive: true });
  }
}

/* ---------- Mobile nav ---------- */

function setupNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => nav.classList.toggle("open"));
}

/* ---------- Countdown to the big day ---------- */

function setupCountdown() {
  const el = document.querySelector(".countdown");
  if (!el) return;

  const target = new Date("2026-12-21T17:00:00+05:30"); // 5 PM Sri Lanka time

  function render() {
    let diff = Math.max(0, target - new Date());
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    el.querySelector('[data-unit="days"]').textContent = days;
    el.querySelector('[data-unit="hours"]').textContent = hours;
    el.querySelector('[data-unit="mins"]').textContent = mins;
  }

  render();
  setInterval(render, 30000);
}

/* ---------- The digital invitation card (cover + wax seal) ----------
   The sealed cover greets every visit to the home page with a
   personal "Hello, …"; tapping the wax seal opens it and the
   invitation card rises out. Skipped only when arriving via the
   site's own navigation, so browsing back to Home doesn't replay it.
   A personalized link (?g=guestid) always opens it, with that
   guest's name on both the cover and the card. */

function setupInvitation() {
  const overlay = document.getElementById("card-overlay");
  if (!overlay) return;

  const params = new URLSearchParams(location.search);
  const guestId = params.get("g");
  const previewName = params.get("name"); // ?name=… previews any greeting without the sheet

  const cameFromInside = document.referrer.startsWith(location.origin);
  if (cameFromInside && !guestId && !previewName) {
    overlay.remove();
    return;
  }

  const nameEl = overlay.querySelector(".inv-guest");
  const helloEl = overlay.querySelector(".cov-hello");
  function setGuest(hello, name) {
    helloEl.textContent = hello;
    helloEl.classList.toggle("long", hello.length > 20);
    nameEl.textContent = name;
  }
  if (previewName) {
    setGuest("Dear " + previewName, previewName);
  } else if (guestId) {
    Api.getGuest(guestId)
      .then((result) => {
        if (result.found) setGuest("Dear " + result.name, result.name);
        else setGuest("Dear guest", "Dear Guest");
      })
      .catch(() => {
        setGuest("Dear guest", "Dear Guest");
      });
  } else {
    setGuest("Dear family & friends", "Our Family & Friends");
  }

  overlay.classList.remove("hidden");
  document.body.classList.add("no-scroll");

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function open(e) {
    e.stopPropagation();
    if (overlay.classList.contains("opening")) return;
    overlay.classList.add("opening");
    if (reduceMotion) {
      overlay.classList.add("risen", "presented");
      return;
    }
    setTimeout(() => overlay.classList.add("risen"), 950);
    setTimeout(() => overlay.classList.add("presented"), 1700);
  }

  function done() {
    overlay.classList.add("leaving");
    document.body.classList.remove("no-scroll");
    setTimeout(() => overlay.remove(), 750);
  }

  overlay.querySelector(".wax-seal").addEventListener("click", open);
  overlay.querySelector(".cover").addEventListener("click", open);
  overlay.querySelector(".inv-enter").addEventListener("click", (e) => {
    e.stopPropagation();
    done();
  });
  overlay.querySelector(".skip-link").addEventListener("click", done);
}
