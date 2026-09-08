/* Photos page: guests add pictures, and the album shows what everyone has shared.
   Uploads shrink in the browser and go to the couple's Drive folder through Api
   (js/api.js). Upload only: nothing on this page can edit or delete a photo. The
   album is read-only and only shows what the couple has marked "yes" in their sheet. */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;
const MAX_FILES = 12;
const configured = () => CONFIG.DEMO_MODE || (typeof CONFIG.SCRIPT_URL === "string" && CONFIG.SCRIPT_URL.startsWith("https://"));

document.addEventListener("DOMContentLoaded", () => {
  setupUpload();
  loadWall();
});

function setupUpload() {
  const form = document.getElementById("upload-form");
  if (!form) return;
  const nameInput = document.getElementById("upload-name");
  const fileInput = document.getElementById("upload-files");
  const pick = document.getElementById("upload-pick");
  const status = document.getElementById("upload-status");
  const say = (text, kind) => { status.textContent = text; status.className = "upload-status" + (kind ? " " + kind : ""); };

  pick.addEventListener("click", () => {
    if (!configured()) { say("Photo uploads open very soon. Please check back in a few days.", "muted"); return; }
    fileInput.click();
  });

  fileInput.addEventListener("change", async () => {
    const files = Array.from(fileInput.files || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    if (files.length > MAX_FILES) { say(`Up to ${MAX_FILES} photos at a time, please.`, "error"); fileInput.value = ""; return; }
    pick.disabled = true;
    let sent = 0;
    try {
      for (const file of files) {
        say(`Sending ${sent + 1} of ${files.length}…`, "busy");
        const { base64, dataUrl } = await shrink(file);
        const out = await Api.uploadPhoto({ name: (nameInput.value || "").trim(), filename: file.name.replace(/\.[^.]+$/, "") + ".jpg", mimeType: "image/jpeg", data: base64 });
        if (!out.ok) throw new Error(out.error || "rejected");
        addTile(dataUrl, (nameInput.value || "").trim() || "You", true);
        sent++;
      }
      say(sent === 1 ? "Thank you! Your photo is in the album." : `Thank you! ${sent} photos are in the album.`, "ok");
      form.reset();
    } catch (e) {
      say(sent ? `${sent} sent, then something went wrong. Please try the rest again.` : "Sorry, that did not go through. Please try again in a moment.", "error");
    } finally {
      pick.disabled = false;
      fileInput.value = "";
    }
  });
}

async function loadWall() {
  const note = document.getElementById("wall-note");
  if (!configured()) { note.textContent = "The album opens together with the uploads."; return; }
  try {
    const out = await Api.getPhotos();
    (out.photos || []).forEach((p) => addTile(p.url, p.by, false));
  } catch (e) {
    note.textContent = "The album could not load just now. Please try again in a moment.";
  }
}

function addTile(src, by, prepend) {
  const wall = document.getElementById("wall");
  const empty = document.getElementById("wall-empty");
  empty.hidden = true;
  const fig = document.createElement("figure");
  fig.className = "wall-tile";
  const img = document.createElement("img");
  img.referrerPolicy = "no-referrer";
  img.src = src; img.loading = "lazy"; img.decoding = "async";
  img.alt = by ? `Photo shared by ${by}` : "Guest photo";
  img.addEventListener("error", () => fig.remove(), { once: true });
  const cap = document.createElement("figcaption");
  const who = document.createElement("span");
  who.textContent = by || "A guest";
  const save = document.createElement("button");
  save.type = "button"; save.className = "wall-save";
  save.title = "Save this photo to your phone"; save.setAttribute("aria-label", "Save this photo to your phone");
  save.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#ic-download"/></svg>';
  save.addEventListener("click", () => savePhoto(src, save));
  cap.append(who, save);
  fig.append(img, cap);
  prepend ? wall.prepend(fig) : wall.append(fig);
}

/* Save a photo to the guest's phone. On phones the share sheet opens (iPhone: "Save Image"
   puts it in the camera roll). Elsewhere it downloads as a normal file. */
let saveCount = 0;
async function savePhoto(src, btn) {
  btn.classList.add("busy");
  try {
    // The album URLs point at drive.google.com, which refuses cross-origin fetches. The same file
    // is served with permissive headers from googleusercontent, so build that URL from the file id.
    const m = src.match(/[?&]id=([^&]+)/);
    const full = m ? `https://lh3.googleusercontent.com/d/${m[1]}=w2000` : src;
    const blob = await (await fetch(full)).blob();
    const name = `maheshika-moksha-${String(++saveCount).padStart(2, "0")}.jpg`;
    const file = new File([blob], name, { type: blob.type || "image/jpeg" });
    const phone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && matchMedia("(pointer: coarse)").matches);
    if (phone && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); flash(btn); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    flash(btn);
  } catch (e) {
    window.open(src, "_blank", "noopener");
  } finally {
    btn.classList.remove("busy");
  }
}
function flash(btn) { btn.classList.add("done"); setTimeout(() => btn.classList.remove("done"), 1500); }

function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL("image/jpeg", JPEG_QUALITY);
      resolve({ dataUrl, base64: dataUrl.split(",")[1] });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.src = url;
  });
}
