/**
 * Integration: mixed existing+new bulk upsert payload against local Supabase.
 * Skips when credentials are missing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import {
  buildReelUpsertRow,
  partitionImportReels,
} from '../src/lib/instagram/profileImport.mjs';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = !!(URL && SERVICE);

if (!hasCreds) {
  test('mixed upsert integration (skipped — no local supabase env)', { skip: true }, () => {});
} else {
  test('mixed upsert: 3 existing + 1 new without id field', async () => {
    const admin = createClient(URL, SERVICE);
    const email = `mix_${Date.now()}@test.local`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: 'testpass123',
      email_confirm: true,
      user_metadata: { display_name: 'Mix' },
    });
    if (createErr) throw createErr;
    const userId = created.user.id;

    try {
      const { data: account, error: accErr } = await admin
        .from('instagram_accounts')
        .insert({
          user_id: userId,
          username: 'mixuser',
          profile_url: 'https://www.instagram.com/mixuser/',
          sync_status: 'ready',
          import_since: '2025-01-01',
        })
        .select()
        .single();
      if (accErr) throw accErr;

      const seed = ['A', 'B', 'C'].map((shortcode) => ({
        user_id: userId,
        instagram_account_id: account.id,
        instagram_url: `https://www.instagram.com/reel/${shortcode}/`,
        shortcode,
        views: 10,
        likes: 1,
        comments: 0,
        sync_status: 'ready',
        owner_username: 'mixuser',
      }));
      const { data: existing, error: seedErr } = await admin
        .from('reels')
        .insert(seed)
        .select('id, shortcode, views, cover_url');
      if (seedErr) throw seedErr;

      const scraped = [
        { shortcode: 'A', views: 11, likes: 1, comments: 0, owner_username: 'mixuser' },
        { shortcode: 'B', views: 22, likes: 1, comments: 0, owner_username: 'mixuser' },
        { shortcode: 'C', views: 33, likes: 1, comments: 0, owner_username: 'mixuser' },
        { shortcode: 'D_NEW', views: 44, likes: 2, comments: 0, owner_username: 'mixuser' },
      ];
      const by = Object.fromEntries(existing.map((r) => [r.shortcode, r]));
      const { toUpdate, toInsert } = partitionImportReels(scraped, by);
      assert.equal(toUpdate.length, 3);
      assert.equal(toInsert.length, 1);

      const now = new Date().toISOString();
      const rows = [
        ...toUpdate.map(({ reel, existing: ex }) => buildReelUpsertRow({
          reel, existing: ex, account, userId, coverUrl: null, now,
        })),
        ...toInsert.map(({ reel }) => buildReelUpsertRow({
          reel, account, userId, coverUrl: null, now,
        })),
      ];
      assert.ok(rows.every((r) => !Object.hasOwn(r, 'id')));

      const { data: saved, error: upErr } = await admin
        .from('reels')
        .upsert(rows, { onConflict: 'user_id,shortcode' })
        .select('id, shortcode, views');
      if (upErr) throw upErr;
      assert.equal(saved.length, 4);
      const neu = saved.find((r) => r.shortcode === 'D_NEW');
      assert.ok(neu?.id);
      assert.equal(neu.views, 44);

      const { error: snapErr } = await admin.from('reel_metric_snapshots').insert(
        saved.map((r) => ({ reel_id: r.id, views: r.views, likes: 0, comments: 0 }))
      );
      if (snapErr) throw snapErr;

      const { count } = await admin
        .from('reels')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      assert.equal(count, 4);
    } finally {
      await admin.from('reels').delete().eq('user_id', userId);
      await admin.from('instagram_accounts').delete().eq('user_id', userId);
      await admin.from('profiles').delete().eq('id', userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });
}
