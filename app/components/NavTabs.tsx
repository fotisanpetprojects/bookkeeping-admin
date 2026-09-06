'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LANGUAGES, StringKey, useLanguage, useT } from '@/lib/i18n';

const TABS: { href: string; key: StringKey }[] = [
  { href: '/', key: 'nav.home' },
  { href: '/invoices', key: 'nav.invoices' },
  { href: '/clients', key: 'nav.profiles' },
  { href: '/expenses', key: 'nav.expenses' },
  { href: '/btw-summary', key: 'nav.vatSummary' },
  { href: '/belastingdienst', key: 'nav.belastingdienst' },
  { href: '/finance', key: 'nav.finance' },
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

  const isCurrent = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <div className="flex items-center gap-2">
      {/* Scrolls sideways rather than wrapping onto a second row, which pushed the
          language switch onto a line of its own. */}
      <nav className="nav-scroll flex gap-2 text-sm">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isCurrent(tab.href) ? 'page' : undefined}
            className={
              isCurrent(tab.href)
                ? 'btn shrink-0 border-[var(--accent-line)] bg-[var(--accent-soft)] font-medium text-[var(--accent)]'
                : 'btn shrink-0'
            }
          >
            {t(tab.key)}
          </Link>
        ))}
      </nav>

      {/* Settings is a destination, not a section — an icon keeps it out of the row. */}
      <Link
        href="/settings"
        aria-current={isCurrent('/settings') ? 'page' : undefined}
        aria-label={t('nav.settings')}
        title={t('nav.settings')}
        className={
          isCurrent('/settings') ? 'nav-gear shrink-0 is-current' : 'nav-gear shrink-0'
        }
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M19.1 14.4a1.5 1.5 0 0 0 .3 1.65l.06.05a1.8 1.8 0 1 1-2.55 2.55l-.05-.06a1.5 1.5 0 0 0-1.65-.3 1.5 1.5 0 0 0-.91 1.37v.16a1.8 1.8 0 1 1-3.6 0v-.09a1.5 1.5 0 0 0-.98-1.37 1.5 1.5 0 0 0-1.65.3l-.05.06A1.8 1.8 0 1 1 4.47 16.1l.06-.05a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.37-.91h-.16a1.8 1.8 0 1 1 0-3.6h.09a1.5 1.5 0 0 0 1.37-.98 1.5 1.5 0 0 0-.3-1.65l-.06-.05A1.8 1.8 0 1 1 6.95 4.66l.05.06a1.5 1.5 0 0 0 1.65.3h.07a1.5 1.5 0 0 0 .91-1.37v-.16a1.8 1.8 0 1 1 3.6 0v.09a1.5 1.5 0 0 0 .91 1.37 1.5 1.5 0 0 0 1.65-.3l.05-.06a1.8 1.8 0 1 1 2.55 2.55l-.06.05a1.5 1.5 0 0 0-.3 1.65v.07a1.5 1.5 0 0 0 1.37.91h.16a1.8 1.8 0 1 1 0 3.6h-.09a1.5 1.5 0 0 0-1.37.91z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </Link>

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
