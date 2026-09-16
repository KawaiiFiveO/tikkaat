import { deflateSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { encodeBase62 } from './base62';
import { EXAMPLE_PUZZLE } from './examplePuzzle';
import {
  fromFileJson,
  fromSaveFile,
  fromShareString,
  loadFileJson,
  loadShareString,
  PuzzleImportError,
  puzzleFileName,
  shareLinkFor,
  sourceFileName,
  sourceFileText,
  sourceFromPuzzle,
  sourceShareCode,
  toFileJson,
  toSaveFile,
  toShareLink,
  toShareString,
} from './serialize';
import type { Puzzle } from './types';
import { LIMITS, normalizePuzzle } from './validate';

/** A share code for an arbitrary payload, for testing what decoding accepts. */
const codeFor = (payload: unknown) => encodeBase62(deflateSync(new TextEncoder().encode(JSON.stringify(payload))));

const FINNISH_PUZZLE: Puzzle = {
  metadata: {
    title: 'Kylmästä lämpimään',
    creatorName: 'Äijä Öljynen',
    dateCreated: '2026-09-13T12:00:00.000Z',
    aboutThisPuzzle: 'Åland, sauna ja jäätelö.',
    completionMessage: '',
  },
  startWord: 'kylmä',
  endWord: 'lämmin',
  rungs: ['jää tee', 'Å-KIRJAIN', 'SÄÄ 42'],
  clues: ['{word} ja jää', 'Vaihda {word}', 'Käännä {word} → {word}', 'Lisää {word}'],
  clueBankOrder: [3, 1, 0, 2],
};

describe('file JSON', () => {
  it('round-trips', () => {
    expect(fromFileJson(toFileJson(EXAMPLE_PUZZLE))).toEqual(normalizePuzzle(EXAMPLE_PUZZLE));
    expect(fromFileJson(toFileJson(FINNISH_PUZZLE))).toEqual(normalizePuzzle(FINNISH_PUZZLE));
  });

  it('is pretty-printed and uncompressed, with answers hidden', () => {
    const json = toFileJson(EXAMPLE_PUZZLE);
    expect(json).toContain('\n  "metadata": {');
    expect(json).toContain('Change one letter in {word} to get the opposite of cold');
    for (const rung of EXAMPLE_PUZZLE.rungs) expect(json).not.toContain(rung);
  });

  it('stores steps in clue bank order', () => {
    const file = toSaveFile(EXAMPLE_PUZZLE);
    expect(file.steps.map((step) => step.clue)).toEqual(
      EXAMPLE_PUZZLE.clueBankOrder.map((s) => EXAMPLE_PUZZLE.clues[s]),
    );
  });

  it('tolerates a byte order mark', () => {
    expect(fromFileJson(`﻿${toFileJson(EXAMPLE_PUZZLE)}`).startWord).toBe('HIT');
  });
});

describe('share strings and links', () => {
  it('round-trips using only base62 characters', () => {
    for (const puzzle of [EXAMPLE_PUZZLE, FINNISH_PUZZLE]) {
      const code = toShareString(puzzle);
      expect(code).toMatch(/^[0-9A-Za-z]+$/);
      expect(fromShareString(code)).toEqual(normalizePuzzle(puzzle));
    }
  });

  it('round-trips a puzzle at every limit', () => {
    const word = (i: number) => `ÅÄÖ SANA ${i}`.padEnd(LIMITS.wordMaxLength, 'X');
    const text = (length: number) => 'Lisää {word} ja käännä, jotta saat jotain muuta. '.repeat(20).slice(0, length);
    const puzzle: Puzzle = {
      metadata: {
        title: text(LIMITS.titleMaxLength),
        creatorName: text(LIMITS.creatorMaxLength),
        dateCreated: '2026-09-14T08:30:00.000Z',
        aboutThisPuzzle: text(LIMITS.aboutMaxLength),
        completionMessage: text(LIMITS.completionMessageMaxLength),
      },
      startWord: word(100),
      endWord: word(101),
      rungs: Array.from({ length: LIMITS.maxRungs }, (_, i) => word(i)),
      clues: Array.from({ length: LIMITS.maxRungs + 1 }, (_, i) => `${i} ${text(LIMITS.clueMaxLength)}`.slice(0, 150)),
      clueBankOrder: Array.from({ length: LIMITS.maxRungs + 1 }, (_, i) => (i * 8) % (LIMITS.maxRungs + 1)),
    };
    const code = toShareString(puzzle);
    expect(code).toMatch(/^[0-9A-Za-z]+$/);
    expect(fromShareString(code)).toEqual(normalizePuzzle(puzzle));
  });

  it('is stable across re-export', () => {
    const code = toShareString(EXAMPLE_PUZZLE);
    expect(toShareString(fromShareString(code))).toBe(code);
  });

  it('ignores whitespace from wrapped text', () => {
    const code = toShareString(EXAMPLE_PUZZLE);
    const wrapped = `  ${code.slice(0, 10)}\n${code.slice(10, 30)} \r\n${code.slice(30)}  `;
    expect(fromShareString(wrapped).startWord).toBe('HIT');
  });

  it('round-trips links and replaces an existing hash', () => {
    const link = toShareLink(FINNISH_PUZZLE, 'https://example.github.io/tikkaat/#old');
    expect(link).toBe(`https://example.github.io/tikkaat/#${toShareString(FINNISH_PUZZLE)}`);
    expect(fromShareString(link)).toEqual(normalizePuzzle(FINNISH_PUZZLE));
  });
});

describe('import errors', () => {
  const expectImportError = (fn: () => unknown) => expect(fn).toThrow(PuzzleImportError);

  it('rejects empty, invalid, truncated, and garbage share strings', () => {
    const code = toShareString(EXAMPLE_PUZZLE);
    expectImportError(() => fromShareString(''));
    expectImportError(() => fromShareString('abc+def'));
    expectImportError(() => fromShareString(code.slice(0, -5)));
    expectImportError(() => fromShareString(code.slice(5)));
    expectImportError(() => fromShareString('zzzzzzzzzzzz'));
    expectImportError(() => fromShareString('A'.repeat(60_000)));
  });

  describe('share code payloads', () => {
    const tuple = [
      1,
      'From HIT to COG',
      'Tikkaat',
      '2026-09-14T00:00:00.000Z',
      'About',
      ['HIT', 'hot', 'DOT', 'DOG', 'COG'],
      EXAMPLE_PUZZLE.clues,
      [2, 0, 3, 1],
    ];
    const withItem = (index: number, value: unknown) => tuple.map((item, i) => (i === index ? value : item));

    it('accepts a valid payload and normalizes it', () => {
      const puzzle = fromShareString(codeFor([...tuple, 'Well done']));
      expect(puzzle.rungs).toEqual(['HOT', 'DOT', 'DOG']);
      expect(puzzle.metadata.completionMessage).toBe('Well done');
      expect(fromShareString(codeFor(tuple)).metadata.completionMessage).toBe('');
    });

    it('rejects newer versions, wrong shapes, and invalid puzzles', () => {
      expect(() => fromShareString(codeFor(withItem(0, 2)))).toThrow(/newer version/);
      expectImportError(() => fromShareString(codeFor(toSaveFile(EXAMPLE_PUZZLE))));
      expectImportError(() => fromShareString(codeFor(withItem(1, 42))));
      expectImportError(() => fromShareString(codeFor(withItem(5, 'HIT HOT DOT DOG COG'))));
      expectImportError(() => fromShareString(codeFor(withItem(6, ['no placeholder', 'a', 'b', 'c']))));
      expectImportError(() => fromShareString(codeFor(withItem(7, [0, 0, 1, 2]))));
      expectImportError(() => fromShareString(codeFor([...tuple, 42])));
      expectImportError(() => fromShareString(codeFor([...tuple, 'message', 'extra'])));
    });
  });

  it('rejects files that are not puzzles', () => {
    expectImportError(() => fromFileJson('not json'));
    expectImportError(() => fromFileJson('[]'));
    expectImportError(() => fromFileJson('{"formatVersion":1}'));
  });

  it('rejects newer format versions', () => {
    const file = { ...toSaveFile(EXAMPLE_PUZZLE), formatVersion: 2 };
    expect(() => fromSaveFile(file)).toThrow(/newer version/);
  });

  it('rejects duplicate or out-of-range positions', () => {
    const file = toSaveFile(EXAMPLE_PUZZLE);
    const duplicated = { ...file, steps: [file.steps[0], file.steps[0], file.steps[2], file.steps[3]] };
    expectImportError(() => fromSaveFile(duplicated));
    expectImportError(() => fromSaveFile({ ...file, steps: file.steps.slice(0, 3) }));
  });

  it('rejects a final answer that does not match the end word', () => {
    expectImportError(() => fromSaveFile({ ...toSaveFile(EXAMPLE_PUZZLE), endWord: 'CAT' }));
  });

  it('re-validates limits on import', () => {
    const file = toSaveFile(EXAMPLE_PUZZLE);
    const steps = file.steps.map((step) => ({ ...step, clue: 'no placeholder' }));
    expectImportError(() => fromSaveFile({ ...file, steps }));
  });
});

describe('{next} clues', () => {
  const INLINE: Puzzle = {
    ...EXAMPLE_PUZZLE,
    clues: [
      '{word} becomes {next}, the opposite of cold',
      'Change the first letter of {word} to get a tiny round mark',
      "Change the last letter of {word} to get man's best friend",
      '{word} {next}, a tooth on a gear',
    ],
  };

  // {next} lives inside the clue string, so it needs no change to the save file or share code format.
  it('round-trips through files and share strings under format version 1', () => {
    expect(fromFileJson(toFileJson(INLINE))).toEqual(normalizePuzzle(INLINE));
    expect(fromShareString(toShareString(INLINE))).toEqual(normalizePuzzle(INLINE));
    expect(toSaveFile(INLINE).formatVersion).toBe(1);
  });

  it('leaves puzzles without it byte-for-byte unchanged', () => {
    expect(toFileJson(EXAMPLE_PUZZLE)).not.toContain('{next}');
    expect(toShareString(EXAMPLE_PUZZLE)).toBe(toShareString({ ...EXAMPLE_PUZZLE, clues: [...EXAMPLE_PUZZLE.clues] }));
  });
});

describe('completion message', () => {
  const withMessage = (completionMessage: string): Puzzle => ({
    ...EXAMPLE_PUZZLE,
    metadata: { ...EXAMPLE_PUZZLE.metadata, completionMessage },
  });

  it('round-trips through share strings and files, keeping line breaks', () => {
    const puzzle = withMessage('Hyvin tehty!\nSee you next time.');
    expect(fromShareString(toShareString(puzzle)).metadata.completionMessage).toBe('Hyvin tehty!\nSee you next time.');
    expect(fromFileJson(toFileJson(puzzle)).metadata.completionMessage).toBe('Hyvin tehty!\nSee you next time.');
  });

  it('leaves an empty message out of the file, so puzzles without one keep their share string', () => {
    const file = toSaveFile(withMessage('   '));
    expect('completionMessage' in file.metadata).toBe(false);
    expect(toShareString(withMessage(''))).toBe(toShareString(withMessage('  ')));
  });

  it('accepts files without the field and rejects a non-string message', () => {
    const file = toSaveFile(withMessage(''));
    expect(fromSaveFile(file).metadata.completionMessage).toBe('');
    expect(() => fromSaveFile({ ...file, metadata: { ...file.metadata, completionMessage: 42 } })).toThrow(
      PuzzleImportError,
    );
  });
});

describe('puzzle sources', () => {
  it('keeps an uploaded file byte-for-byte and derives a working code from it', () => {
    const text = `﻿${JSON.stringify(toSaveFile(EXAMPLE_PUZZLE), null, 4)}`;
    const { puzzle, source } = loadFileJson(text, 'My Ladder.json');
    expect(source).toEqual({ json: text, fileName: 'My Ladder.json' });
    expect(sourceFileText(source)).toBe(text);
    expect(sourceFileName(source, puzzle)).toBe('My Ladder.json');
    const code = sourceShareCode(source);
    expect(code).toMatch(/^[0-9A-Za-z]+$/);
    expect(fromShareString(code)).toEqual(puzzle);
  });

  it('keeps a pasted code as entered and derives the file from its JSON', () => {
    const code = toShareString(FINNISH_PUZZLE);
    const { puzzle, source } = loadShareString(`https://example.github.io/tikkaat/#${code.slice(0, 20)}\n${code.slice(20)}`);
    expect(source.code).toBe(code);
    expect(sourceShareCode(source)).toBe(code);
    expect(sourceFileText(source)).toBe(toFileJson(FINNISH_PUZZLE));
    expect(sourceFileName(source, puzzle)).toBe('kylmästä-lämpimään.tikkaat');
  });

  it('matches the canonical code and file for generated sources', () => {
    const source = sourceFromPuzzle(EXAMPLE_PUZZLE);
    expect(sourceShareCode(source)).toBe(toShareString(EXAMPLE_PUZZLE));
    expect(sourceFileText(source)).toBe(toFileJson(EXAMPLE_PUZZLE));
  });

  it('builds links from a code', () => {
    expect(shareLinkFor('abc123', 'https://example.github.io/tikkaat/#old')).toBe(
      'https://example.github.io/tikkaat/#abc123',
    );
  });
});

describe('puzzleFileName', () => {
  it('slugifies the title', () => {
    expect(puzzleFileName(EXAMPLE_PUZZLE)).toBe('from-hit-to-cog.tikkaat');
    expect(puzzleFileName(FINNISH_PUZZLE)).toBe('kylmästä-lämpimään.tikkaat');
  });
});
