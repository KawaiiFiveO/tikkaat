import { cipherKey, decodeStepAnswer, encodeStepAnswer } from './cipher';
import { normalizeWord } from './normalize';
import { LIMITS } from './validate';

/** Highest clue (step) number: one clue per step, rungs + 1. */
export const MAX_CLUE_NUMBER = LIMITS.maxRungs + 1;

export interface CipherToolInput {
  mode: 'decode' | 'encode';
  /** The puzzle's start word, used as the cipher key. */
  startWord: string;
  /** Decode: an `answer` value from a save file. */
  encoded: string;
  /** Encode: 1-based clue number, as typed. */
  clueNumber: string;
  /** Encode: the answer word or phrase. */
  answer: string;
}

export interface CipherToolResult {
  output: { label: string; text: string } | null;
  problem: string | null;
}

/**
 * Developer tool for hand-editing save files: decodes or encodes a step's `answer` field exactly
 * as the save file format does (Beaufort over the Finnish alphabet, key = start word, with the
 * step's position letter folded in).
 */
export function runCipherTool(input: CipherToolInput): CipherToolResult {
  const none: CipherToolResult = { output: null, problem: null };
  if (cipherKey(input.startWord).length === 0) {
    return input.startWord.trim() === ''
      ? none
      : { output: null, problem: 'The start word needs at least one letter from A–Ö.' };
  }

  if (input.mode === 'decode') {
    const encoded = normalizeWord(input.encoded);
    if (encoded === '') return none;
    const decoded = decodeStepAnswer(encoded, input.startWord);
    if (!decoded || decoded.stepIndex >= MAX_CLUE_NUMBER || decoded.answer.trim() === '') {
      return {
        output: null,
        problem: "That isn't a valid answer for this start word. (A wrong start word can also decode to nonsense.)",
      };
    }
    return { output: { label: `Clue ${decoded.stepIndex + 1} answer`, text: decoded.answer }, problem: null };
  }

  const clueNumber = Number(input.clueNumber);
  if (input.clueNumber.trim() === '' || !Number.isInteger(clueNumber) || clueNumber < 1 || clueNumber > MAX_CLUE_NUMBER) {
    return { output: null, problem: `The clue number must be between 1 and ${MAX_CLUE_NUMBER}.` };
  }
  const answer = normalizeWord(input.answer);
  if (answer === '') return none;
  return {
    output: {
      label: `Encoded answer for clue ${clueNumber}`,
      text: encodeStepAnswer(clueNumber - 1, answer, input.startWord),
    },
    problem: null,
  };
}
