import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateInstagramUrl, scrapeReel } from '@/lib/apify/instagram';
import { uploadCover } from '@/lib/apify/cover';
import { InstagramAccountService } from '@/lib/instagram/accountService';
import { scopeReelsToAccount } from '@/lib/instagram/profileImport.mjs';
import { fetchSnapshotsByReelIds } from '@/lib/instagram/fetchSnapshots.mjs';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url } = await request.json();
    const validation = validateInstagramUrl(url);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from('reels')
      .select('id')
      .eq('user_id', user.id)
      .eq('shortcode', validation.shortcode)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Этот Reel уже добавлен' }, { status: 409 });
    }

    // Scrape from Apify
    let reelData;
    try {
      reelData = await scrapeReel(validation.url);
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }

    // Upload cover
    const coverUrl = await uploadCover(reelData.source_cover_url, user.id, reelData.shortcode || validation.shortcode);

    // Insert reel
    const { data: reel, error: insertError } = await supabase
      .from('reels')
      .insert({
        user_id: user.id,
        instagram_url: validation.url,
        instagram_reel_id: reelData.instagram_reel_id,
        shortcode: reelData.shortcode || validation.shortcode,
        caption: reelData.caption,
        owner_username: reelData.owner_username,
        owner_full_name: reelData.owner_full_name,
        cover_url: coverUrl || reelData.source_cover_url,
        source_cover_url: reelData.source_cover_url,
        published_at: reelData.published_at,
        views: reelData.views,
        likes: reelData.likes,
        comments: reelData.comments,
        sync_status: 'ready',
        last_synced_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      if (insertError?.code === '23505') {
        return NextResponse.json({ error: 'Этот Reel уже добавлен' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Не удалось сохранить Reel' }, { status: 500 });
    }

    // Create initial snapshot
    const { error: snapError } = await supabase.from('reel_metric_snapshots').insert({
      reel_id: reel.id,
      views: reelData.views,
      likes: reelData.likes,
      comments: reelData.comments,
    });

    if (snapError) {
      console.error('Snapshot insert error:', snapError);
      return NextResponse.json({ error: 'Reel сохранён, но snapshot не создан' }, { status: 500 });
    }

    return NextResponse.json({ reel }, { status: 201 });
  } catch (err) {
    console.error('POST /api/reels error:', err);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const accountIdParam = searchParams.get('accountId');
    if (accountIdParam && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accountIdParam)) {
      return NextResponse.json({ error: 'Некорректный accountId' }, { status: 400 });
    }

    const { InstagramAccountService } = await import('@/lib/instagram/accountService');
    const { scopeReelsToAccount } = await import('@/lib/instagram/profileImport.mjs');
    const service = new InstagramAccountService(supabase, user.id);
    const account = await service.resolveAccount(accountIdParam);

    const { data: reels, error } = await supabase
      .from('reels')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const scoped = scopeReelsToAccount(reels || [], account);
    const reelIds = scoped.map(r => r.id);
    if (reelIds.length === 0) {
      return NextResponse.json({ reels: [], instagramAccount: account, accounts: await service.listAccounts() });
    }

    const snapshots = await fetchSnapshotsByReelIds(
      supabase,
      reelIds,
      'reel_id, views, captured_at',
    );

    const snapsByReel = {};
    for (const s of snapshots) {
      if (!snapsByReel[s.reel_id]) snapsByReel[s.reel_id] = [];
      snapsByReel[s.reel_id].push(s);
    }

    const reelsWithDelta = scoped.map(r => {
      const list = snapsByReel[r.id] || [];
      if (list.length < 2) return { ...r, deltaViews: null };
      const latest = list[list.length - 1];
      const prev = list[list.length - 2];
      const latestViews = Number(latest?.views ?? 0);
      const prevViews = Number(prev?.views ?? 0);
      const deltaViews = latestViews - prevViews;
      return { ...r, deltaViews };
    });

    return NextResponse.json({
      reels: reelsWithDelta,
      instagramAccount: account,
      accounts: await service.listAccounts(),
    });
  } catch (err) {
    console.error('GET /api/reels error:', err);
    return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 });
  }
}
