'use client';

import Link from 'next/link';
import { useT } from '@/lib/i18n';

export default function NotFound() {
  const { t } = useT();

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <section className="card-raised max-w-lg p-10 text-center">
        <svg
          width="96"
          height="96"
          viewBox="0 0 96 96"
          fill="none"
          className="mx-auto"
          role="img"
          aria-label={t('nf.title')}
        >
          <circle cx="48" cy="48" r="34" stroke="var(--line-strong)" strokeWidth="3" />
          <circle cx="37" cy="41" r="4" fill="var(--ink-3)" />
          <circle cx="59" cy="41" r="4" fill="var(--ink-3)" />
          {/* A frown, not a smile — the books did not balance. */}
          <path
            d="M35 63c4-6 9-9 13-9s9 3 13 9"
            stroke="var(--ink-3)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>

        <p className="mt-6 text-5xl font-semibold tracking-tight">404</p>

        <h1 className="mt-3 text-xl font-semibold">{t('nf.title')}</h1>
        <p className="mt-3 muted">{t('nf.body')}</p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-primary">{t('nf.home')}</Link>
          <Link href="/invoices" className="btn">{t('nav.invoices')}</Link>
          <Link href="/finance" className="btn">{t('nav.finance')}</Link>
        </div>

        <p className="mt-6 text-xs faint">{t('nf.joke')}</p>
      </section>
    </div>
  );
}
