'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { RefreshCw, Trash2, ExternalLink } from 'lucide-react';
import { formatViews, formatDateShort, timeAgo, formatDelta } from '@/lib/format';

export default function ReelTable({ reels, onRefresh, onDelete }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius)] bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Reel</th>
            <th className="text-left px-4 py-3 font-medium hidden sm:table-cell" style={{ color: 'var(--text-secondary)' }}>Дата</th>
            <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Просмотры</th>
            <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Прирост</th>
            <th className="text-left px-4 py-3 font-medium hidden md:table-cell" style={{ color: 'var(--text-secondary)' }}>Обновлено</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {reels.map(reel => (
            <tr key={reel.id} className="border-b border-gray-50 hover:bg-gray-50/50">
              <td className="px-4 py-3">
                <Link href={`/reels/${reel.id}`} className="flex items-center gap-3">
                  <div className="w-8 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 relative">
                    <CoverImage reel={reel} />
                  </div>
                  <span className="line-clamp-1">{reel.caption || reel.shortcode}</span>
                </Link>
              </td>
              <td className="px-4 py-3 hidden sm:table-cell" style={{ color: 'var(--text-secondary)' }}>
                {formatDateShort(reel.published_at)}
              </td>
              <td className="px-4 py-3 text-right font-medium">{formatViews(reel.views)}</td>
              <td className="px-4 py-3 text-right">
                {reel.deltaViews === null ? (
                  <span style={{ color: 'var(--text-secondary)' }}>новое</span>
                ) : (
                  <span
                    style={{
                      color: reel.deltaViews > 0 ? '#2F855A' : '#7B6F6B',
                      fontWeight: 600,
                    }}
                  >
                    {formatDelta(reel.deltaViews)}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 hidden md:table-cell" style={{ color: 'var(--text-secondary)' }}>
                {timeAgo(reel.last_synced_at)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <a href={reel.instagram_url} target="_blank" rel="noopener" className="p-1.5 rounded-lg hover:bg-gray-100">
                    <ExternalLink size={14} />
                  </a>
                  <button onClick={() => onRefresh(reel.id)} className="p-1.5 rounded-lg hover:bg-gray-100" disabled={reel.sync_status === 'syncing'}>
                    <RefreshCw size={14} className={reel.sync_status === 'syncing' ? 'animate-spin' : ''} />
                  </button>
                  <button onClick={() => onDelete(reel.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CoverImage({ reel }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const primarySrc = reel.cover_url || '';
  const fallbackSrc = reel.source_cover_url || '';
  const srcToRender =
    !primarySrc
      ? fallbackSrc
      : failedSrc === primarySrc
        ? fallbackSrc
        : failedSrc === fallbackSrc
          ? ''
          : primarySrc;

  if (!srcToRender) return <div className="w-full h-full" />;

  return (
    <Image
      src={srcToRender}
      alt=""
      fill
      sizes="32px"
      className="object-cover"
      onError={() => setFailedSrc(srcToRender)}
    />
  );
}
