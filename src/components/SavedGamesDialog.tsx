import { useState } from 'react';
import { formatDateTime } from '../lib/format';
import { displayScore, isComplete, PERFECT_SCORE, solvedCount } from '../lib/game';
import type { SavedGame } from '../lib/gamesStore';
import { Button, Dialog } from './ui';

interface SavedGamesDialogProps {
  open: boolean;
  onClose: () => void;
  /** Games with progress, most recently played first. */
  games: SavedGame[];
  onContinue: (game: SavedGame) => void;
  /** Deletes a game and its progress. */
  onDelete: (id: string) => void;
}

export function SavedGamesDialog({ open, onClose, games, onContinue, onDelete }: SavedGamesDialogProps) {
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const close = () => {
    setConfirmingDelete(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title="Saved games">
      <p className="text-sm text-ink-muted">
        Puzzles you've saved in this browser, most recently played first.
      </p>

      {games.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">No saved games yet.</p>
      ) : (
        <ul className="mt-4 flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
          {games.map((game) => {
            const { puzzle, progress } = game;
            const complete = isComplete(progress);
            return (
              <li key={game.id} className="list-item">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold break-words">
                      {puzzle.metadata.title}
                      {complete && <span className="ml-2 text-xs font-medium text-success">Completed</span>}
                    </div>
                    <div className="text-xs text-ink-muted">
                      {puzzle.startWord} → {puzzle.endWord} · {solvedCount(progress)} / {puzzle.rungs.length} rungs ·
                      Score {displayScore(progress)} / {PERFECT_SCORE}
                    </div>
                    <div className="text-xs text-ink-muted">Played {formatDateTime(game.lastPlayed)}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {confirmingDelete === game.id ? (
                      <>
                        <span className="mr-1 text-xs font-semibold text-danger">
                          Delete this game and its progress?
                        </span>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setConfirmingDelete(null);
                            onDelete(game.id);
                          }}
                        >
                          Delete
                        </Button>
                        <Button size="sm" autoFocus onClick={() => setConfirmingDelete(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            close();
                            onContinue(game);
                          }}
                        >
                          {complete ? 'View' : 'Continue'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(game.id)}>
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
