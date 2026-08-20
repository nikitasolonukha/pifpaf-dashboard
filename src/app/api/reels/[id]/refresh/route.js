import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scrapeReel } from '@/lib/apify/instagram';
import { uploadCover } from '@/lib/apify/cover';
import { throwOnError } from '@/lib/supabase/assert';

async function markReelError(supabase, id, userId, message) {
  if (!supabase || !id) return;
  const { error } = await supabase
    .from('reels')
    .update({
      sync_status: 'error',
      sync_error: message || 'Ошибка обновления',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) console.error('markReelError failed:', error.message);
}

export async function POST(request, { params }) {
  let id = null;
  let supabase = null;
  let user = null;
  let claimed = false;

  try {
    ({ id } = await params);
    supabase = await createClient();
    const auth = await supabase.auth.getUser();
    user = auth.data?.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: reel, error } = await supabase
      .from('reels')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !reel) {
      return NextResponse.json({ error: 'Reel не найден' }, { status: 404 });
    }

    const { data: claimedRows, error: claimError } = await supabase
      .from('reels')
      .update({ sync_status: 'syncing', sync_error: null })
      .eq('id', id)
      .eq('user_id', user.id)
      .neq('sync_status', 'syncing')
      .select('id');

    throwOnError({ error: claimError }, 'refresh claim');

    if (!claimedRows || claimedRows.length === 0) {
      return NextResponse.json({ error: 'Уже обновляется' }, { status: 429 });
    }
    claimed = true;

    let reelData;
    try {
      reelData = await scrapeReel(reel.instagram_url);
    } catch (err) {
      const message = err?.message || 'Ошибка Apify';
      await markReelError(supabase, id, user.id, message);
      return NextResponse.json({ error: message }, { status: 502 });
    }

    let coverUrl = reel.cover_url;
    if (reelData.source_cover_url && reelData.source_cover_url !== reel.source_cover_url) {
      const newCover = await uploadCover(reelData.source_cover_url, user.id, reel.shortcode);
      if (newCover) coverUrl = newCover;
    }
    if (!coverUrl) {
      coverUrl = reelData.source_cover_url || reel.source_cover_url || null;
    }

    const { data: updated, error: updateError } = await supabase
      .from('reels')
      .update({
        views: reelData.views,
        likes: reelData.likes,
        comments: reelData.comments,
        cover_url: coverUrl,
        source_cover_url: reelData.source_cover_url,
        caption: reelData.caption,
        sync_status: 'ready',
        sync_error: null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      await markReelError(supabase, id, user.id, updateError.message);
      return NextResponse.json({ error: 'Не удалось сохранить Reel' }, { status: 500 });
    }

    const { error: snapError } = await supabase.from('reel_metric_snapshots').insert({
      reel_id: id,
      views: reelData.views,
      likes: reelData.likes,
      comments: reelData.comments,
    });

    if (snapError) {
      await markReelError(supabase, id, user.id, snapError.message);
      return NextResponse.json({ error: 'Не удалось сохранить snapshot' }, { status: 500 });
    }

    return NextResponse.json({ reel: updated });
  } catch (err) {
    console.error('Refresh error:', err);
    if (claimed) {
      await markReelError(supabase, id, user?.id, err?.message || 'Ошибка обновления');
    }
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 });
  }
}
