/** Every Tikkaat storage key starts with this (including tikkaat:theme and tikkaat:color). */
export const STORAGE_PREFIX = 'tikkaat:';

export const STORAGE_KEYS = {
  /** The single builder draft saved by earlier versions; migrated into the draft list on load. */
  legacyDraft: 'tikkaat:draft',
  /** List of saved draft summaries. */
  drafts: 'tikkaat:drafts',
  /** Id of the draft open in the builder. */
  currentDraft: 'tikkaat:currentDraft',
  /** One draft's content. */
  draft: (id: string) => `tikkaat:draft:${id}`,
  /** The single active puzzle saved by earlier versions; migrated into the saved games list on load. */
  legacyActive: 'tikkaat:active',
  /** List of saved games. */
  games: 'tikkaat:games',
  /** One saved game's original puzzle source. */
  game: (puzzleId: string) => `tikkaat:game:${puzzleId}`,
  /** Progress for a puzzle, keyed by its puzzle id (a hash of its share string; see gamesStore). */
  progress: (puzzleId: string) => `tikkaat:progress:${puzzleId}`,
} as const;

// Every helper takes an optional Storage (for tests) and falls back to localStorage. Accessing
// localStorage can itself throw (blocked storage), so it's only touched inside try.

export function readStorage(key: string, storage?: Storage): unknown {
  try {
    const raw = (storage ?? localStorage).getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: unknown, storage?: Storage): void {
  try {
    (storage ?? localStorage).setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable or full; the app keeps working without it.
  }
}

export function removeStorage(key: string, storage?: Storage): void {
  try {
    (storage ?? localStorage).removeItem(key);
  } catch {
    // Storage unavailable.
  }
}

/** Removes every key starting with `prefix`. */
export function removeKeysWithPrefix(prefix: string, storage?: Storage): void {
  try {
    const target = storage ?? localStorage;
    const keys: string[] = [];
    for (let i = 0; i < target.length; i++) {
      const key = target.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((key) => target.removeItem(key));
  } catch {
    // Storage unavailable.
  }
}

/**
 * Removes every Tikkaat key and nothing else. Never use localStorage.clear(): GitHub Pages
 * project sites share one origin per user, so other sites' data lives in the same storage.
 */
export function clearSiteData(storage?: Storage): void {
  removeKeysWithPrefix(STORAGE_PREFIX, storage);
}
