import { chunkArray } from './profileImport.mjs';

/** Keep `.in(reel_id, …)` under PostgREST/URL size limits for large profiles. */
const SNAPSHOT_IN_CHUNK = 80;

/**
 * Load metric snapshots for many reels in chunks.
 * A single `.in()` with 200+ UUIDs can fail silently / return empty.
 */
export async function fetchSnapshotsByReelIds(
  supabase,
  reelIds,
  columns = 'reel_id, views, likes, comments, captured_at',
) {
  if (!Array.isArray(reelIds) || reelIds.length === 0) return [];

  const out = [];
  for (const chunk of chunkArray(reelIds, SNAPSHOT_IN_CHUNK)) {
    const { data, error } = await supabase
      .from('reel_metric_snapshots')
      .select(columns)
      .in('reel_id', chunk)
      .order('captured_at', { ascending: true });
    if (error) throw error;
    out.push(...(data || []));
  }

  out.sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at));
  return out;
}
