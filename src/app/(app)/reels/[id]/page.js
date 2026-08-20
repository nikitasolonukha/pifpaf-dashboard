'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { formatViews, formatViewsFull, formatDelta, formatDate, timeAgo } from '@/lib/format';
import GrowthChart from '@/components/charts/GrowthChart';
import ReelCover from '@/components/ReelCover';

export default function ReelDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [reel, setReel] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/reels/${id}`);
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        setReel(data.reel);
        setSnapshots(data.snapshots || []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetch(`/api/reels/${id}/refresh`, { method: 'POST' });
    const res = await fetch(`/api/reels/${id}`);
    if (res.ok) {
      const data = await res.json();
      setReel(data.reel);
      setSnapshots(data.snapshots || []);
    }
    setRefreshing(false);
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto pb-20 md:pb-8">
        <div className="h-96 rounded-[var(--radius-lg)] bg-gray-100 animate-pulse" />
      </div>
    );
  }

  if (!reel) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <p>Reel не найден</p>
      </div>
    );
  }

  const chartData = snapshots.map(s => ({
    date: new Date(s.captured_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    views: Number(s.views),
  }));

  const hasGrowth = snapshots.length >= 2;

  return (
    <div className="max-w-4xl mx-auto pb-20 md:pb-8 space-y-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm hover:opacity-70"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={16} /> Назад
      </button>

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
        <div className="aspect-[9/16] max-w-[240px] mx-auto md:mx-0 rounded-[var(--radius)] overflow-hidden relative border border-[var(--border-soft)]">
          <ReelCover reel={reel} sizes="240px" iconSize={40} />
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <p className="text-3xl font-semibold">{formatViewsFull(reel.views)}</p>
            <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
              {formatViews(reel.likes)} лайков · {formatViews(reel.comments)} комментариев
            </p>
          </div>

          {reel.caption && <p className="text-sm line-clamp-4">{reel.caption}</p>}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Опубликовано</p>
              <p className="font-medium">{formatDate(reel.published_at) || '—'}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Последняя синхронизация</p>
              <p className="font-medium">{reel.last_synced_at ? timeAgo(reel.last_synced_at) : '—'}</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <a
              href={reel.instagram_url}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-btn)] border border-[var(--border-soft)] text-sm hover:bg-white"
            >
              <ExternalLink size={14} /> Открыть Instagram
            </a>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-btn)] border border-[var(--border-soft)] text-sm disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Обновить
            </button>
          </div>
        </div>
      </div>

      <section className="p-6 rounded-[var(--radius-lg)] border border-[var(--border-soft)] shadow-[var(--shadow-soft)]" style={{ background: 'var(--surface)' }}>
        <h2 className="text-lg font-semibold mb-4">Рост после подключения</h2>
        <GrowthChart data={chartData} hasGrowth={hasGrowth} />
        {hasGrowth && (
          <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
            {formatDelta(Number(snapshots[snapshots.length - 1].views) - Number(snapshots[0].views))} с первого отслеживания
          </p>
        )}
      </section>

      {snapshots.length > 0 && (
        <section className="p-6 rounded-[var(--radius-lg)] border border-[var(--border-soft)]" style={{ background: 'var(--sage)' }}>
          <h2 className="text-lg font-semibold mb-4">История обновлений</h2>
          <ul className="space-y-2">
            {[...snapshots].reverse().slice(0, 20).map((s, i) => (
              <li key={i} className="flex items-center justify-between py-2 border-b border-[var(--border-soft)] last:border-0 text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>
                  {new Date(s.captured_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="font-medium tabular-nums">{Number(s.views).toLocaleString('ru-RU')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
