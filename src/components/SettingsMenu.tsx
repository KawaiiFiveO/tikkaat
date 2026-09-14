import { useState } from 'react';
import { CipherTool } from './CipherTool';
import { Button, Dialog } from './ui';

interface SettingsMenuProps {
  /** Number of saved games (including the most recently played game on the Continue card). */
  savedGameCount: number;
  /** Deletes every saved game and all puzzle progress. */
  onDeleteAllGames: () => void;
  /** Number of saved (non-empty) builder drafts. */
  draftCount: number;
  /** Deletes every draft and opens a new empty one. */
  onDeleteAllDrafts: () => void;
  /** Deletes all Tikkaat data; the app reloads afterwards. */
  onClearAllData: () => void;
}

export function SettingsMenu({
  savedGameCount,
  onDeleteAllGames,
  draftCount,
  onDeleteAllDrafts,
  onClearAllData,
}: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmingGames, setConfirmingGames] = useState(false);
  const [gamesCleared, setGamesCleared] = useState(false);
  const [confirmingDraft, setConfirmingDraft] = useState(false);
  const [draftCleared, setDraftCleared] = useState(false);

  const close = () => {
    setOpen(false);
    setConfirming(false);
    setConfirmingGames(false);
    setGamesCleared(false);
    setConfirmingDraft(false);
    setDraftCleared(false);
  };

  return (
    <>
      <Button variant="bar" size="sm" onClick={() => setOpen(true)} aria-label="Settings" title="Settings">
        <span aria-hidden="true">⚙</span>
        <span className="max-sm:hidden">Settings</span>
      </Button>
      <Dialog open={open} onClose={close} title="Settings">
        <section>
          <h3 className="font-semibold">Saved games</h3>
          <p className="mt-1 text-sm text-ink-muted" role="status">
            {savedGameCount > 0
              ? 'Delete every saved game and all puzzle progress, including the game on the “Continue playing” card.'
              : gamesCleared
                ? 'Deleted all saved games.'
                : 'There are no saved games.'}
          </p>
          {confirmingGames && savedGameCount > 0 ? (
            <div role="alert" className="mt-3 rounded-lg border border-danger/50 bg-danger-soft p-3">
              <p className="text-sm font-semibold">Delete all saved games and their progress? This can't be undone.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  onClick={() => {
                    onDeleteAllGames();
                    setConfirmingGames(false);
                    setGamesCleared(true);
                  }}
                >
                  Yes, delete all saved games
                </Button>
                <Button autoFocus onClick={() => setConfirmingGames(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="mt-3"
              disabled={savedGameCount === 0}
              onClick={() => {
                setGamesCleared(false);
                setConfirmingGames(true);
              }}
            >
              Delete all saved games…
            </Button>
          )}
        </section>

        <hr className="rule my-5" />

        <section>
          <h3 className="font-semibold">Drafts</h3>
          <p className="mt-1 text-sm text-ink-muted" role="status">
            {draftCount > 0
              ? `Delete all ${draftCount} saved ${draftCount === 1 ? 'draft' : 'drafts'} and start the builder over with an empty puzzle.`
              : draftCleared
                ? 'Deleted all drafts.'
                : 'There are no saved drafts.'}
          </p>
          {confirmingDraft && draftCount > 0 ? (
            <div role="alert" className="mt-3 rounded-lg border border-danger/50 bg-danger-soft p-3">
              <p className="text-sm font-semibold">Delete all drafts? This can't be undone.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  onClick={() => {
                    onDeleteAllDrafts();
                    setConfirmingDraft(false);
                    setDraftCleared(true);
                  }}
                >
                  Yes, delete all drafts
                </Button>
                <Button autoFocus onClick={() => setConfirmingDraft(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="mt-3"
              disabled={draftCount === 0}
              onClick={() => {
                setDraftCleared(false);
                setConfirmingDraft(true);
              }}
            >
              Delete all drafts…
            </Button>
          )}
        </section>

        <hr className="rule my-5" />

        <section>
          <h3 className="font-semibold">Site data</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Delete everything Tikkaat has saved in this browser: your saved games and progress, your builder drafts,
            and your theme settings.
          </p>
          {confirming ? (
            <div role="alert" className="mt-3 rounded-lg border border-danger/50 bg-danger-soft p-3">
              <p className="text-sm font-semibold">Are you sure? This can't be undone.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="danger" onClick={onClearAllData}>
                  Yes, delete everything
                </Button>
                <Button autoFocus onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button className="mt-3" onClick={() => setConfirming(true)}>
              Clear all site data…
            </Button>
          )}
        </section>

        <hr className="rule my-5" />

        <details className="disclosure">
          <summary className="px-3 py-2 text-sm font-medium">Developer tools: answer cipher</summary>
          <div className="p-3">
            <CipherTool />
          </div>
        </details>
      </Dialog>
    </>
  );
}
