import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scrapeReel } from '@/lib/apify/instagram';
import { uploadCover } from '@/lib/apify/cover';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: reels } = await supabase
      .from('reels')
      .select('*')
      .eq('user_id', user.id)
      .neq('sync_status', 'syncing');

    if (!reels || reels.length === 0) {
      return NextResponse.json({ total: 0, updated: 0, failed: 0 });
    }

    const limit = 3;
    const total = reels.length;
    let updated = 0;
    let failed = 0;

    const runPool = async () => {
      let idx = 0;
      const workers = new Array(Math.min(limit, total)).fill(0).map(async () => {
        while (idx < total) {
          const reel = reels[idx];
          idx += 1;

          try {
            // Atomic claim for each reel.
            const { data: claimedRows, error: claimError } = await supabase
              .from('reels')
              .update({ sync_status: 'syncing', sync_error: null })
              .eq('id', reel.id)
              .eq('user_id', user.id)
              .neq('sync_status', 'syncing')
              .select('id');

            if (claimError) throw claimError;
            if (!claimedRows || claimedRows.length === 0) {
              // Someone else is syncing it right now.
              continue;
            }

            const reelData = await scrapeReel(reel.instagram_url);

            let coverUrl = reel.cover_url;
            if (reelData.source_cover_url && reelData.source_cover_url !== reel.source_cover_url) {
              const newCover = await uploadCover(reelData.source_cover_url, user.id, reel.shortcode);
              if (newCover) coverUrl = newCover;
            }

            if (!coverUrl) {
              coverUrl = reelData.source_cover_url || reel.source_cover_url || null;
            }

            await supabase.from('reels').update({
              views: reelData.views,
              likes: reelData.likes,
              comments: reelData.comments,
              cover_url: coverUrl,
              source_cover_url: reelData.source_cover_url,
              caption: reelData.caption,
              owner_username: reelData.owner_username,
              owner_full_name: reelData.owner_full_name,
              published_at: reelData.published_at,
              sync_status: 'ready',
              sync_error: null,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq('id', reel.id);

            await supabase.from('reel_metric_snapshots').insert({
              reel_id: reel.id,
              views: reelData.views,
              likes: reelData.likes,
              comments: reelData.comments,
            });

            updated += 1;
          } catch (err) {
            failed += 1;
            try {
              await supabase.from('reels').update({
                sync_status: 'error',
                sync_error: err?.message || 'Ошибка обновления',
              }).eq('id', reel.id);
            } catch {
              // ignore
            }
          }
        }
      });

      await Promise.all(workers);
    };

    await runPool();

    return NextResponse.json({ total, updated, failed });
  } catch (err) {
    console.error('Refresh all error:', err);
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 });
  }
}
