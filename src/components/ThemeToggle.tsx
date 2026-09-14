import { useEffect, useState } from 'react';
import { applyTheme, loadTheme, saveTheme, type Theme } from '../lib/theme';
import { Button } from './ui';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);

  return (
    <Button
      variant="bar"
      size="sm"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      <span aria-hidden="true">{next === 'light' ? '☀' : '☾'}</span>
      {next === 'light' ? 'Light' : 'Dark'}
    </Button>
  );
}
