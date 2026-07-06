/**
 * Maheshika & Moksha — Wedding Site Backend (Google Apps Script)
 * ==============================================================
 * Built for the "Wedding" planner spreadsheet. It reads guests from the
 * existing "Guest List & RSVP" tab and serves three things:
 *   GET  ?action=seat&name=<name>   -> one guest's table (seat finder)
 *   GET  ?action=invite&g=<guestid> -> one guest's name (personalized invite)
 *   POST <JSON body>                -> appends a row to "RSVP Responses"
 *
 * The full guest list never leaves the Sheet — every request returns
 * at most one guest.
 *
 * SETUP:
 *   1. In the (converted, native Google) spreadsheet:
 *      Extensions -> Apps Script, paste this file, save.
 *   2. Run setupWebsite() once (accept the permission prompts). It:
 *        - adds "Table", "GuestID" and "Seat Note" columns to the
 *          Guest List & RSVP tab (only if missing),
 *        - generates a unique GuestID for every guest that lacks one
 *          (these become the personalized links: ?g=<GuestID>),
 *        - creates the "RSVP Responses" tab for website submissions.
 *      It never changes your existing columns or rows.
 *   3. Deploy -> New deployment -> Web app:
 *        Execute as: Me    |    Who has access: Anyone
 *   4. Copy the web app URL into js/config.js (SCRIPT_URL) and set
 *      DEMO_MODE to false.
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

// Header titles in the Guest List & RSVP tab. If you rename a column,
// update it here and re-deploy.
var COL_NAME = 'Full Name';
var COL_TABLE = 'Table';
var COL_ID = 'GuestID';
var COL_NOTE = 'Seat Note';

/* ------------------------------------------------------------------ */
/* GET — seat finder & invitation lookup                               */
/* ------------------------------------------------------------------ */

function doGet(e) {
  var action = String((e.parameter.action || '')).toLowerCase();

  if (action === 'seat')   return jsonResponse(findSeatByName(e.parameter.name));
  if (action === 'invite') return jsonResponse(findGuestById(e.parameter.g));

  return jsonResponse({ ok: false, error: 'Unknown action' });
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

    var name = String(data.name || '').trim();
    if (!name) return jsonResponse({ ok: false, error: 'Missing name' });

    getOrCreateRsvpSheet().appendRow([
      new Date(),
      name,
      String(data.attending || ''),
      Number(data.guests || 1),
      String(data.message || ''),
    ]);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Could not save RSVP' });
  }
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
    sheet.appendRow(['Timestamp', 'Name', 'Attending', 'Guests', 'Message']);
    sheet.getRange('1:1').setFontWeight('bold');
  }
  return sheet;
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

  // Generate ids like "amma-k3x9" for guests that don't have one yet.
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
    var guestId = makeGuestId(name, used);
    used[guestId] = true;
    sheet.getRange(r2 + 1, c.id + 1).setValue(guestId);
    added++;
  }

  getOrCreateRsvpSheet();
  Logger.log('setupWebsite done — generated ' + added + ' new GuestIDs.');
}

/** "Sonu (Brother)" -> "sonu-brother-x4k2" (short random suffix, unique). */
function makeGuestId(name, used) {
  var slug = normalize(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  var alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  while (true) {
    var suffix = '';
    for (var i = 0; i < 4; i++) {
      suffix += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    var id = slug + '-' + suffix;
    if (!used[id]) return id;
  }
}

/**
 * Handy helper: logs every guest's personalized link so you can copy
 * them into invitations. Run it and check View -> Logs (or the
 * Execution log). Set SITE_URL to your Cloudflare Pages address first.
 */
function listInviteLinks() {
  var SITE_URL = 'https://your-site.pages.dev'; // EDIT once your site is live
  getGuestRows().forEach(function (g) {
    if (g.id) Logger.log(g.name + ': ' + SITE_URL + '/?g=' + g.id);
  });
}
