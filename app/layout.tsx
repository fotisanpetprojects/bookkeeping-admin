import './globals.css';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Freelancer Admin',
  description: 'Track invoices, expenses, receipts and BTW',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0b1020] text-white">
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1b2a52_0%,#0b1020_45%,#070b16_100%)]">
          <header className="border-b border-white/10 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <Link href="/" className="text-xl font-semibold tracking-tight">
                Freelancer Admin
              </Link>

              <nav className="flex gap-3 text-sm">
                <Link href="/" className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/10">
                  Dashboard
                </Link>
                <Link href="/invoices" className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/10">
                  Invoices
                </Link>
                <Link href="/clients" className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/10">
                  Profiles
                </Link>
                <Link href="/expenses" className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/10">
                  Expenses
                </Link>
                <Link href="/btw-summary" className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/10">
                  BTW Summary
                </Link>
              </nav>
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
