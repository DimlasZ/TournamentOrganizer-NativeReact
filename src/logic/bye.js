// Bye assignment — selects which player gets the bye in odd-player rounds.
// Pure functions; no DOM, no localStorage, no side effects.
//
// What it does:
//   1. Scans completed rounds to find who has already received a bye
//   2. Assigns the bye to the lowest-ranked player who hasn't had one yet
//   3. If everyone has had a bye, assigns to the lowest-ranked player again

/**
 * Select which player receives a bye this round.
 *
 * @param {string[]} playerIds      - Active player IDs sorted by standings (best first).
 * @param {object[]} completedRounds - Completed round objects (to check prior byes).
 * @returns {string} Player ID that should receive the bye.
 */
export function selectByePlayer(playerIds, completedRounds) {
  const priorByeRecipients = new Set();
  for (const round of completedRounds) {
    for (const match of round.matches) {
      if (match.isBye) {
        priorByeRecipients.add(match.player1Id);
      }
    }
  }

  // Iterate from lowest-ranked to highest-ranked (end of array = weakest)
  for (let i = playerIds.length - 1; i >= 0; i--) {
    if (!priorByeRecipients.has(playerIds[i])) {
      return playerIds[i];
    }
  }

  // All players have already had a bye — assign to the lowest-ranked player again
  return playerIds[playerIds.length - 1];
}
