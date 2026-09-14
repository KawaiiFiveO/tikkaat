import { describe, expect, it } from 'vitest';
import { ALPHABET, beaufort, cipherKey, decodeStepAnswer, encodeStepAnswer } from './cipher';

describe('beaufort', () => {
  it('uses C = (K − P) mod 29', () => {
    // K=10, E=4 → 6 = G
    expect(beaufort('BARE', 'BARK')).toBe('AAAG');
  });

  it('wraps around through Å, Ä, Ö', () => {
    expect(ALPHABET).toHaveLength(29);
    expect(beaufort('B', 'A')).toBe('Ö'); // (0 − 1) mod 29 = 28
    expect(beaufort('Ö', 'A')).toBe('B');
    expect(beaufort('Ä', 'Å')).toBe('Ö'); // K=Å(26), P=Ä(27): (26 − 27 + 29) mod 29 = 28
  });

  it('is reciprocal', () => {
    const plain = 'KÄÄRMEEN HÄNTÄ, 42! ÅBO';
    const enciphered = beaufort(plain, 'KARHU');
    expect(enciphered).not.toBe(plain);
    expect(beaufort(enciphered, 'KARHU')).toBe(plain);
  });

  it('passes non-alphabet characters through without advancing the key', () => {
    // Key A,B: first A → (0−0)=A, space passes through, second A → (1−0)=B
    expect(beaufort('A A', 'AB')).toBe('A B');
    expect(beaufort('É-1', 'KARHU')).toBe('É-1');
  });

  it('builds the key from normalized alphabet letters only', () => {
    expect(cipherKey('ice cream!')).toHaveLength(8);
    expect(cipherKey('kä')).toEqual([10, 27]);
  });

  it('throws when the key has no alphabet letters', () => {
    expect(() => beaufort('ABC', '123')).toThrow();
  });
});

describe('step answers', () => {
  it('round-trips position and answer', () => {
    for (const index of [0, 5, 20]) {
      const encoded = encodeStepAnswer(index, 'ICE CREAM', 'KYLMÄ');
      expect(decodeStepAnswer(encoded, 'KYLMÄ')).toEqual({ stepIndex: index, answer: 'ICE CREAM' });
    }
  });

  it('rejects answers whose first character is not a letter', () => {
    expect(decodeStepAnswer('', 'KARHU')).toBeNull();
    expect(decodeStepAnswer('1ABC', 'KARHU')).toBeNull();
  });
});
