function startOfDayUTC(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function endOfDayUTC(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function dayKeyUTC(date) {
  const d = startOfDayUTC(date);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function defaultDayLabelRu(date) {
  // Keep labels stable even in tests: use UTC date components.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0, 0));
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function buildPortfolioViewsSeries(reels, snapshots, { dayLabel = defaultDayLabelRu } = {}) {
  if (!Array.isArray(reels) || reels.length === 0) return [];
  if (!Array.isArray(snapshots) || snapshots.length === 0) return [];

  const reelIds = reels.map(r => r.id);
  const snapshotsByReel = {};
  for (const s of snapshots) {
    if (!s || !s.reel_id) continue;
    if (!snapshotsByReel[s.reel_id]) snapshotsByReel[s.reel_id] = [];
    snapshotsByReel[s.reel_id].push(s);
  }

  // Sort snapshots ascending per reel.
  for (const reelId of Object.keys(snapshotsByReel)) {
    snapshotsByReel[reelId].sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at));
  }

  // Unique day keys from snapshots.
  const dayKeys = Array.from(
    new Set(snapshots.map(s => dayKeyUTC(new Date(s.captured_at))))
  ).sort();

  const series = [];

  // Maintain "last known snapshot" pointer for each reel while iterating days.
  const pointers = {};
  for (const reelId of reelIds) pointers[reelId] = -1;

  for (const key of dayKeys) {
    const dayEnd = endOfDayUTC(new Date(key + 'T00:00:00.000Z'));

    let total = 0;
    let counted = 0;

    for (const reelId of reelIds) {
      const reelSnaps = snapshotsByReel[reelId] || [];
      let idx = pointers[reelId];

      while (idx + 1 < reelSnaps.length) {
        const nextSnap = reelSnaps[idx + 1];
        const capturedAt = new Date(nextSnap.captured_at);
        if (capturedAt <= dayEnd) idx += 1;
        else break;
      }

      pointers[reelId] = idx;

      if (idx >= 0) {
        const views = Number(reelSnaps[idx]?.views ?? 0);
        total += Number.isFinite(views) ? views : 0;
        counted += 1;
      }
    }

    // If no reel has snapshot by this day end, skip.
    if (counted > 0) {
      const label = dayLabel(new Date(key + 'T00:00:00.000Z'));
      series.push({ date: label, views: total });
    }
  }

  return series;
}

export function calcReelLatestDelta(snapshotsAsc) {
  const snaps = Array.isArray(snapshotsAsc) ? snapshotsAsc : [];
  if (snaps.length < 2) return null;
  const latest = snaps[snaps.length - 1];
  const prev = snaps[snaps.length - 2];
  const latestViews = Number(latest?.views ?? 0);
  const prevViews = Number(prev?.views ?? 0);
  return (Number.isFinite(latestViews) ? latestViews : 0) - (Number.isFinite(prevViews) ? prevViews : 0);
}

export function buildTotalGrowthDelta(reels, snapshots) {
  if (!Array.isArray(reels) || reels.length === 0) return 0;
  if (!Array.isArray(snapshots) || snapshots.length === 0) return 0;

  const snapshotsByReel = {};
  for (const s of snapshots) {
    if (!s?.reel_id) continue;
    if (!snapshotsByReel[s.reel_id]) snapshotsByReel[s.reel_id] = [];
    snapshotsByReel[s.reel_id].push(s);
  }

  let total = 0;
  for (const reel of reels) {
    const reelId = reel.id;
    const reelSnaps = (snapshotsByReel[reelId] || []).slice().sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at));
    const delta = calcReelLatestDelta(reelSnaps);
    total += delta ?? 0;
  }
  return total;
}

