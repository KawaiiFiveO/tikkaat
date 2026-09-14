import { displayScore, isComplete, PERFECT_SCORE, solvedCount, type GameProgress } from '../lib/game';
import { useState } from 'react';
import type { DraftSummary } from '../lib/draftStore';
import type { LoadedPuzzle } from '../lib/serialize';
import type { Puzzle } from '../lib/types';
import { DraftsDialog } from './DraftsDialog';
import { ImportPanel } from './ImportPanel';
import { Button, Card } from './ui';

export interface ActiveGame extends LoadedPuzzle {
  progress: GameProgress;
}

interface HomeProps {
  linkError: string | null;
  activeGame: ActiveGame | null;
  hasDraft: boolean;
  onContinue: (game: ActiveGame) => void;
  onBuild: () => void;
  onPlayExample: () => void;
  onPlay: (loaded: LoadedPuzzle) => void;
  onEdit: (puzzle: Puzzle) => void;
  /** Saved drafts, most recently edited first. */
  drafts: DraftSummary[];
  /** Id of the draft the builder has open. */
  draftId: string;
  /** Opens a draft in the builder. */
  onOpenDraft: (id: string) => void;
  onDuplicateDraft: (id: string) => void;
  onDeleteDraft: (id: string) => void;
  /** Creates a new draft and goes to the builder. */
  onNewDraft: () => void;
}

export function Home({
  linkError,
  activeGame,
  hasDraft,
  onContinue,
  onBuild,
  onPlayExample,
  onPlay,
  onEdit,
  drafts,
  draftId,
  onOpenDraft,
  onDuplicateDraft,
  onDeleteDraft,
  onNewDraft,
}: HomeProps) {
  const [showDrafts, setShowDrafts] = useState(false);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {linkError && (
        <div role="alert" className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm">
          Couldn't open the puzzle link. {linkError}
        </div>
      )}
      {activeGame && <ContinueCard game={activeGame} onContinue={onContinue} />}
      <Card>
        <h1 className="text-3xl font-bold">Tikkaat</h1>
        <p className="mt-2 text-ink-muted">
          The word-ladder transformation puzzle game. Work from the top word to the bottom word, one rung at a time,
          using the list of clues.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant={activeGame ? 'secondary' : 'primary'} onClick={onBuild}>
            {hasDraft ? 'Continue building' : 'Build a puzzle'}
          </Button>
          <Button onClick={onPlayExample}>Play an example</Button>
          {drafts.length > 0 && <Button onClick={() => setShowDrafts(true)}>Drafts ({drafts.length})</Button>}
        </div>
      </Card>
      <ImportPanel onPlay={onPlay} onEdit={onEdit} />
      <DraftsDialog
        open={showDrafts}
        onClose={() => setShowDrafts(false)}
        drafts={drafts}
        currentId={draftId}
        onOpen={onOpenDraft}
        onDuplicate={onDuplicateDraft}
        onDelete={onDeleteDraft}
        onNew={onNewDraft}
        currentLabel="Current"
        allowOpenCurrent
      />
    </div>
  );
}

function ContinueCard({ game, onContinue }: { game: ActiveGame; onContinue: (game: ActiveGame) => void }) {
  const { puzzle, progress } = game;
  const complete = isComplete(progress);
  const solved = solvedCount(progress);
  return (
    <Card title={complete ? 'Last puzzle' : 'Continue playing'}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold break-words">{puzzle.metadata.title}</h3>
          <p className="text-sm text-ink-muted">
            {complete ? 'Completed' : `${solved} of ${puzzle.rungs.length} rungs solved`} · Score{' '}
            {displayScore(progress)} / {PERFECT_SCORE}
          </p>
        </div>
        <Button variant="primary" onClick={() => onContinue(game)}>
          {complete ? 'View' : 'Continue'}
        </Button>
      </div>
    </Card>
  );
}
