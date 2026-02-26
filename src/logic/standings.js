// Standings — calculates player rankings from completed rounds.
// Pure functions; no DOM, no localStorage, no side effects.
//
// What it does:
//   1. Aggregates match/game results per player from completed rounds
//   2. Computes match win %, game win %, and opponent-based tiebreakers (OMW%, OGW%)
//   3. Returns players sorted by: Match Points → OMW% → GW% → OGW%
//      All percentages have a 33% floor (MTG rule).

import { POINTS, MIN_MATCH_WIN_PCT, MIN_GAME_WIN_PCT } from '../constants.js';

/**
 * Compute standings for all active players.
 *
 * @param {string[]} activePlayers - Array of active player IDs.
 * @param {object[]} rounds        - All round objects (completed or active).
 * @returns {object[]} Sorted standings array, best player first.
 *
 * Each entry:
 *   playerId, matchPoints, matchWins, matchLosses, matchDraws,
 *   gamesWon, gamesPlayed, hasBye, mwPct, gwPct, omwPct, ogwPct
 */
export function computeStandings(activePlayers, rounds) {
  const completedRounds = rounds.filter(r => r.status === 'complete');

  // Initialise stats per player
  const stats = {};
  for (const id of activePlayers) {
    stats[id] = {
      playerId:     id,
      matchesPlayed: 0,
      matchWins:    0,
      matchLosses:  0,
      matchDraws:   0,
      matchPoints:  0,
      gamesWon:     0,
      gamesLost:    0,
      gamesPlayed:  0,
      opponents:    [],   // excludes bye opponents
      hasBye:       false,
    };
  }

  // Accumulate results from completed rounds
  for (const round of completedRounds) {
    for (const match of round.matches) {
      if (match.isBye) {
        // Bye counts as 2-0 win; excluded from OMW% opponent list
        const s = stats[match.player1Id];
        if (!s) continue;
        s.matchesPlayed += 1;
        s.matchWins     += 1;
        s.matchPoints   += POINTS.WIN;
        s.gamesWon      += 2;
        s.gamesPlayed   += 2;
        s.hasBye         = true;
        continue;
      }

      if (!match.result) continue; // Result not yet submitted

      const { player1Wins, player2Wins, draws } = match.result;
      const totalGames = player1Wins + player2Wins + draws;

      const p1 = stats[match.player1Id];
      const p2 = stats[match.player2Id];
      if (!p1 || !p2) continue;

      // Accumulate games
      p1.matchesPlayed += 1;
      p1.gamesWon      += player1Wins;
      p1.gamesLost     += player2Wins;
      p1.gamesPlayed   += totalGames;
      p1.opponents.push(match.player2Id);

      p2.matchesPlayed += 1;
      p2.gamesWon      += player2Wins;
      p2.gamesLost     += player1Wins;
      p2.gamesPlayed   += totalGames;
      p2.opponents.push(match.player1Id);

      // Match outcome
      if (player1Wins > player2Wins) {
        p1.matchWins   += 1; p1.matchPoints += POINTS.WIN;
        p2.matchLosses += 1;
      } else if (player2Wins > player1Wins) {
        p2.matchWins   += 1; p2.matchPoints += POINTS.WIN;
        p1.matchLosses += 1;
      } else {
        p1.matchDraws  += 1; p1.matchPoints += POINTS.DRAW;
        p2.matchDraws  += 1; p2.matchPoints += POINTS.DRAW;
      }
    }
  }

  // First pass: compute individual win percentages
  const result = Object.values(stats).map(s => ({
    ...s,
    mwPct: _matchWinPct(s),
    gwPct: _gameWinPct(s),
    omwPct: 0,
    ogwPct: 0,
  }));

  // Build lookup by player ID for second pass
  const byId = Object.fromEntries(result.map(s => [s.playerId, s]));

  // Second pass: compute opponent-based tiebreakers
  for (const s of result) {
    s.omwPct = _omwPct(s, byId);
    s.ogwPct = _ogwPct(s, byId);
  }

  // Sort: matchPoints → OMW% → GW% → OGW%
  result.sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    if (Math.abs(b.omwPct - a.omwPct) > 1e-9) return b.omwPct - a.omwPct;
    if (Math.abs(b.gwPct  - a.gwPct)  > 1e-9) return b.gwPct  - a.gwPct;
    return b.ogwPct - a.ogwPct;
  });

  return result;
}

// Internal helpers

function _matchWinPct(s) {
  if (s.matchesPlayed === 0) return MIN_MATCH_WIN_PCT;
  return Math.max(s.matchPoints / (3 * s.matchesPlayed), MIN_MATCH_WIN_PCT);
}

function _gameWinPct(s) {
  if (s.gamesPlayed === 0) return MIN_GAME_WIN_PCT;
  return Math.max(s.gamesWon / s.gamesPlayed, MIN_GAME_WIN_PCT);
}

function _omwPct(s, byId) {
  // Byes are excluded from the opponent list, so they never factor into OMW%
  const pcts = s.opponents
    .filter(id => byId[id])
    .map(id => byId[id].mwPct);
  if (pcts.length === 0) return MIN_MATCH_WIN_PCT;
  return pcts.reduce((sum, v) => sum + v, 0) / pcts.length;
}

function _ogwPct(s, byId) {
  const pcts = s.opponents
    .filter(id => byId[id])
    .map(id => byId[id].gwPct);
  if (pcts.length === 0) return MIN_GAME_WIN_PCT;
  return pcts.reduce((sum, v) => sum + v, 0) / pcts.length;
}
