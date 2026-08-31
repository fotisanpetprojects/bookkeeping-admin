import './globals.css';
import Link from 'next/link';
import NavTabs from '@/app/components/NavTabs';
import SeedLoader from '@/app/components/SeedLoader';
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
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <div className="min-h-screen">
          <SeedLoader />
          <header className="app-header sticky top-0 z-20">
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
