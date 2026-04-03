import Link from 'next/link';

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
        <p className="mb-3 text-sm uppercase tracking-[0.2em] text-cyan-300">
          Freelancer Finance OS
        </p>
        <h1 className="mb-4 max-w-2xl text-4xl font-semibold leading-tight">
          Keep your invoices, receipts and quarterly BTW under control.
        </h1>
        <p className="max-w-2xl text-white/70">
          A simple admin tool for freelancers to track billing profiles, invoices, expenses, receipts and VAT without spreadsheet chaos.
        </p>

        <div className="mt-6 flex gap-3">
          <Link
            href="/invoices"
            className="rounded-full bg-cyan-400 px-5 py-3 font-medium text-black hover:opacity-90"
          >
            Create invoice
          </Link>
          <Link
            href="/expenses"
            className="rounded-full border border-white/10 px-5 py-3 font-medium hover:bg-white/10"
          >
            Add expense
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link href="/invoices" className="rounded-3xl border border-white/10 bg-white/5 p-6 hover:bg-white/10">
          <div className="mb-2 text-sm text-white/50">01</div>
          <h2 className="text-xl font-semibold">Invoices</h2>
          <p className="mt-2 text-sm text-white/70">
            Create invoices and calculate VAT totals instantly.
          </p>
        </Link>

        <Link href="/clients" className="rounded-3xl border border-white/10 bg-white/5 p-6 hover:bg-white/10">
          <div className="mb-2 text-sm text-white/50">02</div>
          <h2 className="text-xl font-semibold">Profiles</h2>
          <p className="mt-2 text-sm text-white/70">
            Save your business details and reusable client invoice data.
          </p>
        </Link>

        <Link href="/expenses" className="rounded-3xl border border-white/10 bg-white/5 p-6 hover:bg-white/10">
          <div className="mb-2 text-sm text-white/50">03</div>
          <h2 className="text-xl font-semibold">Expenses</h2>
          <p className="mt-2 text-sm text-white/70">
            Log receipts, VAT rates and business costs.
          </p>
        </Link>

        <Link href="/btw-summary" className="rounded-3xl border border-white/10 bg-white/5 p-6 hover:bg-white/10">
          <div className="mb-2 text-sm text-white/50">04</div>
          <h2 className="text-xl font-semibold">BTW Summary</h2>
          <p className="mt-2 text-sm text-white/70">
            Review deductible VAT by quarter.
          </p>
        </Link>
      </section>
    </div>
  );
}
