export function InstructionsPanel({ className = '' }: { className?: string }) {
  return (
    <details className={`disclosure ${className}`}>
      <summary className="px-3 py-2 text-sm font-medium">How to play</summary>
      <ul className="list-disc space-y-1.5 py-3 pr-3 pl-8 text-sm text-ink-muted">
        <li>Get from the top word to the bottom word, one rung at a time.</li>
        <li>
          The clues are shuffled, and only one fits the current step. <strong className="text-ink">Shuffle</strong>{' '}
          reorders the list.
        </li>
        <li>
          <strong className="text-ink">Solving ↓ downwards:</strong> every clue shows the current word. Find the clue
          that works and enter the next word.
        </li>
        <li>
          <strong className="text-ink">Solving ↑ upwards:</strong> every clue shows the current word as its result.
          Find the word that fills the blank.
        </li>
        <li>
          Some clues read as a phrase containing both words, so the word you're looking for sits in a blank inside the
          clue rather than after the arrow.
        </li>
        <li>
          <strong className="text-ink">Cross off a clue</strong> by clicking it, to rule out the ones that don't fit
          the step you're on. Click it again to bring it back.
        </li>
        <li>
          Switch direction at any time with the switch button, by tapping the empty rung at the other end, or by
          pressing <strong className="text-ink">↑</strong> or <strong className="text-ink">↓</strong> while
          typing your answer.
        </li>
        <li>
          <strong className="text-ink">Hints:</strong> the first shows which clue fits the step; the second reveals
          the word.
        </li>
        <li>
          <strong className="text-ink">Scoring:</strong> a perfect ladder is 1000 points, split evenly across the
          rungs. A rung is worth half after a clue hint and nothing if revealed.
        </li>
      </ul>
    </details>
  );
}
