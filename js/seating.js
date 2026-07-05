/* Seat finder page: look up one guest's table by name. */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("seat-form");
  const input = document.getElementById("seat-name");
  const status = document.getElementById("seat-status");
  const result = document.getElementById("seat-result");
  const button = form.querySelector("button");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = input.value.trim();
    result.classList.remove("visible");
    status.className = "form-status";

    if (name.length < 2) {
      status.classList.add("error");
      status.textContent = "Please type your name as it appears on your invitation.";
      return;
    }

    button.disabled = true;
    status.innerHTML = '<span class="spinner"></span> Checking the seating chart…';

    try {
      const res = await Api.findSeat(name);

      status.textContent = "";
      if (res.found) {
        const hasTable = res.table !== null && res.table !== undefined && res.table !== "";
        result.querySelector(".guest-name").textContent = res.name;
        result.querySelector(".table-word").style.display = hasTable ? "" : "none";
        result.querySelector(".table-num").style.display = hasTable ? "" : "none";
        result.querySelector(".table-num").textContent = hasTable ? res.table : "";
        result.querySelector(".note").textContent = hasTable
          ? res.note || "We can't wait to celebrate with you!"
          : "Your table hasn't been assigned yet — check back closer to the big day!";
        result.classList.add("visible");
      } else if (res.ambiguous) {
        status.classList.add("error");
        status.textContent =
          "A few guests match that — could you try your full name?";
      } else {
        status.classList.add("error");
        status.textContent =
          "Hmm, we couldn't find that name. Try the exact name on your invitation, or ask a member of the wedding party.";
      }
    } catch (err) {
      status.classList.add("error");
      status.textContent = "Something went wrong — please try again in a moment.";
    } finally {
      button.disabled = false;
    }
  });
});
