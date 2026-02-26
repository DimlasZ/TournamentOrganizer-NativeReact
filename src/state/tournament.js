// Tournament lifecycle — state transitions for the active tournament.
// Calls store.setState; never touches the DOM.
//
// What it does:
//   1. Creates tournaments and manages the player list (add, drop)
//   2. Pairs rounds using swiss.js, assigns byes via bye.js
//   3. Accepts match results and closes completed rounds
//   4. Archives finished tournaments and supports reopening history

import { getState, setState } from './store.js';
import { computeStandings } from '../logic/standings.js';
import { selectByePlayer }  from '../logic/bye.js';
import { pairRound, shuffle } from '../logic/swiss.js';

// Queries

/** True if there is an active (unfinished) tournament in state. */
export function hasUnfinishedTournament() {
  const { tournament } = getState();
  return tournament !== null && tournament.status === 'active';
}

/** Returns the currently active round object, or null. */
export function getActiveRound() {
  const { tournament } = getState();
  if (!tournament) return null;
  return tournament.rounds.find(r => r.status === 'active') ?? null;
}

/** True if every match in the active round has a result (ready to close). */
export function isRoundComplete() {
  const round = getActiveRound();
  if (!round) return false;
  return round.matches.every(m => m.isBye || m.result !== null);
}

/**
 * True if the result for a given match can still be corrected.
 * Correction is only allowed while the round is still 'active'.
 */
export function canCorrectResult(matchId) {
  const round = getActiveRound();
  return round?.matches.some(m => m.id === matchId) ?? false;
}

// Tournament creation

/**
 * Create a new tournament.
 * @param {string[]} playerIds - IDs of players participating.
 * @param {string} [dateStr]   - Optional date string (YYYY-MM-DD). Defaults to today.
 */
export function createTournament(playerIds, dateStr) {
  if (!dateStr) {
    const d = new Date();
    dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  setState(state => {
    const archive = state.tournament?.status === 'complete'
      ? [state.tournament, ...(state.pastTournaments ?? [])]
      : (state.pastTournaments ?? []);
    return {
      ...state,
      pastTournaments: archive,
      tournament: {
        id:             _uuid(),
        dateStr,
        status:         'active',
        currentRound:   0,   // 0 = no round paired yet
        activePlayers:  [...playerIds],
        droppedPlayers: [],
        rounds:         [],
        seatingOrder:   [...playerIds],
      },
    };
  });
}


/** Re-randomise the seating order before Round 1 is paired. No-op once a round is active. */
export function reshuffleSeating() {
  const { tournament } = getState();
  if (!tournament || tournament.currentRound !== 0) return;
  setState(state => ({
    ...state,
    tournament: {
      ...state.tournament,
      seatingOrder: shuffle([...state.tournament.activePlayers]),
    },
  }));
}

// Round management

/**
 * Pair the next round and save it as an 'active' round in state.
 *
 * Round 1: players are shuffled randomly (Swiss rule: random first round).
 * Round 2+: players are sorted by current standings.
 *
 * Also handles bye assignment for odd player counts.
 */
export function pairNextRound() {
  const { tournament } = getState();
  if (!tournament || tournament.status !== 'active') return;

  const completedRounds = tournament.rounds.filter(r => r.status === 'complete');
  const nextRoundNumber = completedRounds.length + 1;

  // Determine player order
  let sortedPlayerIds;
  if (completedRounds.length === 0) {
    // Round 1: use the seating order the user confirmed (or reshuffled)
    sortedPlayerIds = [...(tournament.seatingOrder ?? tournament.activePlayers)];
  } else {
    // Round 2+: sort by standings (best first)
    const standings = computeStandings(tournament.activePlayers, completedRounds);
    sortedPlayerIds = standings.map(s => s.playerId);
  }

  // Assign bye if odd number of players
  let byePlayerId = null;
  if (sortedPlayerIds.length % 2 !== 0) {
    byePlayerId = selectByePlayer(sortedPlayerIds, completedRounds);
  }

  // Generate pairings
  const pairs = pairRound(sortedPlayerIds, completedRounds, byePlayerId);

  // Build match objects
  const matches = pairs.map(({ player1Id, player2Id }) => ({
    id: _uuid(),
    player1Id,
    player2Id,
    isBye: false,
    result: null,
  }));

  // Add bye match (auto-result: 2-0 win)
  if (byePlayerId) {
    matches.push({
      id:         _uuid(),
      player1Id:  byePlayerId,
      player2Id:  null,
      isBye:      true,
      result: {
        player1Wins: 2,
        player2Wins: 0,
        draws:       0,
        submittedAt: new Date().toISOString(),
        correctedAt: null,
      },
    });
  }

  setState(state => ({
    ...state,
    tournament: {
      ...state.tournament,
      currentRound: nextRoundNumber,
      rounds: [
        ...state.tournament.rounds,
        { roundNumber: nextRoundNumber, status: 'active', matches },
      ],
    },
  }));
}

/**
 * Swap two players between their respective pending (no-result) matches in the
 * active round. If either player is already in a match with a result, the swap
 * is a no-op.
 * @param {string} playerIdA
 * @param {string} playerIdB
 */
export function swapPlayers(playerIdA, playerIdB) {
  setState(state => {
    const rounds = state.tournament.rounds.map(round => {
      if (round.status !== 'active') return round;

      const matchA = round.matches.find(m =>
        (m.player1Id === playerIdA || m.player2Id === playerIdA) && !m.isBye && !m.result
      );
      const matchB = round.matches.find(m =>
        (m.player1Id === playerIdB || m.player2Id === playerIdB) && !m.isBye && !m.result
      );

      if (!matchA || !matchB || matchA.id === matchB.id) return round;

      const matches = round.matches.map(m => {
        if (m.id === matchA.id) {
          return {
            ...m,
            player1Id: m.player1Id === playerIdA ? playerIdB : m.player1Id,
            player2Id: m.player2Id === playerIdA ? playerIdB : m.player2Id,
          };
        }
        if (m.id === matchB.id) {
          return {
            ...m,
            player1Id: m.player1Id === playerIdB ? playerIdA : m.player1Id,
            player2Id: m.player2Id === playerIdB ? playerIdA : m.player2Id,
          };
        }
        return m;
      });

      return { ...round, matches };
    });

    return { ...state, tournament: { ...state.tournament, rounds } };
  });
}

/**
 * Reassign the bye to a different player in the active round.
 * The current bye recipient is placed into the match that newByePlayerId was in.
 * @param {string} newByePlayerId
 */
export function reassignBye(newByePlayerId) {
  setState(state => {
    const rounds = state.tournament.rounds.map(round => {
      if (round.status !== 'active') return round;

      const byeMatch = round.matches.find(m => m.isBye);
      if (!byeMatch) return round;

      const oldByePlayerId = byeMatch.player1Id;
      if (oldByePlayerId === newByePlayerId) return round;

      // Must swap with a pending (no result) non-bye match
      const targetMatch = round.matches.find(m =>
        !m.isBye && !m.result &&
        (m.player1Id === newByePlayerId || m.player2Id === newByePlayerId)
      );
      if (!targetMatch) return round;

      const matches = round.matches.map(m => {
        if (m.isBye) {
          return { ...m, player1Id: newByePlayerId };
        }
        if (m.id === targetMatch.id) {
          return {
            ...m,
            player1Id: m.player1Id === newByePlayerId ? oldByePlayerId : m.player1Id,
            player2Id: m.player2Id === newByePlayerId ? oldByePlayerId : m.player2Id,
          };
        }
        return m;
      });

      return { ...round, matches };
    });

    return { ...state, tournament: { ...state.tournament, rounds } };
  });
}

/**
 * Re-pair the current active round using updated standings, but only if no
 * results have been entered yet. Safe to call after editing a historical result.
 */
export function repairActiveRound() {
  const { tournament } = getState();
  if (!tournament) return;
  const activeRound = tournament.rounds.find(r => r.status === 'active');
  if (!activeRound) return;

  const anyResult = activeRound.matches.some(m => m.result !== null && !m.isBye);
  if (anyResult) return; // Don't discard results already entered

  const completedCount = tournament.rounds.filter(r => r.status === 'complete').length;
  setState(state => ({
    ...state,
    tournament: {
      ...state.tournament,
      currentRound: completedCount,
      rounds: state.tournament.rounds.filter(r => r.status !== 'active'),
    },
  }));
  pairNextRound();
}

/**
 * Re-pair the current active round (Round 1 only, before any results are submitted).
 * Generates a new random seating and re-rolls pairings.
 */
export function repairRound1() {
  const { tournament } = getState();
  if (!tournament) return;
  const activeRound = tournament.rounds.find(r => r.status === 'active');
  if (!activeRound || activeRound.roundNumber !== 1) return;
  const anyResult = activeRound.matches.some(m => m.result !== null && !m.isBye);
  if (anyResult) return; // Can't re-pair once results are being entered

  // Remove the current active round and re-pair
  setState(state => ({
    ...state,
    tournament: {
      ...state.tournament,
      currentRound: 0,
      rounds: state.tournament.rounds.filter(r => r.status !== 'active'),
    },
  }));
  pairNextRound();
}

// Result submission

/**
 * Submit (or update) a match result.
 * @param {string} matchId
 * @param {{ player1Wins: number, player2Wins: number, draws: number }} result
 */
export function submitResult(matchId, result) {
  setState(state => ({
    ...state,
    tournament: {
      ...state.tournament,
      rounds: state.tournament.rounds.map(round => ({
        ...round,
        matches: round.matches.map(match =>
          match.id === matchId
            ? {
                ...match,
                result: {
                  ...result,
                  submittedAt: match.result?.submittedAt ?? new Date().toISOString(),
                  correctedAt: match.result ? new Date().toISOString() : null,
                },
              }
            : match
        ),
      })),
    },
  }));
}

// Round completion

/**
 * Close the active round (mark it 'complete').
 * Returns false if any match is still missing a result.
 * @returns {boolean}
 */
export function completeCurrentRound() {
  const round = getActiveRound();
  if (!round) return false;
  if (!isRoundComplete()) return false;

  setState(state => ({
    ...state,
    tournament: {
      ...state.tournament,
      rounds: state.tournament.rounds.map(r =>
        r.roundNumber === round.roundNumber ? { ...r, status: 'complete' } : r
      ),
    },
  }));
  return true;
}

// Tournament completion / abandonment

/** Mark tournament as finished (no more rounds). */
export function finishTournament() {
  setState(state => ({
    ...state,
    tournament: { ...state.tournament, status: 'complete' },
  }));
}

/** Discard the current tournament entirely (cannot be undone). */
export function abandonTournament() {
  setState(state => ({ ...state, tournament: null }));
}

// Player management during a tournament

/** Add a late arrival to the active player list. */
export function addLateArrival(playerId) {
  setState(state => ({
    ...state,
    tournament: {
      ...state.tournament,
      activePlayers: [...state.tournament.activePlayers, playerId],
    },
  }));
}

/** Drop a player from the tournament (they won't appear in future pairings). */
export function dropPlayer(playerId) {
  setState(state => ({
    ...state,
    tournament: {
      ...state.tournament,
      activePlayers:  state.tournament.activePlayers.filter(id => id !== playerId),
      droppedPlayers: [...state.tournament.droppedPlayers, playerId],
    },
  }));
}

// Tournament history

/**
 * Reopen the current completed tournament (already in state.tournament).
 * No-op if there is no completed tournament in the active slot.
 */
export function reopenCurrentTournament() {
  setState(state => {
    if (state.tournament?.status !== 'complete') return state;
    return { ...state, tournament: { ...state.tournament, status: 'active' } };
  });
}

/**
 * Move a past tournament back to the active slot for corrections.
 * No-op if a tournament is currently active or in-progress.
 * @param {string} tournamentId
 */
export function reopenTournament(tournamentId) {
  setState(state => {
    if (state.tournament?.status === 'active') return state;
    const idx = (state.pastTournaments ?? []).findIndex(t => t.id === tournamentId);
    if (idx === -1) return state;
    const toReopen = state.pastTournaments[idx];
    const remaining = state.pastTournaments.filter((_, i) => i !== idx);
    // If there's a finished tournament in the active slot, push it back to history
    const newPast = state.tournament
      ? [state.tournament, ...remaining]
      : remaining;
    return {
      ...state,
      tournament: { ...toReopen, status: 'active' },
      pastTournaments: newPast,
    };
  });
}

/**
 * Permanently remove a tournament from history.
 * @param {string} tournamentId
 */
export function deleteHistoryEntry(tournamentId) {
  setState(state => ({
    ...state,
    pastTournaments: (state.pastTournaments ?? []).filter(t => t.id !== tournamentId),
  }));
}

// Internal

function _uuid() {
  return crypto.randomUUID();
}
