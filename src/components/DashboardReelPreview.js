'use client';

import Link from 'next/link';
import ReelCover from '@/components/ReelCover';
import { formatViews, formatDelta, timeAgo } from '@/lib/format';

function deltaLabel(delta) {
  if (delta === null || delta === undefined) return 'новое';
  if (delta === 0) return 'без изменений';
  return formatDelta(delta);
}

export default function DashboardReelPreview({ reel, compact = false }) {
  if (compact) {
    return (
      <Link
        href={`/reels/${reel.id}`}
        className="group block rounded-[var(--radius)] overflow-hidden border border-[var(--border-soft)] bg-white shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-[var(--blush)]">
          <ReelCover reel={reel} sizes="160px" />
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
          <p className="absolute bottom-2 left-2 right-2 text-[11px] font-semibold text-white drop-shadow-sm truncate">
            {formatViews(reel.views)}
          </p>
        </div>
        {reel.caption ? (
          <p
            className="px-2.5 py-2 text-[11px] leading-[1.35] line-clamp-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            {reel.caption}
          </p>
        ) : (
          <p className="px-2.5 py-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {reel.shortcode || 'Reel'}
          </p>
        )}
      </Link>
    );
  }

  const delta = deltaLabel(reel.deltaViews);
  const deltaColor =
    reel.deltaViews === null ? 'var(--text-secondary)' :
    reel.deltaViews > 0 ? '#3D7A52' :
    reel.deltaViews === 0 ? 'var(--text-secondary)' :
    '#7B6F6B';

  return (
    <Link
      href={`/reels/${reel.id}`}
      className="group block rounded-[var(--radius)] overflow-hidden border border-[var(--border-soft)] bg-white shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative overflow-hidden bg-[var(--blush)] aspect-[9/16]">
        <ReelCover reel={reel} sizes="180px" />
        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/45 via-black/15 to-transparent" />
        <div className="absolute bottom-2.5 left-2.5 right-2.5">
          <p className="text-xs font-semibold text-white drop-shadow-sm">{formatViews(reel.views)}</p>
          <p className="text-[10px] font-medium" style={{ color: deltaColor === 'var(--text-secondary)' ? 'rgba(255,255,255,0.85)' : deltaColor }}>
            {delta}
          </p>
        </div>
      </div>
      {reel.caption && (
        <p className="px-3 py-2.5 text-xs line-clamp-2 min-h-[2.5rem]" style={{ color: 'var(--text-secondary)' }}>
          {reel.caption}
        </p>
      )}
    </Link>
  );
}

export function BestReelCard({ reel, showLink = true }) {
  if (!reel) return null;

  return (
    <div className="flex gap-4">
      <div className="w-[88px] h-[140px] rounded-[var(--radius-btn)] overflow-hidden relative flex-shrink-0 border border-[var(--border-soft)]">
        <ReelCover reel={reel} sizes="88px" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className="text-2xl font-semibold">{formatViews(reel.views)}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>просмотров</p>
        {reel.caption && (
          <p className="text-sm line-clamp-2 mt-2">{reel.caption}</p>
        )}
        {reel.last_synced_at && (
          <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
            Обновлено {timeAgo(reel.last_synced_at)}
          </p>
        )}
        {showLink && (
          <Link
            href={`/reels/${reel.id}`}
            className="inline-flex mt-3 text-sm font-medium underline-offset-2 hover:underline"
          >
            Открыть Reel
          </Link>
        )}
      </div>
    </div>
  );
}

export function RecentUpdatesList({ updates }) {
  if (!updates?.length) {
    return (
      <p className="text-sm py-4" style={{ color: 'var(--text-secondary)' }}>
        Обновления появятся после синхронизации Reels
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {updates.map(item => (
        <li key={item.id}>
          <Link href={`/reels/${item.id}`} className="flex items-baseline justify-between gap-3 group">
            <span className="text-sm truncate group-hover:underline">
              {item.caption?.slice(0, 40) || item.shortcode || 'Reel'}
              {item.caption && item.caption.length > 40 ? '…' : ''}
            </span>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
              · {timeAgo(item.last_synced_at)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function TopReelsList({ reels }) {
  if (!reels?.length) return null;

  return (
    <ul className="space-y-3">
      {reels.map((reel, i) => (
        <li key={reel.id}>
          <Link href={`/reels/${reel.id}`} className="flex items-center gap-3 group">
            <span className="text-xs w-5 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>
              {i + 1}
            </span>
            <div className="w-10 h-14 rounded-lg overflow-hidden relative flex-shrink-0 border border-[var(--border-soft)]">
              <ReelCover reel={reel} sizes="40px" iconSize={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:underline">
                {reel.caption?.slice(0, 50) || reel.shortcode || 'Reel'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {formatViews(reel.views)} просмотров
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
