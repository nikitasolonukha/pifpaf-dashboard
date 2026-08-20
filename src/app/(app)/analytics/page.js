'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatViews, formatDelta } from '@/lib/format';
import SectionCard from '@/components/SectionCard';
import InstagramProfileHeader, { SyncToast } from '@/components/InstagramProfileHeader';
import ViewsByReelChart from '@/components/charts/ViewsByReelChart';
import TopReelsChart from '@/components/charts/TopReelsChart';
import ReelsByMonthChart from '@/components/charts/ReelsByMonthChart';
import GrowthChart from '@/components/charts/GrowthChart';
import { BestReelCard } from '@/components/DashboardReelPreview';
import { useActiveAccountId, withAccountParam } from '@/hooks/useActiveAccount';
import { DEFAULT_SYNC_PERIOD } from '@/lib/instagram/syncPeriods.mjs';

const PERIODS = [
  { query: 'days=30', label: '30 дней' },
  { query: 'period=3', label: '3 месяца' },
  { query: 'period=6', label: '6 месяцев' },
  { query: 'period=12', label: '12 месяцев' },
];

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodQuery, setPeriodQuery] = useState('period=12');
  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState(null);
  const [syncPeriod, setSyncPeriod] = useState(DEFAULT_SYNC_PERIOD);

  const { activeAccountId, setActiveAccountId } = useActiveAccountId(accounts);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(withAccountParam(`/api/dashboard?${periodQuery}`, activeAccountId));
    if (res.ok) {
      const json = await res.json();
      setData(json);
      if (json.accounts) setAccounts(json.accounts);
    }
    setLoading(false);
  }, [periodQuery, activeAccountId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client fetch on period/account change
    loadData();
  }, [loadData]);

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
      alert(body.error || 'Ошибка');
    }
  }

  const perf = data?.performance;
  const growthValue = Number(data?.growth ?? 0);

  return (
    <div className="max-w-7xl mx-auto pb-20 md:pb-10 space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold">Аналитика</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Полная статистика твоих Reels
          </p>
        </div>
        <InstagramProfileHeader
          account={data?.instagramAccount}
          accounts={accounts}
          reelsTracked={data?.totalReels}
          onSync={handleSync}
          syncing={syncing}
          onAccountChange={setActiveAccountId}
          syncPeriod={syncPeriod}
          onSyncPeriodChange={setSyncPeriod}
        />
      </header>

      <div className="flex flex-wrap gap-2">
        {PERIODS.map(p => (
          <button
            key={p.query}
            type="button"
            onClick={() => setPeriodQuery(p.query)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              periodQuery === p.query ? 'border-transparent' : 'border-[var(--border-soft)] bg-white/60'
            }`}
            style={{
              background: periodQuery === p.query ? 'var(--pink-bg)' : undefined,
              color: periodQuery === p.query ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-96 bg-gray-100 rounded-[var(--radius-lg)] animate-pulse" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Все просмотры" value={formatViews(data?.totalViews)} />
            <Kpi label="Среднее на Reel" value={formatViews(data?.avgViewsPerReel)} tint="var(--lavender)" />
            <Kpi label="Медиана" value={formatViews(data?.medianViews)} tint="var(--peach)" />
            <Kpi label="Лучший Reel" value={formatViews(data?.bestReel?.views)} tint="var(--blush)" />
          </div>

          <SectionCard title="Топ-20 Reels по просмотрам">
            {perf?.viewsByReel?.length > 0 ? (
              <ViewsByReelChart data={perf.viewsByReel} />
            ) : (
              <p className="text-sm py-10 text-center" style={{ color: 'var(--text-secondary)' }}>
                Нет Reels за выбранный период
              </p>
            )}
          </SectionCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Top Reels" tint="var(--blush)">
              <TopReelsChart data={perf?.topReels} />
            </SectionCard>
            <SectionCard title="Количество Reels по месяцам" tint="var(--lavender)">
              {perf?.reelsByMonth?.length > 0 ? (
                <ReelsByMonthChart data={perf.reelsByMonth} valueKey="count" label="Reels" />
              ) : (
                <p className="text-sm py-8 text-center" style={{ color: 'var(--text-secondary)' }}>Нет данных</p>
              )}
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard
              title="Результат по месяцам"
              subtitle="Просмотры Reels, опубликованных в этом месяце"
              tint="var(--peach)"
            >
              {perf?.viewsByPublishMonth?.length > 0 ? (
                <ReelsByMonthChart data={perf.viewsByPublishMonth} valueKey="views" label="Просмотры" />
              ) : (
                <p className="text-sm py-8 text-center" style={{ color: 'var(--text-secondary)' }}>Нет данных</p>
              )}
            </SectionCard>
            <SectionCard title="Лучший Reel" tint="var(--sage)">
              {data?.bestReel ? (
                <BestReelCard reel={data.bestReel} />
              ) : (
                <p className="text-sm py-6" style={{ color: 'var(--text-secondary)' }}>—</p>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Рост после подключения">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Изменение отслеживаемых просмотров между синхронизациями
              </p>
              {data?.growthAvailable && (
                <span className="text-sm font-medium">{formatDelta(growthValue)}</span>
              )}
            </div>
            <GrowthChart data={data?.chartData} hasGrowth={data?.growthAvailable} />
          </SectionCard>
        </>
      )}

      <SyncToast summary={syncSummary} onClose={() => setSyncSummary(null)} />
    </div>
  );
}

function Kpi({ label, value, tint = 'var(--surface)' }) {
  return (
    <div className="p-4 rounded-[var(--radius)] border border-[var(--border-soft)] shadow-[var(--shadow-soft)]" style={{ background: tint }}>
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-xl font-semibold mt-1">{value ?? '—'}</p>
    </div>
  );
}
