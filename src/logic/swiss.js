// Swiss pairing algorithm — generates match pairings for each round.
// Pure functions; no DOM, no localStorage, no side effects.
//
// What it does:
//   1. Tracks prior matchups to avoid rematches
//   2. Uses backtracking to find a valid pairing (no rematches)
//   3. Falls back to greedy pairing if all options would be rematches
//   4. Provides Fisher-Yates shuffle for Round 1 random seating

/**
 * Build a Set of prior matchup keys like "idA|idB" (IDs sorted so order doesn't matter).
 * @param {object[]} completedRounds
 * @returns {Set<string>}
 */
export function buildPriorMatchups(completedRounds) {
  const matchups = new Set();
  for (const round of completedRounds) {
    for (const match of round.matches) {
      if (!match.isBye && match.player2Id) {
        const key = [match.player1Id, match.player2Id].sort().join('|');
        matchups.add(key);
      }
    }
  }
  return matchups;
}

/**
 * Check if two players have already played each other.
 * @param {string} idA
 * @param {string} idB
 * @param {Set<string>} priorMatchups
 * @returns {boolean}
 */
export function hasPlayed(idA, idB, priorMatchups) {
  return priorMatchups.has([idA, idB].sort().join('|'));
}

/**
 * Generate pairings for the next round.
 *
 * @param {string[]} playerIds  - Active player IDs sorted by standings (best first).
 *                                For round 1, pass in a pre-shuffled order.
 * @param {object[]} completedRounds - Array of completed round objects (for rematch avoidance).
 * @param {string|null} byePlayerId  - Player already assigned a bye this round (excluded).
 * @returns {{ player1Id: string, player2Id: string }[]}
 */
export function pairRound(playerIds, completedRounds, byePlayerId) {
  const priorMatchups = buildPriorMatchups(completedRounds);
  const playersToSchedule = byePlayerId
    ? playerIds.filter(id => id !== byePlayerId)
    : [...playerIds];

  // Round 1: fold pairing — seat 1 vs seat 5, 2 vs 6, etc.
  if (completedRounds.length === 0) {
    return _foldPair(playersToSchedule);
  }

  const pairs = _backtrackPair(playersToSchedule, priorMatchups);

  if (pairs === null) {
    // All possible pairings result in rematches — pair greedily as last resort.
    return _greedyPair(playersToSchedule);
  }
  return pairs;
}

/**
 * Recursive backtracking pairer.
 * Tries to pair the first unmatched player with each subsequent player,
 * skipping known rematches, backtracking if a downstream pairing fails.
 *
 * @param {string[]} players
 * @param {Set<string>} priorMatchups
 * @returns {{ player1Id, player2Id }[] | null}  null = no valid solution found
 */
function _backtrackPair(players, priorMatchups) {
  if (players.length === 0) return [];

  const [first, ...rest] = players;

  for (let i = 0; i < rest.length; i++) {
    const opponent = rest[i];
    if (!hasPlayed(first, opponent, priorMatchups)) {
      const remaining = rest.filter((_, idx) => idx !== i);
      const result = _backtrackPair(remaining, priorMatchups);
      if (result !== null) {
        return [{ player1Id: first, player2Id: opponent }, ...result];
      }
    }
  }

  return null; // No valid pairing found from this branch
}

/**
 * Fold pairing for Round 1: pair seat 1 vs seat N/2+1, seat 2 vs seat N/2+2, etc.
 * e.g. 8 players → 1v5, 2v6, 3v7, 4v8
 */
function _foldPair(players) {
  const half = Math.floor(players.length / 2);
  const pairs = [];
  for (let i = 0; i < half; i++) {
    pairs.push({ player1Id: players[i], player2Id: players[i + half] });
  }
  return pairs;
}

/**
 * Greedy fallback: pair sequentially, ignoring rematches.
 * Used only when every possible pairing would be a rematch.
 */
function _greedyPair(players) {
  const pairs = [];
  for (let i = 0; i < players.length - 1; i += 2) {
    pairs.push({ player1Id: players[i], player2Id: players[i + 1] });
  }
  return pairs;
}

/**
 * Shuffle an array in-place using Fisher-Yates. Returns the array.
 * Used for Round 1 random seating.
 * @param {any[]} arr
 * @returns {any[]}
 */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
