'use client';

import { useEffect } from 'react';
import { useLocalStorageState } from '@/lib/local-storage';

export type ThemeChoice = 'system' | 'light' | 'dark';

/** Applied before paint by the inline script in the layout, and here on change. */
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;

  if (choice === 'system') {
    root.removeAttribute('data-theme');
    return;
  }

  root.setAttribute('data-theme', choice);
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden focusable="false">
      <circle cx="10" cy="10" r="3.6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 2v2M10 16v2M2 10h2M16 10h2M4.4 4.4l1.4 1.4M14.2 14.2l1.4 1.4M15.6 4.4l-1.4 1.4M5.8 14.2l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden focusable="false">
      <path
        d="M16 11.4A6.4 6.4 0 018.6 4a6.4 6.4 0 103.4 12 6.4 6.4 0 004-4.6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useLocalStorageState<ThemeChoice>('theme', 'system');

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Clicking the mode you are already on returns to following the system.
  const choose = (next: 'light' | 'dark') => {
    setTheme(theme === next ? 'system' : next);
  };

  const options: { value: 'light' | 'dark'; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <SunIcon /> },
    { value: 'dark', label: 'Dark', icon: <MoonIcon /> },
  ];

  return (
    <div className={`btn gap-0 overflow-hidden p-0 ${className}`} role="group" aria-label="Colour theme">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => choose(option.value)}
          aria-pressed={theme === option.value}
          title={
            theme === option.value
              ? `${option.label} — click again to follow your system`
              : `Switch to ${option.label.toLowerCase()}`
          }
          className={
            theme === option.value
              ? 'flex items-center px-2.5 py-1.5 bg-[var(--accent-soft)] text-[var(--accent)]'
              : 'flex items-center px-2.5 py-1.5 text-[var(--ink-3)] hover:bg-[var(--surface-sunken)]'
          }
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}
