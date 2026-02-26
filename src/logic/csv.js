// CSV export — formats completed match results for download.
// Pure functions; no DOM, no localStorage, no side effects.
//
// What it does:
//   1. Converts the tournament date (YYYY-MM-DD) to UTC midnight in Swiss local time
//      CET (UTC+1): T23:00:00Z | CEST (UTC+2): T22:00:00Z
//   2. Iterates completed rounds and formats each match into CSV columns:
//      draws, player1, player1Wins, player2, player2Wins, round, tournamentDate
//   3. Returns the full CSV string and a suggested filename

/**
 * Convert a local Swiss date string "YYYY-MM-DD" to a UTC ISO string
 * representing midnight Swiss local time.
 *
 * @param {string} dateStr - "YYYY-MM-DD"
 * @returns {string} e.g. "2026-02-18T23:00:00Z"
 */
export function swissDateToUTC(dateStr) {
  // Use Intl to find the UTC offset for Europe/Zurich on this date.
  // We probe at noon to avoid any DST edge case around midnight.
  const noonLocal = new Date(`${dateStr}T12:00:00`);

  const formatter = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Zurich',
    timeZoneName: 'shortOffset',
  });

  const parts = formatter.formatToParts(noonLocal);
  const offsetStr = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+1';
  // offsetStr looks like "GMT+1" or "GMT+2"
  const match = offsetStr.match(/GMT([+-])(\d+)/);
  const sign   = match ? (match[1] === '+' ? 1 : -1) : 1;
  const hours  = match ? parseInt(match[2], 10) : 1;
  const offsetHours = sign * hours; // +1 for CET, +2 for CEST

  // Parse the date components
  const [year, month, day] = dateStr.split('-').map(Number);

  // Midnight Swiss time = 00:00 local = (00:00 - offsetHours) UTC
  // e.g. CET (UTC+1):  midnight = 23:00 of the previous UTC day
  // e.g. CEST (UTC+2): midnight = 22:00 of the previous UTC day
  const midnightUTC = new Date(Date.UTC(year, month - 1, day, -offsetHours, 0, 0));

  return midnightUTC.toISOString().replace('.000Z', 'Z');
}

/**
 * Generate CSV content from completed tournament rounds.
 * Bye matches are excluded per spec.
 *
 * @param {object}   tournament - Tournament state object.
 * @param {object[]} players    - Player master list (for name lookup by ID).
 * @param {string}   dateStr    - Tournament date "YYYY-MM-DD".
 * @returns {string} Full CSV string including header.
 */
export function generateCSV(tournament, players, dateStr) {
  const playerMap = Object.fromEntries(players.map(p => [p.id, p.name]));
  const tournamentDate = swissDateToUTC(dateStr);

  const header = 'draws,player1,player1Wins,player2,player2Wins,round,tournamentDate';
  const rows = [];

  for (const round of tournament.rounds) {
    if (round.status !== 'complete') continue;
    for (const match of round.matches) {
      if (match.isBye || !match.result) continue;

      const { player1Wins, player2Wins } = match.result;
      const draws = player1Wins === player2Wins ? 1 : 0;
      const player1 = playerMap[match.player1Id] ?? match.player1Id;
      const player2 = playerMap[match.player2Id] ?? match.player2Id;

      rows.push([
        draws,
        _csvField(player1),
        player1Wins,
        _csvField(player2),
        player2Wins,
        round.roundNumber,
        tournamentDate,
      ].join(','));
    }
  }

  return [header, ...rows].join('\n');
}

/**
 * Generate the export filename from a date string.
 * @param {string} dateStr - "YYYY-MM-DD"
 * @returns {string} e.g. "2026_02_18_matches.csv"
 */
export function exportFilename(dateStr) {
  return dateStr.replace(/-/g, '_') + '_matches.csv';
}

// Wrap field in double-quotes if it contains a comma or quote
function _csvField(value) {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
