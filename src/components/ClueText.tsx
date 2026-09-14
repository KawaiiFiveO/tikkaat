import type { ClueDisplay } from '../lib/game';

/** Renders clue segments as React text: words in bold, blanks as an underline. */
export function ClueText({ display }: { display: ClueDisplay }) {
  return (
    <>
      {display.segments.map((segment, i) => {
        if (segment.kind === 'text') return <span key={i}>{segment.text}</span>;
        if (segment.kind === 'word') {
          return (
            <strong key={i} className="font-semibold tracking-wide">
              {segment.text}
            </strong>
          );
        }
        return (
          <span key={i} className="inline-block w-[4.5em] border-b-2 border-ink-muted align-[-0.2em]">
            <span className="sr-only">blank</span>
          </span>
        );
      })}
      {display.result !== null && (
        <>
          {' '}
          <span aria-hidden="true">→</span>
          <span className="sr-only">gives</span>{' '}
          <strong className="font-semibold tracking-wide">{display.result}</strong>
        </>
      )}
    </>
  );
}
