import { isRecord, isString } from './guards';
import { loadFileJson, toShareString, type LoadedPuzzle, type PuzzleSource } from './serialize';

/** Loads the active puzzle from its stored original source, or null if it no longer parses. */
export function loadActiveSource(source: PuzzleSource): LoadedPuzzle | null {
  try {
    return { puzzle: loadFileJson(source.json).puzzle, source };
  } catch {
    return null;
  }
}

/** Validates the active puzzle source read from storage. */
export function restoreActiveSource(raw: unknown): PuzzleSource | null {
  if (!isRecord(raw) || !isString(raw.json)) return null;
  const { json, code, fileName } = raw;
  if ((code !== undefined && !isString(code)) || (fileName !== undefined && !isString(fileName))) return null;
  const source: PuzzleSource = { json };
  if (code !== undefined) source.code = code;
  if (fileName !== undefined) source.fileName = fileName;
  return loadActiveSource(source) ? source : null;
}

/**
 * When a share link opens the same puzzle as the active one, keep the active puzzle's
 * original source (e.g. reloading a puzzle opened from a file keeps its original file).
 */
export function preferActiveSource(loaded: LoadedPuzzle, active: PuzzleSource | null): LoadedPuzzle {
  if (!active) return loaded;
  const current = loadActiveSource(active);
  return current && toShareString(current.puzzle) === toShareString(loaded.puzzle) ? current : loaded;
}
