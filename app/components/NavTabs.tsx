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
          isCurrent('/settings')
            ? 'btn btn-icon shrink-0 border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]'
            : 'btn btn-icon shrink-0'
        }
      >
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M10 2.6v1.7M10 15.7v1.7M17.4 10h-1.7M4.3 10H2.6M15.2 4.8l-1.2 1.2M6 14l-1.2 1.2M15.2 15.2L14 14M6 6L4.8 4.8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
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
