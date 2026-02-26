// GitHub export — pushes a CSV file to DimlasZ/TournamentOrganizer/results/
// Uses the GitHub Contents API with a stored PAT.
//
// Token storage is handled here via AsyncStorage.
// Token prompting (UI) is handled by the calling screen.

import AsyncStorage from '@react-native-async-storage/async-storage';

const REPO_OWNER  = 'DimlasZ';
const REPO_NAME   = 'TournamentOrganizer';
const RESULTS_DIR = 'results';
const TOKEN_KEY   = 'gh_pat';

/** Returns the stored PAT, or null if none is saved. */
export async function getStoredToken() {
  return await AsyncStorage.getItem(TOKEN_KEY);
}

/** Save a PAT to storage. */
export async function setStoredToken(token) {
  await AsyncStorage.setItem(TOKEN_KEY, token.trim());
}

/** Clear the stored PAT (e.g. after auth failure). */
export async function clearStoredToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

/**
 * Push csvContent to results/{filename} in the repo.
 * The caller is responsible for providing a valid token.
 *
 * @param {string} filename   - e.g. "2026_02_18_matches.csv"
 * @param {string} csvContent
 * @param {string} token      - GitHub PAT with repo write access
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function pushResultsToGitHub(filename, csvContent, token) {
  if (!token?.trim()) return { ok: false, message: 'No token provided.' };

  const path   = `${RESULTS_DIR}/${filename}`;
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
  const bytes = new TextEncoder().encode(csvContent);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  const content = btoa(binary);

  // Check if file already exists (need its SHA to update)
  let sha;
  try {
    const check = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (check.ok) {
      const data = await check.json();
      sha = data.sha;
    } else if (check.status === 401) {
      await clearStoredToken();
      return { ok: false, message: 'Invalid token — cleared. Enter it again.' };
    }
  } catch {
    return { ok: false, message: 'Network error while checking file.' };
  }

  // Create or update the file
  try {
    const res = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Add results ${filename}`,
        content,
        ...(sha ? { sha } : {}),
      }),
    });

    if (res.status === 401) {
      await clearStoredToken();
      return { ok: false, message: 'Invalid token — cleared. Enter it again.' };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, message: err.message ?? `GitHub error ${res.status}` };
    }
    return { ok: true, message: `Saved to results/${filename}` };
  } catch {
    return { ok: false, message: 'Network error while uploading.' };
  }
}
