import { useState } from 'react';
import { draftDisplayName, type DraftSummary } from '../lib/draftStore';
import { Button, Dialog } from './ui';

interface DraftsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Saved drafts, most recently edited first. */
  drafts: DraftSummary[];
  /** Id of the draft open in the builder. */
  currentId: string;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  /** Label beside the current draft's name. */
  currentLabel?: string;
  /** Show Open for the current draft too (e.g. from the home screen, where it isn't open yet). */
  allowOpenCurrent?: boolean;
}

function formatEdited(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function DraftsDialog({
  open,
  onClose,
  drafts,
  currentId,
  onOpen,
  onDuplicate,
  onDelete,
  onNew,
  currentLabel = 'Editing',
  allowOpenCurrent = false,
}: DraftsDialogProps) {
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const close = () => {
    setConfirmingDelete(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title="Drafts">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">Drafts save automatically in this browser as you type.</p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            onNew();
            close();
          }}
        >
          New draft
        </Button>
      </div>

      {drafts.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">
          No saved drafts yet. Start filling in the builder and your draft will appear here.
        </p>
      ) : (
        <ul className="mt-4 flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
          {drafts.map((summary) => {
            const current = summary.id === currentId;
            return (
              <li key={summary.id} className={`list-item ${current ? 'list-item-current' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold break-words">
                      {draftDisplayName(summary)}
                      {current && <span className="ml-2 text-xs font-medium text-accent">{currentLabel}</span>}
                    </div>
                    <div className="text-xs text-ink-muted">
                      <span className="uppercase">{summary.startWord || '…'}</span> →{' '}
                      <span className="uppercase">{summary.endWord || '…'}</span> · Edited{' '}
                      {formatEdited(summary.updatedAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {confirmingDelete === summary.id ? (
                      <>
                        <span className="mr-1 text-xs font-semibold text-danger">Delete this draft?</span>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setConfirmingDelete(null);
                            onDelete(summary.id);
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
                        {(!current || allowOpenCurrent) && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              onOpen(summary.id);
                              close();
                            }}
                          >
                            Open
                          </Button>
                        )}
                        <Button size="sm" onClick={() => onDuplicate(summary.id)}>
                          Duplicate
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(summary.id)}>
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
