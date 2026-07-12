/* RSVP page: post the response to the Apps Script backend. */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("rsvp-form");
  const status = document.getElementById("rsvp-status");
  const button = form.querySelector("button");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.className = "form-status";

    const data = new FormData(form);
    const payload = {
      name: (data.get("name") || "").trim(),
      attending: data.get("attending"),
      guests: Number(data.get("guests") || 1),
      song: (data.get("song") || "").trim(),
      message: (data.get("message") || "").trim(),
    };

    if (payload.name.length < 2) {
      status.classList.add("error");
      status.textContent = "Please tell us your name.";
      return;
    }
    if (!payload.attending) {
      status.classList.add("error");
      status.textContent = "Please let us know if you can make it.";
      return;
    }

    button.disabled = true;
    status.innerHTML = '<span class="spinner"></span> Sending your reply…';

    try {
      const res = await Api.submitRsvp(payload);
      if (!res.ok) throw new Error("Backend rejected the RSVP");

      status.classList.add("ok");
      status.textContent =
        payload.attending === "yes"
          ? "Thank you! We can't wait to see you on the 21st of December. ❤"
          : "Thank you for letting us know — you'll be missed!";
      form.reset();
    } catch (err) {
      status.classList.add("error");
      status.textContent =
        "Sorry, your reply didn't go through. Please try again in a moment.";
    } finally {
      button.disabled = false;
    }
  });
});
