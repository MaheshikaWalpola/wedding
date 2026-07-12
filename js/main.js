/* Shared behaviour: mobile nav, countdown, personalized invitation overlay. */

document.addEventListener("DOMContentLoaded", () => {
  setupNav();
  setupCountdown();
  setupInvitation();
  setupMotion();
});

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
   The sealed invitation greets every visit to the home page; it is
   skipped only when arriving via the site's own navigation, so browsing
   back to Home doesn't replay it. A personalized link (?g=guestid)
   always opens it, with that guest's name on the card. */

function setupInvitation() {
  const overlay = document.getElementById("card-overlay");
  if (!overlay) return;

  const guestId = new URLSearchParams(location.search).get("g");

  const cameFromInside = document.referrer.startsWith(location.origin);
  if (cameFromInside && !guestId) {
    overlay.remove();
    return;
  }

  const nameEl = overlay.querySelector(".inv-guest");
  if (guestId) {
    Api.getGuest(guestId)
      .then((result) => {
        nameEl.textContent = result.found ? result.name : "Dear Guest";
      })
      .catch(() => {
        nameEl.textContent = "Dear Guest";
      });
  } else {
    nameEl.textContent = "Our Family & Friends";
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
