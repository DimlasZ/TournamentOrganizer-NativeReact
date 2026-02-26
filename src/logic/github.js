// GitHub export — pushes a CSV file to DimlasZ/TournamentOrganizer/results/
// Uses the GitHub Contents API with a stored PAT.

const REPO_OWNER  = 'DimlasZ';
const REPO_NAME   = 'TournamentOrganizer';
const RESULTS_DIR = 'results';
const TOKEN_KEY   = 'gh_pat';

/**
 * Push csvContent to results/{filename} in the repo.
 * Prompts for a PAT on first use (or after auth failure) and remembers it.
 *
 * @param {string} filename - e.g. "2026_02_18_matches.csv"
 * @param {string} csvContent
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function pushResultsToGitHub(filename, csvContent) {
  let token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    token = prompt('Enter your GitHub Personal Access Token (needs repo write access):');
    if (!token?.trim()) return { ok: false, message: 'No token provided.' };
    token = token.trim();
    localStorage.setItem(TOKEN_KEY, token);
  }

  const path = `${RESULTS_DIR}/${filename}`;
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
  const content = btoa(unescape(encodeURIComponent(csvContent)));

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
      localStorage.removeItem(TOKEN_KEY);
      return { ok: false, message: 'Invalid token — it has been cleared. Try again.' };
    }
  } catch {
    return { ok: false, message: 'Network error while checking file.' };
  }

  // Create or update the file
  const body = {
    message: `Add results ${filename}`,
    content,
    ...(sha ? { sha } : {}),
  };

  try {
    const res = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      return { ok: false, message: 'Invalid token — it has been cleared. Try again.' };
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
