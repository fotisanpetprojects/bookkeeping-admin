'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Dashboard' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/clients', label: 'Profiles' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/btw-summary', label: 'BTW Summary' },
  { href: '/belastingdienst', label: 'Belastingdienst' },
];

export default function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-3 text-sm">
      {TABS.map((tab) => {
        const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={
              isActive
                ? 'rounded-full border border-cyan-400/60 bg-cyan-400/15 px-4 py-2 font-medium text-cyan-100'
                : 'rounded-full border border-white/10 px-4 py-2 text-white/80 hover:bg-white/10'
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
