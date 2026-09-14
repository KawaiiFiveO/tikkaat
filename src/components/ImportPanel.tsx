import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  importErrorMessage,
  loadFileJson,
  loadShareString,
  MAX_PUZZLE_FILE_BYTES,
  PuzzleImportError,
  type LoadedPuzzle,
} from '../lib/serialize';
import type { Puzzle } from '../lib/types';
import { Button, Card, inputClass } from './ui';

interface ImportPanelProps {
  onPlay: (loaded: LoadedPuzzle) => void;
  onEdit: (puzzle: Puzzle) => void;
}

function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false;
}

export function ImportPanel({ onPlay, onEdit }: ImportPanelProps) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<LoadedPuzzle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const hasInput = file !== null || text.trim() !== '';

  // Shared by the file picker and drag and drop. Only uses state setters, so it's safe to call
  // from the drop listener registered once below.
  async function openFile(selected: File) {
    try {
      if (selected.size > MAX_PUZZLE_FILE_BYTES) throw new PuzzleImportError('This file is too large to be a puzzle file.');
      setFile(loadFileJson(await selected.text(), selected.name));
      setText('');
      setError(null);
    } catch (err) {
      setFile(null);
      setError(importErrorMessage(err));
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (selected) void openFile(selected);
  }

  // Drop a puzzle file anywhere on the home screen (this panel only exists there). App blocks file
  // drops in the capture phase; these bubble-phase listeners accept them again while it's mounted.
  useEffect(() => {
    // dragenter/dragleave fire for every element crossed, so count them to know when the drag leaves the window.
    let depth = 0;
    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth += 1;
      setDragging(true);
    };
    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event) || !event.dataTransfer) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const dropped = event.dataTransfer?.files[0];
      if (!dropped) return;
      void openFile(dropped);
      panel.current?.scrollIntoView({ block: 'nearest' });
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  function loadInput(): LoadedPuzzle | null {
    if (file) return file;
    try {
      return loadShareString(text);
    } catch (err) {
      setError(importErrorMessage(err));
      return null;
    }
  }

  return (
    <div ref={panel}>
      <Card title="Open a puzzle">
        <p className="text-sm text-ink-muted">Paste a puzzle code or link, or open or drop a .tikkaat file.</p>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFile(null);
            setError(null);
          }}
          rows={3}
          spellCheck={false}
          placeholder="Paste a puzzle code or link"
          aria-label="Puzzle code or link"
          className={`${inputClass} mt-3 resize-y font-mono text-sm break-all`}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept=".tikkaat,.json,application/json"
            onChange={handleFileInput}
            className="hidden"
          />
          <Button onClick={() => fileInput.current?.click()}>Open file…</Button>
          {file && (
            <span className="text-sm text-ink-muted">
              Loaded <strong className="text-ink">{file.puzzle.metadata.title}</strong> from {file.source.fileName}
            </span>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={!hasInput}
            onClick={() => {
              const loaded = loadInput();
              if (loaded) onPlay(loaded);
            }}
          >
            Play
          </Button>
          <Button
            disabled={!hasInput}
            onClick={() => {
              const loaded = loadInput();
              if (loaded) onEdit(loaded.puzzle);
            }}
          >
            Edit in builder
          </Button>
        </div>
      </Card>
      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <p className="panel px-6 py-4 text-center text-lg font-semibold">Drop a .tikkaat or .json file to open it</p>
        </div>
      )}
    </div>
  );
}
