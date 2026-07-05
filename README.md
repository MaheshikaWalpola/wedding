# Maheshika & Moksha — Wedding Website 💍

A static wedding site (plain HTML/CSS/JS, no framework) with a Google Apps
Script + Google Sheets backend for RSVPs, seat lookups, and personalized
invitation links.

**21 December 2026 · Anantara Kalutara Resort, Sri Lanka**

## Pages

| Page | What it does |
|---|---|
| `index.html` | Home — hero, countdown, and the personalized invitation overlay (`?g=guestid`) |
| `info.html` | Schedule (poruwa ceremony + reception) and dress code — placeholders marked with `<!-- EDIT: ... -->` |
| `location.html` | Embedded Google Map to the resort + travel notes |
| `seating.html` | Seat finder — a guest types their name, sees their table |
| `rsvp.html` | RSVP form — name, attending, guest count |

## Try it right now (demo mode)

The site ships with `DEMO_MODE: true` in [js/config.js](js/config.js) and six
sample guests, so everything works with no backend:

```bash
cd wedding_planner
python3 -m http.server 8788
# open http://localhost:8788
```

- **Seat finder:** try `Nimali Perera`, `Kasun`, or `Ruwan`.
- **Personalized invite:** open `http://localhost:8788/index.html?g=nimali01`
  (also try `kasun02`, `sachini03`, `dilhara04`, `amaya05`, `ruwan06`).
- **RSVP:** submits succeed and are logged to the browser console.

## Connect your Google Sheet (go live)

The backend is built for the "Wedding" planner spreadsheet — it reads
guests straight from the existing **Guest List & RSVP** tab.

### 1. Open the Sheet and paste the script

1. The spreadsheet must be a native Google Sheet, not an uploaded .xlsx.
   If the title bar shows an `.XLSX` badge: **File → Save as Google
   Sheets** first, and use the converted copy from then on.
2. In the menu: **Extensions → Apps Script**.
3. Delete the placeholder code and paste in the whole of
   [apps-script/Code.gs](apps-script/Code.gs). Save (💾).

### 2. Run the one-time setup

1. In the Apps Script editor, select the function **`setupWebsite`** in the
   toolbar dropdown and click **Run**.
2. Google will ask for permission the first time — click **Review
   permissions → your account → Advanced → Go to … (unsafe) → Allow**.
   (It's your own script reading your own sheet; the warning is standard.)
3. This adds **Table**, **GuestID** and **Seat Note** columns to the
   Guest List & RSVP tab (existing columns are untouched), generates a
   unique GuestID for every guest, and creates an **RSVP Responses** tab
   for website submissions. Safe to re-run any time — e.g. after adding
   new guests, to give them ids too.

### 3. Deploy as a web app

1. Click **Deploy → New deployment**.
2. Click the gear ⚙ next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy** and copy the **Web app URL**
   (it looks like `https://script.google.com/macros/s/AKfy.../exec`).

### 4. Point the site at it

In [js/config.js](js/config.js):

```js
const CONFIG = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfy.../exec", // your URL
  DEMO_MODE: false,
};
```

That's it. The seat finder and invitation links now query your Sheet one
guest at a time (the full list never reaches the browser), and website
RSVPs appear as rows in the **RSVP Responses** tab — your own RSVP and
Meal Preference columns in the guest list remain yours to manage.

> **Note:** if you later edit `Code.gs`, you must publish the change with
> **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
> Just saving the file does not update the live web app.

### Managing guests

Everything lives in the **Guest List & RSVP** tab:

- **Full Name** is what the seat finder matches against — guests type it,
  so use the names guests know themselves by.
- **Table** — fill in as you finalise seating. Until it has a value, the
  seat finder shows that guest a friendly "not assigned yet" message.
- **GuestID** is what goes in each personalized link:
  `https://your-site.pages.dev/?g=sonu-brother-x4k2`. Run `setupWebsite`
  again after adding new guests to generate ids for them. The
  `listInviteLinks` function prints every guest's link for copy-pasting.
- **Seat Note** is optional; it shows under the table number in the
  seat finder.

## Deploy to Cloudflare Pages

1. Push this folder to a GitHub repository.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages →
   Connect to Git**, pick the repo.
3. Framework preset: **None**. Build command: *(leave empty)*.
   Build output directory: `/`.
4. Deploy — you'll get `https://<project>.pages.dev`.

## Editing the details

- Schedule times, dress code, RSVP deadline, and travel notes are all
  marked with `<!-- EDIT: ... -->` comments in the HTML.
- Colours and fonts live in the `:root` block at the top of
  [css/styles.css](css/styles.css).
- The countdown target date is in [js/main.js](js/main.js).
