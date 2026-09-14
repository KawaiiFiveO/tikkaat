import { describe, expect, it } from 'vitest';
import { EXAMPLE_PUZZLE } from './examplePuzzle';
import { applyHint, createProgress } from './game';
import {
  deleteAllGames,
  deleteGame,
  isGameStarted,
  isKeptGame,
  listSavedGames,
  markGameStarted,
  openSavedGames,
  preferStoredSource,
  puzzleId,
  recordGamePlayed,
  restoreSource,
} from './gamesStore';
import { hashString } from './hash';
import { loadFileJson, loadShareString, sourceFromPuzzle, toSaveFile, toShareString } from './serialize';
import { STORAGE_KEYS, writeStorage } from './storage';
import { createMemoryStorage, storageKeys } from './testUtils';
import type { Puzzle } from './types';
import { normalizePuzzle } from './validate';

const T1 = new Date('2026-09-01T10:00:00.000Z');
const T2 = new Date('2026-09-02T10:00:00.000Z');
const T3 = new Date('2026-09-03T10:00:00.000Z');

function titled(title: string): Puzzle {
  return normalizePuzzle({ ...EXAMPLE_PUZZLE, metadata: { ...EXAMPLE_PUZZLE.metadata, title } });
}

const A = titled('Ladder A');
const B = titled('Ladder B');
const C = titled('Ladder C');
const opened = (puzzle: Puzzle) => ({ puzzle, source: sourceFromPuzzle(puzzle) });
const fileText = `${JSON.stringify(toSaveFile(EXAMPLE_PUZZLE), null, 4)}\n`;

function addProgress(puzzle: Puzzle, storage: Storage): void {
  writeStorage(STORAGE_KEYS.progress(puzzleId(puzzle)), applyHint(createProgress(puzzle)), storage);
}

function titles(storage: Storage): string[] {
  return listSavedGames(storage).map((game) => game.puzzle.metadata.title);
}

describe('puzzleId', () => {
  it('is a hash of the canonical save-file JSON', () => {
    expect(STORAGE_KEYS.progress(puzzleId(A))).toBe(`tikkaat:progress:${hashString(JSON.stringify(toSaveFile(A)))}`);
  });

  it('is the same however the puzzle was opened', () => {
    expect(puzzleId(loadFileJson(fileText).puzzle)).toBe(puzzleId(loadShareString(toShareString(EXAMPLE_PUZZLE)).puzzle));
  });
});

describe('recordGamePlayed', () => {
  it('stores the original source and lists the game first', () => {
    const storage = createMemoryStorage();
    const loaded = loadFileJson(fileText, 'ladder.json');
    const entries = recordGamePlayed(loaded, storage, T1);
    expect(entries).toEqual([
      { id: puzzleId(loaded.puzzle), title: 'From HIT to COG', startWord: 'HIT', endWord: 'COG', lastPlayed: T1.toISOString() },
    ]);
    expect(listSavedGames(storage)[0]?.source).toEqual(loaded.source);
  });

  it('moves a replayed game to the top without duplicating it', () => {
    const storage = createMemoryStorage();
    addProgress(A, storage);
    addProgress(B, storage);
    recordGamePlayed(opened(A), storage, T1);
    recordGamePlayed(opened(B), storage, T2);
    const entries = recordGamePlayed(opened(A), storage, T3);
    expect(entries.map((entry) => [entry.title, entry.lastPlayed])).toEqual([
      ['Ladder A', T3.toISOString()],
      ['Ladder B', T2.toISOString()],
    ]);
  });

  it('prunes other games without progress, along with their source and fresh progress', () => {
    const storage = createMemoryStorage();
    addProgress(C, storage);
    recordGamePlayed(opened(C), storage, T1);
    recordGamePlayed(opened(A), storage, T2); // opened but never played
    writeStorage(STORAGE_KEYS.progress(puzzleId(A)), createProgress(A), storage);

    recordGamePlayed(opened(B), storage, T3);
    expect(titles(storage)).toEqual(['Ladder B', 'Ladder C']);
    expect(storageKeys(storage).some((key) => key.endsWith(puzzleId(A)))).toBe(false);
  });
});

describe('started games', () => {
  it('keeps a started game in the list after a reset, even when another game is opened', () => {
    const storage = createMemoryStorage();
    recordGamePlayed(opened(A), storage, T1);
    addProgress(A, storage);
    markGameStarted(puzzleId(A), storage);
    writeStorage(STORAGE_KEYS.progress(puzzleId(A)), createProgress(A), storage); // Reset

    recordGamePlayed(opened(B), storage, T2);
    const gameA = listSavedGames(storage).find((game) => game.puzzle.metadata.title === 'Ladder A');
    expect(gameA?.started).toBe(true);
    expect(gameA && isKeptGame(gameA)).toBe(true);
    expect(gameA?.progress.solved.some(Boolean)).toBe(false);
  });

  it('keeps the started mark when a reset game is replayed', () => {
    const storage = createMemoryStorage();
    recordGamePlayed(opened(A), storage, T1);
    markGameStarted(puzzleId(A), storage);
    expect(recordGamePlayed(opened(A), storage, T2)[0]?.started).toBe(true);
  });

  it('counts progress saved before the started mark existed', () => {
    const storage = createMemoryStorage();
    addProgress(A, storage);
    expect(recordGamePlayed(opened(A), storage, T1)[0]?.started).toBe(true);
  });

  it('only marks listed, unstarted games', () => {
    const storage = createMemoryStorage();
    expect(markGameStarted('missing', storage)).toBeNull();
    recordGamePlayed(opened(A), storage, T1);
    expect(markGameStarted(puzzleId(A), storage)?.[0]?.started).toBe(true);
    expect(markGameStarted(puzzleId(A), storage)).toBeNull();
  });

  it('keeps a game saved for later without progress, even when another game is opened', () => {
    const storage = createMemoryStorage();
    recordGamePlayed(opened(A), storage, T1);
    expect(isGameStarted(puzzleId(A), storage)).toBe(false);
    markGameStarted(puzzleId(A), storage); // Save for later
    expect(isGameStarted(puzzleId(A), storage)).toBe(true);

    recordGamePlayed(opened(B), storage, T2);
    recordGamePlayed(opened(C), storage, T3);
    expect(titles(storage)).toEqual(['Ladder C', 'Ladder A']);
    expect(isGameStarted('missing', storage)).toBe(false);
  });

  it('treats an unstarted game without progress as not kept', () => {
    const storage = createMemoryStorage();
    recordGamePlayed(opened(A), storage, T1);
    const game = listSavedGames(storage)[0];
    expect(game && isKeptGame(game)).toBe(false);
  });
});

describe('listSavedGames', () => {
  it('includes progress, and skips games whose source no longer loads or malformed entries', () => {
    const storage = createMemoryStorage();
    addProgress(A, storage);
    addProgress(B, storage);
    recordGamePlayed(opened(A), storage, T1);
    recordGamePlayed(opened(B), storage, T2);

    storage.setItem(STORAGE_KEYS.game(puzzleId(A)), JSON.stringify({ json: '{not json' }));
    const index = JSON.parse(storage.getItem(STORAGE_KEYS.games) ?? '[]') as unknown[];
    storage.setItem(STORAGE_KEYS.games, JSON.stringify([...index, { id: 7 }, null]));

    const games = listSavedGames(storage);
    expect(games.map((game) => [game.puzzle.metadata.title, game.progress.hints[0]])).toEqual([['Ladder B', 1]]);
  });
});

describe('deleteGame and deleteAllGames', () => {
  it('deletes one game with its source and progress', () => {
    const storage = createMemoryStorage();
    addProgress(A, storage);
    addProgress(B, storage);
    recordGamePlayed(opened(A), storage, T1);
    recordGamePlayed(opened(B), storage, T2);

    expect(deleteGame(puzzleId(A), storage).map((entry) => entry.title)).toEqual(['Ladder B']);
    expect(storageKeys(storage).some((key) => key.endsWith(puzzleId(A)))).toBe(false);
  });

  it('deletes every game and all progress, leaving other data alone', () => {
    const storage = createMemoryStorage({
      [STORAGE_KEYS.progress('orphan')]: '{}',
      [STORAGE_KEYS.legacyActive]: '{}',
      [STORAGE_KEYS.drafts]: '[]',
      'tikkaat:theme': 'light',
    });
    addProgress(A, storage);
    recordGamePlayed(opened(A), storage, T1);

    deleteAllGames(storage);
    expect(storageKeys(storage)).toEqual([STORAGE_KEYS.drafts, 'tikkaat:theme']);
  });
});

describe('preferStoredSource', () => {
  it('keeps the stored original file when a link reopens the same puzzle', () => {
    const storage = createMemoryStorage();
    const fromFile = loadFileJson(fileText, 'ladder.json');
    recordGamePlayed(fromFile, storage, T1);
    const fromLink = loadShareString(toShareString(EXAMPLE_PUZZLE));
    expect(preferStoredSource(fromLink, storage).source).toEqual(fromFile.source);
  });

  it('uses the new source for a puzzle that isn’t saved', () => {
    const fromLink = loadShareString(toShareString(B));
    expect(preferStoredSource(fromLink, createMemoryStorage())).toBe(fromLink);
  });
});

describe('openSavedGames', () => {
  it('moves the active puzzle saved by earlier versions into the list', () => {
    const { source } = loadFileJson(fileText, 'ladder.json');
    const storage = createMemoryStorage({ [STORAGE_KEYS.legacyActive]: JSON.stringify(source) });
    const entries = openSavedGames(storage, T1);
    expect(entries.map((entry) => entry.title)).toEqual(['From HIT to COG']);
    expect(listSavedGames(storage)[0]?.source).toEqual(source);
    expect(storage.getItem(STORAGE_KEYS.legacyActive)).toBeNull();
  });

  it('moves games saved under an older id to the current id, keeping progress', () => {
    const { source } = loadShareString(toShareString(A));
    const storage = createMemoryStorage({
      [STORAGE_KEYS.games]: JSON.stringify([
        { id: 'old', title: 'Ladder A', startWord: 'HIT', endWord: 'COG', lastPlayed: T1.toISOString(), started: true },
      ]),
      [STORAGE_KEYS.game('old')]: JSON.stringify({ ...source, code: 'OldFormatCode123' }),
      [STORAGE_KEYS.progress('old')]: JSON.stringify(applyHint(createProgress(A))),
    });

    expect(openSavedGames(storage, T2).map((entry) => entry.id)).toEqual([puzzleId(A)]);
    const [game] = listSavedGames(storage);
    expect(game?.source).toEqual({ json: source.json });
    expect(game?.started).toBe(true);
    expect(game?.progress.hints[0]).toBe(1);
    expect(storageKeys(storage).some((key) => key.endsWith(':old'))).toBe(false);
  });

  it('drops a malformed legacy active puzzle', () => {
    const storage = createMemoryStorage({ [STORAGE_KEYS.legacyActive]: '{"json":"nope"}' });
    expect(openSavedGames(storage, T1)).toEqual([]);
    expect(storageKeys(storage)).toEqual([]);
  });
});

describe('restoreSource', () => {
  it('restores stored file and code sources unchanged', () => {
    const fromFile = loadFileJson(fileText, 'ladder.json').source;
    const fromCode = loadShareString(toShareString(EXAMPLE_PUZZLE)).source;
    expect(restoreSource(JSON.parse(JSON.stringify(fromFile)))).toEqual(fromFile);
    expect(restoreSource(JSON.parse(JSON.stringify(fromCode)))).toEqual(fromCode);
  });

  it('drops a stored code that no longer opens the puzzle', () => {
    const fromCode = loadShareString(toShareString(EXAMPLE_PUZZLE)).source;
    expect(restoreSource({ ...fromCode, code: 'OldFormatCode123' })).toEqual({ json: fromCode.json });
    expect(restoreSource({ ...fromCode, code: toShareString(B) })).toEqual({ json: fromCode.json });
  });

  it('rejects malformed or unparseable sources', () => {
    expect(restoreSource(null)).toBeNull();
    expect(restoreSource('abc')).toBeNull();
    expect(restoreSource({ code: 'abc' })).toBeNull();
    expect(restoreSource({ json: '{not json' })).toBeNull();
    expect(restoreSource({ json: fileText, fileName: 42 })).toBeNull();
  });
});
