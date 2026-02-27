// Player master list — CRUD operations for the global player list.
// Calls store.setState; never touches the DOM.
//
// What it does:
//   1. Fetches the player list from the ManaCore CSV on every launch
//   2. Merges new players into the local list (never removes existing ones)
//   3. Add, rename, and delete players by ID

import { getState, setState } from './store.js';

const PLAYERS_CSV_URL =
  'https://raw.githubusercontent.com/GuySchnidrig/ManaCore/main/data/processed/players.csv';

// Boot

/**
 * Fetch the remote CSV and merge any new players into the local list.
 * Silently falls back to the existing list if the fetch fails.
 */
export async function initPlayers() {
  try {
    const res = await fetch(PLAYERS_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const names = _parseCSV(text);

    const existing = new Set(getState().players.map(p => p.name.toLowerCase()));
    const toAdd = names.filter(n => !existing.has(n.toLowerCase()));

    if (toAdd.length > 0) {
      setState(state => ({
        ...state,
        players: [
          ...state.players,
          ...toAdd.map(name => ({ id: _uuid(), name, active: true })),
        ],
      }));
    }
  } catch (err) {
    console.warn('[players] Could not fetch remote player list:', err);
  }
}

// CRUD

/** Add a new player to the master list. */
export function addPlayer(name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  setState(state => ({
    ...state,
    players: [...state.players, { id: _uuid(), name: trimmed, active: true }],
  }));
}

/**
 * Edit a player's name. Safe to do mid-tournament — historical results
 * are stored by player ID, not by name, so old data is unaffected.
 */
export function editPlayer(id, newName) {
  const trimmed = newName.trim();
  if (!trimmed) return;
  setState(state => ({
    ...state,
    players: state.players.map(p =>
      p.id === id ? { ...p, name: trimmed } : p
    ),
  }));
}

/** Remove a player from the master list. */
export function deletePlayer(id) {
  setState(state => ({
    ...state,
    players: state.players.filter(p => p.id !== id),
  }));
}

// Internal helpers

function _parseCSV(text) {
  const lines = text.trim().split('\n');
  // Skip header row, extract second column, filter "Missing Player" and blanks
  return lines
    .slice(1)
    .map(line => line.split(',')[1]?.trim())
    .filter(name => name && name !== 'Missing Player');
}

function _uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
