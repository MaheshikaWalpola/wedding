/* Everything on the main page that talks to the guest list, through Api (js/api.js):
   the personal greeting on ?g=guestid links, the RSVP form and the seat finder.
   The guest list never reaches the browser: each call looks up one guest. */

document.addEventListener("DOMContentLoaded", () => {
  setupGreeting();
  setupRsvp();
  setupSeatFinder();
});

/* ---------- Personal invitation links ----------
   ?g=<GuestID> (from the Sheet, see listInviteLinks in Code.gs) puts the guest's name
   on the sealed cover and its card, above the couple's names, on the invitation card
   and in the RSVP form.
   ?name=Anyone previews the greeting without the Sheet. */

function setupGreeting() {
  const params = new URLSearchParams(location.search);
  const guestId = params.get("g");
  const preview = params.get("name");
  if (!guestId && !preview) return;

  const show = (name) => {
    const greet = document.getElementById("hero-greet");
    const card = document.getElementById("inv-guest");
    const hello = document.getElementById("cov-hello");
    const ovl = document.getElementById("ovl-guest");
    const rsvpName = document.getElementById("rsvp-name");
    if (greet) { greet.querySelector("b").textContent = name; greet.hidden = false; }
    if (card) card.textContent = name;
    if (hello) { hello.textContent = "Dear " + name; hello.classList.toggle("long", name.length > 18); }
    if (ovl) ovl.textContent = name;
    if (rsvpName && !rsvpName.value) rsvpName.value = name;
  };
  if (preview) { show(preview.trim()); return; }
  Api.getGuest(guestId).then((r) => { if (r && r.found && r.name) show(r.name); }).catch(() => {});
}

/* ---------- RSVP: the form writes one row to the "RSVP Responses" tab ---------- */

function setupRsvp() {
  const form = document.getElementById("rsvp-form");
  if (!form) return;
  const status = document.getElementById("rsvp-status");
  const button = form.querySelector("button[type='submit']");
  const say = (text, kind) => { status.textContent = text; status.className = "form-status" + (kind ? " " + kind : ""); };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const payload = {
      name: (data.get("name") || "").trim(),
      attending: data.get("attending"),
      guests: Number(data.get("guests") || 1),
      song: (data.get("song") || "").trim(),
      message: (data.get("message") || "").trim(),
    };
    if (payload.name.length < 2) { say("Please tell us your name.", "error"); document.getElementById("rsvp-name").focus(); return; }
    if (!payload.attending) { say("Please let us know if you can make it.", "error"); return; }

    button.disabled = true;
    say("Sending your reply…", "busy");
    try {
      const res = await Api.submitRsvp(payload);
      if (!res || !res.ok) throw new Error("rejected");
      say(payload.attending === "yes"
        ? "Thank you! We cannot wait to see you on the 21st of December."
        : "Thank you for letting us know. You will be missed.", "ok");
      form.reset();
    } catch (err) {
      say("Sorry, your reply did not go through. Please try again in a moment, or message us on WhatsApp.", "error");
    } finally {
      button.disabled = false;
    }
  });
}

/* ---------- Seat finder: one name in, one table out ---------- */

function setupSeatFinder() {
  const form = document.getElementById("seat-form");
  if (!form) return;
  const input = document.getElementById("seat-name");
  const status = document.getElementById("seat-status");
  const result = document.getElementById("seat-result");
  const button = form.querySelector("button[type='submit']");
  const say = (text, kind) => { status.textContent = text; status.className = "form-status" + (kind ? " " + kind : ""); };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = input.value.trim();
    result.hidden = true;
    if (name.length < 2) { say("Please type your name as it appears on your invitation.", "error"); input.focus(); return; }

    button.disabled = true;
    say("Checking the seating plan…", "busy");
    try {
      const res = await Api.findSeat(name);
      say("");
      if (res.found) {
        const hasTable = res.table !== null && res.table !== undefined && res.table !== "";
        result.querySelector(".seat-guest").textContent = res.name;
        result.querySelector(".seat-word").hidden = !hasTable;
        result.querySelector(".seat-num").hidden = !hasTable;
        result.querySelector(".seat-num").textContent = hasTable ? res.table : "";
        result.querySelector(".seat-note").textContent = hasTable
          ? res.note || "We cannot wait to celebrate with you."
          : "Your table has not been assigned yet. Check back closer to the day.";
        result.hidden = false;
      } else if (res.ambiguous) {
        say("A few guests match that. Could you try your full name?", "error");
      } else {
        say("We could not find that name. Try the exact name on your invitation, or ask one of us.", "error");
      }
    } catch (err) {
      say("Something went wrong. Please try again in a moment.", "error");
    } finally {
      button.disabled = false;
    }
  });
}
