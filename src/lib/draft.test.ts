import { describe, expect, it } from 'vitest';
import { createDraft, insertRung, isDraftEmpty, removeRung, restoreDraft, suggestTitle } from './draft';
import { EXAMPLE_PUZZLE } from './examplePuzzle';
import { isPermutation } from './guards';

describe('createDraft', () => {
  it('starts empty with one rung and two clues', () => {
    const draft = createDraft();
    expect(draft.rungs).toEqual(['']);
    expect(draft.clues).toEqual(['', '']);
    expect(isPermutation(draft.clueBankOrder, 2)).toBe(true);
    expect(isDraftEmpty(draft)).toBe(true);
    expect(isDraftEmpty(EXAMPLE_PUZZLE)).toBe(false);
    expect(isDraftEmpty({ ...draft, metadata: { ...draft.metadata, completionMessage: 'Well done!' } })).toBe(false);
  });
});

describe('suggestTitle', () => {
  it('uses the normalized start and end words', () => {
    expect(suggestTitle('  hit ', 'cog')).toBe('From HIT to COG');
    expect(suggestTitle('ice   cream', 'kylmä')).toBe('From ICE CREAM to KYLMÄ');
  });

  it('returns null until both words are filled in', () => {
    expect(suggestTitle('', 'COG')).toBeNull();
    expect(suggestTitle('HIT', '   ')).toBeNull();
  });

  it('fits within the title limit for maximum-length words', () => {
    const word = 'A'.repeat(20);
    expect(suggestTitle(word, word)).toBe(`From ${word} to ${word}`);
  });
});

describe('insertRung', () => {
  it('adds a rung below a clue, keeping every existing clue in its box', () => {
    const draft = insertRung(EXAMPLE_PUZZLE, 1); // below clue 2, between HOT and DOT
    expect(draft.rungs).toEqual(['HOT', '', 'DOT', 'DOG']);
    expect(draft.clues).toEqual([
      EXAMPLE_PUZZLE.clues[0],
      EXAMPLE_PUZZLE.clues[1],
      '',
      EXAMPLE_PUZZLE.clues[2],
      EXAMPLE_PUZZLE.clues[3],
    ]);
    expect(isPermutation(draft.clueBankOrder, 5)).toBe(true);
  });

  it('stops at 20 rungs', () => {
    let draft = createDraft();
    for (let i = 0; i < 25; i++) draft = insertRung(draft, 0);
    expect(draft.rungs).toHaveLength(20);
    expect(draft.clues).toHaveLength(21);
  });
});

describe('removeRung', () => {
  it('merges the clue boxes around the rung, keeping the clue above it in place', () => {
    const draft = removeRung(EXAMPLE_PUZZLE, 1); // remove DOT
    expect(draft.rungs).toEqual(['HOT', 'DOG']);
    expect(draft.clues).toEqual([EXAMPLE_PUZZLE.clues[0], EXAMPLE_PUZZLE.clues[1], EXAMPLE_PUZZLE.clues[3]]);
    expect(isPermutation(draft.clueBankOrder, 3)).toBe(true);
  });

  it('keeps the clue below when only it has text', () => {
    const draft = { ...EXAMPLE_PUZZLE, clues: ['a {word}', '', 'c {word}', 'd {word}'] };
    expect(removeRung(draft, 1).clues).toEqual(['a {word}', 'c {word}', 'd {word}']);
  });

  it('undoes adding a rung', () => {
    for (const step of [0, 1, 3]) {
      const restored = removeRung(insertRung(EXAMPLE_PUZZLE, step), step);
      expect(restored.rungs).toEqual(EXAMPLE_PUZZLE.rungs);
      expect(restored.clues).toEqual(EXAMPLE_PUZZLE.clues);
    }
  });

  it('never removes the last rung', () => {
    const draft = createDraft();
    expect(removeRung(draft, 0)).toBe(draft);
  });
});

describe('restoreDraft', () => {
  it('restores a saved draft', () => {
    expect(restoreDraft(JSON.parse(JSON.stringify(EXAMPLE_PUZZLE)))).toEqual(EXAMPLE_PUZZLE);
  });

  it('restores drafts saved before completion messages existed', () => {
    const { completionMessage: _omit, ...oldMetadata } = EXAMPLE_PUZZLE.metadata;
    const restored = restoreDraft({ ...EXAMPLE_PUZZLE, metadata: oldMetadata });
    expect(restored?.metadata.completionMessage).toBe('');
    expect(restoreDraft({ ...EXAMPLE_PUZZLE, metadata: { ...oldMetadata, completionMessage: 5 } })).toBeNull();
  });

  it('regenerates an invalid clue order', () => {
    const restored = restoreDraft({ ...EXAMPLE_PUZZLE, clueBankOrder: [1, 1] });
    expect(restored && isPermutation(restored.clueBankOrder, 4)).toBe(true);
  });

  it('rejects malformed drafts', () => {
    expect(restoreDraft(null)).toBeNull();
    expect(restoreDraft({ ...EXAMPLE_PUZZLE, clues: ['only one'] })).toBeNull();
    expect(restoreDraft({ ...EXAMPLE_PUZZLE, rungs: [1, 2, 3] })).toBeNull();
    expect(restoreDraft({ ...EXAMPLE_PUZZLE, metadata: undefined })).toBeNull();
  });
});
