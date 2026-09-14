import { useEffect, useMemo, useState } from 'react';
import { Builder } from './components/Builder';
import { ColorThemePicker } from './components/ColorThemePicker';
import { Footer } from './components/Footer';
import { LadderIcon } from './components/LadderIcon';
import { Home, type ActiveGame } from './components/Home';
import { Player, type PlayMode } from './components/Player';
import { SettingsMenu } from './components/SettingsMenu';
import { ThemeToggle } from './components/ThemeToggle';
import { loadActiveSource, preferActiveSource, restoreActiveSource } from './lib/activePuzzle';
import { pageUrl, setUrlHash } from './lib/browser';
import { createDraft, isDraftEmpty } from './lib/draft';
import {
  deleteAllDrafts,
  deleteDraft,
  duplicateDraft,
  loadDraft,
  newDraftId,
  openInitialDraft,
  saveDraft,
  writeCurrentDraftId,
  type DraftSummary,
} from './lib/draftStore';
import { EXAMPLE_PUZZLE } from './lib/examplePuzzle';
import { createProgress, restoreProgress } from './lib/game';
import {
  importErrorMessage,
  loadShareString,
  sourceFromPuzzle,
  sourceShareCode,
  toShareString,
  type LoadedPuzzle,
  type PuzzleSource,
} from './lib/serialize';
import { clearSiteData, readStorage, removeStorage, STORAGE_KEYS, writeStorage } from './lib/storage';
import type { Puzzle } from './lib/types';
import { normalizePuzzle } from './lib/validate';

type View =
  | { name: 'home' }
  | { name: 'build' }
  | { name: 'play'; puzzle: Puzzle; mode: PlayMode; source: PuzzleSource | null; key: number };

let playKey = 0;

function playView(puzzle: Puzzle, mode: PlayMode, source: PuzzleSource | null): View {
  return { name: 'play', puzzle, mode, source, key: ++playKey };
}

function readHash(): { loaded: LoadedPuzzle | null; error: string | null } {
  const code = window.location.hash.slice(1);
  if (code === '') return { loaded: null, error: null };
  try {
    return { loaded: loadShareString(code), error: null };
  } catch (error) {
    return { loaded: null, error: importErrorMessage(error) };
  }
}

export function App() {
  const [initial] = useState(() => {
    const active = restoreActiveSource(readStorage(STORAGE_KEYS.active));
    const { loaded, error } = readHash();
    return { active, loaded: loaded && preferActiveSource(loaded, active), error };
  });
  const [view, setView] = useState<View>(() =>
    initial.loaded ? playView(initial.loaded.puzzle, 'shared', initial.loaded.source) : { name: 'home' },
  );
  const [linkError, setLinkError] = useState(initial.error);
  const [initialDraft] = useState(() => openInitialDraft());
  const [draftId, setDraftId] = useState(initialDraft.id);
  const [draft, setDraft] = useState<Puzzle>(initialDraft.draft);
  const [drafts, setDrafts] = useState<DraftSummary[]>(initialDraft.drafts);
  const [activeSource, setActiveSource] = useState<PuzzleSource | null>(initial.active);

  // Autosave the open draft (empty drafts aren't stored) and remember which draft is open.
  useEffect(() => {
    setDrafts(saveDraft(draftId, draft));
    writeCurrentDraftId(draftId);
  }, [draftId, draft]);

  // A shared puzzle being played lives in the URL hash (so reloading keeps it)
  // and becomes the single active puzzle, stored as its original source.
  useEffect(() => {
    const source = view.name === 'play' ? view.source : null;
    setUrlHash(source ? sourceShareCode(source) : null);
    if (source) {
      setActiveSource(source);
      writeStorage(STORAGE_KEYS.active, source);
    }
    window.scrollTo(0, 0);
  }, [view]);

  useEffect(() => {
    const handleHashChange = () => {
      const { loaded, error } = readHash();
      if (loaded) {
        const resolved = preferActiveSource(loaded, activeSource);
        setLinkError(null);
        setView(playView(resolved.puzzle, 'shared', resolved.source));
      } else if (error) {
        setLinkError(error);
        setView({ name: 'home' });
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeSource]);

  // Re-read when returning home so the progress summary is current.
  const activeGame = useMemo((): ActiveGame | null => {
    if (view.name !== 'home' || !activeSource) return null;
    const loaded = loadActiveSource(activeSource);
    if (!loaded) return null;
    const saved = readStorage(STORAGE_KEYS.progress(toShareString(loaded.puzzle)));
    return { ...loaded, progress: restoreProgress(saved, loaded.puzzle) ?? createProgress(loaded.puzzle) };
  }, [view, activeSource]);

  const activeTitle = useMemo(
    () => (activeSource ? (loadActiveSource(activeSource)?.puzzle.metadata.title ?? null) : null),
    [activeSource],
  );

  // Forget the resumable game but keep its saved progress. If it's being played, go home,
  // since playing a shared puzzle would immediately make it active again.
  const clearCurrentGame = () => {
    removeStorage(STORAGE_KEYS.active);
    setActiveSource(null);
    if (view.name === 'play' && view.mode === 'shared') setView({ name: 'home' });
  };

  // Delete every Tikkaat key, then reload without the share hash so all state starts fresh.
  const clearAllData = () => {
    clearSiteData();
    window.location.replace(pageUrl());
  };

  const play = (puzzle: Puzzle, mode: PlayMode, source: PuzzleSource | null) => {
    setLinkError(null);
    setView(playView(puzzle, mode, source));
  };

  // Drafts: opening, creating, or importing never discards a draft, since the open one is autosaved.
  const openDraft = (id: string, content: Puzzle) => {
    setDraftId(id);
    setDraft(content);
  };

  const startNewDraft = () => openDraft(newDraftId(), createDraft());

  const editPuzzle = (puzzle: Puzzle) => {
    openDraft(newDraftId(), puzzle);
    setView({ name: 'build' });
  };

  const openSavedDraft = (id: string) => {
    const content = loadDraft(id);
    if (content) openDraft(id, content);
  };

  const duplicateSavedDraft = (id: string) => {
    const result = duplicateDraft(id);
    if (result) setDrafts(result.drafts);
  };

  // Deleting the open draft opens the most recent remaining draft, or a new empty one.
  const deleteSavedDraft = (id: string) => {
    const remaining = deleteDraft(id);
    setDrafts(remaining);
    if (id !== draftId) return;
    for (const summary of remaining) {
      const content = loadDraft(summary.id);
      if (content) {
        openDraft(summary.id, content);
        return;
      }
    }
    startNewDraft();
  };

  const deleteAllSavedDrafts = () => {
    deleteAllDrafts();
    setDrafts([]);
    startNewDraft();
  };

  const playExample = () => {
    const example = normalizePuzzle(EXAMPLE_PUZZLE);
    play(example, 'shared', sourceFromPuzzle(example));
  };

  return (
    <div className="flex min-h-screen flex-col text-ink">
      <header className="app-header">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <button
            type="button"
            onClick={() => setView({ name: 'home' })}
            className="flex items-center gap-2 rounded-lg text-lg font-bold focus-visible:outline-2 focus-visible:outline-accent"
          >
            <LadderIcon className="h-6 w-6 shrink-0" /> Tikkaat
          </button>
          <div className="flex items-center gap-2">
            <ColorThemePicker />
            <ThemeToggle />
            <SettingsMenu
              activeTitle={activeTitle}
              onClearCurrentGame={clearCurrentGame}
              draftCount={drafts.length}
              onDeleteAllDrafts={deleteAllSavedDrafts}
              onClearAllData={clearAllData}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {view.name === 'home' && (
          <Home
            linkError={linkError}
            activeGame={activeGame}
            hasDraft={!isDraftEmpty(draft) || drafts.length > 0}
            onContinue={(game) => play(game.puzzle, 'shared', game.source)}
            onBuild={() => setView({ name: 'build' })}
            onPlayExample={playExample}
            onPlay={(loaded) => play(loaded.puzzle, 'shared', loaded.source)}
            onEdit={editPuzzle}
            drafts={drafts}
            draftId={draftId}
            onOpenDraft={(id) => {
              openSavedDraft(id);
              setView({ name: 'build' });
            }}
            onDuplicateDraft={duplicateSavedDraft}
            onDeleteDraft={deleteSavedDraft}
            onNewDraft={() => {
              startNewDraft();
              setView({ name: 'build' });
            }}
          />
        )}
        {view.name === 'build' && (
          <Builder
            key={draftId}
            drafts={drafts}
            draftId={draftId}
            onOpenDraft={openSavedDraft}
            onDuplicateDraft={duplicateSavedDraft}
            onDeleteDraft={deleteSavedDraft}
            draft={draft}
            onChange={setDraft}
            onPlaytest={(puzzle) => play(puzzle, 'playtest', null)}
            onNew={startNewDraft}
            onLoadExample={() =>
              // The example opens as a new draft; it's a template, so the copy gets today's date.
              editPuzzle({
                ...normalizePuzzle(EXAMPLE_PUZZLE),
                metadata: { ...EXAMPLE_PUZZLE.metadata, dateCreated: new Date().toISOString() },
              })
            }
          />
        )}
        {view.name === 'play' && (
          <Player
            key={view.key}
            puzzle={view.puzzle}
            mode={view.mode}
            source={view.source}
            onExit={() => setView(view.mode === 'playtest' ? { name: 'build' } : { name: 'home' })}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
