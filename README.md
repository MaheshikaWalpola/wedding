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

### 1. Create the Sheet and paste the script

1. Go to [sheets.new](https://sheets.new) and create a blank spreadsheet
   (name it e.g. *Wedding Guests*).
2. In the menu: **Extensions → Apps Script**.
3. Delete the placeholder code and paste in the whole of
   [apps-script/Code.gs](apps-script/Code.gs). Save (💾).

### 2. Create the tabs with sample data

1. In the Apps Script editor, select the function **`setupSheets`** in the
   toolbar dropdown and click **Run**.
2. Google will ask for permission the first time — click **Review
   permissions → your account → Advanced → Go to … (unsafe) → Allow**.
   (It's your own script reading your own sheet; the warning is standard.)
3. Your spreadsheet now has a **Guests** tab (GuestID, Name, Table, Note)
   with the six sample guests, and an empty **RSVPs** tab.

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
guest at a time (the full list never reaches the browser), and RSVPs appear
as rows in the **RSVPs** tab.

> **Note:** if you later edit `Code.gs`, you must publish the change with
> **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
> Just saving the file does not update the live web app.

### Replace the sample guests

Edit the **Guests** tab directly — one row per guest/party:

| GuestID | Name | Table | Note |
|---|---|---|---|
| `aunty-k` | Kumari Ratnayake | 6 | So glad you made the trip! |

- **GuestID** is what goes in each personalized link:
  `https://your-site.pages.dev/?g=aunty-k` — keep them lowercase, no spaces,
  and hard to guess if you like (e.g. `kumari-x7q2`).
- **Note** is optional; it shows under the table number in the seat finder.

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
