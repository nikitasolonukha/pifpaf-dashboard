import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scrapeReel } from '@/lib/apify/instagram';
import { uploadCover } from '@/lib/apify/cover';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
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

    // Atomic refresh claim: only one concurrent sync per reel.
    const { data: claimedRows, error: claimError } = await supabase
      .from('reels')
      .update({ sync_status: 'syncing', sync_error: null })
      .eq('id', id)
      .eq('user_id', user.id)
      .neq('sync_status', 'syncing')
      .select('id');

    if (claimError) {
      console.error('Refresh claim error:', claimError);
      return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 });
    }

    if (!claimedRows || claimedRows.length === 0) {
      return NextResponse.json({ error: 'Уже обновляется' }, { status: 429 });
    }

    let reelData;
    try {
      reelData = await scrapeReel(reel.instagram_url);
    } catch (err) {
      const message = err?.message || 'Ошибка Apify';
      await supabase.from('reels').update({
        sync_status: 'error',
        sync_error: message,
      }).eq('id', id);
      return NextResponse.json({ error: message }, { status: 502 });
    }

    // Re-upload cover if changed
    let coverUrl = reel.cover_url;
    if (reelData.source_cover_url && reelData.source_cover_url !== reel.source_cover_url) {
      const newCover = await uploadCover(reelData.source_cover_url, user.id, reel.shortcode);
      if (newCover) coverUrl = newCover;
    }

    if (!coverUrl) {
      // Fallback to last known source cover (displayUrl) if permanent upload failed.
      coverUrl = reelData.source_cover_url || reel.source_cover_url || null;
    }

    // Update reel
    const { data: updated } = await supabase
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
      .select()
      .single();

    // Create snapshot
    await supabase.from('reel_metric_snapshots').insert({
      reel_id: id,
      views: reelData.views,
      likes: reelData.likes,
      comments: reelData.comments,
    });

    return NextResponse.json({ reel: updated });
  } catch (err) {
    console.error('Refresh error:', err);
    try {
      // Ensure we don't leave the reel in "syncing" forever.
      await supabase.from('reels').update({
        sync_status: 'error',
        sync_error: err?.message || 'Ошибка обновления',
      }).eq('id', id).eq('user_id', user?.id);
    } catch (e) {
      // Ignore secondary failures.
    }
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 });
  }
}
