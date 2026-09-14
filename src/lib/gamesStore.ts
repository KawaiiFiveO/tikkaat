import { createProgress, hasProgress, restoreProgress, type GameProgress } from './game';
import { isRecord, isString } from './guards';
import { hashString } from './hash';
import { loadFileJson, toShareString, type LoadedPuzzle, type PuzzleSource } from './serialize';
import { readStorage, removeKeysWithPrefix, removeStorage, STORAGE_KEYS, writeStorage } from './storage';
import type { Puzzle } from './types';

/**
 * Saved games in localStorage:
 *   tikkaat:games        list of GameEntry, most recently played first
 *   tikkaat:game:<id>    the puzzle's original source ({ json, code?, fileName? }), never re-serialized
 *   tikkaat:progress:<id>  the player's progress (see Player)
 * <id> is puzzleId(): a hash of the canonical share string, so every way of opening the same
 * puzzle (link, code, file) shares one entry and one progress record.
 *
 * Only the most recently played game may lack progress (it's on the Continue card). Recording a
 * new game prunes any other game without progress, so peeked-at puzzles don't pile up.
 * Every function takes an optional Storage for tests.
 */

export interface GameEntry {
  id: string;
  title: string;
  startWord: string;
  endWord: string;
  /** ISO timestamp of when the game was last opened. */
  lastPlayed: string;
}

export interface SavedGame extends LoadedPuzzle {
  id: string;
  lastPlayed: string;
  progress: GameProgress;
}

export function puzzleId(puzzle: Puzzle): string {
  return hashString(toShareString(puzzle));
}

/** Loads a puzzle from its stored original source, or null if it no longer parses. */
export function loadSource(source: PuzzleSource): LoadedPuzzle | null {
  try {
    return { puzzle: loadFileJson(source.json).puzzle, source };
  } catch {
    return null;
  }
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

/** Validates a stored puzzle source: the right shape, and its puzzle still loads. */
export function restoreSource(raw: unknown): PuzzleSource | null {
  const source = sourceShape(raw);
  return source && loadSource(source) ? source : null;
}

function isEntry(value: unknown): value is GameEntry {
  return (
    isRecord(value) &&
    [value.id, value.title, value.startWord, value.endWord, value.lastPlayed].every(isString) &&
    value.id !== ''
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
  return { ...loaded, id: entry.id, lastPlayed: entry.lastPlayed, progress: loadProgress(loaded.puzzle, storage) };
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
 * source) and prunes any other game without progress. Returns the updated list.
 */
export function recordGamePlayed(loaded: LoadedPuzzle, storage?: Storage, now: Date = new Date()): GameEntry[] {
  const id = puzzleId(loaded.puzzle);
  const others: GameEntry[] = [];
  for (const entry of readEntries(storage)) {
    if (entry.id === id) continue;
    const game = loadEntry(entry, storage);
    if (game && hasProgress(game.progress)) others.push(entry);
    else forgetGame(entry.id, storage);
  }
  writeStorage(STORAGE_KEYS.game(id), loaded.source, storage);
  const { puzzle } = loaded;
  const entry: GameEntry = {
    id,
    title: puzzle.metadata.title,
    startWord: puzzle.startWord,
    endWord: puzzle.endWord,
    lastPlayed: now.toISOString(),
  };
  return writeEntries([entry, ...others], storage);
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

/** Loads the saved games list, first moving in the single active puzzle saved by earlier versions. */
export function openSavedGames(storage?: Storage, now: Date = new Date()): GameEntry[] {
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
