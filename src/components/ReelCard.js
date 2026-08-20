'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import { formatViews, timeAgo, formatDateShort, formatDelta } from '@/lib/format';
import ReelCover from '@/components/ReelCover';

function deltaLabel(delta) {
  if (delta === null || delta === undefined) return 'новое';
  if (delta === 0) return 'без изменений';
  return formatDelta(delta);
}

export default function ReelCard({ reel, onRefresh, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isSyncing = reel.sync_status === 'syncing';
  const isError = reel.sync_status === 'error';
  const status = isSyncing ? 'обновляется…' : isError ? 'ошибка' : 'актуально';

  const delta = reel.deltaViews;
  const deltaText = deltaLabel(delta);
  const deltaColor =
    delta === null ? 'rgba(255,255,255,0.9)' :
    delta > 0 ? '#A8E6BF' :
    delta === 0 ? 'rgba(255,255,255,0.75)' :
    '#F5C6C6';

  return (
    <div className="relative group rounded-[var(--radius)] overflow-hidden bg-white border border-[var(--border-soft)] shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
      <Link href={`/reels/${reel.id}`}>
        <div className="aspect-[9/16] relative overflow-hidden bg-[var(--blush)]">
          <ReelCover reel={reel} sizes="(max-width: 768px) 45vw, 220px" />
          <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-black/50 via-black/20 to-transparent pointer-events-none" />
          <div className="absolute bottom-3 left-3 right-3">
            <p className="text-sm font-semibold text-white drop-shadow-sm">{formatViews(reel.views)}</p>
            <p className="text-xs font-medium mt-0.5" style={{ color: deltaColor }}>
              {deltaText}
            </p>
          </div>
        </div>
      </Link>

      <div className="p-3">
        <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Instagram Reel</p>
        {reel.caption ? (
          <p className="text-sm line-clamp-2 mb-2 min-h-[2.5rem]">{reel.caption}</p>
        ) : (
          <div className="min-h-[2.5rem] mb-2" />
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {reel.published_at ? formatDateShort(reel.published_at) : ''}
          </span>
          {!isError && !isSyncing && (
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'var(--sage)', color: '#4A6B52' }}
            >
              {status}
            </span>
          )}
          {isSyncing && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--peach)', color: '#8B6914' }}>
              {status}
            </span>
          )}
          {isError && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">
              {status}
            </span>
          )}
        </div>
        {reel.last_synced_at && (
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
            Обновлено {timeAgo(reel.last_synced_at)}
          </p>
        )}
      </div>

      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 border border-[var(--border-soft)] opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
      >
        <MoreHorizontal size={16} />
      </button>

      {menuOpen && (
        <div className="absolute top-10 right-2 bg-white rounded-xl shadow-lg border border-[var(--border-soft)] py-1 z-10 min-w-[160px]">
          <a
            href={reel.instagram_url}
            target="_blank"
            rel="noopener"
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            onClick={() => setMenuOpen(false)}
          >
            <ExternalLink size={14} /> Открыть в Instagram
          </a>
          <button
            onClick={() => { onRefresh(reel.id); setMenuOpen(false); }}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full"
            disabled={isSyncing}
          >
            <RefreshCw size={14} /> Обновить данные
          </button>
          <button
            onClick={() => { setConfirmDelete(true); setMenuOpen(false); }}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-red-500"
          >
            <Trash2 size={14} /> Удалить
          </button>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-[var(--radius)] p-6 max-w-xs w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Удалить Reel?</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Это действие нельзя отменить.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-[var(--radius-btn)] border border-gray-200 text-sm">Отмена</button>
              <button onClick={() => { onDelete(reel.id); setConfirmDelete(false); }} className="flex-1 py-2 rounded-[var(--radius-btn)] bg-red-500 text-white text-sm">Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
