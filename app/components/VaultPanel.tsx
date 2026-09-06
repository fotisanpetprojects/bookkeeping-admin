'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { lock, subscribeToVault, vaultExists } from '@/lib/vault';
import { requestVaultSetup } from '@/app/components/VaultGate';

export default function VaultPanel() {
  const { t } = useT();
  const [exists, setExists] = useState(false);

  // Rendered on the server too, so the check waits until the browser is available.
  useEffect(() => {
    const settle = () => setExists(vaultExists());
    settle();
    return subscribeToVault(settle);
  }, []);

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t('vault.panelTitle')}</h2>
          <p className="mt-1 max-w-2xl text-sm muted">{t('vault.panelBody')}</p>
          {exists && (
            <p className="mt-2 text-sm" style={{ color: 'var(--good)' }}>
              {t('vault.enabled')}
            </p>
          )}
        </div>

        {exists ? (
          <button className="btn" onClick={() => void lock()}>
            {t('vault.lock')}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={requestVaultSetup}>
            {t('vault.enable')}
          </button>
        )}
      </div>
    </section>
  );
}
