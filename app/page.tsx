'use client';

import Link from 'next/link';
import BackupPanel from '@/app/components/BackupPanel';
import AiImportPanel from '@/app/components/AiImportPanel';
import { StringKey, useT } from '@/lib/i18n';

const CARDS: { n: string; href: string; title: StringKey; body: StringKey }[] = [
  { n: '01', href: '/invoices', title: 'nav.invoices', body: 'home.cardInvoices' },
  { n: '02', href: '/clients', title: 'nav.profiles', body: 'home.cardProfiles' },
  { n: '03', href: '/expenses', title: 'nav.expenses', body: 'home.cardExpenses' },
  { n: '04', href: '/btw-summary', title: 'nav.vatSummary', body: 'home.cardVat' },
  { n: '05', href: '/belastingdienst', title: 'nav.belastingdienst', body: 'home.cardBelasting' },
];

export default function Home() {
  const { t } = useT();

  return (
    <div className="space-y-8">
      <section className="card-raised p-8">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
          {t('home.eyebrow')}
        </p>
        <h1 className="mb-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight">
          {t('home.headline')}
        </h1>
        <p className="max-w-2xl muted">{t('home.intro')}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/invoices" className="btn btn-primary">{t('home.createInvoice')}</Link>
          <Link href="/expenses" className="btn">{t('home.addExpense')}</Link>
          <Link href="/belastingdienst" className="btn">{t('home.seeTaxYear')}</Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CARDS.map((card) => (
          <Link key={card.href} href={card.href} className="card p-6 transition hover:-translate-y-0.5">
            <div className="mb-2 text-xs faint">{card.n}</div>
            <h2 className="text-lg font-semibold">{t(card.title)}</h2>
            <p className="mt-2 text-sm muted">{t(card.body)}</p>
          </Link>
        ))}
      </section>

      <BackupPanel />

      <AiImportPanel />
    </div>
  );
}
