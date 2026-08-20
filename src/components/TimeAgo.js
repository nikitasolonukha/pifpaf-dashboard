'use client';

import { useSyncExternalStore } from 'react';
import { timeAgo } from '@/lib/format';

function subscribe() {
  return () => {};
}

function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/** Relative time after mount — avoids Date.now() hydration mismatch. */
export default function TimeAgo({ date, prefix = '', empty = '' }) {
  const isClient = useIsClient();

  if (!date) return empty ? <>{empty}</> : null;

  if (!isClient) {
    return empty ? <>{empty}</> : (
      <span className="invisible" aria-hidden>
        …
      </span>
    );
  }

  return (
    <>
      {prefix}
      {timeAgo(date)}
    </>
  );
}
