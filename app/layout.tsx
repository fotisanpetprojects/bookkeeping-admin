import './globals.css';
import Link from 'next/link';
import NavTabs from '@/app/components/NavTabs';
import ThemeToggle from '@/app/components/ThemeToggle';
import SeedLoader from '@/app/components/SeedLoader';
import VaultGate from '@/app/components/VaultGate';
import ConfirmProvider from '@/app/components/Confirm';
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=JSON.parse(localStorage.getItem('theme'));if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-screen">
        <div className="min-h-screen">
          <SeedLoader />
          <ConfirmProvider>
          <VaultGate>
          <header className="app-header">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <Link href="/" className="text-xl font-semibold tracking-tight">
                Bookkeeping Admin
              </Link>

              <NavTabs />
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
          </VaultGate>
          </ConfirmProvider>

          <ThemeToggle className="theme-dock" />
        </div>
      </body>
    </html>
  );
}
