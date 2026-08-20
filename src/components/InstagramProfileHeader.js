'use client';

import { RefreshCw, Plus } from 'lucide-react';
import { formatDelta } from '@/lib/format';
import { isSyncInProgress } from '@/lib/instagram/syncProgress';
import TimeAgo from '@/components/TimeAgo';

export default function InstagramProfileHeader({
  account,
  reelsTracked = 0,
  onSync,
  onAddReel,
  syncing = false,
}) {
  const initial = account?.username?.[0]?.toUpperCase() || '?';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 border border-[var(--border-soft)]"
          style={{ background: 'var(--lavender)' }}
        >
          {account?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={account.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold truncate">@{account?.username || 'instagram'}</p>
          <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
            {reelsTracked} Reels
            {account?.last_synced_at && (
              <>
                {' · '}
                <TimeAgo date={account.last_synced_at} prefix="Обновлено " />
              </>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {onAddReel && (
          <button
            type="button"
            onClick={onAddReel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-btn)] text-sm border border-[var(--border-soft)] bg-white/80 hover:bg-white"
          >
            <Plus size={14} /> Reel
          </button>
        )}
        {onSync && account && (
          <button
            type="button"
            onClick={onSync}
            disabled={isSyncInProgress(account, syncing)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-btn)] text-sm font-medium text-white disabled:opacity-60"
            style={{ background: '#191716' }}
          >
            <RefreshCw size={14} className={isSyncInProgress(account, syncing) ? 'animate-spin' : ''} />
            {isSyncInProgress(account, syncing) ? 'Синхронизация…' : 'Синхронизировать'}
          </button>
        )}
      </div>
    </div>
  );
}

export function SyncToast({ summary, onClose }) {
  if (!summary) return null;

  const checked = Number(summary.checked ?? 0);
  const newPart = summary.newCount > 0
    ? `${summary.newCount} новых`
    : 'Новых Reel нет';
  const viewsDelta = formatDelta(summary.viewsDelta ?? 0) ?? '0';
  const viewsPart = viewsDelta.startsWith('+') || viewsDelta.startsWith('-')
    ? viewsDelta
    : `+${viewsDelta}`;

  return (
    <div
      className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[calc(100%-2rem)] p-4 rounded-[var(--radius)] border shadow-lg animate-in"
      style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)' }}
    >
      <p className="font-semibold text-sm mb-1">Instagram обновлён ✨</p>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {checked.toLocaleString('ru-RU')} Reels проверено · {newPart} · {viewsPart} просмотров
      </p>
      <button type="button" onClick={onClose} className="text-xs mt-2 underline" style={{ color: 'var(--text-secondary)' }}>
        Закрыть
      </button>
    </div>
  );
}
