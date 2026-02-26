// App-wide constants — match points, tiebreaker floors, and seed player list.

export const STORAGE_KEY = 'tournament_organizer_state';

export const POINTS = {
  WIN: 3,
  DRAW: 1,
  LOSS: 0,
};

/** MTG Swiss tiebreaker floor values (never count below 33%) */
export const MIN_MATCH_WIN_PCT = 0.33;
export const MIN_GAME_WIN_PCT  = 0.33;

