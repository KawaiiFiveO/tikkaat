import { isIndexSubset, isPermutation } from './guards';
import { isCorrectGuess } from './normalize';
import { shuffledOrder } from './shuffle';
import { ladderWords, NEXT_PLACEHOLDER, PLACEHOLDER, type Puzzle } from './types';

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
  /**
   * Steps the player has crossed off as not fitting the step they're currently solving. Scoped to
   * `discardedFor`: they're ignored (and replaced) once the active step changes, so a clue ruled out
   * for one rung is offered again on the next. See activeDiscards.
   */
  discarded: number[];
  /** The correctStep the discards belong to; -1 when there are none. */
  discardedFor: number;
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
    discarded: [],
    discardedFor: -1,
  };
}

/** Validates progress loaded from storage. Unsolved rungs must form one contiguous block. */
export function restoreProgress(raw: unknown, puzzle: PuzzleShape): GameProgress | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const rungCount = puzzle.rungs.length;
  const { solved, hints, direction, bankOrder, discarded, discardedFor } = raw as Record<string, unknown>;
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
    // Discards are a scratch note, not progress: progress saved before they existed (or with a bad
    // value) restores with none rather than being rejected.
    ...restoreDiscards(discarded, discardedFor, rungCount + 1),
  };
}

function restoreDiscards(
  discarded: unknown,
  discardedFor: unknown,
  stepCount: number,
): Pick<GameProgress, 'discarded' | 'discardedFor'> {
  if (!isIndexSubset(discarded, stepCount) || !Number.isInteger(discardedFor)) return { discarded: [], discardedFor: -1 };
  const step = discardedFor as number;
  if (step < 0 || step >= stepCount) return { discarded: [], discardedFor: -1 };
  return { discarded: [...discarded], discardedFor: step };
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

/**
 * Steps the player has crossed off for the step they're solving now. Discards are kept only for the
 * step they were made on, so solving a rung or switching direction silently drops them instead of
 * carrying a clue ruled out for one step over to the next.
 */
export function activeDiscards(progress: GameProgress): number[] {
  const step = correctStep(progress);
  return step >= 0 && progress.discardedFor === step ? progress.discarded : [];
}

export function isDiscarded(progress: GameProgress, step: number): boolean {
  return activeDiscards(progress).includes(step);
}

/** Crosses a clue off for the current step, or restores it if it's already crossed off. */
export function toggleDiscard(progress: GameProgress, step: number): GameProgress {
  const current = correctStep(progress);
  if (current < 0) return progress;
  const active = activeDiscards(progress);
  const discarded = active.includes(step) ? active.filter((s) => s !== step) : [...active, step];
  return { ...progress, discarded, discardedFor: current };
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

export type ClueSegment =
  | { kind: 'text'; text: string }
  | { kind: 'word'; text: string }
  | { kind: 'result'; text: string }
  | { kind: 'blank' };

export interface ClueDisplay {
  step: number;
  segments: ClueSegment[];
  /** Word shown after the arrow, or null for no arrow (including when the clue shows it inline). */
  result: string | null;
}

/** Fills for the two placeholders: the step's from-word and its to-word. */
export interface ClueFills {
  word: ClueSegment;
  next: ClueSegment;
}

/** True when the clue shows its to-word inline, so it isn't appended after an arrow. */
export function showsNextInline(clue: string): boolean {
  return clue.includes(NEXT_PLACEHOLDER);
}

export function fillClue(clue: string, fills: ClueFills): ClueSegment[] {
  const segments: ClueSegment[] = [];
  let text = '';
  const flush = () => {
    if (text !== '') segments.push({ kind: 'text', text });
    text = '';
  };
  for (let i = 0; i < clue.length; ) {
    if (clue.startsWith(PLACEHOLDER, i)) {
      flush();
      segments.push(fills.word);
      i += PLACEHOLDER.length;
    } else if (clue.startsWith(NEXT_PLACEHOLDER, i)) {
      flush();
      segments.push(fills.next);
      i += NEXT_PLACEHOLDER.length;
    } else {
      text += clue[i];
      i += 1;
    }
  }
  flush();
  return segments;
}

/** Fully resolved: from-word filled in, to-word inline or after the arrow. */
export function resolvedClue(puzzle: Puzzle, step: number): ClueDisplay {
  const words = ladderWords(puzzle);
  const clue = puzzle.clues[step] ?? '';
  const to = words[step + 1] ?? '';
  return {
    step,
    segments: fillClue(clue, {
      word: { kind: 'word', text: words[step] ?? '' },
      next: { kind: 'result', text: to },
    }),
    result: showsNextInline(clue) ? null : to,
  };
}

/** Available clue formatted for the current direction. */
export function availableClue(puzzle: Puzzle, progress: GameProgress, step: number): ClueDisplay {
  const clue = puzzle.clues[step] ?? '';
  const word = ladderWords(puzzle)[currentWordIndex(progress)] ?? '';
  // Down: the from-word is known and the to-word is the answer. Up: the other way round.
  return progress.direction === 'down'
    ? { step, segments: fillClue(clue, { word: { kind: 'word', text: word }, next: { kind: 'blank' } }), result: null }
    : {
        step,
        segments: fillClue(clue, { word: { kind: 'blank' }, next: { kind: 'result', text: word } }),
        result: showsNextInline(clue) ? null : word,
      };
}

export function clueBank(
  puzzle: Puzzle,
  progress: GameProgress,
): { available: ClueDisplay[]; used: ClueDisplay[]; hintedStep: number | null; discarded: number[] } {
  const available = progress.bankOrder
    .filter((s) => !isStepUsed(progress, s))
    .map((s) => availableClue(puzzle, progress, s));
  const used = puzzle.clues
    .map((_, s) => s)
    .filter((s) => isStepUsed(progress, s))
    .map((s) => resolvedClue(puzzle, s));
  const rung = activeRung(progress);
  const hintedStep = rung >= 0 && (progress.hints[rung] ?? 0) >= 1 ? correctStep(progress) : null;
  // A revealed clue isn't shown crossed off: the hint is the better information.
  const discarded = activeDiscards(progress).filter((s) => s !== hintedStep);
  return { available, used, hintedStep, discarded };
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
