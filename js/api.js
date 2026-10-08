/* ============================================================
   API layer — talks to the Google Apps Script backend.
   When CONFIG.DEMO_MODE is true, answers come from SAMPLE_GUESTS
   instead, so the whole site works locally with no backend.
   ============================================================ */

const Api = (() => {
  const DEMO_DELAY_MS = 600; // small pause so demo mode feels like a real lookup

  function demoDelay(value) {
    return new Promise((resolve) => setTimeout(() => resolve(value), DEMO_DELAY_MS));
  }

  function normalize(s) {
    return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  /* --- The site key ---
     What the device remembers once the gate is passed: the four-digit code the guest
     typed, or "g:<guestid>" from a personal link. The backend checks it on every call
     (it keeps the code in a Script Property; no file of this site holds it). The key
     is kept in memory as well, so a device whose storage is unavailable still works
     for the rest of the visit. The old "1" flag from before October 2026 is not a key:
     those devices see the gate once more. */
  const KEY_NAME = "mnm-key";
  const KEY_SHAPE = /^(\d{4}|g:.+)$/;
  let memoryKey = "";

  function key() {
    if (memoryKey) return memoryKey;
    try {
      const k = localStorage.getItem(KEY_NAME) || "";
      return KEY_SHAPE.test(k) ? k : "";
    } catch (e) { return ""; }
  }
  function rememberKey(k) {
    memoryKey = k;
    try { localStorage.setItem(KEY_NAME, k); } catch (e) {}
  }
  function forgetKey() {
    memoryKey = "";
    try { localStorage.removeItem(KEY_NAME); } catch (e) {}
  }

  /* Reads a backend answer. If the backend says the remembered key is wrong (the code
     was changed after this device saved it), the key is dropped and the page reloads
     once so the gate shows again instead of every form failing quietly. */
  async function answer(res, what) {
    if (!res.ok) throw new Error(`${what} failed (${res.status})`);
    const out = await res.json();
    if (out && out.auth === false && out.wrong && key()) {
      forgetKey();
      try {
        if (!sessionStorage.getItem("mnm-regate")) { sessionStorage.setItem("mnm-regate", "1"); location.reload(); }
      } catch (e) {}
    }
    return out;
  }
  const withKey = (url) => `${url}&key=${encodeURIComponent(key())}`;

  /* --- PIN gate: code -> { ok } or { ok: false, wrong | slow | error } --- */
  async function verifyKey(code) {
    if (CONFIG.DEMO_MODE) {
      console.info("[demo] any four digits open the gate; the real code is checked by the backend");
      return demoDelay({ ok: true });
    }
    const res = await fetch(`${CONFIG.SCRIPT_URL}?action=verify&key=${encodeURIComponent(code)}`);
    if (!res.ok) throw new Error(`Code check failed (${res.status})`);
    return res.json();
  }

  /* --- Seat finder: name -> { found, name, table, note } --- */
  async function findSeat(name) {
    const query = normalize(name);
    if (!query) return { found: false };

    if (CONFIG.DEMO_MODE) {
      const matches = SAMPLE_GUESTS.filter((g) => normalize(g.name).includes(query));
      if (matches.length === 1) {
        const g = matches[0];
        return demoDelay({ found: true, name: g.name, table: g.table, note: g.note });
      }
      if (matches.length > 1) return demoDelay({ found: false, ambiguous: true });
      return demoDelay({ found: false });
    }

    const url = withKey(`${CONFIG.SCRIPT_URL}?action=seat&name=${encodeURIComponent(name)}`);
    return answer(await fetch(url), "Lookup");
  }

  /* --- Invitation: guest id -> { found, name } --- */
  async function getGuest(guestId) {
    const id = normalize(guestId);
    if (!id) return { found: false };

    if (CONFIG.DEMO_MODE) {
      const g = SAMPLE_GUESTS.find((s) => normalize(s.id) === id);
      return demoDelay(g ? { found: true, name: g.name } : { found: false });
    }

    const url = `${CONFIG.SCRIPT_URL}?action=invite&g=${encodeURIComponent(guestId)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
    return res.json();
  }

  /* --- RSVP: payload -> { ok } ---
     Posted as text/plain (a plain string body) on purpose: it keeps the
     request "simple" so the browser skips the CORS preflight that
     Apps Script web apps cannot answer. Code.gs parses the JSON itself. */
  async function submitRsvp(payload) {
    if (CONFIG.DEMO_MODE) {
      console.info("[demo] RSVP that would be sent to your Google Sheet:", payload);
      return demoDelay({ ok: true });
    }

    const res = await fetch(CONFIG.SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ ...payload, key: key() }),
    });
    return answer(res, "Submission");
  }

  /* --- Guest photo wall: list visible photos --- */
  async function getPhotos() {
    if (CONFIG.DEMO_MODE) {
      return demoDelay({ ok: true, photos: [] });
    }
    return answer(await fetch(withKey(`${CONFIG.SCRIPT_URL}?action=photos`)), "Photo list");
  }

  /* --- Guest photo wall: upload one photo (base64, already resized) --- */
  async function uploadPhoto(payload) {
    if (CONFIG.DEMO_MODE) {
      console.info("[demo] photo that would be uploaded to your Drive:", payload.filename);
      return demoDelay({ ok: true });
    }
    const res = await fetch(CONFIG.SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "photo", ...payload, key: key() }),
    });
    return answer(res, "Upload");
  }

  return { key, rememberKey, forgetKey, verifyKey, findSeat, getGuest, submitRsvp, getPhotos, uploadPhoto };
})();
