import { COPYRIGHT_HOLDER, COPYRIGHT_URL, COPYRIGHT_YEAR, REPO_URL } from '../lib/siteInfo';

export function Footer() {
  return (
    <footer className="app-footer">
      <div className="page-column flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-xs">
        <p>
          sanaketjumuunnospulmapeli © {COPYRIGHT_YEAR}{' '}
          <a href={COPYRIGHT_URL} target="_blank" rel="noreferrer">
            {COPYRIGHT_HOLDER}
          </a>
        </p>
        {REPO_URL ? (
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Source (GitHub)
          </a>
        ) : (
          <span title="Repository link coming soon">Source on GitHub (coming soon)</span>
        )}
      </div>
    </footer>
  );
}
