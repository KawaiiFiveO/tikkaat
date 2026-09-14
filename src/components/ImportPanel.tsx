import { useRef, useState, type ChangeEvent } from 'react';
import { importErrorMessage, loadFileJson, loadShareString, type LoadedPuzzle } from '../lib/serialize';
import type { Puzzle } from '../lib/types';
import { Button, Card, inputClass } from './ui';

interface ImportPanelProps {
  onPlay: (loaded: LoadedPuzzle) => void;
  onEdit: (puzzle: Puzzle) => void;
}

export function ImportPanel({ onPlay, onEdit }: ImportPanelProps) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<LoadedPuzzle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const hasInput = file !== null || text.trim() !== '';

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    try {
      setFile(loadFileJson(await selected.text(), selected.name));
      setText('');
      setError(null);
    } catch (err) {
      setFile(null);
      setError(importErrorMessage(err));
    }
  }

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
    <Card title="Open a puzzle">
      <p className="text-sm text-ink-muted">Paste a puzzle code or link, or open a .tikkaat file.</p>
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
          onChange={handleFile}
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
  );
}
