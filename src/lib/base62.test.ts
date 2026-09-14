import { describe, expect, it } from 'vitest';
import { decodeBase62, encodeBase62 } from './base62';

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Reference implementation: the same number, converted one digit at a time. */
function naiveEncode(bytes: Uint8Array): string {
  let n = 1n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let text = '';
  while (n > 0n) {
    text = DIGITS[Number(n % 62n)]! + text;
    n /= 62n;
  }
  return text;
}

function randomBytes(length: number, seed: number): Uint8Array {
  let state = seed;
  return Uint8Array.from({ length }, () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state >> 16;
  });
}

describe('base62', () => {
  it('encodes known values', () => {
    expect(encodeBase62(new Uint8Array())).toBe('1');
    expect(encodeBase62(Uint8Array.of(0))).toBe('48');
    expect(encodeBase62(Uint8Array.of(255))).toBe('8F');
  });

  it('matches digit-by-digit conversion and round-trips, including leading zero bytes', () => {
    for (let length = 0; length <= 64; length++) {
      const bytes = randomBytes(length, length + 1);
      if (length >= 2) bytes.fill(0, 0, 2);
      const code = encodeBase62(bytes);
      expect(code).toBe(naiveEncode(bytes));
      expect(code).toMatch(/^[0-9A-Za-z]+$/);
      expect(decodeBase62(code)).toEqual(bytes);
    }
  });

  it('round-trips long input', () => {
    const bytes = randomBytes(20000, 7);
    expect(decodeBase62(encodeBase62(bytes))).toEqual(bytes);
  });

  it('rejects text that is not an encoded byte string', () => {
    expect(decodeBase62('')).toBeNull();
    expect(decodeBase62('ab+c')).toBeNull();
    expect(decodeBase62('0')).toBeNull();
    expect(decodeBase62('2')).toBeNull();
  });
});
