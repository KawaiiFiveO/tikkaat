import { normalizeWord } from './normalize';

/** Finnish alphabet, in order. Index A=0 … Ö=28. */
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ';

/** Alphabet indices of the letters in the key word; other characters are ignored. */
export function cipherKey(keyWord: string): number[] {
  return [...normalizeWord(keyWord)].map((ch) => ALPHABET.indexOf(ch)).filter((index) => index >= 0);
}

/**
 * Beaufort cipher over the Finnish alphabet: C = (K − P) mod 29.
 * Reciprocal, so the same call enciphers and deciphers. Characters outside the
 * alphabet pass through unchanged and do not advance the key.
 */
export function beaufort(text: string, keyWord: string): string {
  const key = cipherKey(keyWord);
  if (key.length === 0) {
    throw new Error('Cipher key must contain at least one letter.');
  }
  let result = '';
  let keyPosition = 0;
  for (const ch of text) {
    const p = ALPHABET.indexOf(ch);
    if (p < 0) {
      result += ch;
      continue;
    }
    const k = key[keyPosition % key.length]!;
    result += ALPHABET.charAt((k - p + ALPHABET.length) % ALPHABET.length);
    keyPosition++;
  }
  return result;
}

export function encodeStepAnswer(stepIndex: number, answer: string, startWord: string): string {
  return beaufort(ALPHABET.charAt(stepIndex) + answer, startWord);
}

export function decodeStepAnswer(
  encoded: string,
  startWord: string,
): { stepIndex: number; answer: string } | null {
  const plain = beaufort(encoded, startWord);
  if (plain === '') return null;
  const stepIndex = ALPHABET.indexOf(plain.charAt(0));
  if (stepIndex < 0) return null;
  return { stepIndex, answer: plain.slice(1) };
}
