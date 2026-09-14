import { useEffect, useState } from 'react';
import { copyText } from '../lib/browser';
import { MAX_CLUE_NUMBER, runCipherTool, type CipherToolInput } from '../lib/cipherTool';
import { Button, inputClass } from './ui';

/** Encode/decode save-file `answer` fields for hand-editing .tikkaat files. */
export function CipherTool() {
  const [input, setInput] = useState<CipherToolInput>({
    mode: 'decode',
    startWord: '',
    encoded: '',
    clueNumber: '1',
    answer: '',
  });
  const [copied, setCopied] = useState(false);
  const { output, problem } = runCipherTool(input);
  const update = (changes: Partial<CipherToolInput>) => setInput((current) => ({ ...current, ...changes }));

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-ink-muted">
        Decode or encode the <code className="font-mono">answer</code> fields of a .tikkaat file. The key is the
        puzzle's start word. Clue 1 leads from the start word to rung 1, and the last clue's answer is the end word.
      </p>

      <div className="flex gap-2" role="group" aria-label="Mode">
        {(['decode', 'encode'] as const).map((mode) => (
          <Button
            key={mode}
            size="sm"
            variant={input.mode === mode ? 'primary' : 'secondary'}
            aria-pressed={input.mode === mode}
            onClick={() => update({ mode })}
          >
            {mode === 'decode' ? 'Decode' : 'Encode'}
          </Button>
        ))}
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Start word (key)</span>
        <input
          value={input.startWord}
          onChange={(e) => update({ startWord: e.target.value })}
          spellCheck={false}
          autoComplete="off"
          className={`${inputClass} uppercase`}
        />
      </label>

      {input.mode === 'decode' ? (
        <label className="flex flex-col gap-1">
          <span className="font-medium">Encoded answer</span>
          <input
            value={input.encoded}
            onChange={(e) => update({ encoded: e.target.value })}
            placeholder="Paste an answer value from the file"
            spellCheck={false}
            autoComplete="off"
            className={`${inputClass} font-mono uppercase placeholder:font-sans placeholder:normal-case`}
          />
        </label>
      ) : (
        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Clue</span>
            <input
              type="number"
              min={1}
              max={MAX_CLUE_NUMBER}
              value={input.clueNumber}
              onChange={(e) => update({ clueNumber: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Answer</span>
            <input
              value={input.answer}
              onChange={(e) => update({ answer: e.target.value })}
              spellCheck={false}
              autoComplete="off"
              className={`${inputClass} uppercase`}
            />
          </label>
        </div>
      )}

      {problem && (
        <p role="alert" className="text-danger">
          {problem}
        </p>
      )}
      {output && (
        <div className="inset-box flex items-center justify-between gap-3 px-3 py-2">
          <div className="min-w-0">
            <div className="text-xs text-ink-muted">{output.label}</div>
            <div className="font-mono font-semibold break-all select-all">{output.text}</div>
          </div>
          <Button
            size="sm"
            onClick={async () => {
              if (await copyText(output.text)) setCopied(true);
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      )}
    </div>
  );
}
