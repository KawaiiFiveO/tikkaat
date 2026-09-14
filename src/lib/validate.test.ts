import { describe, expect, it } from 'vitest';
import { EXAMPLE_PUZZLE } from './examplePuzzle';
import type { Puzzle } from './types';
import { normalizePuzzle, validatePuzzle } from './validate';

function withChanges(changes: Partial<Puzzle>): Puzzle {
  return normalizePuzzle({ ...EXAMPLE_PUZZLE, ...changes });
}

function fields(puzzle: Puzzle): string[] {
  return validatePuzzle(puzzle).map((issue) => issue.field);
}

describe('validatePuzzle', () => {
  it('accepts the example puzzle', () => {
    expect(validatePuzzle(normalizePuzzle(EXAMPLE_PUZZLE))).toEqual([]);
  });

  it('requires {word} in every clue', () => {
    const clues = [...EXAMPLE_PUZZLE.clues];
    clues[1] = 'Something in a deck';
    expect(fields(withChanges({ clues }))).toEqual(['clues.1']);
  });

  it('limits rung count to 20', () => {
    const rungs = Array.from({ length: 21 }, () => 'WORD');
    const clues = Array.from({ length: 22 }, () => '{word}');
    const clueBankOrder = clues.map((_, i) => i);
    expect(fields(withChanges({ rungs, clues, clueBankOrder }))).toContain('rungs');
  });

  it('requires at least one rung', () => {
    expect(fields(withChanges({ rungs: [], clues: ['{word}'], clueBankOrder: [0] }))).toContain('rungs');
  });

  it('limits words to 20 characters, spaces included', () => {
    const rungs = ['ABCDEFGHIJ KLMNOPQRS', 'CARD', 'ABCDEFGHIJ KLMNOPQRST'];
    expect(fields(withChanges({ rungs }))).toEqual(['rungs.2']);
  });

  it('requires a cipher letter in the start word', () => {
    expect(fields(withChanges({ startWord: '123' }))).toEqual(['startWord']);
  });

  it('requires one clue per step', () => {
    expect(fields(withChanges({ clues: EXAMPLE_PUZZLE.clues.slice(0, 3) }))).toContain('clues');
  });

  it('rejects a clue order that is not a permutation', () => {
    expect(fields(withChanges({ clueBankOrder: [0, 0, 1, 2] }))).toEqual(['clueBankOrder']);
  });

  it('limits the completion message to 500 characters', () => {
    const metadata = { ...EXAMPLE_PUZZLE.metadata, completionMessage: 'x'.repeat(501) };
    expect(fields(withChanges({ metadata }))).toEqual(['metadata.completionMessage']);
  });

  it('enforces clue and metadata limits', () => {
    const clues = [...EXAMPLE_PUZZLE.clues];
    clues[0] = `{word}${'x'.repeat(150)}`;
    const metadata = { ...EXAMPLE_PUZZLE.metadata, title: '  ', creatorName: 'x'.repeat(41) };
    expect(fields(withChanges({ clues, metadata }))).toEqual(['metadata.title', 'metadata.creatorName', 'clues.0']);
  });
});
