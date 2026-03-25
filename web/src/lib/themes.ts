const THEMES = ["dark", "light", "ocean", "forest"] as const;
export type ThemeName = (typeof THEMES)[number];

const THEME_KEY = "news-reader-theme";

export function getStoredTheme(): ThemeName {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored && THEMES.includes(stored as ThemeName)) {
    return stored as ThemeName;
  }
  return "dark";
}

export function applyTheme(name: ThemeName) {
  document.documentElement.setAttribute("data-theme", name);
  localStorage.setItem(THEME_KEY, name);
}

export function getAvailableThemes(): ThemeName[] {
  return [...THEMES];
}
