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

/* ---------- Personalized invitation (?g=guestid) ---------- */

function setupInvitation() {
  const overlay = document.getElementById("invite-overlay");
  if (!overlay) return;

  const guestId = new URLSearchParams(location.search).get("g");
  if (!guestId) {
    overlay.remove();
    return;
  }

  const nameEl = overlay.querySelector(".inv-guest");
  overlay.classList.remove("hidden");

  Api.getGuest(guestId)
    .then((result) => {
      nameEl.textContent = result.found ? result.name : "Dear Guest";
    })
    .catch(() => {
      nameEl.textContent = "Dear Guest";
    });

  overlay.querySelector(".inv-enter").addEventListener("click", () => {
    overlay.classList.add("hidden");
    setTimeout(() => overlay.remove(), 700);
  });
}
