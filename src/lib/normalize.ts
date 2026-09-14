/** Unicode NFC, so Ä is always U+00C4 and never A + combining diaeresis. */
export function normalizeText(text: string): string {
  return text.normalize('NFC');
}

/** Storage form of a ladder word: trimmed, single spaces, uppercase. */
export function normalizeWord(word: string): string {
  return normalizeText(normalizeText(word).trim().replace(/\s+/g, ' ').toUpperCase());
}

/** Comparison form of a guess or answer: uppercase letters and digits only. */
export function guessKey(text: string): string {
  return normalizeText(normalizeText(text).toUpperCase()).replace(/[^\p{L}\p{N}]/gu, '');
}

export function isCorrectGuess(guess: string, answer: string): boolean {
  const key = guessKey(guess);
  return key !== '' && key === guessKey(answer);
}

export function codePointLength(text: string): number {
  return [...text].length;
}

/**
 * Crossword-style letter counts for an answer: words separated by ", ", hyphenated parts by "-".
 * Only letters and digits count. "A TON" → "1, 3", "X-RAY VISION" → "1-3, 6", "ROCK 'N' ROLL" → "4, 1, 4".
 */
export function enumeration(answer: string): string {
  return normalizeText(answer)
    .trim()
    .split(/\s+/)
    .map((word) =>
      word
        .split('-')
        .map((part) => [...part].filter((ch) => /[\p{L}\p{N}]/u.test(ch)).length)
        .filter((count) => count > 0)
        .join('-'),
    )
    .filter((word) => word !== '')
    .join(', ');
}

/** Screen reader label for an enumeration: "1 letter", "3 letters", "1, 3 letters". */
export function enumerationLabel(counts: string): string {
  return counts === '1' ? '1 letter' : `${counts} letters`;
}

export function hasLetterOrDigit(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}
