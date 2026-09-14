export const FORMAT_VERSION = 1;

/** Placeholder in clue text for the step's from-word. */
export const PLACEHOLDER = '{word}';

export interface PuzzleMetadata {
  title: string;
  creatorName: string;
  dateCreated: string; // ISO String
  aboutThisPuzzle: string;
  /** Optional author message shown only after the puzzle is solved ('' when none). */
  completionMessage: string;
}

/** Metadata as stored in a save file: an empty completion message is omitted. */
export type SaveFileMetadata = Omit<PuzzleMetadata, 'completionMessage'> & { completionMessage?: string };

/** Plaintext in-memory puzzle used by the Builder, Playtest, and Interpreter. */
export interface Puzzle {
  metadata: PuzzleMetadata;
  startWord: string;
  endWord: string;
  /** W1 … WN, ladder order. */
  rungs: string[];
  /** N+1 entries; clues[s] is the clue for the step from W(s) to W(s+1). */
  clues: string[];
  /** Permutation of step indices: display order of the clue bank. */
  clueBankOrder: number[];
}

export interface StepEntry {
  clue: string;
  /** Beaufort-enciphered (positionLetter + to-word), key = startWord. */
  answer: string;
}

export interface TikkaatSaveFile {
  formatVersion: typeof FORMAT_VERSION;
  metadata: SaveFileMetadata;
  startWord: string;
  endWord: string;
  /** Shuffled clue-bank order. */
  steps: StepEntry[];
}

/** All ladder words W0 … W(N+1). */
export function ladderWords(puzzle: Pick<Puzzle, 'startWord' | 'endWord' | 'rungs'>): string[] {
  return [puzzle.startWord, ...puzzle.rungs, puzzle.endWord];
}
