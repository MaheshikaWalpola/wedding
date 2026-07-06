/* Guest photo wall: show shared photos and let guests upload their own.
   Photos are resized in the browser (max 1600px JPEG) before upload, so
   they're quick to send and light on Drive storage. */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;
const MAX_FILES_PER_BATCH = 10;

document.addEventListener("DOMContentLoaded", () => {
  loadGallery();

  const form = document.getElementById("photo-form");
  const nameInput = document.getElementById("photo-name");
  const fileInput = document.getElementById("photo-files");
  const status = document.getElementById("photo-status");
  const button = form.querySelector("button");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.className = "form-status";

    const files = Array.from(fileInput.files || []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (!files.length) {
      status.classList.add("error");
      status.textContent = "Please choose a photo first.";
      return;
    }
    if (files.length > MAX_FILES_PER_BATCH) {
      status.classList.add("error");
      status.textContent = `Up to ${MAX_FILES_PER_BATCH} photos at a time, please.`;
      return;
    }

    button.disabled = true;
    let sent = 0;

    try {
      for (const file of files) {
        status.innerHTML = `<span class="spinner"></span> Uploading ${sent + 1} of ${files.length}…`;
        const resized = await resizeImage(file);
        const result = await Api.uploadPhoto({
          name: (nameInput.value || "").trim(),
          filename: file.name.replace(/\.[^.]+$/, "") + ".jpg",
          mimeType: "image/jpeg",
          data: resized.base64,
        });
        if (!result.ok) throw new Error(result.error || "Upload rejected");
        addTile(resized.dataUrl, (nameInput.value || "").trim() || "You", true);
        sent++;
      }
      status.classList.add("ok");
      status.textContent =
        sent === 1
          ? "Thank you! Your photo is on the wall. 📸"
          : `Thank you! ${sent} photos are on the wall. 📸`;
      form.reset();
    } catch (err) {
      status.classList.add("error");
      status.textContent = sent
        ? `${sent} uploaded, then something went wrong — please try the rest again.`
        : "Sorry, the upload didn't work — please try again in a moment.";
    } finally {
      button.disabled = false;
    }
  });
});

async function loadGallery() {
  const grid = document.getElementById("gallery-grid");
  const empty = document.getElementById("gallery-empty");

  try {
    const res = await Api.getPhotos();
    const photos = (res && res.photos) || [];
    if (!photos.length) {
      empty.style.display = "";
      return;
    }
    empty.style.display = "none";
    photos.forEach((p) => addTile(p.url, p.by, false));
  } catch (err) {
    empty.style.display = "";
  }
}

function addTile(src, by, prepend) {
  const grid = document.getElementById("gallery-grid");
  const empty = document.getElementById("gallery-empty");
  empty.style.display = "none";

  const fig = document.createElement("figure");
  fig.className = "gallery-tile";
  const img = document.createElement("img");
  img.referrerPolicy = "no-referrer"; // Google image hosts sometimes block hotlinks with a referrer
  img.src = src;
  img.loading = "lazy";
  img.alt = by ? `Photo shared by ${by}` : "Guest photo";
  img.addEventListener("error", () => fig.remove(), { once: true });
  const cap = document.createElement("figcaption");
  cap.textContent = by || "A guest";
  fig.append(img, cap);

  prepend ? grid.prepend(fig) : grid.append(fig);
}

/** Downscale to MAX_EDGE px and return both base64 (for upload) and a
    data URL (to show instantly in the grid). */
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      resolve({ dataUrl, base64: dataUrl.split(",")[1] });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}
