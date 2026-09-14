import { isPermutation, isRecord, isString } from './guards';
import { codePointLength, normalizeWord } from './normalize';
import { shuffledOrder } from './shuffle';
import type { Puzzle } from './types';
import { LIMITS } from './validate';

/** A new, empty builder draft with one rung. */
export function createDraft(now: Date = new Date()): Puzzle {
  return {
    metadata: {
      title: '',
      creatorName: '',
      dateCreated: now.toISOString(),
      aboutThisPuzzle: '',
      completionMessage: '',
    },
    startWord: '',
    endWord: '',
    rungs: [''],
    clues: ['', ''],
    clueBankOrder: shuffledOrder(2),
  };
}

/** Standard "From START to END" title, or null until both words are filled in (or if it wouldn't fit). */
export function suggestTitle(startWord: string, endWord: string): string | null {
  const start = normalizeWord(startWord);
  const end = normalizeWord(endWord);
  if (start === '' || end === '') return null;
  const title = `From ${start} to ${end}`;
  return codePointLength(title) <= LIMITS.titleMaxLength ? title : null;
}

export function isDraftEmpty(draft: Puzzle): boolean {
  const { title, creatorName, aboutThisPuzzle, completionMessage } = draft.metadata;
  return [
    title,
    creatorName,
    aboutThisPuzzle,
    completionMessage,
    draft.startWord,
    draft.endWord,
    ...draft.rungs,
    ...draft.clues,
  ].every(
    (text) => text.trim() === '',
  );
}

export function reshuffleClues(draft: Puzzle): Puzzle {
  return { ...draft, clueBankOrder: shuffledOrder(draft.clues.length) };
}

/**
 * Inserts an empty rung below the clue for step `step` (between W(step) and W(step+1)).
 * Existing clues stay in their boxes: the new, empty clue is for the step below the new rung.
 */
export function insertRung(draft: Puzzle, step: number): Puzzle {
  if (draft.rungs.length >= LIMITS.maxRungs) return draft;
  const rungs = [...draft.rungs];
  rungs.splice(step, 0, '');
  const clues = [...draft.clues];
  clues.splice(step + 1, 0, '');
  return reshuffleClues({ ...draft, rungs, clues });
}

/**
 * Removes rung `index` (word W(index+1)), merging the clue boxes above and below it.
 * Keeps the clue above (so clues stay in place) unless only the clue below has text.
 * Undoes insertRung(draft, index).
 */
export function removeRung(draft: Puzzle, index: number): Puzzle {
  if (draft.rungs.length <= LIMITS.minRungs) return draft;
  const rungs = [...draft.rungs];
  rungs.splice(index, 1);
  const upper = draft.clues[index] ?? '';
  const lower = draft.clues[index + 1] ?? '';
  const clues = [...draft.clues];
  clues.splice(upper.trim() === '' && lower.trim() !== '' ? index : index + 1, 1);
  return reshuffleClues({ ...draft, rungs, clues });
}

/** Validates a draft loaded from storage. Content may be incomplete; only the shape is checked. */
export function restoreDraft(raw: unknown): Puzzle | null {
  if (!isRecord(raw) || !isRecord(raw.metadata)) return null;
  const { title, creatorName, dateCreated, aboutThisPuzzle, completionMessage } = raw.metadata;
  const { startWord, endWord, rungs, clues, clueBankOrder } = raw;
  if (
    !isString(title) ||
    !isString(creatorName) ||
    !isString(dateCreated) ||
    !isString(aboutThisPuzzle) ||
    (completionMessage !== undefined && !isString(completionMessage)) ||
    !isString(startWord) ||
    !isString(endWord) ||
    !Array.isArray(rungs) ||
    !rungs.every(isString) ||
    !Array.isArray(clues) ||
    !clues.every(isString) ||
    rungs.length < LIMITS.minRungs ||
    rungs.length > LIMITS.maxRungs ||
    clues.length !== rungs.length + 1
  ) {
    return null;
  }
  return {
    // Drafts saved before completion messages existed have no field.
    metadata: { title, creatorName, dateCreated, aboutThisPuzzle, completionMessage: completionMessage ?? '' },
    startWord,
    endWord,
    rungs: [...rungs],
    clues: [...clues],
    clueBankOrder: isPermutation(clueBankOrder, clues.length) ? [...clueBankOrder] : shuffledOrder(clues.length),
  };
}
