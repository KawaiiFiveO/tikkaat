import { compress, decompress } from 'lzbase62';
import { cipherKey, decodeStepAnswer, encodeStepAnswer } from './cipher';
import { isRecord } from './guards';
import { normalizeWord } from './normalize';
import { FORMAT_VERSION, type Puzzle, type PuzzleMetadata, type TikkaatSaveFile } from './types';
import { LIMITS, normalizePuzzle, validatePuzzle } from './validate';

export class PuzzleImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PuzzleImportError';
  }
}

export function importErrorMessage(error: unknown): string {
  return error instanceof PuzzleImportError ? error.message : 'Something went wrong while opening this puzzle.';
}

function fail(message: string): never {
  throw new PuzzleImportError(message);
}

const CORRUPTED = 'This puzzle is incomplete or corrupted.';

export function toSaveFile(puzzle: Puzzle): TikkaatSaveFile {
  const p = normalizePuzzle(puzzle);
  const issues = validatePuzzle(p);
  if (issues.length > 0) {
    throw new Error(`Cannot export an invalid puzzle: ${issues[0]!.message}`);
  }
  const answers = [...p.rungs, p.endWord];
  // Omit an empty completion message so puzzles without one keep the same share string.
  const { completionMessage, ...metadata } = p.metadata;
  return {
    formatVersion: FORMAT_VERSION,
    metadata: completionMessage ? { ...metadata, completionMessage } : metadata,
    startWord: p.startWord,
    endWord: p.endWord,
    steps: p.clueBankOrder.map((s) => ({
      clue: p.clues[s]!,
      answer: encodeStepAnswer(s, answers[s]!, p.startWord),
    })),
  };
}

export function fromSaveFile(data: unknown): Puzzle {
  if (!isRecord(data)) fail('This is not a Tikkaat puzzle.');
  if (data.formatVersion !== FORMAT_VERSION) {
    fail(
      typeof data.formatVersion === 'number' && data.formatVersion > FORMAT_VERSION
        ? 'This puzzle was made with a newer version of Tikkaat.'
        : 'This is not a supported Tikkaat puzzle format.',
    );
  }

  const m = data.metadata;
  if (
    !isRecord(m) ||
    typeof m.title !== 'string' ||
    typeof m.creatorName !== 'string' ||
    typeof m.dateCreated !== 'string' ||
    typeof m.aboutThisPuzzle !== 'string' ||
    (m.completionMessage !== undefined && typeof m.completionMessage !== 'string')
  ) {
    fail('The puzzle details are missing or malformed.');
  }
  const metadata: PuzzleMetadata = {
    title: m.title,
    creatorName: m.creatorName,
    dateCreated: m.dateCreated,
    aboutThisPuzzle: m.aboutThisPuzzle,
    completionMessage: typeof m.completionMessage === 'string' ? m.completionMessage : '',
  };

  const { startWord, endWord, steps } = data;
  if (typeof startWord !== 'string' || typeof endWord !== 'string') fail('The start or end word is missing.');
  if (!Array.isArray(steps)) fail('The puzzle clues are missing.');
  if (steps.length < LIMITS.minRungs + 1 || steps.length > LIMITS.maxRungs + 1) {
    fail(`A puzzle must have between ${LIMITS.minRungs + 1} and ${LIMITS.maxRungs + 1} clues.`);
  }
  if (cipherKey(startWord).length === 0) fail('The start word must contain at least one letter.');

  const clues: (string | undefined)[] = new Array(steps.length).fill(undefined);
  const answers: string[] = new Array(steps.length).fill('');
  const clueBankOrder: number[] = [];
  for (const step of steps) {
    if (!isRecord(step) || typeof step.clue !== 'string' || typeof step.answer !== 'string') {
      fail('A puzzle clue is malformed.');
    }
    const decoded = decodeStepAnswer(step.answer, startWord);
    if (!decoded || decoded.stepIndex >= steps.length || clues[decoded.stepIndex] !== undefined) {
      fail(CORRUPTED);
    }
    clues[decoded.stepIndex] = step.clue;
    answers[decoded.stepIndex] = decoded.answer;
    clueBankOrder.push(decoded.stepIndex);
  }

  const puzzle = normalizePuzzle({
    metadata,
    startWord,
    endWord,
    rungs: answers.slice(0, -1),
    clues: clues as string[],
    clueBankOrder,
  });
  if (normalizeWord(answers[answers.length - 1]!) !== puzzle.endWord) fail(CORRUPTED);

  const issues = validatePuzzle(puzzle);
  if (issues.length > 0) fail(`This puzzle is invalid: ${issues[0]!.message}`);
  return puzzle;
}

/** Uncompressed, pretty-printed JSON for the .tikkaat file. */
export function toFileJson(puzzle: Puzzle): string {
  return `${JSON.stringify(toSaveFile(puzzle), null, 2)}\n`;
}

/** Where an opened puzzle came from, kept verbatim so it can be shared again unmodified. */
export interface PuzzleSource {
  /** Exact save-file JSON text: the uploaded file's contents, or the decompressed share code. */
  json: string;
  /** The share code as entered (whitespace removed), when opened from a code or link. */
  code?: string;
  /** The uploaded file's name, when opened from a file. */
  fileName?: string;
}

export interface LoadedPuzzle {
  puzzle: Puzzle;
  source: PuzzleSource;
}

function stripBom(text: string): string {
  return text.replace(/^﻿/, '');
}

export function loadFileJson(text: string, fileName?: string): LoadedPuzzle {
  let data: unknown;
  try {
    data = JSON.parse(stripBom(text));
  } catch {
    fail('This file is not a valid puzzle file.');
  }
  const puzzle = fromSaveFile(data);
  return { puzzle, source: fileName === undefined ? { json: text } : { json: text, fileName } };
}

export function fromFileJson(text: string): Puzzle {
  return loadFileJson(text).puzzle;
}

export function toShareString(puzzle: Puzzle): string {
  return compress(JSON.stringify(toSaveFile(puzzle)));
}

/** Accepts a raw share string or a full share link; ignores whitespace from wrapped text. */
export function extractShareString(input: string): string {
  const compact = input.replace(/\s+/g, '');
  const hashIndex = compact.lastIndexOf('#');
  return hashIndex >= 0 ? compact.slice(hashIndex + 1) : compact;
}

export function loadShareString(input: string): LoadedPuzzle {
  const code = extractShareString(input);
  if (code === '') fail('Paste a puzzle code or link.');
  if (!/^[0-9A-Za-z]+$/.test(code)) fail('This puzzle code contains invalid characters.');
  let json: string;
  let data: unknown;
  try {
    json = decompress(code);
    data = JSON.parse(json);
  } catch {
    fail(CORRUPTED);
  }
  return { puzzle: fromSaveFile(data), source: { json, code } };
}

export function fromShareString(input: string): Puzzle {
  return loadShareString(input).puzzle;
}

/** A source for a puzzle that wasn't opened from a code or file (e.g. the built-in example). */
export function sourceFromPuzzle(puzzle: Puzzle): PuzzleSource {
  return { json: JSON.stringify(toSaveFile(puzzle)) };
}

/** The original share code, or one compressed from the original JSON (same data, whitespace removed). */
export function sourceShareCode(source: PuzzleSource): string {
  return source.code ?? compress(JSON.stringify(JSON.parse(stripBom(source.json))));
}

/** The original file text, or the original JSON pretty-printed (same data). */
export function sourceFileText(source: PuzzleSource): string {
  return source.fileName !== undefined
    ? source.json
    : `${JSON.stringify(JSON.parse(stripBom(source.json)), null, 2)}\n`;
}

export function sourceFileName(source: PuzzleSource, puzzle: Puzzle): string {
  return source.fileName ?? puzzleFileName(puzzle);
}

export function shareLinkFor(code: string, pageUrl: string): string {
  return `${pageUrl.split('#')[0]}#${code}`;
}

export function toShareLink(puzzle: Puzzle, pageUrl: string): string {
  return shareLinkFor(toShareString(puzzle), pageUrl);
}

export function puzzleFileName(puzzle: Puzzle): string {
  const slug = puzzle.metadata.title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'puzzle'}.tikkaat`;
}
