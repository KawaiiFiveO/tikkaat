import { describe, expect, it } from 'vitest';
import { preferActiveSource, restoreActiveSource } from './activePuzzle';
import { EXAMPLE_PUZZLE } from './examplePuzzle';
import { loadFileJson, loadShareString, toSaveFile, toShareString } from './serialize';
import type { Puzzle } from './types';

const fileText = `${JSON.stringify(toSaveFile(EXAMPLE_PUZZLE), null, 4)}\n`;
const OTHER_PUZZLE: Puzzle = { ...EXAMPLE_PUZZLE, metadata: { ...EXAMPLE_PUZZLE.metadata, title: 'Another ladder' } };

describe('restoreActiveSource', () => {
  it('restores a stored file source unchanged', () => {
    const { source } = loadFileJson(fileText, 'ladder.json');
    expect(restoreActiveSource(JSON.parse(JSON.stringify(source)))).toEqual(source);
  });

  it('restores a stored code source unchanged', () => {
    const { source } = loadShareString(toShareString(EXAMPLE_PUZZLE));
    expect(restoreActiveSource(JSON.parse(JSON.stringify(source)))).toEqual(source);
  });

  it('rejects malformed or unparseable sources', () => {
    expect(restoreActiveSource(null)).toBeNull();
    expect(restoreActiveSource('abc')).toBeNull();
    expect(restoreActiveSource({ code: 'abc' })).toBeNull();
    expect(restoreActiveSource({ json: '{not json' })).toBeNull();
    expect(restoreActiveSource({ json: fileText, fileName: 42 })).toBeNull();
  });
});

describe('preferActiveSource', () => {
  const fromFile = loadFileJson(fileText, 'ladder.json');

  it('keeps the original file when a link reopens the same puzzle', () => {
    const fromLink = loadShareString(toShareString(EXAMPLE_PUZZLE));
    expect(preferActiveSource(fromLink, fromFile.source).source).toEqual(fromFile.source);
  });

  it('uses the new source for a different puzzle or when nothing is active', () => {
    const other = loadShareString(toShareString(OTHER_PUZZLE));
    expect(preferActiveSource(other, fromFile.source)).toBe(other);
    expect(preferActiveSource(other, null)).toBe(other);
  });
});
