import { describe, expect, it } from 'vitest';
import { EXAMPLE_PUZZLE as P } from './examplePuzzle';
import {
  activeDiscards,
  activeRung,
  applyHint,
  clueBank,
  clueToText,
  completedClues,
  correctStep,
  createProgress,
  displayScore,
  fillClue,
  hasProgress,
  isComplete,
  restoreProgress,
  setDirection,
  shuffleBank,
  solvedCount,
  submitGuess,
  toggleDiscard,
  type GameProgress,
} from './game';
import type { Puzzle } from './types';

// Ladder: HIT → HOT → DOT → DOG → COG (3 rungs, 4 clues)

function solve(progress: GameProgress, direction: 'down' | 'up', guess: string): GameProgress {
  const result = submitGuess(P, setDirection(progress, direction), guess);
  expect(result.correct).toBe(true);
  return result.progress;
}

function availableTexts(progress: GameProgress): string[] {
  return clueBank(P, progress).available.map(clueToText);
}

describe('direction and clue display', () => {
  it('solving down shows the current word in every available clue', () => {
    const progress = createProgress(P);
    expect(activeRung(progress)).toBe(0);
    expect(correctStep(progress)).toBe(0);
    expect(availableTexts(progress)).toEqual([
      "Change the last letter of HIT to get man's best friend",
      'Change one letter in HIT to get the opposite of cold',
      'Change the first letter of HIT to get a tooth on a gear',
      'Change the first letter of HIT to get a tiny round mark',
    ]);
  });

  it('solving up shows a blank and the current word after an arrow', () => {
    const progress = setDirection(createProgress(P), 'up');
    expect(activeRung(progress)).toBe(2);
    expect(correctStep(progress)).toBe(3);
    expect(availableTexts(progress)[0]).toBe("Change the last letter of ________ to get man's best friend → COG");
  });

  it('fills every placeholder in a clue', () => {
    const segments = fillClue('Change the last letter of {word} to get the Spanish word for {word}', {
      word: { kind: 'word', text: 'COSTA' },
      next: { kind: 'blank' },
    });
    expect(clueToText({ step: 0, segments, result: null })).toBe(
      'Change the last letter of COSTA to get the Spanish word for COSTA',
    );
  });
});

// Ladder: TREES → TREE → THREE (Raddle-style clues naming both words inline)
const INLINE: Puzzle = {
  metadata: {
    title: 'From TREES to THREE',
    creatorName: '',
    dateCreated: '2026-09-15T00:00:00.000Z',
    aboutThisPuzzle: '',
    completionMessage: '',
  },
  startWord: 'TREES',
  endWord: 'THREE',
  rungs: ['TREE'],
  clues: ['Drop the S from {word} to get {next}, one of many in a forest', 'Anagram {word} to get {next}'],
  clueBankOrder: [1, 0],
};

describe('clues that name the to-word inline', () => {
  function texts(progress: GameProgress): string[] {
    return clueBank(INLINE, progress).available.map(clueToText);
  }

  it('shows a blank where the answer goes when solving down, with no arrow', () => {
    expect(texts(createProgress(INLINE))).toEqual([
      'Anagram TREES to get ________',
      'Drop the S from TREES to get ________, one of many in a forest',
    ]);
  });

  it('shows the current word inline when solving up, with no arrow', () => {
    expect(texts(setDirection(createProgress(INLINE), 'up'))).toEqual([
      'Anagram ________ to get THREE',
      'Drop the S from ________ to get THREE, one of many in a forest',
    ]);
  });

  it('fills both words in and drops the arrow once the clue is used', () => {
    const result = submitGuess(INLINE, createProgress(INLINE), 'TREE');
    expect(result.correct).toBe(true);
    expect(clueBank(INLINE, result.progress).used.map(clueToText)).toEqual([
      'Drop the S from TREES to get TREE, one of many in a forest',
      'Anagram TREE to get THREE',
    ]);
    expect(completedClues(INLINE).map(clueToText)).toEqual([
      'Drop the S from TREES to get TREE, one of many in a forest',
      'Anagram TREE to get THREE',
    ]);
  });

  it('gives every {next} in a clue the same replacement', () => {
    const segments = fillClue('{next} and {next} again, after {word}', {
      word: { kind: 'word', text: 'TREES' },
      next: { kind: 'result', text: 'TREE' },
    });
    expect(clueToText({ step: 0, segments, result: null })).toBe('TREE and TREE again, after TREES');
  });

  it('still appends the arrow for clues without {next}', () => {
    const progress = setDirection(createProgress(P), 'up');
    expect(availableTexts(progress)[0]).toBe("Change the last letter of ________ to get man's best friend → COG");
  });
});

describe('solving', () => {
  it('rejects wrong guesses', () => {
    const progress = createProgress(P);
    const result = submitGuess(P, progress, 'DOT');
    expect(result.correct).toBe(false);
    expect(result.progress).toBe(progress);
  });

  it('moves a solved clue to Used and advances the active rung', () => {
    const progress = solve(createProgress(P), 'down', ' hot ');
    expect(activeRung(progress)).toBe(1);
    const bank = clueBank(P, progress);
    expect(bank.used.map(clueToText)).toEqual(['Change one letter in HIT to get the opposite of cold → HOT']);
    expect(bank.available).toHaveLength(3);
    expect(availableTexts(progress)[0]).toBe("Change the last letter of HOT to get man's best friend");
  });

  it('solving up then the last rung from either direction uses both remaining clues', () => {
    let progress = solve(createProgress(P), 'down', 'HOT');
    progress = solve(progress, 'up', 'DOG');
    expect(clueBank(P, progress).used.map((c) => c.step)).toEqual([0, 3]);

    // Both directions now target rung 1 (DOT).
    expect(activeRung(setDirection(progress, 'down'))).toBe(1);
    expect(activeRung(setDirection(progress, 'up'))).toBe(1);
    expect(correctStep(setDirection(progress, 'down'))).toBe(1);
    expect(correctStep(setDirection(progress, 'up'))).toBe(2);
    expect(availableTexts(setDirection(progress, 'up'))).toContain(
      "Change the last letter of ________ to get man's best friend → DOG",
    );

    progress = solve(progress, 'up', 'dot');
    expect(isComplete(progress)).toBe(true);
    const bank = clueBank(P, progress);
    expect(bank.available).toEqual([]);
    expect(bank.used.map((c) => c.step)).toEqual([0, 1, 2, 3]);
    expect(submitGuess(P, progress, 'anything').correct).toBe(false);
  });

  it('lists all clues in ladder order when complete', () => {
    expect(completedClues(P).map(clueToText)).toEqual([
      'Change one letter in HIT to get the opposite of cold → HOT',
      'Change the first letter of HOT to get a tiny round mark → DOT',
      "Change the last letter of DOT to get man's best friend → DOG",
      'Change the first letter of DOG to get a tooth on a gear → COG',
    ]);
  });
});

describe('hints', () => {
  it('hint 1 highlights the correct clue; hint 2 reveals and advances', () => {
    let progress = applyHint(createProgress(P));
    expect(clueBank(P, progress).hintedStep).toBe(0);
    expect(activeRung(progress)).toBe(0);

    progress = applyHint(progress);
    expect(progress.solved[0]).toBe(true);
    expect(progress.hints[0]).toBe(2);
    expect(activeRung(progress)).toBe(1);
    expect(clueBank(P, progress).hintedStep).toBeNull();
  });

  it('hint 1 follows a direction switch on the last rung', () => {
    let progress = solve(createProgress(P), 'down', 'HOT');
    progress = solve(progress, 'up', 'DOG');
    progress = applyHint(setDirection(progress, 'down'));
    expect(clueBank(P, progress).hintedStep).toBe(1);
    expect(clueBank(P, setDirection(progress, 'up')).hintedStep).toBe(2);
  });

  it('hints are tracked per rung', () => {
    const progress = setDirection(applyHint(createProgress(P)), 'up');
    expect(clueBank(P, progress).hintedStep).toBeNull();
  });
});

describe('scoring', () => {
  const puzzleWithRungs = (count: number) => ({
    rungs: new Array<string>(count).fill('X'),
    clueBankOrder: Array.from({ length: count + 1 }, (_, i) => i),
  });

  it('a perfect game is exactly 1000 even when rungs do not divide evenly', () => {
    for (const count of [1, 3, 7, 9, 20]) {
      const progress = createProgress(puzzleWithRungs(count));
      expect(displayScore({ ...progress, solved: progress.solved.map(() => true) })).toBe(1000);
    }
  });

  it('gives half after hint 1 and nothing after hint 2', () => {
    const progress = createProgress(P);
    const allSolved = progress.solved.map(() => true);
    expect(displayScore({ ...progress, solved: allSolved, hints: [1, 0, 0] })).toBe(833);
    expect(displayScore({ ...progress, solved: allSolved, hints: [2, 0, 0] })).toBe(667);
    expect(displayScore({ ...progress, solved: allSolved, hints: [2, 2, 2] })).toBe(0);
  });

  it('counts only solved rungs', () => {
    const progress = solve(createProgress(P), 'down', 'HOT');
    expect(displayScore(progress)).toBe(333);
  });
});

describe('clue bank shuffle', () => {
  it('produces a different order containing the same steps', () => {
    const progress = createProgress(P);
    for (let i = 0; i < 20; i++) {
      const shuffled = shuffleBank(progress);
      expect(shuffled.bankOrder).not.toEqual(progress.bankOrder);
      expect([...shuffled.bankOrder].sort()).toEqual([0, 1, 2, 3]);
    }
  });

  it('changes the available clue display order', () => {
    const progress = shuffleBank(createProgress(P), () => 0);
    expect(clueBank(P, progress).available.map((c) => c.step)).toEqual(progress.bankOrder);
  });
});

describe('solvedCount', () => {
  it('counts solved rungs, including revealed ones', () => {
    expect(solvedCount(createProgress(P))).toBe(0);
    let progress = solve(createProgress(P), 'down', 'HOT');
    expect(solvedCount(progress)).toBe(1);
    progress = applyHint(applyHint(progress)); // reveal DOT
    expect(solvedCount(progress)).toBe(2);
  });
});

describe('hasProgress', () => {
  it('is false for a fresh game, even after switching direction or shuffling', () => {
    expect(hasProgress(createProgress(P))).toBe(false);
    expect(hasProgress(shuffleBank(setDirection(createProgress(P), 'up')))).toBe(false);
  });

  it('is true after solving a rung or using a hint', () => {
    expect(hasProgress(solve(createProgress(P), 'down', 'HOT'))).toBe(true);
    expect(hasProgress(applyHint(createProgress(P)))).toBe(true);
  });
});

describe('discarding clues', () => {
  it('crosses a clue off for the current step and restores it when clicked again', () => {
    const progress = createProgress(P);
    expect(clueBank(P, progress).discarded).toEqual([]);

    const off = toggleDiscard(progress, 2);
    expect(clueBank(P, off).discarded).toEqual([2]);
    // Still offered as a clue: crossing off only changes how it's shown.
    expect(clueBank(P, off).available.map((c) => c.step)).toEqual(clueBank(P, progress).available.map((c) => c.step));

    expect(clueBank(P, toggleDiscard(off, 2)).discarded).toEqual([]);
  });

  it('keeps several crossed off at once', () => {
    const progress = toggleDiscard(toggleDiscard(createProgress(P), 1), 3);
    expect([...activeDiscards(progress)].sort()).toEqual([1, 3]);
  });

  it('drops them once another rung becomes active', () => {
    const progress = toggleDiscard(createProgress(P), 2);
    expect(activeDiscards(progress)).toEqual([2]);
    expect(activeDiscards(solve(progress, 'down', 'HOT'))).toEqual([]);
  });

  it('drops them when the direction changes the step being solved', () => {
    // Down targets step 0, up targets step 3: different clues, so the notes don't carry over.
    const progress = toggleDiscard(createProgress(P), 2);
    expect(activeDiscards(setDirection(progress, 'up'))).toEqual([]);
  });

  it('drops them on the last rung too, where both directions meet but the clue differs', () => {
    let progress = solve(solve(createProgress(P), 'down', 'HOT'), 'down', 'DOT');
    expect(activeRung(progress)).toBe(2);
    progress = toggleDiscard(progress, 0);
    expect(activeDiscards(progress)).toEqual([0]);
    const up = setDirection(progress, 'up');
    expect(activeRung(up)).toBe(2);
    expect(correctStep(up)).toBe(3);
    expect(activeDiscards(up)).toEqual([]);
  });

  it('does not cross off the clue a hint has revealed', () => {
    const progress = applyHint(toggleDiscard(createProgress(P), 0));
    expect(clueBank(P, progress).hintedStep).toBe(0);
    expect(clueBank(P, progress).discarded).toEqual([]);
  });

  it('is not progress: it costs nothing and does not start the game', () => {
    const progress = toggleDiscard(createProgress(P), 2);
    expect(hasProgress(progress)).toBe(false);
    expect(displayScore(progress)).toBe(0);
  });

  it('does nothing once the puzzle is complete', () => {
    let progress = solve(solve(createProgress(P), 'down', 'HOT'), 'down', 'DOT');
    progress = solve(progress, 'down', 'DOG');
    expect(isComplete(progress)).toBe(true);
    expect(toggleDiscard(progress, 0)).toEqual(progress);
  });
});

describe('restoreProgress', () => {
  it('accepts valid saved progress', () => {
    const progress = shuffleBank(applyHint(solve(createProgress(P), 'up', 'DOG')));
    expect(restoreProgress(JSON.parse(JSON.stringify(progress)), P)).toEqual(progress);
  });

  it('restores crossed-off clues, and drops them when they are missing or invalid', () => {
    const progress = toggleDiscard(createProgress(P), 2);
    expect(restoreProgress(JSON.parse(JSON.stringify(progress)), P)).toEqual(progress);

    // Progress saved before crossing off existed still loads, rather than being rejected.
    const { discarded: _d, discardedFor: _f, ...legacy } = progress;
    expect(restoreProgress(legacy, P)).not.toBeNull();
    expect(restoreProgress(legacy, P)?.discarded).toEqual([]);

    for (const bad of [{ discarded: [0, 0] }, { discarded: [9] }, { discarded: 'x' }, { discardedFor: 9 }]) {
      const restored = restoreProgress({ ...progress, ...bad }, P);
      expect(restored).not.toBeNull();
      expect(restored?.discarded).toEqual([]);
      expect(restored?.discardedFor).toBe(-1);
    }
  });

  it('falls back to the puzzle clue order when the saved order is missing or invalid', () => {
    const { bankOrder: _omit, ...rest } = createProgress(P);
    expect(restoreProgress(rest, P)?.bankOrder).toEqual(P.clueBankOrder);
    expect(restoreProgress({ ...rest, bankOrder: [0, 0, 1, 2] }, P)?.bankOrder).toEqual(P.clueBankOrder);
  });

  it('rejects malformed or impossible progress', () => {
    const base = createProgress(P);
    expect(restoreProgress(null, P)).toBeNull();
    expect(restoreProgress({ ...base, solved: [false, false] }, P)).toBeNull();
    expect(restoreProgress({ ...base, direction: 'sideways' }, P)).toBeNull();
    expect(restoreProgress({ ...base, solved: [false, true, false] }, P)).toBeNull();
    expect(restoreProgress({ ...base, hints: [2, 0, 0] }, P)).toBeNull();
  });
});
