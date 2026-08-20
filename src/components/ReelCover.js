'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Film } from 'lucide-react';

/**
 * Shared cover with graceful fallback: cover_url → source_cover_url → placeholder.
 */
export default function ReelCover({
  reel,
  className = '',
  sizes = '220px',
  placeholderClassName = '',
  iconSize = 28,
}) {
  const [failedSrc, setFailedSrc] = useState(null);

  const primarySrc = reel?.cover_url || '';
  const fallbackSrc = reel?.source_cover_url || '';
  const srcToRender =
    !primarySrc
      ? fallbackSrc
      : failedSrc === primarySrc
        ? fallbackSrc
        : failedSrc === fallbackSrc
          ? ''
          : primarySrc;

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
      onError={() => setFailedSrc(srcToRender)}
    />
  );
}
