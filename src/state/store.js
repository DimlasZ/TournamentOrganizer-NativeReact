// Central state store — the only layer allowed to read/write AsyncStorage.
//
// What it does:
//   1. Loads and migrates saved state from AsyncStorage on boot (async)
//   2. Persists state to AsyncStorage after every update (fire-and-forget)
//   3. Notifies all subscribers after each state change

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEY } from '../constants.js';

let _state = null;
const _subscribers = [];

// Public API

/** Load state from AsyncStorage (call once at boot, must be awaited). */
export async function load() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      _state = _migrate(JSON.parse(raw));
    } else {
      _state = _freshState();
    }
  } catch {
    _state = _freshState();
  }
}

/** Returns the current state object (treat as read-only). */
export function getState() {
  return _state;
}

/**
 * Apply an updater function to state, persist to AsyncStorage (fire-and-forget),
 * then notify all subscribers synchronously.
 *
 * @param {(state: object) => object} updater - Pure function: old state → new state.
 */
export function setState(updater) {
  _state = updater(_state);
  // Persist asynchronously — don't block subscribers on I/O
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_state)).catch(e => {
    console.error('[store] Failed to persist state:', e);
  });
  for (const fn of _subscribers) fn(_state);
}

/**
 * Subscribe to state changes. Called after every setState.
 * @param {(state: object) => void} fn
 * @returns {() => void} Unsubscribe function.
 */
export function subscribe(fn) {
  _subscribers.push(fn);
  return () => {
    const idx = _subscribers.indexOf(fn);
    if (idx !== -1) _subscribers.splice(idx, 1);
  };
}

// Internal helpers

function _freshState() {
  return { players: [], tournament: null, pastTournaments: [] };
}

function _migrate(data) {
  if (!data || typeof data !== 'object') return _freshState();
  if (!Array.isArray(data.players)) data.players = [];
  if (!('tournament' in data)) data.tournament = null;
  if (!Array.isArray(data.pastTournaments)) data.pastTournaments = [];
  return data;
}
