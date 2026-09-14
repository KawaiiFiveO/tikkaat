import { createDraft, isDraftEmpty, restoreDraft, suggestTitle } from './draft';
import { isRecord, isString } from './guards';
import { codePointLength } from './normalize';
import { readStorage, removeKeysWithPrefix, removeStorage, STORAGE_KEYS, writeStorage } from './storage';
import type { Puzzle } from './types';
import { LIMITS } from './validate';

/**
 * Multiple builder drafts in localStorage:
 *   tikkaat:drafts        list of DraftSummary (for the Drafts dialog)
 *   tikkaat:draft:<id>    one draft's content, so autosave only rewrites the open draft
 *   tikkaat:currentDraft  id of the draft open in the builder
 * Every function takes an optional Storage for tests.
 */

export interface DraftSummary {
  id: string;
  title: string;
  startWord: string;
  endWord: string;
  /** ISO timestamp of the last content change. */
  updatedAt: string;
}

export function newDraftId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Title, else "From START to END", else "Untitled draft". */
export function draftDisplayName(summary: Pick<DraftSummary, 'title' | 'startWord' | 'endWord'>): string {
  return summary.title.trim() || suggestTitle(summary.startWord, summary.endWord) || 'Untitled draft';
}

function summarize(id: string, draft: Puzzle, updatedAt: string): DraftSummary {
  return {
    id,
    title: draft.metadata.title.trim(),
    startWord: draft.startWord.trim(),
    endWord: draft.endWord.trim(),
    updatedAt,
  };
}

function isSummary(value: unknown): value is DraftSummary {
  return (
    isRecord(value) &&
    [value.id, value.title, value.startWord, value.endWord, value.updatedAt].every(isString) &&
    value.id !== ''
  );
}

function sortByRecent(drafts: DraftSummary[]): DraftSummary[] {
  return [...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function writeIndex(drafts: DraftSummary[], storage?: Storage): DraftSummary[] {
  const sorted = sortByRecent(drafts);
  writeStorage(STORAGE_KEYS.drafts, sorted, storage);
  return sorted;
}

/** Saved drafts, most recently edited first. Malformed entries are ignored. */
export function listDrafts(storage?: Storage): DraftSummary[] {
  const raw = readStorage(STORAGE_KEYS.drafts, storage);
  return Array.isArray(raw) ? sortByRecent(raw.filter(isSummary)) : [];
}

export function loadDraft(id: string, storage?: Storage): Puzzle | null {
  return restoreDraft(readStorage(STORAGE_KEYS.draft(id), storage));
}

/**
 * Autosaves a draft and returns the updated list. Empty drafts are never stored (a draft that
 * becomes empty is removed), and saving unchanged content doesn't bump its edit time.
 */
export function saveDraft(id: string, draft: Puzzle, storage?: Storage, now: Date = new Date()): DraftSummary[] {
  const drafts = listDrafts(storage);
  const listed = drafts.some((summary) => summary.id === id);
  if (isDraftEmpty(draft)) return listed ? deleteDraft(id, storage) : drafts;
  if (listed && JSON.stringify(readStorage(STORAGE_KEYS.draft(id), storage)) === JSON.stringify(draft)) {
    return drafts;
  }
  writeStorage(STORAGE_KEYS.draft(id), draft, storage);
  return writeIndex([...drafts.filter((summary) => summary.id !== id), summarize(id, draft, now.toISOString())], storage);
}

export function deleteDraft(id: string, storage?: Storage): DraftSummary[] {
  removeStorage(STORAGE_KEYS.draft(id), storage);
  return writeIndex(
    listDrafts(storage).filter((summary) => summary.id !== id),
    storage,
  );
}

/** Deletes every draft (including any unlisted draft content) and forgets the open draft. */
export function deleteAllDrafts(storage?: Storage): void {
  removeKeysWithPrefix(STORAGE_KEYS.draft(''), storage);
  removeStorage(STORAGE_KEYS.drafts, storage);
  removeStorage(STORAGE_KEYS.currentDraft, storage);
}

/** Copies a draft under a new id, with " (copy)" added to its title when it fits. */
export function duplicateDraft(
  id: string,
  storage?: Storage,
  now: Date = new Date(),
): { id: string; drafts: DraftSummary[] } | null {
  const draft = loadDraft(id, storage);
  if (!draft) return null;
  const title = draft.metadata.title.trim();
  const copyTitle = `${title} (copy)`;
  const copy: Puzzle = {
    ...draft,
    metadata: {
      ...draft.metadata,
      title: title !== '' && codePointLength(copyTitle) <= LIMITS.titleMaxLength ? copyTitle : draft.metadata.title,
      dateCreated: now.toISOString(),
    },
  };
  const copyId = newDraftId();
  return { id: copyId, drafts: saveDraft(copyId, copy, storage, now) };
}

export function readCurrentDraftId(storage?: Storage): string | null {
  const id = readStorage(STORAGE_KEYS.currentDraft, storage);
  return isString(id) && id !== '' ? id : null;
}

export function writeCurrentDraftId(id: string, storage?: Storage): void {
  writeStorage(STORAGE_KEYS.currentDraft, id, storage);
}

/** Moves the single draft saved by earlier versions into the draft list. */
function migrateLegacyDraft(storage?: Storage, now: Date = new Date()): void {
  const legacy = readStorage(STORAGE_KEYS.legacyDraft, storage);
  if (legacy === null) return;
  const draft = restoreDraft(legacy);
  if (draft && !isDraftEmpty(draft)) {
    const id = newDraftId();
    saveDraft(id, draft, storage, now);
    writeCurrentDraftId(id, storage);
  }
  removeStorage(STORAGE_KEYS.legacyDraft, storage);
}

/**
 * The draft the builder opens on load: the current draft; a new empty draft if the current one
 * was never saved (it was empty); otherwise the most recently edited draft; otherwise a new one.
 */
export function openInitialDraft(
  storage?: Storage,
  now: Date = new Date(),
): { id: string; draft: Puzzle; drafts: DraftSummary[] } {
  migrateLegacyDraft(storage, now);
  const drafts = listDrafts(storage);
  const currentId = readCurrentDraftId(storage);
  if (currentId) {
    const current = loadDraft(currentId, storage);
    if (current) return { id: currentId, draft: current, drafts };
    if (!drafts.some((summary) => summary.id === currentId)) {
      return { id: currentId, draft: createDraft(now), drafts };
    }
  }
  for (const summary of drafts) {
    const draft = loadDraft(summary.id, storage);
    if (draft) return { id: summary.id, draft, drafts };
  }
  return { id: newDraftId(), draft: createDraft(now), drafts };
}
