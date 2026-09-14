// Keep in sync with the inline theme script in index.html and the [data-color] rules in index.css.

export type Theme = 'light' | 'dark';

/** Color themes, named after classic Linux distributions. The first is the default. */
export const COLOR_THEMES = [
  { id: 'lubuntu', name: 'Lubuntu', description: 'Classic Lubuntu blue' },
  { id: 'mint', name: 'Mint', description: 'Linux Mint green' },
  { id: 'gentoo', name: 'Gentoo', description: 'Gentoo lavender purple' },
  { id: 'warty', name: 'Ubuntu', description: '4.10 “Warty Warthog” orange' },
] as const;

export type ColorTheme = (typeof COLOR_THEMES)[number]['id'];

const THEME_KEY = 'tikkaat:theme';
const COLOR_KEY = 'tikkaat:color';

/** Dark unless the player chose light. */
export function loadTheme(): Theme {
  try {
    if (localStorage.getItem(THEME_KEY) === 'light') return 'light';
  } catch {
    // Storage unavailable.
  }
  return 'dark';
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage unavailable.
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function loadColorTheme(): ColorTheme {
  try {
    const saved = localStorage.getItem(COLOR_KEY);
    const match = COLOR_THEMES.find((theme) => theme.id === saved);
    if (match) return match.id;
  } catch {
    // Storage unavailable.
  }
  return COLOR_THEMES[0].id;
}

export function saveColorTheme(color: ColorTheme): void {
  try {
    localStorage.setItem(COLOR_KEY, color);
  } catch {
    // Storage unavailable.
  }
}

export function applyColorTheme(color: ColorTheme): void {
  document.documentElement.dataset.color = color;
}
