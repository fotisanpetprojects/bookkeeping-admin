'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LANGUAGES, StringKey, useLanguage, useT } from '@/lib/i18n';
import ThemeToggle from '@/app/components/ThemeToggle';

const TABS: { href: string; key: StringKey }[] = [
  { href: '/', key: 'nav.home' },
  { href: '/invoices', key: 'nav.invoices' },
  { href: '/clients', key: 'nav.profiles' },
  { href: '/expenses', key: 'nav.expenses' },
  { href: '/btw-summary', key: 'nav.vatSummary' },
  { href: '/belastingdienst', key: 'nav.belastingdienst' },
];

export default function NavTabs() {
  const pathname = usePathname();
  const [language, setLanguage] = useLanguage();
  const { t } = useT();

  // The document language is set on the client: rendering it on the server would
  // depend on a stored preference the server cannot know, which is a hydration
  // mismatch by construction.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <nav className="flex flex-wrap gap-3 text-sm">
        {TABS.map((tab) => {
          const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={
                isActive
                  ? 'btn border-[var(--accent-line)] bg-[var(--accent-soft)] font-medium text-[var(--accent)]'
                  : 'btn'
              }
            >
              {t(tab.key)}
            </Link>
          );
        })}
      </nav>

      <ThemeToggle />

      <div className="btn gap-0 overflow-hidden p-0">
        {LANGUAGES.map((option) => (
          <button
            key={option.code}
            onClick={() => setLanguage(option.code)}
            aria-pressed={language === option.code}
            className={
              language === option.code
                ? 'bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent)]'
                : 'px-3 py-1.5 text-xs text-[var(--ink-3)] hover:bg-[var(--surface-sunken)]'
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
