'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n';

/**
 * A confirmation the user can switch off for good.
 *
 * Deleting a transaction is small and reversible only by re-importing, so it is
 * worth one question — but asking the same question a hundred times while tidying
 * a statement is its own kind of harm. Ticking the box records the choice.
 */
export default function ConfirmDelete({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: (remember: boolean) => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const [remember, setRemember] = useState(false);

  return (
    <div className="drawer-root" role="dialog" aria-modal="true">
      <button className="drawer-scrim" aria-label={t('fin.cancel')} onClick={onCancel} />

      <div className="confirm-panel card-raised p-6">
        <p className="text-sm">{message}</p>

        <label className="mt-4 flex items-center gap-2 text-sm muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          {t('fin.dontAskAgain')}
        </label>

        <div className="mt-5 flex justify-end gap-3">
          <button className="btn" onClick={onCancel}>
            {t('fin.cancel')}
          </button>
          <button className="btn btn-danger" onClick={() => onConfirm(remember)}>
            {t('fin.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
