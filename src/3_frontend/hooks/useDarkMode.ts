import { useEffect, useState } from 'react';

const STORAGE_KEY = 'voltra_tower_dark_mode';

export function useDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return stored === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(STORAGE_KEY, String(isDark));
    } catch {
      // localStorage unavailable, ignore
    }
  }, [isDark]);

  const toggleDarkMode = () => setIsDark((prev) => !prev);

  return { isDark, toggleDarkMode };
}