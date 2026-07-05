/**
 * Maheshika & Moksha — Wedding Site Backend (Google Apps Script)
 * ==============================================================
 * Serves three things for the static site:
 *   GET  ?action=seat&name=<name>   -> one guest's table (seat finder)
 *   GET  ?action=invite&g=<guestid> -> one guest's name (personalized invite)
 *   POST <JSON body>                -> appends an RSVP row to the "RSVPs" tab
 *
 * The full guest list never leaves the Sheet — every request returns
 * at most one guest.
 *
 * SETUP (see README.md for the full walkthrough):
 *   1. Create a Google Sheet, then Extensions -> Apps Script, paste this file.
 *   2. Run setupSheets() once (accept the permission prompts) to create the
 *      "Guests" and "RSVPs" tabs with headers and sample data.
 *   3. Deploy -> New deployment -> Web app:
 *        Execute as: Me    |    Who has access: Anyone
 *   4. Copy the web app URL into js/config.js (SCRIPT_URL) and set
 *      DEMO_MODE to false.
 */

var GUESTS_SHEET = 'Guests';
var RSVP_SHEET = 'RSVPs';

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
 * Case-insensitive lookup by name. Matches if the typed name is contained
 * in the guest's name (so "Nimali" finds "Nimali Perera"). If several
 * guests match, asks the visitor to be more specific instead of guessing.
 */
function findSeatByName(name) {
  var query = normalize(name);
  if (query.length < 2) return { found: false };

  var rows = getGuestRows();
  var matches = rows.filter(function (r) {
    return normalize(r.name).indexOf(query) !== -1;
  });

  if (matches.length === 1) {
    var g = matches[0];
    return { found: true, name: g.name, table: g.table, note: g.note };
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

    var sheet = getSheet(RSVP_SHEET);
    sheet.appendRow([
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
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function getSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Missing sheet tab: ' + name + ' — run setupSheets() once.');
  return sheet;
}

/** Reads the Guests tab into [{id, name, table, note}, ...]. */
function getGuestRows() {
  var sheet = getSheet(GUESTS_SHEET);
  var values = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i++) { // skip the header row
    if (!values[i][1]) continue;            // skip blank rows
    rows.push({
      id: values[i][0],
      name: values[i][1],
      table: values[i][2],
      note: values[i][3],
    });
  }
  return rows;
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
 * Creates the "Guests" and "RSVPs" tabs with headers and the same six
 * sample guests the site's demo mode uses. Replace the sample rows with
 * your real guest list whenever you're ready — the site needs no change.
 */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var guests = ss.getSheetByName(GUESTS_SHEET) || ss.insertSheet(GUESTS_SHEET);
  guests.clear();
  guests.getRange(1, 1, 7, 4).setValues([
    ['GuestID',   'Name',                     'Table', 'Note'],
    ['nimali01',  'Nimali Perera',            3, "So happy you're celebrating with us!"],
    ['kasun02',   'Kasun Fernando',           5, 'Save a dance for the newlyweds!'],
    ['sachini03', 'Sachini Jayasooriya',      2, "You're seated with the university crew."],
    ['dilhara04', 'Dilhara Silva',            7, "Right by the dance floor — you're welcome!"],
    ['amaya05',   'Amaya Wickramasinghe',     1, 'Family table, front and centre.'],
    ['ruwan06',   'Ruwan & Chamodi Bandara',  4, 'A lovely lagoon view from your seats.'],
  ]);
  guests.getRange('1:1').setFontWeight('bold');

  var rsvps = ss.getSheetByName(RSVP_SHEET) || ss.insertSheet(RSVP_SHEET);
  if (rsvps.getLastRow() === 0) {
    rsvps.appendRow(['Timestamp', 'Name', 'Attending', 'Guests', 'Message']);
    rsvps.getRange('1:1').setFontWeight('bold');
  }
}
