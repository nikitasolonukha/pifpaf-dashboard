'use client';

import Link from 'next/link';
import ReelCover from '@/components/ReelCover';
import { formatViews } from '@/lib/format';
import { CHART } from './chartTheme';

export default function TopReelsChart({ data }) {
  if (!data?.length) {
    return (
      <p className="text-sm py-6 text-center" style={{ color: 'var(--text-secondary)' }}>
        Reels появятся после импорта
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {data.map(item => (
        <li key={item.id}>
          <Link href={`/reels/${item.id}`} className="group flex items-center gap-3">
            <span className="text-xs font-semibold w-5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              {String(item.rank).padStart(2, '0')}
            </span>
            <div className="w-9 h-12 rounded-lg overflow-hidden relative flex-shrink-0 border border-[var(--border-soft)]">
              <ReelCover reel={item} sizes="36px" iconSize={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate group-hover:underline">
                {item.caption?.slice(0, 36) || item.shortcode || 'Reel'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-medium tabular-nums">{formatViews(item.views)}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(243,201,212,0.35)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${item.barPercent}%`, background: CHART.pinkDark }}
                  />
                </div>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
