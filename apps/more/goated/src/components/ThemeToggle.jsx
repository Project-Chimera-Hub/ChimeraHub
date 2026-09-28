import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

// Theme toggle backed by the `dark` class on <html>. The class is set by the
// inline bootstrap script in index.html before React mounts so we avoid any
// flash of the wrong theme.
export default function ThemeToggle({ className = '' }) {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  // Keep state in sync if anything else flips the class (e.g. system theme
  // listener in the future).
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try { localStorage.setItem('nback_theme', next ? 'dark' : 'light'); } catch { /* ignore */ }
  };

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-secondary/80 border border-border hover:border-foreground/40 text-foreground/90 hover:text-foreground text-xs font-mono font-semibold transition-colors ${className}`}
    >
      {isDark ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-violet-400" />}
      <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
