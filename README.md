# Maheshika & Moksha — Sri Lankan wedding website

A one-page guest site (plus a photos page): plain HTML/CSS/JS, no framework, with a
Google Apps Script + Google Sheets backend for RSVPs, the seat finder, personal
invitation links and the guest photo album.

**Monday 21 December 2026 · Anantara Kalutara Resort, Sri Lanka**

The facts that change (URLs, deployment, open questions) live in `../SYSTEM.md`.

## Pages

| File | What it is |
|---|---|
| `index.html` | The site. PIN code → the v19 sealed invitation cover, recoloured (`?g=guestid` greets the guest by name) → one page: hero, invitation card (Indian card style, the old words), couple, story, celebrations (programme in the v19 zigzag timeline, dress code, map), RSVP form, seat finder, traditions, travel & stay, Q&A, gallery, contacts |
| `photos.html` | Guest uploads (resized in the browser, saved to the Drive folder) and the album |
| `qr.html` | Printable table card with the QR code to the photos page. Not linked from the site |
| `info.html`, `location.html`, `faq.html`, `contact.html`, `seating.html`, `rsvp.html`, `gallery.html` | Redirect stubs for the old multi-page URLs. `_redirects` does the same on Cloudflare |

## Scripts

| File | Does |
|---|---|
| `js/config.js` | The only wiring point: the deployed `/exec` URL and `DEMO_MODE` |
| `js/api.js` | Every backend call; answers from `SAMPLE_GUESTS` while `DEMO_MODE` is true |
| `js/main.js` | PIN gate, sealed cover, nav, reveals, countdown, petals, parallax |
| `js/guest.js` | Personal greeting, RSVP form, seat finder |
| `js/photos.js` | Uploads and the album on `photos.html` |

## Try it locally

```bash
python3 -m http.server 8788
# open http://localhost:8788 — the PIN is in ../SYSTEM.md
```

- **Personal link:** `http://localhost:8788/?g=<GuestID>` (from the Sheet), or
  `?name=Anyone` to preview the greeting without the Sheet.
- **Demo mode:** set `DEMO_MODE: true` in `js/config.js` and the seat finder,
  greeting and RSVP work against the six sample guests with no backend
  (try `Nimali Perera`, `?g=nimali01`).

## Backend

`apps-script/Code.gs` is bound to the wedding Sheet. It reads guests from the tab
whose name contains *guest list*, creates `RSVP Responses` and `Guest Photos`
itself, and saves photos to the Drive folder named in `PHOTOS_FOLDER_NAME`.
The full guest list never leaves the Sheet: every request returns at most one guest.

Setup, redeploying and the sheet-side helpers (`setupWebsite`, `writeInviteLinks`,
`listInviteLinks`) are described at the top of `Code.gs` and in `OWNERS-MANUAL.md`.
Remember: after editing `Code.gs`, **Deploy → Manage deployments → Edit →
Version: New version → Deploy**. Saving alone does not go live.

## Editing the details

- The programme, dress code, hotels, contacts and the RSVP deadline are plain
  text in `index.html` (the invitation card repeats the date, time and deadline).
- The countdown target is in `js/main.js`; the calendar file is `assets/wedding.ics`.
- Colours and fonts live in the `:root` block at the top of `css/styles.css`.
- Photos: `images/hero.jpg` (hero, image 8 of the numbered set), `images/couple.jpg`
  (couple section, image 1), `images/band.jpg`, `images/gallery-1.jpg` to `gallery-6.jpg`,
  `images/island-gold.png` (the gold Sri Lanka picture under the hero; source
  `Wedding_pics/SriLankan-pic.PNG`, see `../SYSTEM.md` for how it was made).
