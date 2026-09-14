import { cipherKey } from './cipher';
import { isPermutation } from './guards';
import { codePointLength, hasLetterOrDigit, normalizeText, normalizeWord } from './normalize';
import { PLACEHOLDER, type Puzzle } from './types';

export const LIMITS = {
  minRungs: 1,
  maxRungs: 20,
  wordMaxLength: 20,
  clueMaxLength: 150,
  titleMaxLength: 60,
  creatorMaxLength: 40,
  aboutMaxLength: 500,
  completionMessageMaxLength: 500,
} as const;

export interface ValidationIssue {
  /** e.g. 'metadata.title', 'startWord', 'rungs.2', 'clues.3' */
  field: string;
  message: string;
}

/** Normalize every text field to its stored form. */
export function normalizePuzzle(puzzle: Puzzle): Puzzle {
  return {
    metadata: {
      title: normalizeText(puzzle.metadata.title).trim(),
      creatorName: normalizeText(puzzle.metadata.creatorName).trim(),
      dateCreated: puzzle.metadata.dateCreated,
      aboutThisPuzzle: normalizeText(puzzle.metadata.aboutThisPuzzle).trim(),
      completionMessage: normalizeText(puzzle.metadata.completionMessage).trim(),
    },
    startWord: normalizeWord(puzzle.startWord),
    endWord: normalizeWord(puzzle.endWord),
    rungs: puzzle.rungs.map(normalizeWord),
    clues: puzzle.clues.map((clue) => normalizeText(clue).trim()),
    clueBankOrder: [...puzzle.clueBankOrder],
  };
}

export function rungLabel(index: number): string {
  return `Rung ${index + 1}`;
}

export function clueLabel(step: number): string {
  return `Clue ${step + 1}`;
}

/** Validates a normalized puzzle. Returns an empty array when valid. */
export function validatePuzzle(puzzle: Puzzle): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (field: string, message: string) => issues.push({ field, message });

  const { title, creatorName, aboutThisPuzzle, completionMessage, dateCreated } = puzzle.metadata;
  if (title === '') add('metadata.title', 'Title is required.');
  if (codePointLength(title) > LIMITS.titleMaxLength) {
    add('metadata.title', `Title must be at most ${LIMITS.titleMaxLength} characters.`);
  }
  if (codePointLength(creatorName) > LIMITS.creatorMaxLength) {
    add('metadata.creatorName', `Creator name must be at most ${LIMITS.creatorMaxLength} characters.`);
  }
  if (codePointLength(aboutThisPuzzle) > LIMITS.aboutMaxLength) {
    add('metadata.aboutThisPuzzle', `About must be at most ${LIMITS.aboutMaxLength} characters.`);
  }
  if (codePointLength(completionMessage) > LIMITS.completionMessageMaxLength) {
    add(
      'metadata.completionMessage',
      `Completion message must be at most ${LIMITS.completionMessageMaxLength} characters.`,
    );
  }
  if (Number.isNaN(Date.parse(dateCreated))) {
    add('metadata.dateCreated', 'Creation date is invalid.');
  }

  const checkWord = (field: string, label: string, word: string): boolean => {
    if (word === '') {
      add(field, `${label} is required.`);
      return false;
    }
    if (codePointLength(word) > LIMITS.wordMaxLength) {
      add(field, `${label} must be at most ${LIMITS.wordMaxLength} characters.`);
      return false;
    }
    if (!hasLetterOrDigit(word)) {
      add(field, `${label} must contain a letter or digit.`);
      return false;
    }
    return true;
  };

  if (checkWord('startWord', 'Start word', puzzle.startWord) && cipherKey(puzzle.startWord).length === 0) {
    add('startWord', 'Start word must contain at least one letter from A–Ö.');
  }
  checkWord('endWord', 'End word', puzzle.endWord);

  const rungCount = puzzle.rungs.length;
  if (rungCount < LIMITS.minRungs) add('rungs', `Add at least ${LIMITS.minRungs} rung.`);
  if (rungCount > LIMITS.maxRungs) add('rungs', `A puzzle can have at most ${LIMITS.maxRungs} rungs.`);
  puzzle.rungs.forEach((rung, i) => checkWord(`rungs.${i}`, rungLabel(i), rung));

  if (puzzle.clues.length !== rungCount + 1) {
    add('clues', `A puzzle with ${rungCount} rungs needs ${rungCount + 1} clues.`);
  }
  puzzle.clues.forEach((clue, s) => {
    const field = `clues.${s}`;
    if (clue === '') {
      add(field, `${clueLabel(s)} is required.`);
      return;
    }
    if (codePointLength(clue) > LIMITS.clueMaxLength) {
      add(field, `${clueLabel(s)} must be at most ${LIMITS.clueMaxLength} characters.`);
    }
    if (!clue.includes(PLACEHOLDER)) {
      add(field, `${clueLabel(s)} must include ${PLACEHOLDER}.`);
    }
  });

  if (!isPermutation(puzzle.clueBankOrder, puzzle.clues.length)) {
    add('clueBankOrder', 'Clue order is invalid.');
  }

  return issues;
}
