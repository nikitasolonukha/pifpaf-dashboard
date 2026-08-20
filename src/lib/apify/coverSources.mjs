/** Unique cover URLs for fallback chain (cover → source → placeholder). */
export function getCoverSources(reel) {
  return [...new Set(
    [reel?.cover_url, reel?.source_cover_url]
      .map(s => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean)
  )];
}

/** Next source that has not failed yet. */
export function pickNextCoverSrc(sources, failedSrcs = []) {
  const failed = new Set(failedSrcs || []);
  return (sources || []).find(src => !failed.has(src)) || '';
}
