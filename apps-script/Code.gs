/**
 * Maheshika & Moksha — Wedding Site Backend (Google Apps Script)
 * ==============================================================
 * Bound to the "Wedding Planner Sri Lanka" spreadsheet (since 9 Oct 2026 the
 * website's own sheet, separate from the "Wedding" planner). It reads guests
 * from the "Guest List" tab and serves these:
 *   GET  ?action=verify&key=<code>  -> is this the site code? (the PIN gate)
 *   GET  ?action=seat&name=<name>   -> one guest's table (seat finder)
 *   GET  ?action=invite&g=<guestid> -> one guest's name (personalized invite)
 *   GET  ?action=photos             -> the album (photos marked Show = yes)
 *   POST <JSON body>                -> adds a row to "RSVP Responses" (or replaces
 *                                      the same guest's earlier reply) and writes
 *                                      Yes/No into the guest's RSVP cell
 *   POST {action:"photo", ...}      -> saves one photo to the Drive folder
 *
 * The full guest list never leaves the Sheet — every request returns
 * at most one guest.
 *
 * THE SITE CODE (PIN):
 *   The four-digit code on the invitation lives ONLY in a Script Property
 *   named SITE_PIN (Apps Script editor -> Project Settings -> Script
 *   properties). It is in no file of the website. Every request except
 *   "invite" must carry key=<code>, or key=g:<guestid> from a personal
 *   link; anything else is refused. After MAX_WRONG_KEYS_PER_MINUTE wrong
 *   keys in a minute, every key is refused until that minute is over, so
 *   guessing all ten thousand codes takes many hours instead of minutes.
 *   Uploads and RSVPs are capped per ten minutes and per six hours.
 *   To change the code: edit SITE_PIN, no redeploy needed. Guests whose
 *   device remembered the old code see the gate once more.
 *
 * SETUP:
 *   1. In the (converted, native Google) spreadsheet:
 *      Extensions -> Apps Script, paste this file, save.
 *   2. Project Settings -> Script properties -> Add: SITE_PIN = the code.
 *      Run checkSetup() to confirm (it never prints the code).
 *   3. Run setupWebsite() once (accept the permission prompts). It:
 *        - adds "Table", "GuestID" and "Seat Note" columns to the
 *          Guest List & RSVP tab (only if missing),
 *        - generates a unique GuestID for every guest that lacks one
 *          (these become the personalized links: ?g=<GuestID>),
 *        - creates the "RSVP Responses" tab for website submissions.
 *      It never changes your existing columns or rows.
 *   4. Deploy -> New deployment -> Web app:
 *        Execute as: Me    |    Who has access: Anyone
 *   5. Copy the web app URL into js/config.js (SCRIPT_URL) and set
 *      DEMO_MODE to false.
 *   Every later change to this file: Deploy -> Manage deployments ->
 *   Edit -> Version: New version -> Deploy. Saving alone does not go live.
 *
 * AFTERWARDS:
 *   - Fill in the "Table" column as you finalise seating; until a guest
 *     has a table, the seat finder shows them a friendly "not assigned
 *     yet" message.
 *   - "Seat Note" is an optional per-guest message shown under the
 *     table number.
 *   - Website RSVPs land in "RSVP Responses"; your own RSVP/Meal
 *     columns in the guest list are yours to update as you confirm.
 */

// The guest tab is matched loosely (any tab whose name contains "guest
// list"), so an emoji prefix like "👥 Guest List & RSVP" still works.
var GUEST_TAB_MATCH = 'guest list';
var RSVP_TAB = 'RSVP Responses';
var RSVP_HEADER = ['Timestamp', 'Name', 'Attending', 'Guests', 'Message', 'GuestID'];

// Header titles in the Guest List & RSVP tab. If you rename a column,
// update it here and re-deploy.
var COL_NAME = 'Full Name';
var COL_TABLE = 'Table';
var COL_ID = 'GuestID';
var COL_NOTE = 'Seat Note';

// Guest photo wall: uploads land in this Drive folder, and each photo
// gets a row in this sheet tab. Set a row's "Show" cell to "no" to hide
// that photo from the website.
var PHOTOS_TAB = 'Guest Photos';
var PHOTOS_FOLDER_NAME = 'Wedding Guest Photos';
var MAX_PHOTO_BASE64_CHARS = 3000000; // ~2.2 MB image; the site sends ~500 KB (1600 px JPEG)

// The site code and the limits. The code itself is read from the SITE_PIN
// Script Property (see the header); it must never be written in this file.
var PIN_PROPERTY = 'SITE_PIN';
var MAX_WRONG_KEYS_PER_MINUTE = 10;  // then every key is refused until the minute is over
// Caps raised 19 Oct 2026 (uploads 150 -> 300, RSVPs 30/300 -> 60/600): the ten minutes
// after a group photo or a reminder message can reach the old ones; a flood sends thousands.
var MAX_UPLOADS_PER_10_MIN = 300;
var MAX_UPLOADS_PER_6_HOURS = 2000;
var MAX_RSVPS_PER_10_MIN = 60;
var MAX_RSVPS_PER_6_HOURS = 600;
var RSVP_REPLACE_WINDOW_MS = 5 * 60 * 1000; // a second reply under the same name within this replaces the first

/* ------------------------------------------------------------------ */
/* GET — PIN check, seat finder, invitation lookup, album              */
/* ------------------------------------------------------------------ */

function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = String(p.action || '').toLowerCase();

  if (action === 'verify') return jsonResponse(checkKey(p.key));
  if (action === 'invite') return jsonResponse(findGuestById(p.g)); // the id is its own key

  var auth = checkKey(p.key);
  if (!auth.ok) return jsonResponse(auth);

  if (action === 'seat')   return jsonResponse(findSeatByName(p.name));
  if (action === 'photos') return jsonResponse(listPhotos());

  return jsonResponse({ ok: false, error: 'Unknown action' });
}

/* ------------------------------------------------------------------ */
/* The site code                                                       */
/* ------------------------------------------------------------------ */

function sitePin() {
  return String(PropertiesService.getScriptProperties().getProperty(PIN_PROPERTY) || '').trim();
}

/**
 * Is this key allowed in? A key is the site code, or "g:<guestid>" from a
 * personal link. Answers { ok: true }, or { ok: false, auth: false } with one
 * of: wrong (bad key), slow (too many wrong keys this minute, every key is
 * refused), or error (the code is not set up). Wrong keys are counted in a
 * shared one-minute window — Apps Script cannot tell visitors apart, so the
 * window is shared by everyone, which is why it refuses for a minute at most
 * and never locks anyone out for longer.
 */
function checkKey(key) {
  var k = String(key || '').trim();
  var pin = sitePin();
  if (!pin) return { ok: false, auth: false, error: 'The site code is not set up yet' };
  if (!k) return { ok: false, auth: false, wrong: true };

  var cache = CacheService.getScriptCache();
  var wrong = Number(cache.get('wrong-keys') || 0);
  if (wrong >= MAX_WRONG_KEYS_PER_MINUTE) return { ok: false, auth: false, slow: true };

  if (k === pin) return { ok: true };
  if (k.indexOf('g:') === 0) {
    try { if (findGuestById(k.slice(2)).found) return { ok: true }; } catch (err) { /* no guest list on this site */ }
  }

  cache.put('wrong-keys', String(wrong + 1), 60);
  return { ok: false, auth: false, wrong: true };
}

/**
 * Counts one more <what> (uploads, rsvps) in the current ten-minute and
 * six-hour windows and says whether either cap is already reached. The
 * windows are fixed (not sliding), so a cap clears at the next window.
 */
function overLimit(what, perTenMinutes, perSixHours) {
  var cache = CacheService.getScriptCache();
  var now = Date.now();
  var shortKey = what + '-10m-' + Math.floor(now / 600000);
  var longKey = what + '-6h-' + Math.floor(now / 21600000);
  var short = Number(cache.get(shortKey) || 0);
  var long = Number(cache.get(longKey) || 0);
  if (short >= perTenMinutes || long >= perSixHours) return true;
  cache.put(shortKey, String(short + 1), 600);
  cache.put(longKey, String(long + 1), 21600);
  return false;
}

/**
 * Case-insensitive lookup by name. An exact name match always wins (so a
 * guest literally named "Amma" is found even though "Loku Amma" also
 * contains it). Otherwise it falls back to "contains" matching, so
 * "Nimali" finds "Nimali Perera". If several guests still match, it asks
 * the visitor to be more specific instead of guessing. A guest without a
 * table yet returns table: null.
 */
function findSeatByName(name) {
  var query = normalize(name);
  if (query.length < 2) return { found: false };

  var rows = getGuestRows();

  var exact = rows.filter(function (g) { return normalize(g.name) === query; });
  var matches = exact.length ? exact : rows.filter(function (g) {
    return normalize(g.name).indexOf(query) !== -1;
  });

  if (matches.length === 1) {
    var g = matches[0];
    return {
      found: true,
      name: g.name,
      table: g.table === '' ? null : g.table,
      note: g.note,
    };
  }
  if (matches.length > 1) return { found: false, ambiguous: true };
  return { found: false };
}

/** Exact lookup by guest id — returns only the name, for the invite card. */
function findGuestById(guestId) {
  var id = normalize(guestId);
  if (!id) return { found: false };

  var rows = getGuestRows();
  for (var i = 0; i < rows.length; i++) {
    if (normalize(rows[i].id) === id) {
      return { found: true, name: rows[i].name };
    }
  }
  return { found: false };
}

/* ------------------------------------------------------------------ */
/* POST — RSVP submissions                                             */
/* ------------------------------------------------------------------ */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    var auth = checkKey(data.key);
    if (!auth.ok) return jsonResponse(auth);

    if (data.action === 'photo') {
      if (overLimit('uploads', MAX_UPLOADS_PER_10_MIN, MAX_UPLOADS_PER_6_HOURS)) {
        return jsonResponse({ ok: false, error: 'The album is very busy right now. Please try again in a few minutes.' });
      }
      return jsonResponse(savePhoto(data));
    }

    // Bounded, plain-text values only: the sheet is the couple's, not the guest's.
    var name = String(data.name || '').trim().slice(0, 120);
    if (!name) return jsonResponse({ ok: false, error: 'Missing name' });
    var attending = String(data.attending || '').toLowerCase() === 'no' ? 'no' : 'yes';
    var guests = Math.min(20, Math.max(1, Math.round(Number(data.guests) || 1)));

    if (overLimit('rsvps', MAX_RSVPS_PER_10_MIN, MAX_RSVPS_PER_6_HOURS)) {
      return jsonResponse({ ok: false, error: 'Too many replies at once. Please try again in a few minutes.' });
    }

    // A reply from a personal link carries key "g:<guestid>"; keeping the id with the
    // reply lets the RSVP column in the guest tab be filled without guessing by name.
    var guestId = String(data.key || '').indexOf('g:') === 0 ? String(data.key).slice(2).trim().slice(0, 40) : '';

    // A repeat reply from the same guest replaces their earlier row instead of adding
    // one (since 19 Oct 2026): guests who took a slow send for a stuck page refreshed
    // and sent the same reply three times, and the tab held all three.
    var rsvpSheet = getOrCreateRsvpSheet();
    var row = [new Date(), name, attending, guests, String(data.message || '').slice(0, 2000), guestId];
    var earlier = findEarlierReply(rsvpSheet, guestId, name);
    if (earlier) rsvpSheet.getRange(earlier, 1, 1, row.length).setValues([row]);
    else rsvpSheet.appendRow(row);

    // Mirror the answer into the guest tab's RSVP column (since 14 Oct 2026). A problem
    // here must never lose the reply, which is already saved above.
    try {
      var guestSheet = getGuestSheet();
      var guestValues = guestSheet.getDataRange().getValues();
      applyRsvpToGuest(guestSheet, guestValues, getGuestLayout(guestValues), guestId, name, attending);
    } catch (ignore) { /* no guest list (Indian site) or no RSVP column */ }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Could not save' });
  }
}

/* ------------------------------------------------------------------ */
/* Guest photo wall                                                    */
/* ------------------------------------------------------------------ */

/** Saves one uploaded photo to Drive and records it in the sheet. */
function savePhoto(data) {
  var b64 = String(data.data || '');
  if (!b64) return { ok: false, error: 'No image data' };
  if (b64.length > MAX_PHOTO_BASE64_CHARS) return { ok: false, error: 'Image too large' };

  var mime = String(data.mimeType || 'image/jpeg');
  if (mime.indexOf('image/') !== 0) return { ok: false, error: 'Not an image' };

  // The guest's name (optional on the site) goes into the file name and the Drive
  // description, so the Drive folder itself shows who added each photo.
  var by = String(data.name || '').replace(/[\/\\:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim() || 'A guest';
  var original = String(data.filename || 'guest-photo.jpg').replace(/[\/\\:*?"<>|]/g, ' ').slice(0, 100) || 'guest-photo.jpg';
  var blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, by + ' - ' + original);
  var file = getOrCreatePhotosFolder().createFile(blob);
  file.setDescription('Added by ' + by + ' via the wedding website');
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  getOrCreatePhotosSheet().appendRow([
    new Date(),
    by,
    file.getId(),
    'yes', // Show on the website — change to "no" to hide
  ]);

  return { ok: true };
}

/** Returns the visible photos, newest first.
 *  A photo shows only if its sheet row says Show = yes AND the file is still in the
 *  photos folder. So deleting (or moving out) a file in Drive removes it from the
 *  album without touching the sheet. One folder listing per request, which is far
 *  cheaper than looking up every file by id. */
function listPhotos() {
  var values = getOrCreatePhotosSheet().getDataRange().getValues();
  var inFolder = {};
  var files = getOrCreatePhotosFolder().getFiles();
  while (files.hasNext()) inFolder[files.next().getId()] = true;
  var photos = [];
  for (var i = 1; i < values.length; i++) {
    var fileId = String(values[i][2] || '').trim();
    if (!fileId) continue;
    var show = String(values[i][3]).toLowerCase().trim();
    if (show !== 'yes' && show !== 'true') continue; // "true": the column turned into checkboxes
    if (!inFolder[fileId]) continue; // trashed, or no longer in the folder
    photos.push({
      by: String(values[i][1] || 'A guest'),
      url: 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200',
    });
  }
  photos.reverse();
  return { ok: true, photos: photos.slice(0, 200) };
}

function getOrCreatePhotosSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PHOTOS_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(PHOTOS_TAB);
    sheet.appendRow(['Timestamp', 'Shared By', 'FileID', 'Show']);
    sheet.getRange('1:1').setFontWeight('bold');
  }
  return sheet;
}

function getOrCreatePhotosFolder() {
  var it = DriveApp.getFoldersByName(PHOTOS_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTOS_FOLDER_NAME);
}

/* ------------------------------------------------------------------ */
/* Reading the Guest List & RSVP tab                                   */
/* ------------------------------------------------------------------ */

/**
 * Finds the header row (the one containing "Full Name") and returns
 * { rowIndex, cols: {name, table, id, note} } with 0-based column
 * indexes. Table/id/note are -1 until setupWebsite() adds them.
 */
function getGuestLayout(values) {
  for (var r = 0; r < Math.min(values.length, 10); r++) {
    var nameCol = values[r].indexOf(COL_NAME);
    if (nameCol !== -1) {
      return {
        rowIndex: r,
        cols: {
          name: nameCol,
          table: values[r].indexOf(COL_TABLE),
          id: values[r].indexOf(COL_ID),
          note: values[r].indexOf(COL_NOTE),
        },
      };
    }
  }
  throw new Error('Could not find a "' + COL_NAME + '" header in the guest tab');
}

/** Finds the guest tab even if its name has an emoji/extra spaces. */
function getGuestSheet() {
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().toLowerCase().indexOf(GUEST_TAB_MATCH) !== -1) {
      return sheets[i];
    }
  }
  throw new Error('Could not find a tab whose name contains "Guest List"');
}

/** Reads the guest tab into [{name, table, id, note}, ...]. */
function getGuestRows() {
  var sheet = getGuestSheet();
  var values = sheet.getDataRange().getValues();
  var layout = getGuestLayout(values);
  var c = layout.cols;

  var rows = [];
  for (var r = layout.rowIndex + 1; r < values.length; r++) {
    var name = String(values[r][c.name] || '').trim();
    if (!name) continue;
    rows.push({
      name: name,
      table: c.table === -1 ? '' : String(values[r][c.table]).trim(),
      id: c.id === -1 ? '' : String(values[r][c.id]).trim(),
      note: c.note === -1 ? '' : String(values[r][c.note]).trim(),
    });
  }
  return rows;
}

function getOrCreateRsvpSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(RSVP_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(RSVP_TAB);
    sheet.appendRow(RSVP_HEADER);
    sheet.getRange('1:1').setFontWeight('bold');
    return sheet;
  }
  var first = sheet.getRange(1, 1, 1, RSVP_HEADER.length).getValues()[0];
  if (String(first[0] || '').trim() !== RSVP_HEADER[0]) {
    // The header row was deleted at some point (seen 15 Oct 2026: row 1 was a reply), so
    // put it back above the replies. An earlier version of this function had already
    // written "GuestID" into F1 of that reply; it is cleared so it is not read as an id.
    if (String(first[5] || '').trim() === 'GuestID') sheet.getRange(1, 6).clearContent();
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, RSVP_HEADER.length).setValues([RSVP_HEADER]).setFontWeight('bold');
  } else if (String(first[5] || '').trim() === '') {
    // Tabs created before 14 Oct 2026 have five headers; the GuestID one is added here.
    sheet.getRange(1, 6).setValue('GuestID').setFontWeight('bold');
  }
  return sheet;
}

/**
 * The 1-based row of the reply a new one should replace, or 0 to append. The most
 * recent reply with the same GuestID (a personal link) always counts, whenever it
 * was sent: the guest changed their mind, and the newer answer is the one that
 * matters. Without an id, only the same name within RSVP_REPLACE_WINDOW_MS (five
 * minutes) counts: a refresh-and-resend lands within a minute or two, while two
 * guests who share a name almost never reply in the same five minutes.
 */
function findEarlierReply(sheet, guestId, name) {
  var values = sheet.getDataRange().getValues();
  var id = normalize(guestId);
  var wanted = normalize(name);
  var since = Date.now() - RSVP_REPLACE_WINDOW_MS;
  for (var r = values.length - 1; r >= 1; r--) {           // newest first; row 0 is the header
    var rowId = normalize(values[r][5]);
    if (id && rowId === id) return r + 1;
    if (!id && !rowId && wanted && normalize(values[r][1]) === wanted) {
      var when = new Date(values[r][0]).getTime();
      if (when >= since) return r + 1;
    }
  }
  return 0;
}

function normalize(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/* One-time setup — run this manually from the Apps Script editor      */
/* ------------------------------------------------------------------ */

/**
 * Logs whether the site code is set (without printing it) and whether the
 * photos folder can be found. Run it after setting SITE_PIN, and whenever
 * the gate says "The site code is not set up yet".
 */
function checkSetup() {
  var pin = sitePin();
  Logger.log(pin
    ? 'SITE_PIN is set (' + pin.length + ' digits).'
    : 'SITE_PIN is NOT set: Project Settings -> Script properties -> Add SITE_PIN.');
  if (pin && !/^\d{4}$/.test(pin)) Logger.log('Warning: the website expects exactly four digits.');
  Logger.log('Photos folder: "' + getOrCreatePhotosFolder().getName() + '"');
  var wrong = CacheService.getScriptCache().get('wrong-keys');
  Logger.log('Wrong keys this minute: ' + (wrong || 0) + ' (refusing after ' + MAX_WRONG_KEYS_PER_MINUTE + ').');
}

/**
 * Adds the website columns (Table, GuestID, Seat Note) to the guest tab
 * if they don't exist, fills in a unique GuestID for every guest that
 * lacks one, and creates the RSVP Responses tab. Safe to run again —
 * existing values are never overwritten.
 */
function setupWebsite() {
  var sheet = getGuestSheet();

  var values = sheet.getDataRange().getValues();
  var layout = getGuestLayout(values);
  var headerRow = layout.rowIndex + 1; // 1-based for Range calls

  // Add any missing headers to the right of the existing columns.
  [COL_TABLE, COL_ID, COL_NOTE].forEach(function (title) {
    if (values[layout.rowIndex].indexOf(title) === -1) {
      var col = sheet.getLastColumn() + 1;
      sheet.getRange(headerRow, col).setValue(title).setFontWeight('bold');
      values = sheet.getDataRange().getValues(); // re-read with the new column
    }
  });

  // Generate ids like "k3x9" for guests that don't have one yet.
  layout = getGuestLayout(values);
  var c = layout.cols;
  var used = {};
  for (var r = layout.rowIndex + 1; r < values.length; r++) {
    var existing = String(values[r][c.id] || '').trim();
    if (existing) used[existing] = true;
  }
  var added = 0;
  for (var r2 = layout.rowIndex + 1; r2 < values.length; r2++) {
    var name = String(values[r2][c.name] || '').trim();
    if (!name || String(values[r2][c.id] || '').trim()) continue;
    var guestId = makeGuestId(used);
    used[guestId] = true;
    sheet.getRange(r2 + 1, c.id + 1).setValue(guestId);
    added++;
  }

  getOrCreateRsvpSheet();
  getOrCreatePhotosSheet();
  getOrCreatePhotosFolder(); // also triggers the Drive permission prompt once
  Logger.log('setupWebsite done — generated ' + added + ' new GuestIDs.');
}

/**
 * A short random id like "x4k2": four characters from an alphabet without the
 * look-alikes (no i/l/1, o/0). Until 14 Oct 2026 the id started with a slug of
 * the name ("sonu-brother-x4k2"); that put nicknames into the links guests
 * receive, so the name part was dropped. Ids already in the sheet keep working,
 * the lookup is by exact id. Nearly a million combinations, and the backend
 * refuses every key for a minute after MAX_WRONG_KEYS_PER_MINUTE wrong ones.
 */
function makeGuestId(used) {
  var alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  while (true) {
    var id = '';
    for (var i = 0; i < 4; i++) {
      id += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    if (!used[id]) return id;
  }
}

var SITE_URL = 'https://maheshika-moksha.pages.dev';

/**
 * Writes every guest's personalized invitation link into an
 * "Invite Link" column in the Guest List & RSVP tab, right where you
 * can copy it when messaging that guest. Safe to run again any time
 * (e.g. after adding guests — run setupWebsite first for their ids).
 */
function writeInviteLinks() {
  var sheet = getGuestSheet();
  var values = sheet.getDataRange().getValues();
  var layout = getGuestLayout(values);
  var headerRow = layout.rowIndex + 1; // 1-based

  var LINK_COL_TITLE = 'Invite Link';
  var linkCol = values[layout.rowIndex].indexOf(LINK_COL_TITLE);
  if (linkCol === -1) {
    linkCol = sheet.getLastColumn(); // 0-based index of the new column
    sheet.getRange(headerRow, linkCol + 1).setValue(LINK_COL_TITLE).setFontWeight('bold');
  }

  var written = 0;
  for (var r = layout.rowIndex + 1; r < values.length; r++) {
    var id = String(values[r][layout.cols.id] || '').trim();
    if (!id) continue;
    var name = String(values[r][layout.cols.name] || '').trim();
    sheet.getRange(r + 1, linkCol + 1).setValue(inviteLink(id, name));
    written++;
  }
  Logger.log('writeInviteLinks done — wrote ' + written + ' links.');
}

/**
 * Gives every guest whose invitation has NOT gone out a fresh id, then rewrites
 * the Invite Link column. A row whose "Invitation" cell says Sent keeps its id,
 * so links already in guests' hands stay valid; everyone else gets a new short
 * id and a new link. Safe to run any time, e.g. after renaming guests
 * (Maheshika, 14 Oct 2026: names change from time to time, and the ids made
 * before that day carried the name as it was then). Logs every old -> new id.
 */
function renewGuestIds() {
  var sheet = getGuestSheet();
  var values = sheet.getDataRange().getValues();
  var layout = getGuestLayout(values);
  var c = layout.cols;
  if (c.id === -1) throw new Error('Run setupWebsite first: there is no GuestID column yet');

  // The column that says Sent / Pending: its header contains "invitation"
  // ("Invite Link" does not, so the links column is never mistaken for it).
  var header = values[layout.rowIndex];
  var sentCol = -1;
  for (var h = 0; h < header.length; h++) {
    if (String(header[h] || '').toLowerCase().indexOf('invitation') !== -1) { sentCol = h; break; }
  }
  if (sentCol === -1) throw new Error('Could not find an "Invitation" column (the one that says Sent)');

  var used = {};
  for (var r = layout.rowIndex + 1; r < values.length; r++) {
    var existing = String(values[r][c.id] || '').trim();
    if (existing) used[existing] = true;
  }
  var renewed = 0, kept = 0;
  for (var r2 = layout.rowIndex + 1; r2 < values.length; r2++) {
    var name = String(values[r2][c.name] || '').trim();
    if (!name) continue;
    if (String(values[r2][sentCol] || '').trim().toLowerCase().indexOf('sent') === 0) { kept++; continue; }
    var old = String(values[r2][c.id] || '').trim();
    var guestId = makeGuestId(used);
    used[guestId] = true;
    sheet.getRange(r2 + 1, c.id + 1).setValue(guestId);
    Logger.log(name + ': ' + (old || '(no id)') + ' -> ' + guestId);
    renewed++;
  }
  Logger.log('renewGuestIds done — ' + renewed + ' new ids, ' + kept + ' kept (Invitation = Sent).');
  writeInviteLinks();
}

/* ---- RSVP replies -> the RSVP column of the guest tab (14 Oct 2026) ---- */

/** 0-based index of the guest tab column whose header contains "RSVP", or -1. */
function rsvpColumn(values, layout) {
  var header = values[layout.rowIndex];
  for (var h = 0; h < header.length; h++) {
    if (String(header[h] || '').toLowerCase().indexOf('rsvp') !== -1) return h;
  }
  return -1;
}

/**
 * Finds the guest a reply belongs to: by GuestID when the reply came through a
 * personal link, else by name — an exact match first, then the one guest whose
 * name contains what was typed (or the other way round). Several loose matches
 * mean nobody is picked. Returns the 0-based row index into `values`, or -1.
 */
function matchGuestRow(values, layout, guestId, name) {
  var c = layout.cols;
  var first = layout.rowIndex + 1;
  var id = normalize(guestId);
  if (id && c.id !== -1) {
    for (var r = first; r < values.length; r++) {
      if (normalize(values[r][c.id]) === id) return r;
    }
  }
  var wanted = normalize(name);
  if (!wanted) return -1;
  for (var r2 = first; r2 < values.length; r2++) {
    if (normalize(values[r2][c.name]) === wanted) return r2;
  }
  var found = -1, count = 0;
  for (var r3 = first; r3 < values.length; r3++) {
    var n = normalize(values[r3][c.name]);
    if (n && (n.indexOf(wanted) !== -1 || wanted.indexOf(n) !== -1)) { found = r3; count++; }
  }
  return count === 1 ? found : -1;
}

/**
 * Writes one reply into the guest's RSVP cell as "Yes" or "No". Called by doPost
 * the moment a reply arrives and by syncRsvps for the whole tab. Returns one line
 * saying what happened, for the log.
 */
function applyRsvpToGuest(sheet, values, layout, guestId, name, attending) {
  var col = rsvpColumn(values, layout);
  if (col === -1) return 'no RSVP column in the guest tab';
  var r = matchGuestRow(values, layout, guestId, name);
  if (r === -1) return 'no matching guest';
  var answer = normalize(attending) === 'no' ? 'No' : 'Yes';
  sheet.getRange(r + 1, col + 1).setValue(answer);
  return String(values[r][layout.cols.name]).trim() + ' -> ' + answer;
}

/**
 * Copies every reply in "RSVP Responses" into the RSVP column of the guest tab,
 * oldest first, so a guest who replied twice ends up with the latest answer.
 * Replies that match no guest are listed at the end of the log for you to enter
 * by hand. New replies are mirrored by doPost as they arrive; run this to catch
 * up on replies from before 14 Oct 2026 or after editing names.
 */
function syncRsvps() {
  var guestSheet = getGuestSheet();
  var values = guestSheet.getDataRange().getValues();
  var layout = getGuestLayout(values);
  if (rsvpColumn(values, layout) === -1) throw new Error('Could not find an "RSVP" column in the guest tab');

  var rsvp = getOrCreateRsvpSheet().getDataRange().getValues();
  var head = rsvp[0] || [];
  var cName = head.indexOf('Name'), cAttending = head.indexOf('Attending'), cId = head.indexOf('GuestID');
  if (cName === -1 || cAttending === -1) throw new Error('The RSVP Responses tab has no Name / Attending headers');

  var written = 0, unmatched = [];
  for (var i = 1; i < rsvp.length; i++) {
    var name = String(rsvp[i][cName] || '').trim();
    var id = cId === -1 ? '' : String(rsvp[i][cId] || '').trim();
    if (!name && !id) continue;
    var attending = String(rsvp[i][cAttending] || '').trim();
    var result = applyRsvpToGuest(guestSheet, values, layout, id, name, attending);
    if (result === 'no matching guest') unmatched.push(name + ' (' + attending + ')'); else written++;
    Logger.log((name || id) + ': ' + result);
  }
  Logger.log('syncRsvps done — ' + written + ' replies written to the guest tab, ' + unmatched.length +
    ' without a matching guest' + (unmatched.length ? ': ' + unmatched.join('; ') : '.'));
}

/**
 * Same links, but printed to the execution log instead of the sheet.
 */
function listInviteLinks() {
  getGuestRows().forEach(function (g) {
    if (g.id) Logger.log(g.name + ': ' + inviteLink(g.id, g.name));
  });
}

/**
 * A personal link carries the guest's name as well as the id (since 10 Oct 2026), so the
 * cover greets them the instant it opens instead of after the backend has answered. The
 * site still looks the id up and corrects the name if it was changed in the sheet. Links
 * without the name keep working; they just show the greeting a moment later.
 */
function inviteLink(id, name) {
  return SITE_URL + '/?g=' + encodeURIComponent(id) + (name ? '&n=' + encodeURIComponent(name) : '');
}
