import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  activeRung,
  applyHint,
  bottommostUnsolved,
  clueBank,
  completedClues,
  createProgress,
  displayScore,
  hasProgress,
  isComplete,
  PERFECT_SCORE,
  restoreProgress,
  setDirection,
  shuffleBank,
  solvedCount,
  submitGuess,
  topmostUnsolved,
  type Direction,
  type GameProgress,
} from '../lib/game';
import {
  sourceFileName,
  sourceFileText,
  sourceShareCode,
  toShareString,
  type PuzzleSource,
} from '../lib/serialize';
import { enumeration, enumerationLabel } from '../lib/normalize';
import { readStorage, STORAGE_KEYS, writeStorage } from '../lib/storage';
import { ladderWords, type Puzzle } from '../lib/types';
import { ClueText } from './ClueText';
import { InstructionsPanel } from './InstructionsPanel';
import { ShareButtons } from './SharePanel';
import { Button, Card } from './ui';

export type PlayMode = 'shared' | 'playtest';

interface PlayerProps {
  puzzle: Puzzle;
  mode: PlayMode;
  /** Original code/file the puzzle was opened from; null for playtests. */
  source: PuzzleSource | null;
  onExit: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function Player({ puzzle, mode, source, onExit }: PlayerProps) {
  // Share from the original source, not a re-serialized copy.
  const share = useMemo(
    () =>
      source && {
        code: sourceShareCode(source),
        fileName: sourceFileName(source, puzzle),
        fileText: sourceFileText(source),
      },
    [source, puzzle],
  );
  // Playtest progress isn't saved: every edit in the builder makes a new puzzle anyway.
  const storageKey = useMemo(
    () => (mode === 'shared' ? STORAGE_KEYS.progress(toShareString(puzzle)) : null),
    [puzzle, mode],
  );
  const [progress, setProgress] = useState<GameProgress>(
    () => (storageKey ? restoreProgress(readStorage(storageKey), puzzle) : null) ?? createProgress(puzzle),
  );
  const [guess, setGuess] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (storageKey) writeStorage(storageKey, progress);
  }, [storageKey, progress]);

  const words = ladderWords(puzzle);
  const letterCounts = useMemo(() => puzzle.rungs.map(enumeration), [puzzle]);
  const rungCount = puzzle.rungs.length;
  const complete = isComplete(progress);
  const active = activeRung(progress);
  const top = topmostUnsolved(progress);
  const bottom = bottommostUnsolved(progress);
  const bank = clueBank(puzzle, progress);
  const hintStage = active >= 0 ? (progress.hints[active] ?? 0) : 0;
  const otherDirection: Direction = progress.direction === 'down' ? 'up' : 'down';
  const { title, creatorName, dateCreated, aboutThisPuzzle, completionMessage } = puzzle.metadata;

  const resetInput = () => {
    setGuess('');
    setFeedback(null);
    setShaking(false);
  };

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (guess.trim() === '') return;
    const result = submitGuess(puzzle, progress, guess);
    if (result.correct) {
      setProgress(result.progress);
      resetInput();
    } else {
      setFeedback('Not quite. Try again.');
      setShaking(true);
    }
  }

  // A correct guess is accepted as soon as it's typed; Enter only gives feedback on wrong guesses.
  function handleGuessChange(value: string) {
    const result = submitGuess(puzzle, progress, value);
    if (result.correct) {
      setProgress(result.progress);
      resetInput();
    } else {
      setGuess(value);
      setFeedback(null);
    }
  }

  function changeDirection(direction: Direction) {
    setProgress((p) => setDirection(p, direction));
    resetInput();
  }

  // Start over: fresh progress (saved over the old progress) and the puzzle's original clue order.
  function resetPuzzle() {
    const confirmNeeded = !complete && hasProgress(progress);
    if (confirmNeeded && !window.confirm('Reset this puzzle? Your solved rungs, hints, and score will be cleared.')) {
      return;
    }
    setProgress(createProgress(puzzle));
    resetInput();
  }

  function handleHint() {
    if (hintStage === 1) resetInput();
    setProgress((p) => applyHint(p));
  }

  return (
    <div className="flex flex-col gap-6">
      {mode === 'playtest' && (
        <div className="rounded-lg border border-hint/50 bg-hint-soft px-4 py-2 text-sm">
          Playtest mode. Progress isn't saved.
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold break-words">{title}</h1>
            <p className="text-sm text-ink-muted">
              {creatorName && `by ${creatorName} · `}
              {formatDate(dateCreated)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inset-box px-3 py-1.5 text-right">
              <div className="text-xs text-ink-muted">Rungs</div>
              <div className="font-semibold tabular-nums">
                {solvedCount(progress)} / {rungCount}
              </div>
            </div>
            <div className="inset-box px-3 py-1.5 text-right">
              <div className="text-xs text-ink-muted">Score</div>
              <div className="font-semibold tabular-nums">
                {displayScore(progress)} / {PERFECT_SCORE}
              </div>
            </div>
            <Button onClick={resetPuzzle} disabled={!hasProgress(progress)} title="Clear your progress on this puzzle">
              Reset
            </Button>
            <Button onClick={onExit}>{mode === 'playtest' ? 'Back to builder' : 'Back'}</Button>
          </div>
        </div>
        {aboutThisPuzzle && <p className="mt-3 whitespace-pre-line text-ink-muted">{aboutThisPuzzle}</p>}
        {share && (
          <div className="mt-4">
            <ShareButtons {...share} layout="row" />
          </div>
        )}
        <InstructionsPanel className="mt-4" />
      </Card>

      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <Card
          title="Ladder"
          actions={
            <span className="text-xs">
              {complete ? 'Complete' : progress.direction === 'down' ? '↓ Solving down' : '↑ Solving up'}
            </span>
          }
        >
          <ol className="flex flex-col gap-2">
            {words.map((word, wordIndex) => {
              const rung = wordIndex - 1;
              if (rung < 0 || rung >= rungCount) {
                return (
                  <li key={wordIndex}>
                    <WordTile word={word} tone="given" />
                  </li>
                );
              }
              if (progress.solved[rung]) {
                return (
                  <li key={wordIndex}>
                    <WordTile
                      word={word}
                      tone={progress.hints[rung] === 2 ? 'revealed' : 'solved'}
                      hinted={progress.hints[rung] === 1}
                    />
                  </li>
                );
              }
              if (rung === active) {
                return (
                  <li key={wordIndex}>
                    <form
                      onSubmit={handleSubmit}
                      onAnimationEnd={() => setShaking(false)}
                      className={`relative ${shaking ? 'motion-safe:animate-shake' : ''}`}
                    >
                      <input
                        key={`${rung}-${progress.direction}`}
                        autoFocus
                        value={guess}
                        onChange={(event) => handleGuessChange(event.target.value)}
                        aria-label={`Rung ${rung + 1}, ${enumerationLabel(letterCounts[rung] ?? '')}, solving ${progress.direction === 'down' ? 'downwards' : 'upwards'}`}
                        placeholder={progress.direction === 'down' ? '↓ Next word' : '↑ Previous word'}
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        enterKeyHint="done"
                        maxLength={60}
                        className="field field-active h-12 w-full min-w-0 px-14 text-center font-semibold tracking-[0.15em] uppercase placeholder:font-normal placeholder:tracking-normal placeholder:normal-case"
                      />
                      <span className="tile-count" aria-hidden="true">
                        {letterCounts[rung]}
                      </span>
                    </form>
                  </li>
                );
              }
              if (rung === top || rung === bottom) {
                const direction: Direction = rung === top ? 'down' : 'up';
                return (
                  <li key={wordIndex}>
                    <button
                      type="button"
                      onClick={() => changeDirection(direction)}
                      className="tile-slot relative flex h-12 w-full items-center justify-center px-14 text-sm focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      {direction === 'down' ? '↓ Solve downwards from here' : '↑ Solve upwards from here'}
                      <span className="sr-only">, {enumerationLabel(letterCounts[rung] ?? '')}</span>
                      <span className="tile-count" aria-hidden="true">
                        {letterCounts[rung]}
                      </span>
                    </button>
                  </li>
                );
              }
              return (
                <li key={wordIndex}>
                  <div
                    className="tile-slot relative h-12"
                    role="img"
                    aria-label={`Unsolved rung, ${enumerationLabel(letterCounts[rung] ?? '')}`}
                  >
                    <span className="tile-count" aria-hidden="true">
                      {letterCounts[rung]}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>

          {!complete && (
            <div className="mt-4 flex flex-col gap-2">
              <p role="status" className="min-h-5 text-sm text-danger">
                {feedback}
              </p>
              <Button onClick={handleHint}>{hintStage === 0 ? 'Hint: which clue?' : 'Hint: reveal word'}</Button>
              {top !== bottom && (
                <Button variant="ghost" onClick={() => changeDirection(otherDirection)}>
                  Switch to solving {otherDirection === 'up' ? '↑ upwards' : '↓ downwards'}
                </Button>
              )}
            </div>
          )}
        </Card>

        {complete ? (
          <Card title="Ladder complete!">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-ink-muted">
                You scored <strong className="text-ink">{displayScore(progress)}</strong> out of {PERFECT_SCORE}.
              </p>
              <Button variant="primary" onClick={resetPuzzle}>
                Play again
              </Button>
            </div>
            {completionMessage && (
              <div className="inset-box mt-4 px-4 py-3">
                <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  {creatorName ? `A message from ${creatorName}` : 'A message from the author'}
                </p>
                <p className="mt-1 whitespace-pre-line break-words">{completionMessage}</p>
              </div>
            )}
            <ol className="mt-4 flex flex-col gap-2">
              {completedClues(puzzle).map((clue) => (
                <li key={clue.step} className="list-item">
                  <ClueText display={clue} />
                </li>
              ))}
            </ol>
          </Card>
        ) : (
          <Card
            title="Clues"
            actions={
              <Button variant="bar" size="sm" onClick={() => setProgress((p) => shuffleBank(p))}>
                Shuffle
              </Button>
            }
          >
            <ul className="flex flex-col gap-2">
              {bank.available.map((clue) => {
                const hinted = clue.step === bank.hintedStep;
                return (
                  <li key={clue.step} className={`list-item ${hinted ? 'list-item-hint' : ''}`}>
                    {hinted && (
                      <span className="mb-1 block text-xs font-semibold tracking-wide text-hint uppercase">
                        Hint: this clue
                      </span>
                    )}
                    <ClueText display={clue} />
                  </li>
                );
              })}
            </ul>
            {bank.used.length > 0 && (
              <>
                <hr className="rule mt-6" />
                <h3 className="mt-4 text-sm font-semibold tracking-wide text-ink-muted uppercase">Used</h3>
                <ul className="mt-2 flex flex-col gap-2">
                  {bank.used.map((clue) => (
                    <li key={clue.step} className="list-item list-item-used">
                      <ClueText display={clue} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

interface WordTileProps {
  word: string;
  tone: 'given' | 'solved' | 'revealed';
  /** Solved after Hint 1 (showed which clue fits). */
  hinted?: boolean;
}

function WordTile({ word, tone, hinted = false }: WordTileProps) {
  const badge = tone === 'revealed' ? 'revealed' : hinted ? 'hint used' : null;
  return (
    <div className={`tile tile-${tone}`}>
      {word}
      {badge && <span className="tile-badge">{badge}</span>}
    </div>
  );
}
