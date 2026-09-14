import { isPermutation } from './guards';
import { isCorrectGuess } from './normalize';
import { shuffledOrder } from './shuffle';
import { ladderWords, PLACEHOLDER, type Puzzle } from './types';

export type Direction = 'down' | 'up';
export type HintStage = 0 | 1 | 2;

export interface GameProgress {
  /** Per rung (W1 … WN). */
  solved: boolean[];
  /** Per rung. 1 = clue shown, 2 = answer revealed. */
  hints: HintStage[];
  direction: Direction;
  /** The player's display order of the clue bank (starts as the puzzle's order; the player can reshuffle). */
  bankOrder: number[];
}

type PuzzleShape = Pick<Puzzle, 'rungs' | 'clueBankOrder'>;

export const PERFECT_SCORE = 1000;
export const BLANK = '________';

export function createProgress(puzzle: PuzzleShape): GameProgress {
  const rungCount = puzzle.rungs.length;
  return {
    solved: new Array<boolean>(rungCount).fill(false),
    hints: new Array<HintStage>(rungCount).fill(0),
    direction: 'down',
    bankOrder: [...puzzle.clueBankOrder],
  };
}

/** Validates progress loaded from storage. Unsolved rungs must form one contiguous block. */
export function restoreProgress(raw: unknown, puzzle: PuzzleShape): GameProgress | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const rungCount = puzzle.rungs.length;
  const { solved, hints, direction, bankOrder } = raw as Record<string, unknown>;
  if (
    !Array.isArray(solved) ||
    !Array.isArray(hints) ||
    solved.length !== rungCount ||
    hints.length !== rungCount ||
    (direction !== 'down' && direction !== 'up') ||
    !solved.every((s) => typeof s === 'boolean') ||
    !hints.every((h, i) => (h === 0 || h === 1 || h === 2) && (h !== 2 || solved[i] === true))
  ) {
    return null;
  }
  const first = solved.indexOf(false);
  const last = solved.lastIndexOf(false);
  if (first >= 0 && solved.slice(first, last + 1).some(Boolean)) return null;
  return {
    solved: [...solved],
    hints: [...hints],
    direction,
    bankOrder: isPermutation(bankOrder, rungCount + 1) ? [...bankOrder] : [...puzzle.clueBankOrder],
  };
}

/** Word index 0 … N+1; start and end words are always solved. */
export function isWordSolved(progress: GameProgress, wordIndex: number): boolean {
  if (wordIndex <= 0 || wordIndex > progress.solved.length) return true;
  return progress.solved[wordIndex - 1] === true;
}

/** Number of solved rungs, including revealed ones. */
export function solvedCount(progress: GameProgress): number {
  return progress.solved.filter(Boolean).length;
}

/** True once the player has solved a rung or used a hint (direction and clue order don't count). */
export function hasProgress(progress: GameProgress): boolean {
  return progress.solved.some(Boolean) || progress.hints.some((stage) => stage > 0);
}

export function isComplete(progress: GameProgress): boolean {
  return progress.solved.every(Boolean);
}

export function topmostUnsolved(progress: GameProgress): number {
  return progress.solved.indexOf(false);
}

export function bottommostUnsolved(progress: GameProgress): number {
  return progress.solved.lastIndexOf(false);
}

/** Rung index being solved in the current direction, or -1 when complete. */
export function activeRung(progress: GameProgress): number {
  return progress.direction === 'down' ? topmostUnsolved(progress) : bottommostUnsolved(progress);
}

/** Word index of the current word shown in available clues, or -1 when complete. */
export function currentWordIndex(progress: GameProgress): number {
  const rung = activeRung(progress);
  if (rung < 0) return -1;
  return progress.direction === 'down' ? rung : rung + 2;
}

/** Step index of the clue that solves the active rung, or -1 when complete. */
export function correctStep(progress: GameProgress): number {
  const rung = activeRung(progress);
  if (rung < 0) return -1;
  return progress.direction === 'down' ? rung : rung + 1;
}

export function isStepUsed(progress: GameProgress, step: number): boolean {
  return isWordSolved(progress, step) && isWordSolved(progress, step + 1);
}

function withSolved(progress: GameProgress, rung: number): GameProgress {
  const solved = [...progress.solved];
  solved[rung] = true;
  return { ...progress, solved };
}

export function submitGuess(
  puzzle: Puzzle,
  progress: GameProgress,
  guess: string,
): { correct: boolean; progress: GameProgress } {
  const rung = activeRung(progress);
  if (rung < 0 || !isCorrectGuess(guess, puzzle.rungs[rung] ?? '')) {
    return { correct: false, progress };
  }
  return { correct: true, progress: withSolved(progress, rung) };
}

/** Advances the active rung's hint stage. Stage 2 reveals and solves the rung. */
export function applyHint(progress: GameProgress): GameProgress {
  const rung = activeRung(progress);
  if (rung < 0) return progress;
  const stage = progress.hints[rung] ?? 0;
  if (stage >= 2) return progress;
  const hints = [...progress.hints];
  hints[rung] = stage === 0 ? 1 : 2;
  const next = { ...progress, hints };
  return hints[rung] === 2 ? withSolved(next, rung) : next;
}

export function setDirection(progress: GameProgress, direction: Direction): GameProgress {
  return progress.direction === direction ? progress : { ...progress, direction };
}

/** Reshuffles the player's clue bank display order (always different from the current order). */
export function shuffleBank(progress: GameProgress, random: () => number = Math.random): GameProgress {
  const current = progress.bankOrder;
  const bankOrder = shuffledOrder(current.length, random).map((i) => current[i]!);
  return { ...progress, bankOrder };
}

export function rungScore(rungCount: number, stage: HintStage): number {
  const full = PERFECT_SCORE / rungCount;
  return stage === 0 ? full : stage === 1 ? full / 2 : 0;
}

/** Unrounded score of solved rungs. Round only for display. */
export function score(progress: GameProgress): number {
  const rungCount = progress.solved.length;
  return progress.solved.reduce(
    (total, solved, i) => (solved ? total + rungScore(rungCount, progress.hints[i] ?? 0) : total),
    0,
  );
}

export function displayScore(progress: GameProgress): number {
  return Math.round(score(progress));
}

// ---------------------------------------------------------------------------
// Clue display

export type ClueSegment = { kind: 'text'; text: string } | { kind: 'word'; text: string } | { kind: 'blank' };

export interface ClueDisplay {
  step: number;
  segments: ClueSegment[];
  /** Word shown after the arrow, or null for no arrow. */
  result: string | null;
}

export function fillClue(clue: string, fill: ClueSegment): ClueSegment[] {
  const segments: ClueSegment[] = [];
  clue.split(PLACEHOLDER).forEach((part, i) => {
    if (i > 0) segments.push(fill);
    if (part !== '') segments.push({ kind: 'text', text: part });
  });
  return segments;
}

/** Fully resolved: from-word filled in, to-word after the arrow. */
export function resolvedClue(puzzle: Puzzle, step: number): ClueDisplay {
  const words = ladderWords(puzzle);
  return {
    step,
    segments: fillClue(puzzle.clues[step] ?? '', { kind: 'word', text: words[step] ?? '' }),
    result: words[step + 1] ?? '',
  };
}

/** Available clue formatted for the current direction. */
export function availableClue(puzzle: Puzzle, progress: GameProgress, step: number): ClueDisplay {
  const clue = puzzle.clues[step] ?? '';
  const word = ladderWords(puzzle)[currentWordIndex(progress)] ?? '';
  return progress.direction === 'down'
    ? { step, segments: fillClue(clue, { kind: 'word', text: word }), result: null }
    : { step, segments: fillClue(clue, { kind: 'blank' }), result: word };
}

export function clueBank(
  puzzle: Puzzle,
  progress: GameProgress,
): { available: ClueDisplay[]; used: ClueDisplay[]; hintedStep: number | null } {
  const available = progress.bankOrder
    .filter((s) => !isStepUsed(progress, s))
    .map((s) => availableClue(puzzle, progress, s));
  const used = puzzle.clues
    .map((_, s) => s)
    .filter((s) => isStepUsed(progress, s))
    .map((s) => resolvedClue(puzzle, s));
  const rung = activeRung(progress);
  const hintedStep = rung >= 0 && (progress.hints[rung] ?? 0) >= 1 ? correctStep(progress) : null;
  return { available, used, hintedStep };
}

/** All clues in ladder order, fully resolved. Shown once the puzzle is complete. */
export function completedClues(puzzle: Puzzle): ClueDisplay[] {
  return puzzle.clues.map((_, s) => resolvedClue(puzzle, s));
}

export function clueToText(display: ClueDisplay): string {
  const body = display.segments
    .map((segment) => (segment.kind === 'blank' ? BLANK : segment.text))
    .join('');
  return display.result === null ? body : `${body} → ${display.result}`;
}
