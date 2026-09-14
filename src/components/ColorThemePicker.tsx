import { useEffect, useState } from 'react';
import { applyColorTheme, COLOR_THEMES, loadColorTheme, saveColorTheme, type ColorTheme } from '../lib/theme';
import { Button, Dialog } from './ui';

export function ColorThemePicker() {
  const [color, setColor] = useState<ColorTheme>(loadColorTheme);
  const [open, setOpen] = useState(false);
  const current = COLOR_THEMES.find((theme) => theme.id === color) ?? COLOR_THEMES[0];

  useEffect(() => {
    applyColorTheme(color);
    saveColorTheme(color);
  }, [color]);

  return (
    <>
      <Button
        variant="bar"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Color theme: ${current.name}. Change color theme.`}
        title="Change color theme"
      >
        <span data-color={color} className="swatch h-3.5 w-3.5 rounded-full" aria-hidden="true" />
        <span className="max-sm:hidden">{current.name}</span>
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Color theme">
        <fieldset>
          <legend className="text-sm text-ink-muted">
            Select a classic Linux theme. Changes apply right away.
          </legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {COLOR_THEMES.map((theme) => (
              <label key={theme.id} className="choice">
                <input
                  type="radio"
                  name="color-theme"
                  value={theme.id}
                  checked={color === theme.id}
                  onChange={() => setColor(theme.id)}
                  className="radio"
                />
                <span data-color={theme.id} className="swatch" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block font-semibold">{theme.name}</span>
                  <span className="block text-xs text-ink-muted">{theme.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </Dialog>
    </>
  );
}
