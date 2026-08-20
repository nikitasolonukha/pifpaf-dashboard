'use client';

import { useEffect, useState } from 'react';
import { formatElapsed, isSyncInProgress } from '@/lib/instagram/syncProgress';

export function useReelsSyncMonitor({ account, syncing, onComplete }) {
  const active = isSyncInProgress(account, syncing);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!active) return undefined;

    const startedAt = syncing
      ? Date.now()
      : new Date(account?.updated_at || account?.created_at || Date.now()).getTime();

    const tick = () => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [active, syncing, account?.updated_at, account?.created_at]);

  useEffect(() => {
    if (!active || syncing) return undefined;

    const poll = setInterval(async () => {
      const res = await fetch('/api/instagram/account');
      if (!res.ok) return;
      const data = await res.json();
      if (data.account?.sync_status !== 'syncing') {
        onComplete?.(data);
      }
    }, 5000);

    return () => clearInterval(poll);
  }, [active, syncing, onComplete]);

  return { active, elapsedSec };
}

export default function ReelsSyncProgress({
  active,
  elapsedSec = 0,
  variant = 'banner',
  title = 'Синхронизируем Instagram…',
}) {
  if (!active) return null;

  if (variant === 'card') {
    return (
      <div className="text-left max-w-md mx-auto">
        <h2 className="text-xl font-semibold mb-2 text-center">{title}</h2>
        <p className="text-sm mb-5 text-center" style={{ color: 'var(--text-secondary)' }}>
          Получаем публичные Reels за 12 месяцев. Это может занять несколько минут. Не закрывай страницу.
        </p>
        <IndeterminateBar />
        <p className="text-xs mt-3 text-center tabular-nums" style={{ color: 'var(--text-secondary)' }}>
          Прошло {formatElapsed(elapsedSec)}
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] p-4 md:p-5 shadow-[var(--shadow-soft)]"
      style={{ background: 'var(--pink-bg)' }}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
          Прошло {formatElapsed(elapsedSec)}
        </p>
      </div>
      <IndeterminateBar />
      <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
        Это может занять несколько минут
      </p>
    </div>
  );
}

function IndeterminateBar() {
  return (
    <div
      className="h-2.5 rounded-full overflow-hidden relative"
      style={{ background: 'rgba(255,255,255,0.65)' }}
      aria-hidden
    >
      <div className="absolute inset-y-0 w-1/3 rounded-full animate-sync-indeterminate" style={{ background: 'linear-gradient(90deg, var(--pink) 0%, #191716 100%)' }} />
    </div>
  );
}
