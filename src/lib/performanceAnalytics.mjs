const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function monthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTHS_RU[Number(m) - 1]} ${y}`;
}

export function filterReelsByPublishedPeriod(reels, months) {
  if (!months || months <= 0) return reels || [];
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return filterReelsSince(reels, cutoff);
}

export function filterReelsByDays(reels, days) {
  if (!days || days <= 0) return reels || [];
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  return filterReelsSince(reels, cutoff);
}

function filterReelsSince(reels, cutoff) {
  return (reels || []).filter(r => {
    if (!r.published_at) return true;
    return new Date(r.published_at) >= cutoff;
  });
}

export function calcMedianViews(reels) {
  const vals = (reels || [])
    .map(r => Number(r.views ?? 0))
    .filter(n => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (vals.length === 0) return 0;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : Math.round((vals[mid - 1] + vals[mid]) / 2);
}

/** Chart A: top reels by current views (readable bar chart) */
export function buildViewsByReelChart(reels, limit = 20) {
  return [...(reels || [])]
    .filter(r => r.published_at)
    .sort((a, b) => Number(b.views ?? 0) - Number(a.views ?? 0))
    .slice(0, limit)
    .map((r, i) => ({
      id: r.id,
      shortcode: r.shortcode,
      caption: r.caption,
      cover_url: r.cover_url,
      source_cover_url: r.source_cover_url,
      published_at: r.published_at,
      views: Number(r.views ?? 0),
      likes: Number(r.likes ?? 0),
      comments: Number(r.comments ?? 0),
      rank: i + 1,
      label: `#${i + 1}`,
    }));
}

/** Top N reels by current views */
export function buildTopReelsRanking(reels, limit = 5) {
  const sorted = [...(reels || [])].sort((a, b) => Number(b.views ?? 0) - Number(a.views ?? 0));
  const maxViews = Number(sorted[0]?.views ?? 0) || 1;
  return sorted.slice(0, limit).map((r, i) => ({
    rank: i + 1,
    id: r.id,
    shortcode: r.shortcode,
    caption: r.caption,
    cover_url: r.cover_url,
    source_cover_url: r.source_cover_url,
    views: Number(r.views ?? 0),
    barPercent: Math.round((Number(r.views ?? 0) / maxViews) * 100),
  }));
}

/** Reels count grouped by publish month */
export function buildReelsByMonthChart(reels) {
  const counts = {};
  for (const r of reels || []) {
    const key = monthKey(r.published_at);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.keys(counts)
    .sort()
    .map(key => ({ month: key, label: monthLabel(key), count: counts[key] }));
}

/** Sum of current views for reels published in each month */
export function buildViewsByPublishMonthChart(reels) {
  const sums = {};
  for (const r of reels || []) {
    const key = monthKey(r.published_at);
    if (!key) continue;
    sums[key] = (sums[key] || 0) + Number(r.views ?? 0);
  }
  return Object.keys(sums)
    .sort()
    .map(key => ({ month: key, label: monthLabel(key), views: sums[key] }));
}

export function hasGrowthHistory(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return false;
  const byReel = {};
  for (const s of snapshots) {
    if (!byReel[s.reel_id]) byReel[s.reel_id] = 0;
    byReel[s.reel_id] += 1;
  }
  return Object.values(byReel).some(c => c >= 2);
}
