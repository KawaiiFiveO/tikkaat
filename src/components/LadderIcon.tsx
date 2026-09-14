import { useId } from 'react';

// An SVG instead of the 🪜 emoji, which many system emoji fonts (e.g. Windows 10) lack.
// Colors follow the active color theme. The favicon in index.html is the same drawing in
// fixed Lubuntu blue; keep the shapes in sync.

export function LadderIcon({ className = '' }: { className?: string }) {
  const id = useId();
  const rail = `${id}-rail`;
  const rung = `${id}-rung`;
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={rail} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: 'var(--primary-3)' }} />
          <stop offset="0.35" style={{ stopColor: 'var(--primary-1)' }} />
          <stop offset="0.6" style={{ stopColor: 'var(--primary-2)' }} />
          <stop offset="1" style={{ stopColor: 'var(--primary-border)' }} />
        </linearGradient>
        <linearGradient id={rung} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--primary-1)' }} />
          <stop offset="0.49" style={{ stopColor: 'var(--primary-2)' }} />
          <stop offset="0.51" style={{ stopColor: 'var(--primary-3)' }} />
          <stop offset="1" style={{ stopColor: 'var(--primary-4)' }} />
        </linearGradient>
      </defs>
      <g strokeWidth="1" style={{ stroke: 'var(--icon-outline)' }}>
        <g fill={`url(#${rung})`}>
          <rect x="10" y="5.5" width="12" height="3" rx="1" />
          <rect x="10" y="12" width="12" height="3" rx="1" />
          <rect x="10" y="18.5" width="12" height="3" rx="1" />
          <rect x="10" y="25" width="12" height="3" rx="1" />
        </g>
        <g fill={`url(#${rail})`}>
          <rect x="6.5" y="1.5" width="4" height="29" rx="2" />
          <rect x="21.5" y="1.5" width="4" height="29" rx="2" />
        </g>
      </g>
    </svg>
  );
}
