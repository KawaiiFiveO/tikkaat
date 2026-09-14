import { useEffect, useMemo, useState } from 'react';
import { Builder } from './components/Builder';
import { ColorThemePicker } from './components/ColorThemePicker';
import { Footer } from './components/Footer';
import { LadderIcon } from './components/LadderIcon';
import { Home } from './components/Home';
import { Player, type PlayMode } from './components/Player';
import { SettingsMenu } from './components/SettingsMenu';
import { ThemeToggle } from './components/ThemeToggle';
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
import {
  clearCurrentGame,
  deleteAllGames,
  deleteGame,
  isCurrentGameCleared,
  isKeptGame,
  listSavedGames,
  openSavedGames,
  preferStoredSource,
  recordGamePlayed,
  type GameEntry,
} from './lib/gamesStore';
import {
  importErrorMessage,
  loadShareString,
  sourceFromPuzzle,
  sourceShareCode,
  type LoadedPuzzle,
  type PuzzleSource,
} from './lib/serialize';
import { clearSiteData } from './lib/storage';
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
    const games = openSavedGames();
    const { loaded, error } = readHash();
    return { games, loaded: loaded && preferStoredSource(loaded), error };
  });
  const [view, setView] = useState<View>(() =>
    initial.loaded ? playView(initial.loaded.puzzle, 'shared', initial.loaded.source) : { name: 'home' },
  );
  const [linkError, setLinkError] = useState(initial.error);
  const [games, setGames] = useState<GameEntry[]>(initial.games);
  const [currentGameCleared, setCurrentGameCleared] = useState(() => isCurrentGameCleared());
  const [initialDraft] = useState(() => openInitialDraft());
  const [draftId, setDraftId] = useState(initialDraft.id);
  const [draft, setDraft] = useState<Puzzle>(initialDraft.draft);
  const [drafts, setDrafts] = useState<DraftSummary[]>(initialDraft.drafts);

  // Autosave the open draft (empty drafts aren't stored) and remember which draft is open.
  useEffect(() => {
    setDrafts(saveDraft(draftId, draft));
    writeCurrentDraftId(draftId);
  }, [draftId, draft]);

  // A shared puzzle being played lives in the URL hash (so reloading keeps it) and is recorded
  // as the most recently played saved game, stored as its original source.
  useEffect(() => {
    const source = view.name === 'play' ? view.source : null;
    setUrlHash(source ? sourceShareCode(source) : null);
    if (view.name === 'play' && view.source) {
      setGames(recordGamePlayed({ puzzle: view.puzzle, source: view.source }));
      setCurrentGameCleared(false);
    }
    window.scrollTo(0, 0);
  }, [view]);

  useEffect(() => {
    const handleHashChange = () => {
      const { loaded, error } = readHash();
      if (loaded) {
        const resolved = preferStoredSource(loaded);
        setLinkError(null);
        setView(playView(resolved.puzzle, 'shared', resolved.source));
      } else if (error) {
        setLinkError(error);
        setView({ name: 'home' });
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // The browser opens or downloads a file dropped where nothing accepts it, leaving the app. Reject
  // file drops everywhere in the capture phase; the home screen's import panel accepts them again.
  useEffect(() => {
    const rejectFileDrop = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      if (event.type === 'dragover') event.dataTransfer.dropEffect = 'none';
    };
    window.addEventListener('dragover', rejectFileDrop, true);
    window.addEventListener('drop', rejectFileDrop, true);
    return () => {
      window.removeEventListener('dragover', rejectFileDrop, true);
      window.removeEventListener('drop', rejectFileDrop, true);
    };
  }, []);

  // Re-read on returning home (or after the list changes) so progress summaries are current.
  const savedGames = useMemo(() => (view.name === 'home' ? listSavedGames() : []), [view, games]);
  const keptGames = useMemo(() => savedGames.filter(isKeptGame), [savedGames]);

  const deleteSavedGame = (id: string) => setGames(deleteGame(id));

  // Remove the most recently played game from the Continue card (a started game stays in Saved
  // games). If a shared puzzle is being played, go home, since staying would make it current again.
  const clearCurrent = () => {
    setGames(clearCurrentGame());
    setCurrentGameCleared(true);
    if (view.name === 'play' && view.mode === 'shared') setView({ name: 'home' });
  };

  // Delete every saved game and all progress. If a shared puzzle is being played, go home,
  // since staying would record it (and its progress) again.
  const deleteAllSavedGames = () => {
    deleteAllGames();
    setGames([]);
    setCurrentGameCleared(false);
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
        <div className="page-column flex items-center justify-between gap-4 py-3">
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
              currentGameTitle={currentGameCleared ? null : (games[0]?.title ?? null)}
              onClearCurrentGame={clearCurrent}
              savedGameCount={games.length}
              onDeleteAllGames={deleteAllSavedGames}
              draftCount={drafts.length}
              onDeleteAllDrafts={deleteAllSavedDrafts}
              onClearAllData={clearAllData}
            />
          </div>
        </div>
      </header>

      <main className="page-column flex-1 py-6">
        {view.name === 'home' && (
          <Home
            linkError={linkError}
            currentGame={currentGameCleared ? null : (savedGames[0] ?? null)}
            savedGames={keptGames}
            onContinue={(game) => play(game.puzzle, 'shared', game.source)}
            onDeleteGame={deleteSavedGame}
            hasDraft={!isDraftEmpty(draft) || drafts.length > 0}
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
