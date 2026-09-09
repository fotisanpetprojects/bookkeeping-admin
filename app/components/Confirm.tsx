'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { useT } from '@/lib/i18n';

/**
 * One confirmation dialog for the whole app.
 *
 * The browser's own `confirm()` is jarring here: it is chrome-coloured, it says
 * "localhost:3000 says", it ignores the theme, and it cannot offer anything beyond
 * OK and Cancel. Five call sites were using it, so five moments in the app looked
 * like they belonged to a different program.
 *
 * `useConfirm()` returns a promise so a caller reads the same as before — await it
 * and carry on — while the dialog itself is ours.
 */

export type ConfirmOptions = {
  message: string;
  /** Text on the confirming button; defaults to a neutral "Confirm". */
  confirmLabel?: string;
  /** Red button, for anything that discards data. */
  danger?: boolean;
  /** Offers "do not ask me again"; the answer comes back as `remember`. */
  offerRemember?: boolean;
};

export type ConfirmResult = { confirmed: boolean; remember: boolean };

type Pending = ConfirmOptions & { resolve: (result: ConfirmResult) => void };

const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<ConfirmResult>>(
  async () => ({ confirmed: false, remember: false })
);

export function useConfirm() {
  return useContext(ConfirmContext);
}

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const [pending, setPending] = useState<Pending | null>(null);
  const [remember, setRemember] = useState(false);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<ConfirmResult>((resolve) => {
        setRemember(false);
        setPending({ ...options, resolve });
      }),
    []
  );

  const settle = (confirmed: boolean) => {
    pending?.resolve({ confirmed, remember });
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {pending && (
        <div className="drawer-root" role="dialog" aria-modal="true">
          <button
            className="drawer-scrim"
            aria-label={t('fin.cancel')}
            onClick={() => settle(false)}
          />

          <div className="confirm-panel card-raised p-6">
            <p className="text-sm">{pending.message}</p>

            {pending.offerRemember && (
              <label className="mt-4 flex items-center gap-2 text-sm muted">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                {t('fin.dontAskAgain')}
              </label>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button className="btn" onClick={() => settle(false)} autoFocus>
                {t('fin.cancel')}
              </button>
              <button
                className={pending.danger ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={() => settle(true)}
              >
                {pending.confirmLabel ?? t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
