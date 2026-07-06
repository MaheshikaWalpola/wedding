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

    const url = `${CONFIG.SCRIPT_URL}?action=seat&name=${encodeURIComponent(name)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
    return res.json();
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
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Submission failed (${res.status})`);
    return res.json();
  }

  /* --- Guest photo wall: list visible photos --- */
  async function getPhotos() {
    if (CONFIG.DEMO_MODE) {
      return demoDelay({ ok: true, photos: [] });
    }
    const res = await fetch(`${CONFIG.SCRIPT_URL}?action=photos`);
    if (!res.ok) throw new Error(`Photo list failed (${res.status})`);
    return res.json();
  }

  /* --- Guest photo wall: upload one photo (base64, already resized) --- */
  async function uploadPhoto(payload) {
    if (CONFIG.DEMO_MODE) {
      console.info("[demo] photo that would be uploaded to your Drive:", payload.filename);
      return demoDelay({ ok: true });
    }
    const res = await fetch(CONFIG.SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "photo", ...payload }),
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    return res.json();
  }

  return { findSeat, getGuest, submitRsvp, getPhotos, uploadPhoto };
})();
