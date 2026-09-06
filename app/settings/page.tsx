'use client';

import { useT } from '@/lib/i18n';
import VaultSettings from '@/app/components/VaultSettings';
import AccountSettings from '@/app/components/AccountSettings';
import BackupPanel from '@/app/components/BackupPanel';
import AiImportPanel from '@/app/components/AiImportPanel';

export default function SettingsPage() {
  const { t } = useT();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">{t('set.title')}</h1>
        <p className="mt-2 max-w-2xl muted">{t('set.subtitle')}</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm uppercase tracking-[0.16em] faint">{t('set.security')}</h2>
        <VaultSettings />
      </section>

      <AccountSettings />

      <BackupPanel />

      <AiImportPanel />
    </div>
  );
}
