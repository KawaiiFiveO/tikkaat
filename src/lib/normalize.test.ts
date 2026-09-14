import { describe, expect, it } from 'vitest';
import {
  codePointLength,
  enumeration,
  enumerationLabel,
  guessKey,
  isCorrectGuess,
  normalizeWord,
} from './normalize';

describe('normalizeWord', () => {
  it('trims, collapses whitespace, and uppercases', () => {
    expect(normalizeWord('  ice \t  cream ')).toBe('ICE CREAM');
  });

  it('composes decomposed Finnish letters to NFC', () => {
    const decomposed = 'kärhu'; // a + combining diaeresis
    expect(normalizeWord(decomposed)).toBe('KÄRHU');
  });
});

describe('guess matching', () => {
  it('ignores case, spaces, and punctuation', () => {
    expect(isCorrectGuess("rock n roll", "ROCK 'N' ROLL")).toBe(true);
    expect(isCorrectGuess('icecream', 'ICE CREAM')).toBe(true);
  });

  it('matches decomposed input against precomposed answers', () => {
    expect(isCorrectGuess('lämmin', 'LÄMMIN')).toBe(true);
  });

  it('keeps Finnish letters distinct from their base letters', () => {
    expect(isCorrectGuess('LAMMIN', 'LÄMMIN')).toBe(false);
  });

  it('rejects empty and punctuation-only guesses', () => {
    expect(isCorrectGuess('', '')).toBe(false);
    expect(isCorrectGuess('!!', '?')).toBe(false);
    expect(guessKey(" '-. ")).toBe('');
  });
});

describe('enumeration', () => {
  it('counts letters per word, crossword style', () => {
    expect(enumeration('HOT')).toBe('3');
    expect(enumeration('A TON')).toBe('1, 3');
    expect(enumeration('  a   ton ')).toBe('1, 3');
  });

  it('joins hyphenated parts with a dash', () => {
    expect(enumeration('X-RAY VISION')).toBe('1-3, 6');
    expect(enumeration('R2-D2')).toBe('2-2');
  });

  it('counts only letters and digits, with Finnish letters as one each', () => {
    expect(enumeration("ROCK 'N' ROLL")).toBe('4, 1, 4');
    expect(enumeration("DON'T")).toBe('4');
    expect(enumeration('käärme')).toBe('6');
    expect(enumeration(' - ')).toBe('');
  });

  it('labels counts for screen readers', () => {
    expect(enumerationLabel('1')).toBe('1 letter');
    expect(enumerationLabel('3')).toBe('3 letters');
    expect(enumerationLabel('1, 3')).toBe('1, 3 letters');
  });
});

describe('codePointLength', () => {
  it('counts code points, not UTF-16 units', () => {
    expect(codePointLength('ÅÄÖ')).toBe(3);
    expect(codePointLength('🪜')).toBe(1);
  });
});
