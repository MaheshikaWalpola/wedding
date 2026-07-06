# 💍 Wedding Website — Owner's Manual

Everything you can do with your site, in simple steps.
Site: **https://maheshika-moksha.pages.dev**
Data: your **"Wedding" Google Sheet** (the one WITHOUT the .XLSX badge)

---

## The one golden rule

| If you change… | Then… |
|---|---|
| **The Google Sheet** (tables, guests, hiding photos) | Nothing! It's live instantly. |
| **Website text/pages** (schedule, dress code…) | The change must be pushed to GitHub — easiest: ask Claude. It's live ~1 minute after pushing. |
| **The backend code** (`apps-script/Code.gs`) | Paste into Apps Script, Save, and **Deploy → Manage deployments → ✏️ → New version → Deploy**. |

---

## Everyday things

### 🔎 Test that everything works (5-minute health check)
1. Open https://maheshika-moksha.pages.dev — countdown ticking?
2. Open https://maheshika-moksha.pages.dev/?g=amma-gqjr — invitation card with "Amma"?
3. Find Your Seat → type `Amma` → result appears?
4. RSVP → send a test reply → appears as a new row in the **RSVP Responses** tab? (Delete the row after.)
5. Gallery → upload any photo → appears on the wall and in the **Guest Photos** tab? (Set its **Show** cell to `no` after, or delete the row.)

### 💌 Send a guest their invitation
1. Open the **Guest List & RSVP** tab.
2. Find the guest's row → copy their **Invite Link** (last column).
3. Paste it into WhatsApp/SMS/email to that guest. Done — the link shows *their* name on the invitation card.

### ✉️ See who has RSVP'd
- Open the **RSVP Responses** tab. Newest at the bottom: name, yes/no, guest count, message.
- Your own **RSVP** column in the Guest List is separate — update it yourself as you confirm people (that keeps your dashboard numbers working).

### 📸 Manage the photo wall
- **See all photos:** the **Guest Photos** tab lists every upload; files live in Drive → **Wedding Guest Photos** folder.
- **Hide a photo from the site:** change its **Show** cell to `no`. (Back to `yes` to restore.)
- **Delete a photo forever:** delete its row in the tab AND the file in the Drive folder.

---

## Guests & seating

### ➕ Add a guest
1. Add a row in **Guest List & RSVP** with at least the **Full Name**.
2. Apps Script editor (sheet → Extensions → Apps Script): dropdown → **setupWebsite** → ▷ Run. (Creates their GuestID.)
3. Dropdown → **writeInviteLinks** → ▷ Run. (Creates their invite link.)

### ➖ Remove a guest
- Delete their row in the sheet. That's it.

### ✏️ Rename a guest
- Edit **Full Name**. Remember: the seat finder matches this exact name, so use the name the guest would type. Their invite link does NOT change (it uses GuestID).

### 🪑 Assign tables
- Type the table number in the **Table** column. Instantly live.
- Until a guest has a table, they see "not assigned yet" — that's fine.
- **Seat Note** column = optional friendly line under their table number ("Right by the dance floor!").

---

## Changing the website itself

### Easiest way (recommended)
Tell Claude what to change — e.g. *"change the poruwa time to 6 PM"*, *"replace the welcome text with…"*. It gets edited, pushed, and is live in a minute.

### Do-it-yourself way (GitHub website)
1. Go to https://github.com/MaheshikaWalpola/wedding
2. Click the file (e.g. `info.html`) → click the **✏️ pencil** icon.
3. Make your change → green **Commit changes** button.
4. Wait ~1 minute — the live site updates by itself.

### What lives where
| Change this… | …in this file |
|---|---|
| Schedule times & descriptions | `info.html` (look for `<!-- EDIT: ... -->`) |
| Dress code | `info.html` |
| RSVP deadline (21 October 2026) | `rsvp.html` |
| Travel note | `location.html` |
| Contact names/numbers | `contact.html` |
| Welcome text on home page | `index.html` |
| Colours & fonts | `css/styles.css` (top `:root` block) |
| Countdown target time | `js/main.js` |

---

## The backend (Apps Script) — rarely needed

The master copy of the code is `apps-script/Code.gs` in the project/GitHub.
If it ever changes:
1. Sheet → **Extensions → Apps Script**
2. Click in code → **Cmd+A** → paste new code → **Cmd+S**
3. If told to run something: dropdown → function name → **▷ Run**
4. If the website talks to it differently: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy** (the URL never changes)

Functions you might run from the dropdown:
- **setupWebsite** — safe anytime; gives new guests their GuestIDs
- **writeInviteLinks** — refills the Invite Link column
- **listInviteLinks** — same links, printed in the log instead

---

## If something looks broken

| Symptom | Likely fix |
|---|---|
| Seat finder can't find a guest | Check the **Full Name** spelling in the sheet — guest must type a part of it (or exactly it) |
| Seat finder says "a few guests match" | Guest should type their fuller name |
| Invite link shows "Dear Guest" | The `?g=...` code doesn't match a **GuestID** — copy the link fresh from the Invite Link column |
| RSVP says "didn't go through" | Check Apps Script deployment: **Who has access** must be **Anyone** |
| Photo uploaded but not on the wall | Check the **Show** cell is `yes`; give Drive a minute for new photos |
| Site not updating after a change | Website changes need a GitHub push; sheet changes are instant |

---

## Important addresses

- **Live site:** https://maheshika-moksha.pages.dev
- **Code (GitHub):** https://github.com/MaheshikaWalpola/wedding
- **Guest data:** your "Wedding" Google Sheet → tabs: Guest List & RSVP · RSVP Responses · Guest Photos
- **Photos:** Google Drive → *Wedding Guest Photos* folder
- **Hosting:** dash.cloudflare.com → Workers & Pages → maheshika-moksha
- **Backend:** the sheet → Extensions → Apps Script
