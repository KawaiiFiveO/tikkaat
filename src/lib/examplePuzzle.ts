import type { Puzzle } from './types';

/** A nod to LeetCode's Word Ladder problem (hit → cog). */
export const EXAMPLE_PUZZLE: Puzzle = {
  metadata: {
    title: 'From HIT to COG',
    creatorName: 'Tikkaat',
    dateCreated: '2026-09-14T00:00:00.000Z',
    aboutThisPuzzle: "A short example ladder to help you get started. (LeetCode #127)",
    completionMessage: 'You made it from HIT to COG! Ready to build a ladder of your own?',
  },
  startWord: 'HIT',
  endWord: 'COG',
  rungs: ['HOT', 'DOT', 'DOG'],
  clues: [
    'Change one letter in {word} to get the opposite of cold',
    'Change the first letter of {word} to get a tiny round mark',
    "Change the last letter of {word} to get man's best friend",
    'Change the first letter of {word} to get a tooth on a gear',
  ],
  clueBankOrder: [2, 0, 3, 1],
};
