import { Fragment, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { insertRung, removeRung, reshuffleClues, suggestTitle } from '../lib/draft';
import { fillClue, showsNextInline, type ClueDisplay } from '../lib/game';
import { codePointLength, normalizeWord } from '../lib/normalize';
import { ladderWords, NEXT_PLACEHOLDER, PLACEHOLDER, type Puzzle, type PuzzleMetadata } from '../lib/types';
import { LIMITS, normalizePuzzle, validatePuzzle } from '../lib/validate';
import { ClueText } from './ClueText';
import { SharePanel } from './SharePanel';
import type { DraftSummary } from '../lib/draftStore';
import { DraftsDialog } from './DraftsDialog';
import { Button, Card, Counter, FieldErrors, inputClass } from './ui';

interface BuilderProps {
  draft: Puzzle;
  onChange: (draft: Puzzle) => void;
  onPlaytest: (puzzle: Puzzle) => void;
  /** Opens a new empty draft (the current one stays saved). */
  onNew: () => void;
  /** Opens the example puzzle as a new draft. */
  onLoadExample: () => void;
  drafts: DraftSummary[];
  draftId: string;
  onOpenDraft: (id: string) => void;
  onDuplicateDraft: (id: string) => void;
  onDeleteDraft: (id: string) => void;
}

export function Builder({
  draft,
  onChange,
  onPlaytest,
  onNew,
  onLoadExample,
  drafts,
  draftId,
  onOpenDraft,
  onDuplicateDraft,
  onDeleteDraft,
}: BuilderProps) {
  const [showDrafts, setShowDrafts] = useState(false);
  const normalized = useMemo(() => normalizePuzzle(draft), [draft]);
  const issues = useMemo(() => validatePuzzle(normalized), [normalized]);
  const [showErrors, setShowErrors] = useState(false);
  const valid = issues.length === 0;
  const words = ladderWords(normalized);
  const rungCount = draft.rungs.length;
  const suggestedTitle = suggestTitle(draft.startWord, draft.endWord);

  const errorsFor = (field: string) =>
    showErrors ? issues.filter((issue) => issue.field === field).map((issue) => issue.message) : [];
  const update = (changes: Partial<Puzzle>) => onChange({ ...draft, ...changes });
  const updateMetadata = (changes: Partial<PuzzleMetadata>) =>
    update({ metadata: { ...draft.metadata, ...changes } });
  const replaceAt = (list: string[], index: number, value: string) =>
    list.map((item, i) => (i === index ? value : item));

  function handlePlaytest() {
    if (valid) onPlaytest(normalized);
    else setShowErrors(true);
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex flex-col gap-6">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">Puzzle builder</h1>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setShowDrafts(true)}>
                Drafts ({drafts.length})
              </Button>
              <Button size="sm" onClick={onNew}>
                New draft
              </Button>
            </div>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Enter the ladder from top to bottom with one clue per step. In each clue, write {PLACEHOLDER} where the
            word being changed goes. Write {NEXT_PLACEHOLDER} too if the answer belongs inside the clue, as in
            “{PLACEHOLDER} {NEXT_PLACEHOLDER}, 20th century actor”; otherwise it's shown after an arrow.
          </p>
        </Card>

        <Card title="Details">
          <div className="flex flex-col gap-4">
            <TextField
              label="Title"
              value={draft.metadata.title}
              max={LIMITS.titleMaxLength}
              onChange={(title) => updateMetadata({ title })}
              errors={errorsFor('metadata.title')}
              // Visible text, since the button's tooltip doesn't show on touch screens.
              hint={suggestedTitle ? undefined : 'Fill in the start and end words to use Suggest title.'}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!suggestedTitle}
                  onClick={() => suggestedTitle && updateMetadata({ title: suggestedTitle })}
                  title={suggestedTitle ? `Use “${suggestedTitle}”` : 'Enter the start and end words first'}
                >
                  Suggest title
                </Button>
              }
            />
            <TextField
              label="Creator name (optional)"
              value={draft.metadata.creatorName}
              max={LIMITS.creatorMaxLength}
              onChange={(creatorName) => updateMetadata({ creatorName })}
              errors={errorsFor('metadata.creatorName')}
            />
            <TextField
              label="Description (optional)"
              value={draft.metadata.aboutThisPuzzle}
              max={LIMITS.aboutMaxLength}
              onChange={(aboutThisPuzzle) => updateMetadata({ aboutThisPuzzle })}
              errors={errorsFor('metadata.aboutThisPuzzle')}
              multiline
            />
            <TextField
              label="Message on completion (optional)"
              hint="Shown to players only after they finish the ladder."
              value={draft.metadata.completionMessage}
              max={LIMITS.completionMessageMaxLength}
              onChange={(completionMessage) => updateMetadata({ completionMessage })}
              errors={errorsFor('metadata.completionMessage')}
              multiline
            />
          </div>
        </Card>

        <Card
          title="Ladder"
          actions={
            <span className="text-xs tabular-nums">
              {rungCount} / {LIMITS.maxRungs} rungs
            </span>
          }
        >
          <FieldErrors messages={[...errorsFor('rungs'), ...errorsFor('clues')]} />
          <div className="flex flex-col">
            <WordField
              label="Start word"
              value={draft.startWord}
              onChange={(startWord) => update({ startWord })}
              errors={errorsFor('startWord')}
              given
            />
            {draft.clues.map((clue, step) => (
              <Fragment key={step}>
                <ClueEditor
                  step={step}
                  clue={clue}
                  from={words[step] ?? ''}
                  to={words[step + 1] ?? ''}
                  onChange={(value) => update({ clues: replaceAt(draft.clues, step, value) })}
                  onInsertRung={rungCount < LIMITS.maxRungs ? () => onChange(insertRung(draft, step)) : undefined}
                  errors={errorsFor(`clues.${step}`)}
                />
                {step < rungCount && (
                  <WordField
                    label={`Rung ${step + 1}`}
                    value={draft.rungs[step] ?? ''}
                    onChange={(value) => update({ rungs: replaceAt(draft.rungs, step, value) })}
                    onRemove={rungCount > LIMITS.minRungs ? () => onChange(removeRung(draft, step)) : undefined}
                    errors={errorsFor(`rungs.${step}`)}
                  />
                )}
              </Fragment>
            ))}
            <WordField
              label="End word"
              value={draft.endWord}
              onChange={(endWord) => update({ endWord })}
              errors={errorsFor('endWord')}
              given
            />
          </div>
        </Card>
      </div>

      <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
        <Card title="Test and share">
          {valid ? (
            <p className="text-sm text-success">Ready to play.</p>
          ) : (
            <p className="text-sm text-ink-muted">
              {issues.length} {issues.length === 1 ? 'thing' : 'things'} to fix before playing or sharing.
            </p>
          )}
          {showErrors && !valid && (
            <ul className="mt-2 list-disc pl-5 text-sm text-danger">
              {issues.map((issue, i) => (
                <li key={i}>{issue.message}</li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="primary" onClick={handlePlaytest}>
              Playtest
            </Button>
            {!valid && (
              <Button variant="ghost" size="sm" aria-pressed={showErrors} onClick={() => setShowErrors(!showErrors)}>
                {showErrors ? "Hide what's missing" : "Show what's missing"}
              </Button>
            )}
            <Button onClick={() => onChange(reshuffleClues(draft))}>Shuffle clue order</Button>
            <div>
              <p className="text-xs text-ink-muted">Clue order players see first:</p>
              <ol className="mt-1 flex flex-wrap gap-1" aria-label="Clue order">
                {draft.clueBankOrder.map((step) => (
                  <li
                    key={step}
                    title={draft.clues[step]?.trim() || 'Empty clue'}
                    className="inset-box px-2 py-0.5 text-xs tabular-nums"
                  >
                    {step + 1}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Card>
        {valid && <SharePanel puzzle={normalized} />}
        <Button variant="ghost" onClick={onLoadExample}>
          Open the example as a new draft
        </Button>
      </aside>

      <DraftsDialog
        open={showDrafts}
        onClose={() => setShowDrafts(false)}
        drafts={drafts}
        currentId={draftId}
        onOpen={onOpenDraft}
        onDuplicate={onDuplicateDraft}
        onDelete={onDeleteDraft}
        onNew={onNew}
      />
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  max: number;
  onChange: (value: string) => void;
  errors: string[];
  multiline?: boolean;
  /** Optional control shown beside the character counter. */
  action?: ReactNode;
  /** Optional help text shown under the field. */
  hint?: string;
}

function TextField({ label, value, max, onChange, errors, multiline = false, action, hint }: TextFieldProps) {
  const id = useId();
  const className = `${inputClass} mt-1`;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {action}
          <Counter value={codePointLength(value.trim())} max={max} />
        </div>
      </div>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          maxLength={max}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          className={`${className} resize-y`}
        />
      ) : (
        <input id={id} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} className={className} />
      )}
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      <FieldErrors messages={errors} />
    </div>
  );
}

interface WordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onRemove?: () => void;
  errors: string[];
  given?: boolean;
}

function WordField({ label, value, onChange, onRemove, errors, given = false }: WordFieldProps) {
  const id = useId();
  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <Counter value={codePointLength(normalizeWord(value))} max={LIMITS.wordMaxLength} />
          {onRemove && (
            <Button variant="ghost" size="sm" onClick={onRemove}>
              Remove
            </Button>
          )}
        </div>
      </div>
      <input
        id={id}
        value={value}
        maxLength={LIMITS.wordMaxLength}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        className={`${inputClass} mt-1 font-semibold tracking-[0.15em] uppercase ${given ? 'field-given' : ''}`}
      />
      <FieldErrors messages={errors} />
    </div>
  );
}

interface ClueEditorProps {
  step: number;
  clue: string;
  from: string;
  to: string;
  onChange: (value: string) => void;
  onInsertRung?: () => void;
  errors: string[];
}

function ClueEditor({ step, clue, from, to, onChange, onInsertRung, errors }: ClueEditorProps) {
  const id = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);

  function insertPlaceholder(token: string) {
    const el = textarea.current;
    const start = el?.selectionStart ?? clue.length;
    const end = el?.selectionEnd ?? clue.length;
    const next = clue.slice(0, start) + token + clue.slice(end);
    if (next.length > LIMITS.clueMaxLength) return;
    onChange(next);
    requestAnimationFrame(() => {
      const caret = start + token.length;
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  }

  const trimmed = clue.trim();
  const preview: ClueDisplay | null =
    trimmed === ''
      ? null
      : {
          step,
          segments: fillClue(trimmed, {
            word: { kind: 'word', text: from || '…' },
            next: { kind: 'result', text: to || '…' },
          }),
          result: showsNextInline(trimmed) ? null : to || '…',
        };

  return (
    <div className="my-1 ml-4 border-l-2 border-dashed border-line py-2 pl-4">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          Clue {step + 1}{' '}
          <span className="font-normal text-ink-muted">
            {from || '…'} → {to || '…'}
          </span>
        </label>
        <Counter value={codePointLength(clue.trim())} max={LIMITS.clueMaxLength} />
      </div>
      <textarea
        ref={textarea}
        id={id}
        rows={2}
        value={clue}
        maxLength={LIMITS.clueMaxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`e.g. Change one letter in ${PLACEHOLDER} to get …`}
        className={`${inputClass} mt-1 resize-y`}
      />
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => insertPlaceholder(PLACEHOLDER)}>
          Insert {PLACEHOLDER}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => insertPlaceholder(NEXT_PLACEHOLDER)}>
          Insert {NEXT_PLACEHOLDER}
        </Button>
        {onInsertRung && (
          <Button size="sm" variant="ghost" onClick={onInsertRung}>
            + Add a rung below
          </Button>
        )}
      </div>
      {preview && (
        <p className="mt-2 text-sm text-ink-muted">
          Solved: <ClueText display={preview} />
        </p>
      )}
      <FieldErrors messages={errors} />
    </div>
  );
}
