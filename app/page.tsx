import Link from 'next/link';
import BackupPanel from '@/app/components/BackupPanel';
import AiImportPanel from '@/app/components/AiImportPanel';

const CARDS = [
  { n: '01', href: '/invoices', title: 'Invoices', body: 'Create invoices and calculate VAT totals instantly.' },
  { n: '02', href: '/clients', title: 'Profiles', body: 'Save your business details and reusable client invoice data.' },
  { n: '03', href: '/expenses', title: 'Expenses', body: 'Log receipts, VAT rates and business costs.' },
  { n: '04', href: '/btw-summary', title: 'VAT Summary', body: 'Net VAT per quarter, and what is still to pay.' },
  { n: '05', href: '/belastingdienst', title: 'Belastingdienst', body: 'The tax year in full: receivables, VAT, and income tax to year end.' },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="card-raised p-8">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
          Bookkeeping Admin
        </p>
        <h1 className="mb-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight">
          Keep your invoices, receipts and quarterly BTW under control.
        </h1>
        <p className="max-w-2xl muted">
          A simple admin tool for independent professionals to track billing profiles,
          invoices, expenses, receipts and VAT without spreadsheet chaos.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/invoices" className="btn btn-primary">Create invoice</Link>
          <Link href="/expenses" className="btn">Add expense</Link>
          <Link href="/belastingdienst" className="btn">See the tax year</Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CARDS.map((card) => (
          <Link key={card.href} href={card.href} className="card p-6 transition hover:-translate-y-0.5">
            <div className="mb-2 text-xs faint">{card.n}</div>
            <h2 className="text-lg font-semibold">{card.title}</h2>
            <p className="mt-2 text-sm muted">{card.body}</p>
          </Link>
        ))}
      </section>

      <AiImportPanel />

      <BackupPanel />
    </div>
  );
}
