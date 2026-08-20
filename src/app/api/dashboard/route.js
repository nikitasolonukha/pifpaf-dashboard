import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  buildPortfolioViewsSeries,
  buildTotalGrowthDelta,
  calcReelLatestDelta,
} from '@/lib/analytics.mjs';
import {
  buildViewsByReelChart,
  buildTopReelsRanking,
  buildReelsByMonthChart,
  buildViewsByPublishMonthChart,
  calcMedianViews,
  filterReelsByPublishedPeriod,
  filterReelsByDays,
  hasGrowthHistory,
} from '@/lib/performanceAnalytics.mjs';
import { InstagramAccountService } from '@/lib/instagram/accountService';
import { scopeReelsToAccount } from '@/lib/instagram/profileImport.mjs';
import { fetchSnapshotsByReelIds } from '@/lib/instagram/fetchSnapshots.mjs';

function attachDeltas(reels, snapshots) {
  const snapsByReel = {};
  for (const s of snapshots || []) {
    if (!snapsByReel[s.reel_id]) snapsByReel[s.reel_id] = [];
    snapsByReel[s.reel_id].push(s);
  }
  return (reels || []).map(r => {
    const list = (snapsByReel[r.id] || []).sort(
      (a, b) => new Date(a.captured_at) - new Date(b.captured_at)
    );
    return { ...r, deltaViews: calcReelLatestDelta(list) };
  });
}

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const periodDays = searchParams.get('days');
    const periodMonths = searchParams.get('period');
    const accountIdParam = searchParams.get('accountId');
    if (accountIdParam && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accountIdParam)) {
      return NextResponse.json({ error: 'Некорректный accountId' }, { status: 400 });
    }

    const service = new InstagramAccountService(supabase, user.id);
    const accounts = await service.listAccounts();
    const instagramAccount = await service.resolveAccount(accountIdParam);

    const { data: reels } = await supabase
      .from('reels')
      .select('*')
      .eq('user_id', user.id);

    const allReels = scopeReelsToAccount(reels || [], instagramAccount);
    let periodReels = allReels;
    if (periodDays) {
      periodReels = filterReelsByDays(allReels, Number(periodDays));
    } else if (periodMonths) {
      periodReels = filterReelsByPublishedPeriod(allReels, Number(periodMonths));
    }

    const reelIds = allReels.map(r => r.id);
    const snapshots = await fetchSnapshotsByReelIds(supabase, reelIds);

    const reelsWithDeltaFull = attachDeltas(allReels, snapshots);
    const periodReelsWithDelta = periodDays
      ? filterReelsByDays(reelsWithDeltaFull, Number(periodDays))
      : periodMonths
        ? filterReelsByPublishedPeriod(reelsWithDeltaFull, Number(periodMonths))
        : reelsWithDeltaFull;

    const totalReels = allReels.length;
    const totalViews = allReels.reduce((s, r) => s + Number(r.views ?? 0), 0);
    const avgViewsPerReel = totalReels > 0 ? Math.round(totalViews / totalReels) : 0;
    const medianViews = calcMedianViews(allReels);

    const bestReel = allReels.reduce(
      (best, r) => (Number(r.views ?? 0) > Number(best?.views ?? 0) ? r : best),
      null
    );

    const growth = buildTotalGrowthDelta(allReels, snapshots || []);
    const growthAvailable = hasGrowthHistory(snapshots || []);

    const chartData = buildPortfolioViewsSeries(allReels, snapshots || []);

    const lastSynced = allReels.reduce((latest, r) => {
      if (!r.last_synced_at) return latest;
      return !latest || new Date(r.last_synced_at) > new Date(latest) ? r.last_synced_at : latest;
    }, instagramAccount?.last_synced_at || null);

    const recentReels = [...reelsWithDeltaFull]
      .sort((a, b) => new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at))
      .slice(0, 4);

    const recentUpdates = [...reelsWithDeltaFull]
      .filter(r => r.last_synced_at)
      .sort((a, b) => new Date(b.last_synced_at) - new Date(a.last_synced_at))
      .slice(0, 6)
      .map(r => ({
        id: r.id,
        caption: r.caption,
        shortcode: r.shortcode,
        last_synced_at: r.last_synced_at,
        views: r.views,
      }));

    return NextResponse.json({
      instagramAccount,
      accounts,
      connected: !!instagramAccount,
      totalReels,
      totalViews,
      avgViewsPerReel,
      medianViews,
      growth,
      growthAvailable,
      bestReel: bestReel ? reelsWithDeltaFull.find(r => r.id === bestReel.id) : null,
      chartData,
      lastSynced,
      recentReels,
      recentUpdates,
      reels: reelsWithDeltaFull,
      performance: {
        viewsByReel: buildViewsByReelChart(periodReelsWithDelta),
        topReels: buildTopReelsRanking(periodReelsWithDelta, 5),
        reelsByMonth: buildReelsByMonthChart(periodReelsWithDelta),
        viewsByPublishMonth: buildViewsByPublishMonthChart(periodReelsWithDelta),
      },
      periodMonths: periodMonths ? Number(periodMonths) : null,
      periodDays: periodDays ? Number(periodDays) : null,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 });
  }
}
