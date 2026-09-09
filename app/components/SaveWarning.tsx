'use client';

import { useEffect, useState } from 'react';
import { getWriteError, subscribeToVault } from '@/lib/vault';

/**
 * Says so when a change did not reach disk.
 *
 * The vault encrypts on a timer, so a failed write happens well after the click
 * that caused it. Without this the app would keep showing the change as saved and
 * lose it on the next reload — the worst kind of failure, because the user has no
 * reason to suspect anything and no chance to rescue the data.
 *
 * It sits above everything and does not dismiss: this is not a notification, it is
 * a state the app is in until something is done about it.
 */
export default function SaveWarning() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const settle = () => setMessage(getWriteError());
    settle();
    return subscribeToVault(settle);
  }, []);

  if (!message) return null;

  return (
    <div className="save-warning" role="alert">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path
          d="M10 3.5l7 12.5H3l7-12.5zM10 8.5v3.2M10 13.7v.1"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {message}
    </div>
  );
}
