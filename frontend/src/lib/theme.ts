// Light/dark theme handling. The initial class is applied by an inline script
// in index.html (before React mounts) to avoid a flash of the wrong theme;
// this module keeps React in sync and persists the choice.
import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "yaar.theme";

export function getTheme(): Theme {
  const stored = localStorage.getItem(KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  localStorage.setItem(KEY, theme);
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(getTheme);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return [theme, toggle];
}
