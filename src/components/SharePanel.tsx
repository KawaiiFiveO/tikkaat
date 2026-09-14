import { useEffect, useMemo, useState } from 'react';
import { copyText, downloadTextFile, pageUrl } from '../lib/browser';
import { puzzleFileName, shareLinkFor, toFileJson, toShareString } from '../lib/serialize';
import type { Puzzle } from '../lib/types';
import { Button, Card, Dialog } from './ui';

interface ShareButtonsProps {
  code: string;
  fileName: string;
  fileText: string;
  layout?: 'column' | 'row';
}

/** Copy link, view/copy the puzzle code in a dialog, and download the file. */
export function ShareButtons({ code, fileName, fileText, layout = 'column' }: ShareButtonsProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [showCode, setShowCode] = useState(false);
  const size = layout === 'row' ? 'sm' : 'md';

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy(kind: 'code' | 'link') {
    if (await copyText(kind === 'code' ? code : shareLinkFor(code, pageUrl()))) setCopied(kind);
  }

  return (
    <>
      <div className={layout === 'column' ? 'flex flex-col gap-2' : 'flex flex-wrap gap-2'}>
        <Button size={size} onClick={() => copy('link')}>
          {copied === 'link' ? 'Link copied!' : 'Copy link'}
        </Button>
        <Button size={size} onClick={() => setShowCode(true)}>
          View puzzle code
        </Button>
        <Button size={size} onClick={() => downloadTextFile(fileName, fileText)}>
          Download file
        </Button>
      </div>
      <Dialog open={showCode} onClose={() => setShowCode(false)} title="Puzzle code">
        <p className="text-sm text-ink-muted">
          Anyone can open this puzzle by pasting the code into Tikkaat. Click the code to select all of it (
          {code.length} characters).
        </p>
        <div className="inset-box mt-3 max-h-[50vh] overflow-y-auto p-3 font-mono text-sm break-all select-all">
          {code}
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="primary" onClick={() => copy('code')}>
            {copied === 'code' ? 'Code copied!' : 'Copy code'}
          </Button>
          <Button onClick={() => setShowCode(false)}>Close</Button>
        </div>
      </Dialog>
    </>
  );
}

/** Builder share panel for a valid, normalized puzzle. */
export function SharePanel({ puzzle }: { puzzle: Puzzle }) {
  const code = useMemo(() => toShareString(puzzle), [puzzle]);
  const fileText = useMemo(() => toFileJson(puzzle), [puzzle]);
  return (
    <Card title="Share">
      <ShareButtons code={code} fileName={puzzleFileName(puzzle)} fileText={fileText} />
    </Card>
  );
}
