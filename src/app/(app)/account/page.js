'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatViews, timeAgo } from '@/lib/format';
import { RefreshCw } from 'lucide-react';
import { SyncToast } from '@/components/InstagramProfileHeader';
import ReelsSyncProgress, { useReelsSyncMonitor } from '@/components/ReelsSyncProgress';

export default function AccountPage() {
  const [profile, setProfile] = useState(null);
  const [accountData, setAccountData] = useState(null);
  const [email, setEmail] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState(null);
  const [firstSnapshot, setFirstSnapshot] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setEmail(user.email || '');
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);
    }
    const accRes = await fetch('/api/instagram/account');
    if (accRes.ok) setAccountData(await accRes.json());

    const dashRes = await fetch('/api/dashboard');
    if (dashRes.ok) {
      const dash = await dashRes.json();
      const snaps = dash.chartData;
      if (snaps?.length) setFirstSnapshot(snaps[0]?.date);
    }
  }

  async function handleSync() {
    if (!accountData?.account?.id) return;
    setSyncing(true);
    const res = await fetch(`/api/instagram/${accountData.account.id}/sync`, { method: 'POST' });
    const body = await res.json();
    setSyncing(false);
    if (res.ok) {
      setSyncSummary(body.summary);
      await loadAll();
    } else {
      alert(body.error);
    }
  }

  const account = accountData?.account;

  const syncMonitor = useReelsSyncMonitor({
    account,
    syncing,
    onComplete: async () => { await loadAll(); },
  });

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

      <section className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] p-6 shadow-[var(--shadow-soft)]" style={{ background: 'var(--blush)' }}>
        <h2 className="text-lg font-semibold mb-4">Подключённый Instagram</h2>
        {account ? (
          <>
            <p className="text-xl font-semibold">@{account.username}</p>
            <a
              href={account.profile_url}
              target="_blank"
              rel="noopener"
              className="text-sm underline-offset-2 hover:underline mt-1 inline-block"
              style={{ color: 'var(--text-secondary)' }}
            >
              {account.profile_url}
            </a>
            <ul className="mt-4 space-y-2 text-sm">
              <li>Reels отслеживается: <strong>{accountData.reelsTracked ?? 0}</strong></li>
              <li>Период: последние 12 месяцев</li>
              <li>
                Последняя синхронизация:{' '}
                {account.last_synced_at ? timeAgo(account.last_synced_at) : '—'}
              </li>
              <li>
                Статус:{' '}
                <span className="font-medium">
                  {account.sync_status === 'syncing' ? 'обновляется…' : account.sync_status === 'error' ? 'ошибка' : 'актуально'}
                </span>
              </li>
            </ul>
            <div className="flex flex-wrap gap-2 mt-5">
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-btn)] text-sm font-medium text-white disabled:opacity-60"
                style={{ background: '#191716' }}
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> Синхронизировать
              </button>
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
              Один Instagram-профиль на кабинет. Смена аккаунта в этом тестовом релизе недоступна.
            </p>
          </>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Instagram не подключён.{' '}
            <Link href="/onboarding" className="underline">Подключить</Link>
          </p>
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
    </div>
  );
}
