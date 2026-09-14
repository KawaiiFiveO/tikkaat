/** Digits in value order: codes use only 0-9A-Za-z. */
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const DIGIT_PATTERN = /^[0-9A-Za-z]+$/;

// Digits are converted CHUNK at a time: 62^8 < 2^53, so a chunk fits in a plain number, and long
// inputs need 8x fewer BigInt operations than converting one digit at a time.
const CHUNK = 8;
const CHUNK_BASE = 62n ** BigInt(CHUNK);

function chunkDigits(value: number, width: number): string {
  let digits = '';
  do {
    digits = DIGITS[value % 62]! + digits;
    value = Math.floor(value / 62);
  } while (value > 0);
  return digits.padStart(width, '0');
}

/**
 * Writes bytes as one base62 number, the densest encoding in these digits. A 0x01 byte is
 * prepended so leading zero bytes survive.
 */
export function encodeBase62(bytes: Uint8Array): string {
  let n = BigInt(`0x01${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`);
  const chunks: string[] = [];
  while (n >= CHUNK_BASE) {
    chunks.push(chunkDigits(Number(n % CHUNK_BASE), CHUNK));
    n /= CHUNK_BASE;
  }
  chunks.push(chunkDigits(Number(n), 0));
  return chunks.reverse().join('');
}

/** Reverses encodeBase62, or returns null if the text isn't a base62 number with the 0x01 marker. */
export function decodeBase62(text: string): Uint8Array | null {
  if (!DIGIT_PATTERN.test(text)) return null;
  let n = 0n;
  for (let end = text.length % CHUNK || CHUNK, start = 0; start < text.length; start = end, end += CHUNK) {
    let value = 0;
    for (let i = start; i < end; i++) value = value * 62 + DIGITS.indexOf(text[i]!);
    n = n * CHUNK_BASE + BigInt(value);
  }
  let hex = n.toString(16);
  if (hex.length % 2 === 1) hex = `0${hex}`;
  if (!hex.startsWith('01')) return null;
  return Uint8Array.from({ length: hex.length / 2 - 1 }, (_, i) => parseInt(hex.slice(2 + 2 * i, 4 + 2 * i), 16));
}
