import { deflateSync, inflateSync } from 'fflate';
import { decodeBase62, encodeBase62 } from './base62';
import { cipherKey, decodeStepAnswer, encodeStepAnswer } from './cipher';
import { isRecord, isStringArray } from './guards';
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

/** The normalized puzzle; throws if it isn't valid enough to export. */
function exportablePuzzle(puzzle: Puzzle): Puzzle {
  const p = normalizePuzzle(puzzle);
  const issues = validatePuzzle(p);
  if (issues.length > 0) {
    throw new Error(`Cannot export an invalid puzzle: ${issues[0]!.message}`);
  }
  return p;
}

function checkFormatVersion(version: unknown): void {
  if (version !== FORMAT_VERSION) {
    fail(
      typeof version === 'number' && version > FORMAT_VERSION
        ? 'This puzzle was made with a newer version of Tikkaat.'
        : 'This is not a supported Tikkaat puzzle format.',
    );
  }
}

function checkStepCount(count: number): void {
  if (count < LIMITS.minRungs + 1 || count > LIMITS.maxRungs + 1) {
    fail(`A puzzle must have between ${LIMITS.minRungs + 1} and ${LIMITS.maxRungs + 1} clues.`);
  }
}

/** A puzzle decoded from a file or code, normalized and validated. */
function validImport(puzzle: Puzzle): Puzzle {
  const issues = validatePuzzle(puzzle);
  if (issues.length > 0) fail(`This puzzle is invalid: ${issues[0]!.message}`);
  return puzzle;
}

export function toSaveFile(puzzle: Puzzle): TikkaatSaveFile {
  const p = exportablePuzzle(puzzle);
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
  checkFormatVersion(data.formatVersion);

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
  checkStepCount(steps.length);
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
  return validImport(puzzle);
}

/** Uncompressed, pretty-printed JSON for the .tikkaat file. */
export function toFileJson(puzzle: Puzzle): string {
  return `${JSON.stringify(toSaveFile(puzzle), null, 2)}\n`;
}

/** Where an opened puzzle came from, kept verbatim so it can be shared again unmodified. */
export interface PuzzleSource {
  /** Exact save-file JSON text: the uploaded file's contents, or for a share code, its puzzle's canonical save-file JSON. */
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

/** Larger files aren't read at all, since a dropped file can be anything. Real puzzle files are a few KB. */
export const MAX_PUZZLE_FILE_BYTES = 1_000_000;

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

/*
 * Share codes are a keyless JSON tuple in ladder order, compressed with raw DEFLATE and written as
 * one base62 number (only 0-9A-Za-z):
 *   [formatVersion, title, creatorName, dateCreated, aboutThisPuzzle, words, clues, clueBankOrder, completionMessage?]
 * where words = [startWord, ...rungs, endWord]. Words are plaintext: the compressed code can't be
 * read at a glance, so the cipher would only add length. An empty completion message is left off.
 */

/** Longer input is rejected before decoding, so pasted junk can't stall the page. Real codes are far shorter. */
const MAX_CODE_LENGTH = 50_000;
/** Decompressed size limit, so a short code can't expand into megabytes. */
const MAX_CODE_JSON_BYTES = 200_000;

export function toShareString(puzzle: Puzzle): string {
  const p = exportablePuzzle(puzzle);
  const { title, creatorName, dateCreated, aboutThisPuzzle, completionMessage } = p.metadata;
  const words = [p.startWord, ...p.rungs, p.endWord];
  const tuple: unknown[] = [FORMAT_VERSION, title, creatorName, dateCreated, aboutThisPuzzle, words, p.clues, p.clueBankOrder];
  if (completionMessage) tuple.push(completionMessage);
  return encodeBase62(deflateSync(new TextEncoder().encode(JSON.stringify(tuple)), { level: 9 }));
}

function fromShareTuple(data: unknown): Puzzle {
  if (!Array.isArray(data)) fail('This is not a Tikkaat puzzle.');
  checkFormatVersion(data[0]);
  const [, title, creatorName, dateCreated, aboutThisPuzzle, words, clues, clueBankOrder, completionMessage = ''] =
    data as unknown[];
  if (
    data.length > 9 ||
    typeof title !== 'string' ||
    typeof creatorName !== 'string' ||
    typeof dateCreated !== 'string' ||
    typeof aboutThisPuzzle !== 'string' ||
    typeof completionMessage !== 'string'
  ) {
    fail('The puzzle details are missing or malformed.');
  }
  if (!isStringArray(words) || words.length < 2) fail('The start or end word is missing.');
  if (!isStringArray(clues) || !Array.isArray(clueBankOrder)) fail('The puzzle clues are missing.');
  checkStepCount(clues.length);
  return validImport(
    normalizePuzzle({
      metadata: { title, creatorName, dateCreated, aboutThisPuzzle, completionMessage },
      startWord: words[0]!,
      endWord: words[words.length - 1]!,
      rungs: words.slice(1, -1),
      clues,
      clueBankOrder: clueBankOrder as number[],
    }),
  );
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
  if (code.length > MAX_CODE_LENGTH) fail(CORRUPTED);
  let data: unknown;
  try {
    const packed = decodeBase62(code);
    if (!packed) throw new Error('Not a base62 byte string');
    const bytes = inflateSync(packed);
    if (bytes.length > MAX_CODE_JSON_BYTES) throw new Error('Decompressed data is too large');
    data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    fail(CORRUPTED);
  }
  const puzzle = fromShareTuple(data);
  return { puzzle, source: { ...sourceFromPuzzle(puzzle), code } };
}

export function fromShareString(input: string): Puzzle {
  return loadShareString(input).puzzle;
}

/** A source for a puzzle that wasn't opened from a code or file (e.g. the built-in example). */
export function sourceFromPuzzle(puzzle: Puzzle): PuzzleSource {
  return { json: JSON.stringify(toSaveFile(puzzle)) };
}

/** The original share code, or one built from the original JSON's puzzle. */
export function sourceShareCode(source: PuzzleSource): string {
  return source.code ?? toShareString(loadFileJson(source.json).puzzle);
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
