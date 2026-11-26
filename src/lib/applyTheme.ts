// Switches the page to a report theme: the colours come from its [data-theme] block in index.css.
// In production the server already sets the theme in index.html (server/pwa.ts), so this only
// matters after an admin change and during development.

import { DEFAULT_THEME, getTheme, isThemeId, type ThemeId } from "@/lib/themes";

// Components whose content (not just colours) depends on the theme, see hooks/use-theme.ts
const listeners = new Set<() => void>();

export const subscribeTheme = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The theme the page is showing */
export const getActiveTheme = (): ThemeId => {
  const id = document.documentElement.dataset.theme;
  return isThemeId(id) ? id : DEFAULT_THEME;
};

export const applyTheme = (theme: unknown) => {
  const id = isThemeId(theme) ? theme : DEFAULT_THEME;
  const changed = document.documentElement.dataset.theme !== id;
  document.documentElement.dataset.theme = id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", getTheme(id).background);
  if (changed) listeners.forEach((listener) => listener());
};
