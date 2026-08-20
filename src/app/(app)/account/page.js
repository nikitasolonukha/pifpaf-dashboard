'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';
import { RefreshCw, Plus, Trash2 } from 'lucide-react';
import { SyncToast } from '@/components/InstagramProfileHeader';
import ReelsSyncProgress, { useReelsSyncMonitor } from '@/components/ReelsSyncProgress';
import SyncPeriodSelect from '@/components/SyncPeriodSelect';
import { useActiveAccountId, withAccountParam } from '@/hooks/useActiveAccount';
import { isSyncInProgress } from '@/lib/instagram/syncProgress';
import {
  DEFAULT_SYNC_PERIOD,
  labelForImportSince,
} from '@/lib/instagram/syncPeriods.mjs';

function syncStatusLabel(status) {
  if (status === 'syncing') return 'обновляется…';
  if (status === 'error') return 'ошибка';
  return 'актуально';
}

export default function AccountPage() {
  const [profile, setProfile] = useState(null);
  const [accountData, setAccountData] = useState(null);
  const [email, setEmail] = useState('');
  const [syncingId, setSyncingId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState(null);
  const [firstSnapshot, setFirstSnapshot] = useState(null);
  const [syncPeriods, setSyncPeriods] = useState({});
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const accounts = accountData?.accounts ?? [];
  const reelsTrackedByAccount = accountData?.reelsTrackedByAccount ?? {};
  const { activeAccountId, setActiveAccountId } = useActiveAccountId(accounts);

  const syncAccount = syncingId ? accounts.find((a) => a.id === syncingId) : null;

  const loadAll = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setEmail(user.email || '');
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);
    }
    const accRes = await fetch('/api/instagram/account');
    if (accRes.ok) setAccountData(await accRes.json());

    const dashRes = await fetch(withAccountParam('/api/dashboard', activeAccountId));
    if (dashRes.ok) {
      const dash = await dashRes.json();
      const snaps = dash.chartData;
      if (snaps?.length) setFirstSnapshot(snaps[0]?.date);
      else setFirstSnapshot(null);
    }
  }, [activeAccountId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client fetch on mount
    loadAll();
  }, [loadAll]);

  const syncMonitor = useReelsSyncMonitor({
    account: syncAccount,
    syncing,
    onComplete: async () => {
      setSyncingId(null);
      await loadAll();
    },
  });

  function periodFor(accountId) {
    return syncPeriods[accountId] || DEFAULT_SYNC_PERIOD;
  }

  async function handleSync(accountId) {
    setSyncingId(accountId);
    setActiveAccountId(accountId);
    setSyncing(true);
    const res = await fetch(`/api/instagram/${accountId}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: periodFor(accountId) }),
    });
    const body = await res.json();
    setSyncing(false);
    if (res.ok) {
      setSyncSummary(body.summary);
      await loadAll();
    } else {
      setSyncingId(null);
      alert(body.error || 'Ошибка синхронизации');
    }
  }

  async function handleDelete(account) {
    setDeletingId(account.id);
    const res = await fetch(`/api/instagram/${account.id}`, { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    setDeletingId(null);
    setConfirmDelete(null);
    if (!res.ok) {
      alert(body.error || 'Ошибка удаления');
      return;
    }
    if (activeAccountId === account.id) {
      const remaining = accounts.filter((a) => a.id !== account.id);
      setActiveAccountId(remaining[0]?.id || null);
    }
    await loadAll();
  }

  return (
    <div className="max-w-2xl mx-auto pb-20 md:pb-10 space-y-6">
      <h1 className="text-2xl font-semibold">Мой аккаунт</h1>

      <ReelsSyncProgress
        active={syncMonitor.active}
        elapsedSec={syncMonitor.elapsedSec}
        title="Синхронизируем Instagram…"
      />

      <section className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] p-6 shadow-[var(--shadow-soft)]" style={{ background: 'var(--surface)' }}>
        <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>PifPaf</h2>
        <p className="text-lg font-semibold">{profile?.display_name || '—'}</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{email}</p>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] p-6 shadow-[var(--shadow-soft)] space-y-4" style={{ background: 'var(--blush)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Instagram-профили</h2>
          <Link
            href="/onboarding?add=1"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-btn)] text-sm font-medium border border-[var(--border-soft)] bg-white/80 hover:bg-white"
          >
            <Plus size={14} /> Добавить профиль
          </Link>
        </div>

        {accounts.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Instagram не подключён.{' '}
            <Link href="/onboarding" className="underline">Подключить</Link>
          </p>
        ) : (
          <ul className="space-y-4">
            {accounts.map((account) => {
              const reelsCount = reelsTrackedByAccount[account.id] ?? 0;
              const inProgress = isSyncInProgress(account, syncing && syncingId === account.id);
              const busy = inProgress || deletingId === account.id;
              return (
                <li
                  key={account.id}
                  className="rounded-[var(--radius)] border border-[var(--border-soft)] p-4"
                  style={{ background: 'var(--surface)' }}
                >
                  <p className="text-xl font-semibold">@{account.username}</p>
                  {account.profile_url && (
                    <a
                      href={account.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm underline-offset-2 hover:underline mt-1 inline-block"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {account.profile_url}
                    </a>
                  )}
                  <ul className="mt-3 space-y-1.5 text-sm">
                    <li>Reels отслеживается: <strong>{reelsCount}</strong></li>
                    <li>Период: {labelForImportSince(account.import_since)}</li>
                    <li>
                      Последняя синхронизация:{' '}
                      {account.last_synced_at ? timeAgo(account.last_synced_at) : '—'}
                    </li>
                    <li>
                      Статус:{' '}
                      <span className="font-medium">{syncStatusLabel(account.sync_status)}</span>
                    </li>
                  </ul>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <SyncPeriodSelect
                      value={periodFor(account.id)}
                      disabled={busy}
                      onChange={(v) => setSyncPeriods((prev) => ({ ...prev, [account.id]: v }))}
                    />
                    <button
                      type="button"
                      onClick={() => handleSync(account.id)}
                      disabled={busy}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-btn)] text-sm font-medium text-white disabled:opacity-60"
                      style={{ background: '#191716' }}
                    >
                      <RefreshCw size={14} className={inProgress ? 'animate-spin' : ''} />
                      {inProgress ? 'Синхронизация…' : 'Синхронизировать'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(account)}
                      disabled={busy}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-btn)] text-sm font-medium text-red-600 border border-red-200 bg-white disabled:opacity-60"
                    >
                      <Trash2 size={14} />
                      Удалить
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] p-5 shadow-[var(--shadow-soft)]" style={{ background: 'var(--sage)' }}>
        <h2 className="text-sm font-semibold mb-2">Данные</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {firstSnapshot
            ? `История отслеживания началась ${firstSnapshot}. Рост строится только с момента первого snapshot — мы не придумываем прошлые просмотры.`
            : 'История отслеживания начнётся после первого импорта или синхронизации.'}
        </p>
      </section>

      <SyncToast summary={syncSummary} onClose={() => setSyncSummary(null)} />

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => !deletingId && setConfirmDelete(null)}
        >
          <div
            className="bg-white rounded-[var(--radius)] p-6 max-w-sm w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-2">Удалить @{confirmDelete.username}?</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Профиль и все связанные Reels с историей будут удалены. Это нельзя отменить.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={!!deletingId}
                className="flex-1 py-2 rounded-[var(--radius-btn)] border border-gray-200 text-sm"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDelete)}
                disabled={!!deletingId}
                className="flex-1 py-2 rounded-[var(--radius-btn)] bg-red-500 text-white text-sm disabled:opacity-60"
              >
                {deletingId ? 'Удаление…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
