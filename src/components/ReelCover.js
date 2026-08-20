'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Film } from 'lucide-react';
import { getCoverSources, pickNextCoverSrc } from '@/lib/apify/coverSources.mjs';

/**
 * Shared cover with graceful fallback across unique sources → placeholder.
 */
export default function ReelCover({
  reel,
  className = '',
  sizes = '220px',
  placeholderClassName = '',
  iconSize = 28,
}) {
  const sources = getCoverSources(reel);
  const [failedSrcs, setFailedSrcs] = useState([]);
  const srcToRender = pickNextCoverSrc(sources, failedSrcs);

  if (!srcToRender) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center gap-1 bg-[var(--blush)] ${placeholderClassName}`}
      >
        <Film size={iconSize} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
        <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Нет обложки</span>
      </div>
    );
  }

  return (
    <Image
      src={srcToRender}
      alt=""
      fill
      sizes={sizes}
      className={`object-cover ${className}`}
      onError={() => setFailedSrcs(prev => (prev.includes(srcToRender) ? prev : [...prev, srcToRender]))}
    />
  );
}
