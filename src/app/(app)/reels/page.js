'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, LayoutGrid, Table2, Search } from 'lucide-react';
import ReelCard from '@/components/ReelCard';
import ReelTable from '@/components/ReelTable';
import AddReelModal from '@/components/AddReelModal';
import InstagramProfileHeader, { SyncToast } from '@/components/InstagramProfileHeader';
import ReelsSyncProgress, { useReelsSyncMonitor } from '@/components/ReelsSyncProgress';

const PERIOD_FILTERS = [
  { id: 'all', label: 'Все' },
  { id: '30d', label: '30 дней' },
  { id: '3m', label: '3 месяца' },
  { id: '6m', label: '6 месяцев' },
  { id: '12m', label: '12 месяцев' },
];

function filterByPeriod(reels, period) {
  if (period === 'all') return reels;
  const cutoff = new Date();
  if (period === '30d') cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  else if (period === '3m') cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
  else if (period === '6m') cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
  else if (period === '12m') cutoff.setUTCMonth(cutoff.getUTCMonth() - 12);
  return reels.filter(r => !r.published_at || new Date(r.published_at) >= cutoff);
}

export default function ReelsPage() {
  const [reels, setReels] = useState([]);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('grid');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [period, setPeriod] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState(null);

  const loadReels = useCallback(async () => {
    const [reelsRes, accRes] = await Promise.all([
      fetch('/api/reels'),
      fetch('/api/instagram/account'),
    ]);
    if (reelsRes.ok) {
      const data = await reelsRes.json();
      setReels(data.reels || []);
    }
    if (accRes.ok) {
      const acc = await accRes.json();
      setAccount(acc.account);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client fetch on mount
    loadReels();
  }, [loadReels]);

  const syncMonitor = useReelsSyncMonitor({
    account,
    syncing,
    onComplete: async (accData) => {
      if (accData?.account) setAccount(accData.account);
      await loadReels();
    },
  });

  async function handleSync() {
    if (!account?.id) return;
    setSyncing(true);
    const res = await fetch(`/api/instagram/${account.id}/sync`, { method: 'POST' });
    const body = await res.json();
    setSyncing(false);
    if (res.ok) {
      setSyncSummary(body.summary);
      await loadReels();
    } else {
      alert(body.error);
    }
  }

  async function handleDelete(id) {
    const res = await fetch(`/api/reels/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSyncSummary({
        partial: true,
        checked: 0,
        newCount: 0,
        updatedCount: 0,
        failedCount: 1,
        errorMessage: body.error || 'Не удалось удалить Reel',
      });
      return;
    }
    setReels(r => r.filter(x => x.id !== id));
  }

  async function handleRefresh(id) {
    setReels(r => r.map(x => x.id === id ? { ...x, sync_status: 'syncing' } : x));
    const res = await fetch(`/api/reels/${id}/refresh`, { method: 'POST' });
    if (res.ok) {
      await loadReels();
    } else {
      await loadReels();
    }
  }

  let filtered = filterByPeriod(reels, period).filter(r =>
    !search || r.caption?.toLowerCase().includes(search.toLowerCase()) ||
    r.owner_username?.toLowerCase().includes(search.toLowerCase())
  );

  if (sort === 'newest') {
    filtered.sort((a, b) => new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at));
  } else if (sort === 'views') {
    filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
  } else if (sort === 'growth') {
    filtered.sort((a, b) => (b.deltaViews ?? -Infinity) - (a.deltaViews ?? -Infinity));
  }

  return (
    <div className="max-w-6xl mx-auto pb-20 md:pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Мои Reels</h1>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Лента автоматически импортированных Reels
        </p>
        <InstagramProfileHeader
          account={account}
          reelsTracked={reels.length}
          onSync={account ? handleSync : undefined}
          onAddReel={() => setShowModal(true)}
          syncing={syncing}
        />
      </div>

      <ReelsSyncProgress
        active={syncMonitor.active}
        elapsedSec={syncMonitor.elapsedSec}
        title="Синхронизируем Instagram…"
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {PERIOD_FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setPeriod(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              period === f.id ? 'border-transparent' : 'border-[var(--border-soft)] bg-white/60'
            }`}
            style={{
              background: period === f.id ? 'var(--pink-bg)' : undefined,
              color: period === f.id ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-[var(--radius-btn)] border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200"
          />
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="px-3 py-2 rounded-[var(--radius-btn)] border border-gray-200 text-sm bg-white"
        >
          <option value="newest">Сначала новые</option>
          <option value="views">По просмотрам</option>
          <option value="growth">По росту</option>
        </select>
        <div className="flex border border-gray-200 rounded-[var(--radius-btn)] overflow-hidden">
          <button onClick={() => setView('grid')} className={`px-3 py-2 ${view === 'grid' ? 'bg-[var(--pink-bg)]' : 'hover:bg-gray-50'}`}>
            <LayoutGrid size={16} />
          </button>
          <button onClick={() => setView('table')} className={`px-3 py-2 ${view === 'table' ? 'bg-[var(--pink-bg)]' : 'hover:bg-gray-50'}`}>
            <Table2 size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-[9/16] rounded-[var(--radius)] bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 rounded-[var(--radius-lg)] border border-[var(--border-soft)]" style={{ background: 'var(--surface)' }}>
          {reels.length === 0 ? (
            <>
              <p className="text-sm text-center max-w-sm" style={{ color: 'var(--text-secondary)' }}>
                Reels появятся после подключения Instagram или ручного добавления
              </p>
              <button onClick={() => setShowModal(true)} className="mt-4 px-4 py-2 rounded-[var(--radius-btn)] text-sm text-white" style={{ background: '#191716' }}>
                + Reel
              </button>
            </>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Ничего не найдено</p>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(reel => (
            <ReelCard key={reel.id} reel={reel} onRefresh={handleRefresh} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        <ReelTable reels={filtered} onRefresh={handleRefresh} onDelete={handleDelete} />
      )}

      {showModal && <AddReelModal onClose={() => setShowModal(false)} onSuccess={loadReels} />}
      <SyncToast summary={syncSummary} onClose={() => setSyncSummary(null)} />
    </div>
  );
}
