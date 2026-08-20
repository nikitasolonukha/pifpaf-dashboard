'use client';

import { RefreshCw, Plus } from 'lucide-react';
import { formatDelta } from '@/lib/format';
import { isSyncInProgress } from '@/lib/instagram/syncProgress';
import TimeAgo from '@/components/TimeAgo';
import AccountSwitcher from '@/components/AccountSwitcher';
import SyncPeriodSelect from '@/components/SyncPeriodSelect';
import { DEFAULT_SYNC_PERIOD } from '@/lib/instagram/syncPeriods.mjs';

export default function InstagramProfileHeader({
  account,
  accounts = [],
  reelsTracked = 0,
  onSync,
  onAddReel,
  syncing = false,
  onAccountChange,
  syncPeriod = DEFAULT_SYNC_PERIOD,
  onSyncPeriodChange,
}) {
  const list = accounts?.length ? accounts : (account ? [account] : []);
  const initial = account?.username?.[0]?.toUpperCase() || '?';
  const busy = isSyncInProgress(account, syncing);

  return (
    <div className="flex flex-col gap-3 mb-6 w-full min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 border border-[var(--border-soft)]"
          style={{ background: 'var(--lavender)' }}
        >
          {account?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={account.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0 flex-1">
          {list.length > 1 && onAccountChange ? (
            <AccountSwitcher
              accounts={list}
              value={account?.id}
              onChange={onAccountChange}
            />
          ) : (
            <p className="font-semibold truncate">@{account?.username || 'instagram'}</p>
          )}
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
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
      <div className="flex flex-wrap items-center gap-2">
        {onAddReel && (
          <button
            type="button"
            onClick={onAddReel}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-btn)] text-sm border border-[var(--border-soft)] bg-white/80 hover:bg-white shrink-0"
          >
            <Plus size={14} /> Reel
          </button>
        )}
        {onSync && account && onSyncPeriodChange && (
          <SyncPeriodSelect
            value={syncPeriod}
            onChange={onSyncPeriodChange}
            disabled={busy}
            className="shrink-0"
          />
        )}
        {onSync && account && (
          <button
            type="button"
            onClick={onSync}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-btn)] text-sm font-medium text-white disabled:opacity-60 shrink-0"
            style={{ background: '#191716' }}
          >
            <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
            {busy ? 'Синхронизация…' : 'Синхронизировать'}
          </button>
        )}
      </div>
    </div>
  );
}

export function SyncToast({ summary, onClose }) {
  if (!summary) return null;

  const checked = Number(summary.checked ?? 0);
  const failedCount = Number(summary.failedCount ?? 0);
  const partial = summary.partial || failedCount > 0;
  const newPart = summary.newCount > 0
    ? `${summary.newCount} новых`
    : 'Новых Reel нет';
  const viewsDelta = formatDelta(summary.viewsDelta ?? 0) ?? '0';
  const viewsPart = viewsDelta.startsWith('+') || viewsDelta.startsWith('-')
    ? viewsDelta
    : `+${viewsDelta}`;

  const detail = summary.errorMessage
    ? summary.errorMessage
    : partial
      ? `${checked.toLocaleString('ru-RU')} проверено · ${Number(summary.updatedCount ?? 0) + Number(summary.newCount ?? 0)} обновлено · ${failedCount} ошибок`
      : `${checked.toLocaleString('ru-RU')} Reels проверено · ${newPart} · ${viewsPart} просмотров`;

  return (
    <div
      className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[calc(100%-2rem)] p-4 rounded-[var(--radius)] border shadow-lg animate-in"
      style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)' }}
    >
      <p className="font-semibold text-sm mb-1">
        {summary.errorMessage ? 'Не удалось выполнить действие' : partial ? 'Instagram обновлён частично' : 'Instagram обновлён ✨'}
      </p>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {detail}
      </p>
      <button type="button" onClick={onClose} className="text-xs mt-2 underline" style={{ color: 'var(--text-secondary)' }}>
        Закрыть
      </button>
    </div>
  );
}
