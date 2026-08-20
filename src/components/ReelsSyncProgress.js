'use client';

import { useEffect, useState } from 'react';
import {
  SYNC_STAGES,
  formatElapsed,
  getSyncEtaText,
  getSyncProgress,
  getSyncStage,
  isSyncInProgress,
} from '@/lib/instagram/syncProgress';

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

  return {
    active,
    elapsedSec,
    stage: getSyncStage(elapsedSec),
    progress: getSyncProgress(elapsedSec),
    etaText: getSyncEtaText(elapsedSec),
  };
}

export default function ReelsSyncProgress({
  active,
  elapsedSec = 0,
  stage = 0,
  progress = 0,
  etaText,
  variant = 'banner',
  title = 'Загружаем Reels…',
  stages = SYNC_STAGES,
}) {
  if (!active) return null;

  const eta = etaText || getSyncEtaText(elapsedSec);

  if (variant === 'card') {
    return (
      <div className="text-left max-w-md mx-auto">
        <h2 className="text-xl font-semibold mb-2 text-center">{title}</h2>
        <p className="text-sm mb-5 text-center" style={{ color: 'var(--text-secondary)' }}>
          Apify собирает профиль за 12 месяцев. Не закрывай страницу.
        </p>
        <ProgressBar progress={progress} />
        <MetaRow elapsedSec={elapsedSec} etaText={eta} progress={progress} className="mt-3 mb-5" />
        <StageList stage={stage} stages={stages} />
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
        <MetaRow elapsedSec={elapsedSec} etaText={eta} progress={progress} />
      </div>
      <ProgressBar progress={progress} />
      <p className="text-xs mt-3 hidden sm:block" style={{ color: 'var(--text-secondary)' }}>
        {stages[stage]}
      </p>
    </div>
  );
}

function ProgressBar({ progress }) {
  return (
    <div
      className="h-2.5 rounded-full overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.65)' }}
      aria-hidden
    >
      <div
        className="h-full rounded-full transition-[width] duration-1000 ease-out"
        style={{
          width: `${progress}%`,
          background: 'linear-gradient(90deg, var(--pink) 0%, #191716 100%)',
        }}
      />
    </div>
  );
}

function MetaRow({ elapsedSec, etaText, progress = 0, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums ${className}`} style={{ color: 'var(--text-secondary)' }}>
      <span>{progress}%</span>
      <span>·</span>
      <span>{formatElapsed(elapsedSec)}</span>
      <span>·</span>
      <span>{etaText}</span>
    </div>
  );
}

function StageList({ stage, stages }) {
  return (
    <ul className="space-y-3">
      {stages.map((label, i) => (
        <li
          key={label}
          className="flex items-center gap-3 text-sm"
          style={{
            color: i <= stage ? 'var(--text-primary)' : 'var(--text-secondary)',
            opacity: i <= stage ? 1 : 0.45,
          }}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: i <= stage ? 'var(--pink)' : '#ddd' }}
          />
          {label}
        </li>
      ))}
    </ul>
  );
}
