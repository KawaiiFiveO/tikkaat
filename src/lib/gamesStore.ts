import { createProgress, hasProgress, restoreProgress, type GameProgress } from './game';
import { isRecord, isString } from './guards';
import { hashString } from './hash';
import { loadFileJson, loadShareString, toSaveFile, type LoadedPuzzle, type PuzzleSource } from './serialize';
import { readStorage, removeKeysWithPrefix, removeStorage, STORAGE_KEYS, writeStorage } from './storage';
import type { Puzzle } from './types';

/**
 * Saved games in localStorage:
 *   tikkaat:games        list of GameEntry, most recently played first
 *   tikkaat:game:<id>    the puzzle's original source ({ json, code?, fileName? }), never re-serialized
 *   tikkaat:progress:<id>  the player's progress (see Player)
 * <id> is puzzleId(): a hash of the canonical save-file JSON, so every way of opening the same
 * puzzle (link, code, file) shares one entry and one progress record.
 *
 * A game is "started" once the player solves a rung, uses a hint, or saves it for later (see
 * markGameStarted), and stays started after a reset. Only the most recently played game may be unstarted (it's on the Continue
 * card). Recording a new game prunes any other unstarted game, so peeked-at puzzles don't pile up.
 * Every function takes an optional Storage for tests.
 */

export interface GameEntry {
  id: string;
  title: string;
  startWord: string;
  endWord: string;
  /** ISO timestamp of when the game was last opened. */
  lastPlayed: string;
  /** Present (true) once the player has solved a rung, used a hint, or saved the game for later; kept even after a reset. */
  started?: true;
}

export interface SavedGame extends LoadedPuzzle {
  id: string;
  lastPlayed: string;
  started: boolean;
  progress: GameProgress;
}

/** Whether a game belongs in the saved games list: started at some point, or has progress now. */
export function isKeptGame(game: SavedGame): boolean {
  return game.started || hasProgress(game.progress);
}

export function puzzleId(puzzle: Puzzle): string {
  return hashString(JSON.stringify(toSaveFile(puzzle)));
}

function codeOpens(code: string, puzzle: Puzzle): boolean {
  try {
    return puzzleId(loadShareString(code).puzzle) === puzzleId(puzzle);
  } catch {
    return false;
  }
}

/**
 * Loads a puzzle from its stored original source, or null if it no longer parses. A stored share
 * code that doesn't open the puzzle (e.g. one in an older code format) is dropped from the source.
 */
export function loadSource(source: PuzzleSource): LoadedPuzzle | null {
  let puzzle: Puzzle;
  try {
    puzzle = loadFileJson(source.json).puzzle;
  } catch {
    return null;
  }
  if (source.code === undefined || codeOpens(source.code, puzzle)) return { puzzle, source };
  const withoutCode: PuzzleSource = { json: source.json };
  if (source.fileName !== undefined) withoutCode.fileName = source.fileName;
  return { puzzle, source: withoutCode };
}

function sourceShape(raw: unknown): PuzzleSource | null {
  if (!isRecord(raw) || !isString(raw.json)) return null;
  const { json, code, fileName } = raw;
  if ((code !== undefined && !isString(code)) || (fileName !== undefined && !isString(fileName))) return null;
  const source: PuzzleSource = { json };
  if (code !== undefined) source.code = code;
  if (fileName !== undefined) source.fileName = fileName;
  return source;
}

/** Validates a stored puzzle source: the right shape, and its puzzle still loads (see loadSource). */
export function restoreSource(raw: unknown): PuzzleSource | null {
  const source = sourceShape(raw);
  return (source && loadSource(source)?.source) ?? null;
}

function isEntry(value: unknown): value is GameEntry {
  return (
    isRecord(value) &&
    [value.id, value.title, value.startWord, value.endWord, value.lastPlayed].every(isString) &&
    value.id !== '' &&
    (value.started === undefined || value.started === true)
  );
}

function sortByRecent(entries: GameEntry[]): GameEntry[] {
  return [...entries].sort((a, b) => b.lastPlayed.localeCompare(a.lastPlayed));
}

function readEntries(storage?: Storage): GameEntry[] {
  const raw = readStorage(STORAGE_KEYS.games, storage);
  return Array.isArray(raw) ? sortByRecent(raw.filter(isEntry)) : [];
}

function writeEntries(entries: GameEntry[], storage?: Storage): GameEntry[] {
  const sorted = sortByRecent(entries);
  writeStorage(STORAGE_KEYS.games, sorted, storage);
  return sorted;
}

/** The player's saved progress on a puzzle, or fresh progress. */
export function loadProgress(puzzle: Puzzle, storage?: Storage): GameProgress {
  return restoreProgress(readStorage(STORAGE_KEYS.progress(puzzleId(puzzle)), storage), puzzle) ?? createProgress(puzzle);
}

function loadEntry(entry: GameEntry, storage?: Storage): SavedGame | null {
  const source = sourceShape(readStorage(STORAGE_KEYS.game(entry.id), storage));
  const loaded = source && loadSource(source);
  if (!loaded) return null;
  return {
    ...loaded,
    id: entry.id,
    lastPlayed: entry.lastPlayed,
    started: entry.started === true,
    progress: loadProgress(loaded.puzzle, storage),
  };
}

/** Every saved game that still loads, most recently played first. */
export function listSavedGames(storage?: Storage): SavedGame[] {
  return readEntries(storage)
    .map((entry) => loadEntry(entry, storage))
    .filter((game): game is SavedGame => game !== null);
}

function forgetGame(id: string, storage?: Storage): void {
  removeStorage(STORAGE_KEYS.game(id), storage);
  removeStorage(STORAGE_KEYS.progress(id), storage);
}

/**
 * Records an opened shared puzzle as the most recently played game (storing its original
 * source) and prunes any other unstarted game. Returns the updated list.
 */
export function recordGamePlayed(loaded: LoadedPuzzle, storage?: Storage, now: Date = new Date()): GameEntry[] {
  const id = puzzleId(loaded.puzzle);
  const entries = readEntries(storage);
  const others: GameEntry[] = [];
  for (const entry of entries) {
    if (entry.id === id) continue;
    const game = loadEntry(entry, storage);
    if (game && isKeptGame(game)) others.push(entry);
    else forgetGame(entry.id, storage);
  }
  writeStorage(STORAGE_KEYS.game(id), loaded.source, storage);
  const { puzzle } = loaded;
  // Keep an existing started mark; progress saved before the mark existed also counts.
  const started =
    entries.some((entry) => entry.id === id && entry.started) || hasProgress(loadProgress(puzzle, storage));
  const entry: GameEntry = {
    id,
    title: puzzle.metadata.title,
    startWord: puzzle.startWord,
    endWord: puzzle.endWord,
    lastPlayed: now.toISOString(),
    ...(started ? { started: true as const } : {}),
  };
  return writeEntries([entry, ...others], storage);
}

/** Whether a listed game is marked as started, so it's kept in the saved games list. */
export function isGameStarted(id: string, storage?: Storage): boolean {
  return readEntries(storage).some((entry) => entry.id === id && entry.started);
}

/**
 * Marks a saved game as started (called when the player solves a rung, uses a hint, or saves the
 * game for later), so it stays in the list even after a reset. Returns the updated list, or null
 * if nothing changed.
 */
export function markGameStarted(id: string, storage?: Storage): GameEntry[] | null {
  const entries = readEntries(storage);
  const entry = entries.find((candidate) => candidate.id === id);
  if (!entry || entry.started) return null;
  return writeEntries(
    entries.map((candidate) => (candidate.id === id ? { ...candidate, started: true as const } : candidate)),
    storage,
  );
}

/** Deletes a saved game and its progress. */
export function deleteGame(id: string, storage?: Storage): GameEntry[] {
  forgetGame(id, storage);
  return writeEntries(
    readEntries(storage).filter((entry) => entry.id !== id),
    storage,
  );
}

/** Deletes every saved game and all puzzle progress (including progress with no saved game). */
export function deleteAllGames(storage?: Storage): void {
  removeKeysWithPrefix(STORAGE_KEYS.game(''), storage);
  removeKeysWithPrefix(STORAGE_KEYS.progress(''), storage);
  removeStorage(STORAGE_KEYS.games, storage);
  removeStorage(STORAGE_KEYS.legacyActive, storage);
}

/**
 * When a share link opens a puzzle that's already saved, use the stored original source
 * (e.g. reloading a puzzle opened from a file keeps its original file).
 */
export function preferStoredSource(loaded: LoadedPuzzle, storage?: Storage): LoadedPuzzle {
  const id = puzzleId(loaded.puzzle);
  const source = sourceShape(readStorage(STORAGE_KEYS.game(id), storage));
  const stored = source && loadSource(source);
  return stored && puzzleId(stored.puzzle) === id ? stored : loaded;
}

/**
 * Moves saved games stored under an id from an older puzzleId (earlier versions hashed the share
 * code) to their current id, along with their source and progress.
 */
function migrateGameIds(storage?: Storage): void {
  const entries = readEntries(storage);
  const migrated: GameEntry[] = [];
  let changed = false;
  for (const entry of entries) {
    const source = sourceShape(readStorage(STORAGE_KEYS.game(entry.id), storage));
    const loaded = source && loadSource(source);
    const id = loaded ? puzzleId(loaded.puzzle) : entry.id;
    if (!loaded || id === entry.id) {
      migrated.push(entry);
      continue;
    }
    changed = true;
    const progress = readStorage(STORAGE_KEYS.progress(entry.id), storage);
    forgetGame(entry.id, storage);
    // The same puzzle is already saved under its current id.
    if ([...entries, ...migrated].some((other) => other.id === id)) continue;
    writeStorage(STORAGE_KEYS.game(id), loaded.source, storage);
    if (progress !== null) writeStorage(STORAGE_KEYS.progress(id), progress, storage);
    migrated.push({ ...entry, id });
  }
  if (changed) writeEntries(migrated, storage);
}

/**
 * Loads the saved games list, first moving games saved under older ids and the single active
 * puzzle saved by earlier versions.
 */
export function openSavedGames(storage?: Storage, now: Date = new Date()): GameEntry[] {
  migrateGameIds(storage);
  const legacy = readStorage(STORAGE_KEYS.legacyActive, storage);
  if (legacy !== null) {
    removeStorage(STORAGE_KEYS.legacyActive, storage);
    const source = sourceShape(legacy);
    const loaded = source && loadSource(source);
    if (loaded && !readEntries(storage).some((entry) => entry.id === puzzleId(loaded.puzzle))) {
      recordGamePlayed(loaded, storage, now);
    }
  }
  return readEntries(storage);
}
