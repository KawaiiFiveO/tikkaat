import { describe, expect, it } from 'vitest';
import { encodeStepAnswer } from './cipher';
import { MAX_CLUE_NUMBER, runCipherTool, type CipherToolInput } from './cipherTool';
import { EXAMPLE_PUZZLE } from './examplePuzzle';
import { fromSaveFile, toSaveFile } from './serialize';

const base: CipherToolInput = { mode: 'decode', startWord: 'HIT', encoded: '', clueNumber: '1', answer: '' };
const file = toSaveFile(EXAMPLE_PUZZLE); // HIT → HOT → DOT → DOG → COG, clue bank order [2, 0, 3, 1]

describe('runCipherTool: decode', () => {
  it('decodes answers from a real save file to their clue numbers', () => {
    const decoded = file.steps.map((step) => runCipherTool({ ...base, encoded: step.answer }).output);
    expect(decoded).toEqual([
      { label: 'Clue 3 answer', text: 'DOG' },
      { label: 'Clue 1 answer', text: 'HOT' },
      { label: 'Clue 4 answer', text: 'COG' },
      { label: 'Clue 2 answer', text: 'DOT' },
    ]);
  });

  it('accepts lowercase input and a lowercase start word', () => {
    const encoded = file.steps[1]!.answer.toLowerCase();
    expect(runCipherTool({ ...base, startWord: ' hit ', encoded }).output?.text).toBe('HOT');
  });

  it('reports positions beyond the last possible clue', () => {
    const encoded = encodeStepAnswer(MAX_CLUE_NUMBER, 'DOG', 'HIT');
    expect(runCipherTool({ ...base, encoded }).problem).toMatch(/isn't a valid answer/);
  });

  it('shows nothing until there is input', () => {
    expect(runCipherTool(base)).toEqual({ output: null, problem: null });
    expect(runCipherTool({ ...base, startWord: '' , encoded: 'ABC' })).toEqual({ output: null, problem: null });
  });

  it('requires a start word with a cipher letter', () => {
    expect(runCipherTool({ ...base, startWord: '123', encoded: 'ABC' }).problem).toMatch(/at least one letter/);
  });
});

describe('runCipherTool: encode', () => {
  it('produces exactly what the save file stores, so edits import cleanly', () => {
    const encoded = runCipherTool({ ...base, mode: 'encode', clueNumber: '2', answer: ' dot ' }).output;
    expect(encoded?.label).toBe('Encoded answer for clue 2');
    expect(encoded?.text).toBe(file.steps[3]!.answer);
  });

  it('round-trips an edited answer through a save file', () => {
    const text = runCipherTool({ ...base, mode: 'encode', clueNumber: '1', answer: 'hat' }).output!.text;
    const steps = file.steps.map((step) => (step.answer === file.steps[1]!.answer ? { ...step, answer: text } : step));
    expect(fromSaveFile({ ...file, steps }).rungs).toEqual(['HAT', 'DOT', 'DOG']);
  });

  it('validates the clue number', () => {
    for (const clueNumber of ['0', '22', '1.5', 'x', '']) {
      expect(runCipherTool({ ...base, mode: 'encode', clueNumber, answer: 'HOT' }).problem).toMatch(/between 1 and 21/);
    }
  });
});
