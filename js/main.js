/* Shared behaviour: mobile nav, countdown, personalized invitation overlay. */

document.addEventListener("DOMContentLoaded", () => {
  setupNav();
  setupCountdown();
  setupInvitation();
});

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

/* ---------- The digital invitation card (envelope + wax seal) ----------
   Every visitor is greeted by a sealed envelope once per visit; a
   personalized link (?g=guestid) always opens it, with that guest's
   name on the card. */

function setupInvitation() {
  const overlay = document.getElementById("card-overlay");
  if (!overlay) return;

  const guestId = new URLSearchParams(location.search).get("g");

  let seen = false;
  try { seen = sessionStorage.getItem("mnm-card-seen") === "1"; } catch (e) {}
  if (seen && !guestId) {
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
    setTimeout(() => overlay.classList.add("risen"), 800);
    setTimeout(() => overlay.classList.add("presented"), 1650);
  }

  function done() {
    try { sessionStorage.setItem("mnm-card-seen", "1"); } catch (e) {}
    overlay.classList.add("leaving");
    document.body.classList.remove("no-scroll");
    setTimeout(() => overlay.remove(), 750);
  }

  overlay.querySelector(".wax-seal").addEventListener("click", open);
  overlay.querySelector(".envelope").addEventListener("click", open);
  overlay.querySelector(".inv-enter").addEventListener("click", (e) => {
    e.stopPropagation();
    done();
  });
  overlay.querySelector(".skip-link").addEventListener("click", done);
}
