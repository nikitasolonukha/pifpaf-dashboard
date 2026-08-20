/**
 * New Reel discovery through real InstagramAccountService.runProfileImport
 * with injected scrape (no Apify). Requires local Supabase env.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { InstagramAccountService } from '../src/lib/instagram/accountService.js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabaseReachable() {
  if (!URL || !SERVICE) return false;
  try {
    const res = await fetch(`${URL}/rest/v1/`, {
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
    return res.status > 0 && res.status < 500;
  } catch {
    return false;
  }
}

const hasCreds = await supabaseReachable();

if (!hasCreds) {
  test('runProfileImport discovery (skipped — no reachable supabase)', { skip: true }, () => {});
} else {
  test('runProfileImport discovers D_NEW via inject scrape', async () => {
    const admin = createClient(URL, SERVICE);
    const email = `disc_${Date.now()}@test.local`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: 'testpass123',
      email_confirm: true,
      user_metadata: { display_name: 'Disc' },
    });
    if (createErr) throw createErr;
    const userId = created.user.id;

    try {
      const { data: account, error: accErr } = await admin
        .from('instagram_accounts')
        .insert({
          user_id: userId,
          username: 'discuser',
          profile_url: 'https://www.instagram.com/discuser/',
          sync_status: 'syncing',
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
        owner_username: 'discuser',
      }));
      const { error: seedErr } = await admin.from('reels').insert(seed);
      if (seedErr) throw seedErr;

      const scrape = async () => ({
        reels: [
          { shortcode: 'A', views: 11, likes: 1, comments: 0, owner_username: 'discuser' },
          { shortcode: 'B', views: 22, likes: 1, comments: 0, owner_username: 'discuser' },
          { shortcode: 'C', views: 33, likes: 1, comments: 0, owner_username: 'discuser' },
          { shortcode: 'D_NEW', views: 44, likes: 2, comments: 0, owner_username: 'discuser' },
        ],
      });
      const upload = async () => null;

      const service = new InstagramAccountService(admin, userId);
      const summary = await service.runProfileImport(account, '2025-01-01', { scrape, upload });

      assert.equal(summary.newCount, 1);
      assert.equal(summary.updatedCount, 3);
      assert.equal(summary.checked, 4);
      assert.equal(summary.failedCount, 0);

      const { data: all } = await admin.from('reels').select('id, shortcode').eq('user_id', userId);
      assert.equal(all.length, 4);
      const neu = all.find((r) => r.shortcode === 'D_NEW');
      assert.ok(neu?.id);

      const { count: snapCount } = await admin
        .from('reel_metric_snapshots')
        .select('*', { count: 'exact', head: true })
        .eq('reel_id', neu.id);
      assert.equal(snapCount, 1);
    } finally {
      await admin.from('reels').delete().eq('user_id', userId);
      await admin.from('instagram_accounts').delete().eq('user_id', userId);
      await admin.from('profiles').delete().eq('id', userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });
}
