import './globals.css';
import Link from 'next/link';
import NavTabs from '@/app/components/NavTabs';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bookkeeping Admin',
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
                Bookkeeping Admin
              </Link>

              <NavTabs />
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
