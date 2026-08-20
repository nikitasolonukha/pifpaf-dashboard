'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatViews, formatDelta } from '@/lib/format';
import AddReelModal from '@/components/AddReelModal';
import SectionCard from '@/components/SectionCard';
import InstagramProfileHeader, { SyncToast } from '@/components/InstagramProfileHeader';
import ReelsSyncProgress, { useReelsSyncMonitor } from '@/components/ReelsSyncProgress';
import ViewsByReelChart from '@/components/charts/ViewsByReelChart';
import TopReelsChart from '@/components/charts/TopReelsChart';
import ReelsByMonthChart from '@/components/charts/ReelsByMonthChart';
import GrowthChart from '@/components/charts/GrowthChart';
import DashboardReelPreview from '@/components/DashboardReelPreview';
import { useActiveAccountId, withAccountParam } from '@/hooks/useActiveAccount';
import { DEFAULT_SYNC_PERIOD } from '@/lib/instagram/syncPeriods.mjs';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [syncSummary, setSyncSummary] = useState(null);
  const [profile, setProfile] = useState(null);
  const [syncPeriod, setSyncPeriod] = useState(DEFAULT_SYNC_PERIOD);

  const { activeAccountId, setActiveAccountId } = useActiveAccountId(accounts);

  const loadData = useCallback(async () => {
    const res = await fetch(withAccountParam('/api/dashboard', activeAccountId));
    if (res.ok) {
      const json = await res.json();
      setData(json);
      if (json.accounts) setAccounts(json.accounts);
    }
    setLoading(false);
  }, [activeAccountId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client fetch on mount/account
    loadData();
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(p);
      }
    })();
  }, [loadData]);

  const syncMonitor = useReelsSyncMonitor({
    account: data?.instagramAccount,
    syncing,
    onComplete: loadData,
  });

  async function handleSync() {
    if (!data?.instagramAccount?.id) return;
    setSyncing(true);
    const res = await fetch(`/api/instagram/${data.instagramAccount.id}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: syncPeriod }),
    });
    const body = await res.json();
    setSyncing(false);
    if (res.ok) {
      setSyncSummary(body.summary);
      await loadData();
    } else {
      alert(body.error || 'Ошибка синхронизации');
    }
  }

  const firstName = profile?.display_name?.split(' ')[0] || '';
  const perf = data?.performance;
  const growthValue = Number(data?.growth ?? 0);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 md:pb-10 space-y-6">
      {/* Row: greeting + profile sync */}
      <div className="grid grid-cols-12 gap-4 items-start">
        <div className="col-span-12 lg:col-span-7">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Привет{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Вот как работают твои Reels
          </p>
        </div>
        <div className="col-span-12 lg:col-span-5">
          <InstagramProfileHeader
            account={data?.instagramAccount}
            accounts={accounts}
            reelsTracked={data?.totalReels}
            onSync={handleSync}
            onAddReel={() => setShowModal(true)}
            syncing={syncing}
            onAccountChange={setActiveAccountId}
            syncPeriod={syncPeriod}
            onSyncPeriodChange={setSyncPeriod}
          />
        </div>
      </div>

      <ReelsSyncProgress
        active={syncMonitor.active}
        elapsedSec={syncMonitor.elapsedSec}
        title="Синхронизируем Instagram…"
      />

      {/* Hero KPI — 12 col */}
      <div className="grid grid-cols-12 gap-3 md:gap-4">
        <div
          className="col-span-12 md:col-span-6 lg:col-span-5 p-6 md:p-7 rounded-[var(--radius-lg)] border border-[var(--border-soft)] shadow-[var(--shadow-soft)]"
          style={{ background: 'var(--surface)' }}
        >
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            Всего просмотров
          </p>
          <p className="text-4xl md:text-5xl font-semibold mt-2 tracking-tight">{formatViews(data?.totalViews)}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>просмотров всего</p>
        </div>
        <div className="col-span-6 md:col-span-3 lg:col-span-2 p-4 md:p-5 rounded-[var(--radius)] border border-[var(--border-soft)]" style={{ background: 'var(--lavender)' }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Reels</p>
          <p className="text-2xl md:text-3xl font-semibold mt-1">{data?.totalReels ?? 0}</p>
        </div>
        <div className="col-span-6 md:col-span-3 lg:col-span-2 p-4 md:p-5 rounded-[var(--radius)] border border-[var(--border-soft)]" style={{ background: 'var(--peach)' }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Среднее</p>
          <p className="text-2xl md:text-3xl font-semibold mt-1">{formatViews(data?.avgViewsPerReel)}</p>
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3 grid grid-cols-2 md:grid-cols-1 gap-3">
          <div className="p-4 rounded-[var(--radius)] border border-[var(--border-soft)]" style={{ background: 'var(--blush)' }}>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Лучший</p>
            <p className="text-xl font-semibold mt-1">{formatViews(data?.bestReel?.views)}</p>
          </div>
          <div className="p-4 rounded-[var(--radius)] border border-[var(--border-soft)]" style={{ background: data?.growthAvailable ? 'var(--sage)' : 'var(--lavender)' }}>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Прирост</p>
            {data?.growthAvailable ? (
              <p className="text-xl font-semibold mt-1">{formatDelta(growthValue) ?? '0'}</p>
            ) : (
              <>
                <p className="text-xl font-semibold mt-1">—</p>
                <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--text-secondary)' }}>после следующего обновления</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Charts row 1: views by reel + top reels */}
      <div className="grid grid-cols-12 gap-4">
        <SectionCard title="Топ-20 Reels по просмотрам" className="col-span-12 xl:col-span-8">
          {perf?.viewsByReel?.length > 0 ? (
            <ViewsByReelChart data={perf.viewsByReel} />
          ) : (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--text-secondary)' }}>
              График появится после импорта Reels
            </p>
          )}
        </SectionCard>
        <SectionCard title="Top Reels" tint="var(--blush)" className="col-span-12 xl:col-span-4">
          <TopReelsChart data={perf?.topReels} />
        </SectionCard>
      </div>

      {/* Charts row 2: monthly content + recent reels */}
      <div className="grid grid-cols-12 gap-4">
        <SectionCard title="Количество Reels по месяцам" tint="var(--lavender)" className="col-span-12 lg:col-span-5">
          {perf?.reelsByMonth?.length > 0 ? (
            <ReelsByMonthChart data={perf.reelsByMonth} valueKey="count" label="Reels" />
          ) : (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--text-secondary)' }}>Нет данных</p>
          )}
        </SectionCard>
        <SectionCard title="Последние Reels" className="col-span-12 lg:col-span-7">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 md:gap-3">
            {(data?.recentReels || []).map(reel => (
              <DashboardReelPreview key={reel.id} reel={reel} compact />
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Result by publish month + growth */}
      <div className="grid grid-cols-12 gap-4">
        <SectionCard
          title="Результат по месяцам"
          subtitle="Просмотры Reels, опубликованных в этом месяце"
          tint="var(--peach)"
          className="col-span-12 lg:col-span-5"
        >
          {perf?.viewsByPublishMonth?.length > 0 ? (
            <ReelsByMonthChart data={perf.viewsByPublishMonth} valueKey="views" label="Просмотры" />
          ) : (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--text-secondary)' }}>Нет данных</p>
          )}
        </SectionCard>
        <SectionCard title="Рост после подключения" tint="var(--sage)" className="col-span-12 lg:col-span-7">
          <GrowthChart data={data?.chartData} hasGrowth={data?.growthAvailable} />
        </SectionCard>
      </div>

      {showModal && <AddReelModal onClose={() => setShowModal(false)} onSuccess={loadData} />}
      <SyncToast summary={syncSummary} onClose={() => setSyncSummary(null)} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="h-20 rounded-[var(--radius-lg)] bg-gray-100 animate-pulse" />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-5 h-36 bg-gray-100 rounded-[var(--radius-lg)] animate-pulse" />
        <div className="col-span-7 h-36 bg-gray-100 rounded-[var(--radius-lg)] animate-pulse" />
      </div>
      <div className="h-72 bg-gray-100 rounded-[var(--radius-lg)] animate-pulse" />
    </div>
  );
}
