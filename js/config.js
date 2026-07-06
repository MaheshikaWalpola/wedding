/* ============================================================
   CONFIG — the only file you need to edit to go live.

   1. Deploy the Apps Script (see README.md / apps-script/Code.gs)
   2. Paste its Web App URL into SCRIPT_URL below
   3. Set DEMO_MODE to false
   ============================================================ */

const CONFIG = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycby1MQP6pJmovAYBpL794PmHpWrf8I3HoMHtWS0blxIq0Kfbw8obqfXQZynzMUI1cyy1Gg/exec",
  DEMO_MODE: false, // live: queries your Google Sheet one guest at a time
};

/* Sample guests used only while DEMO_MODE is true.
   In live mode the guest list lives ONLY in your Google Sheet —
   the site looks up one guest at a time and never downloads the list.

   Try the seat finder with any of these names, or open a
   personalized invitation link, e.g.  index.html?g=nimali01     */

const SAMPLE_GUESTS = [
  { id: "nimali01",  name: "Nimali Perera",           table: 3, note: "So happy you're celebrating with us!" },
  { id: "kasun02",   name: "Kasun Fernando",          table: 5, note: "Save a dance for the newlyweds!" },
  { id: "sachini03", name: "Sachini Jayasooriya",     table: 2, note: "You're seated with the university crew." },
  { id: "dilhara04", name: "Dilhara Silva",           table: 7, note: "Right by the dance floor — you're welcome!" },
  { id: "amaya05",   name: "Amaya Wickramasinghe",    table: 1, note: "Family table, front and centre." },
  { id: "ruwan06",   name: "Ruwan & Chamodi Bandara", table: 4, note: "A lovely lagoon view from your seats." },
];
