import { describe, expect, it } from 'vitest';
import { createDraft, isDraftEmpty } from './draft';
import {
  deleteAllDrafts,
  deleteDraft,
  draftDisplayName,
  duplicateDraft,
  listDrafts,
  loadDraft,
  openInitialDraft,
  readCurrentDraftId,
  saveDraft,
  writeCurrentDraftId,
} from './draftStore';
import { EXAMPLE_PUZZLE } from './examplePuzzle';
import { STORAGE_KEYS } from './storage';
import { createMemoryStorage, storageKeys } from './testUtils';
import type { Puzzle } from './types';

const T1 = new Date('2026-09-01T10:00:00.000Z');
const T2 = new Date('2026-09-02T10:00:00.000Z');
const T3 = new Date('2026-09-03T10:00:00.000Z');

function withTitle(title: string): Puzzle {
  return { ...EXAMPLE_PUZZLE, metadata: { ...EXAMPLE_PUZZLE.metadata, title } };
}

describe('saveDraft and listDrafts', () => {
  it('stores a non-empty draft with its summary', () => {
    const storage = createMemoryStorage();
    const drafts = saveDraft('a', EXAMPLE_PUZZLE, storage, T1);
    expect(drafts).toEqual([
      { id: 'a', title: 'From HIT to COG', startWord: 'HIT', endWord: 'COG', updatedAt: T1.toISOString() },
    ]);
    expect(loadDraft('a', storage)).toEqual(EXAMPLE_PUZZLE);
    expect(listDrafts(storage)).toEqual(drafts);
  });

  it('never stores empty drafts, and removes a draft that becomes empty', () => {
    const storage = createMemoryStorage();
    expect(saveDraft('a', createDraft(T1), storage, T1)).toEqual([]);
    expect(storageKeys(storage)).toEqual([]);

    saveDraft('b', EXAMPLE_PUZZLE, storage, T1);
    expect(saveDraft('b', createDraft(T2), storage, T2)).toEqual([]);
    expect(loadDraft('b', storage)).toBeNull();
  });

  it("doesn't bump the edit time when the content is unchanged", () => {
    const storage = createMemoryStorage();
    saveDraft('a', EXAMPLE_PUZZLE, storage, T1);
    expect(saveDraft('a', structuredClone(EXAMPLE_PUZZLE), storage, T2)[0]?.updatedAt).toBe(T1.toISOString());
    expect(saveDraft('a', withTitle('Changed'), storage, T3)[0]?.updatedAt).toBe(T3.toISOString());
  });

  it('lists the most recently edited first and ignores malformed entries', () => {
    const storage = createMemoryStorage();
    saveDraft('old', withTitle('Old'), storage, T1);
    saveDraft('new', withTitle('New'), storage, T2);
    const raw = JSON.parse(storage.getItem(STORAGE_KEYS.drafts) ?? '[]') as unknown[];
    storage.setItem(STORAGE_KEYS.drafts, JSON.stringify([...raw, { id: 42 }, null, 'x']));
    expect(listDrafts(storage).map((summary) => summary.id)).toEqual(['new', 'old']);
  });
});

describe('duplicateDraft, deleteDraft, deleteAllDrafts', () => {
  it('duplicates under a new id with a "(copy)" title and a new creation date', () => {
    const storage = createMemoryStorage();
    saveDraft('a', EXAMPLE_PUZZLE, storage, T1);
    const result = duplicateDraft('a', storage, T2);
    expect(result).not.toBeNull();
    expect(result?.id).not.toBe('a');
    const copy = loadDraft(result?.id ?? '', storage);
    expect(copy?.metadata.title).toBe('From HIT to COG (copy)');
    expect(copy?.metadata.dateCreated).toBe(T2.toISOString());
    expect(copy?.rungs).toEqual(EXAMPLE_PUZZLE.rungs);
    expect(result?.drafts.map((summary) => summary.id)).toEqual([result?.id, 'a']);
    expect(duplicateDraft('missing', storage, T2)).toBeNull();
  });

  it('keeps the title unchanged when "(copy)" would exceed the limit', () => {
    const storage = createMemoryStorage();
    const long = 'x'.repeat(58);
    saveDraft('a', withTitle(long), storage, T1);
    const result = duplicateDraft('a', storage, T2);
    expect(loadDraft(result?.id ?? '', storage)?.metadata.title).toBe(long);
  });

  it('deletes one draft, or all drafts, leaving other data alone', () => {
    const storage = createMemoryStorage({ 'tikkaat:theme': 'light' });
    saveDraft('a', withTitle('A'), storage, T1);
    saveDraft('b', withTitle('B'), storage, T2);
    writeCurrentDraftId('b', storage);
    storage.setItem(STORAGE_KEYS.draft('orphan'), '{}');

    expect(deleteDraft('a', storage).map((summary) => summary.id)).toEqual(['b']);
    expect(loadDraft('a', storage)).toBeNull();

    deleteAllDrafts(storage);
    expect(storageKeys(storage)).toEqual(['tikkaat:theme']);
  });
});

describe('openInitialDraft', () => {
  it('migrates the single draft saved by earlier versions', () => {
    const storage = createMemoryStorage({ [STORAGE_KEYS.legacyDraft]: JSON.stringify(EXAMPLE_PUZZLE) });
    const { id, draft, drafts } = openInitialDraft(storage, T1);
    expect(draft).toEqual(EXAMPLE_PUZZLE);
    expect(drafts.map((summary) => summary.id)).toEqual([id]);
    expect(readCurrentDraftId(storage)).toBe(id);
    expect(storage.getItem(STORAGE_KEYS.legacyDraft)).toBeNull();
  });

  it('drops an empty or malformed legacy draft', () => {
    for (const legacy of [JSON.stringify(createDraft(T1)), '{"not":"a draft"}']) {
      const storage = createMemoryStorage({ [STORAGE_KEYS.legacyDraft]: legacy });
      expect(openInitialDraft(storage, T1).drafts).toEqual([]);
      expect(storageKeys(storage)).toEqual([]);
    }
  });

  it('opens the current draft', () => {
    const storage = createMemoryStorage();
    saveDraft('a', withTitle('A'), storage, T1);
    saveDraft('b', withTitle('B'), storage, T2);
    writeCurrentDraftId('a', storage);
    const opened = openInitialDraft(storage, T3);
    expect(opened.id).toBe('a');
    expect(opened.draft.metadata.title).toBe('A');
  });

  it('opens an empty draft when the current draft was never saved', () => {
    const storage = createMemoryStorage();
    saveDraft('b', withTitle('B'), storage, T2);
    writeCurrentDraftId('fresh', storage);
    const opened = openInitialDraft(storage, T3);
    expect(opened.id).toBe('fresh');
    expect(isDraftEmpty(opened.draft)).toBe(true);
  });

  it('falls back to the most recent draft, then to a new empty draft', () => {
    const storage = createMemoryStorage();
    saveDraft('a', withTitle('A'), storage, T1);
    saveDraft('b', withTitle('B'), storage, T2);
    expect(openInitialDraft(storage, T3).id).toBe('b');

    const empty = openInitialDraft(createMemoryStorage(), T3);
    expect(isDraftEmpty(empty.draft)).toBe(true);
    expect(empty.drafts).toEqual([]);
  });
});

describe('draftDisplayName', () => {
  it('uses the title, then the start and end words, then "Untitled draft"', () => {
    const blank = { title: '', startWord: '', endWord: '' };
    expect(draftDisplayName({ ...blank, title: 'My ladder' })).toBe('My ladder');
    expect(draftDisplayName({ ...blank, startWord: 'hit', endWord: 'cog' })).toBe('From HIT to COG');
    expect(draftDisplayName(blank)).toBe('Untitled draft');
  });
});
