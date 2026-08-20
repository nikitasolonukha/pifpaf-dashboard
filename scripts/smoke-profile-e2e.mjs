/**
 * Profile flow smoke (needs live credentials + Docker Supabase).
 * Run: node --env-file=.env.local scripts/smoke-profile-e2e.mjs
 *
 * Does NOT require Next.js server. Uses Apify + Supabase directly.
 */
import { createClient } from '@supabase/supabase-js';
import { scrapeProfileReels } from '../src/lib/apify/profileScraper.mjs';
import { dedupeReelsByShortcode } from '../src/lib/instagram/profileImport.mjs';
import { canStartSync } from '../src/lib/instagram/syncLock.mjs';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APIFY = process.env.APIFY_API_TOKEN;
const PROFILE = process.env.SMOKE_PROFILE_URL || 'https://www.instagram.com/natgeo/';

function requireEnv() {
  const missing = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'APIFY_API_TOKEN',
  ].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error('BLOCKED_BY_CREDENTIALS missing:', missing.join(', '));
    process.exit(2);
  }
}

function anonClient(token) {
  return createClient(
    URL,
    ANON,
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined
  );
}

async function signUp(email, password, name) {
  const { error } = await anonClient().auth.signUp({
    email,
    password,
    options: { data: { display_name: name } },
  });
  if (error) throw error;
}

async function signIn(email, password) {
  const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

async function claimAccount(sb, accountId, userId) {
  const { data, error } = await sb
    .from('instagram_accounts')
    .update({ sync_status: 'syncing', sync_error: null, updated_at: new Date().toISOString() })
    .eq('id', accountId)
    .eq('user_id', userId)
    .neq('sync_status', 'syncing')
    .select('id');
  if (error) throw error;
  return data?.length > 0;
}

async function importProfile(sb, userId, account) {
  const { reels } = await scrapeProfileReels(account.profile_url, {
    cutoffDate: account.import_since,
  });
  const scraped = dedupeReelsByShortcode(reels);
  const now = new Date().toISOString();
  const rows = scraped.slice(0, 30).map((reel) => ({
    user_id: userId,
    instagram_account_id: account.id,
    instagram_url: `https://www.instagram.com/reel/${reel.shortcode}/`,
    shortcode: reel.shortcode,
    caption: reel.caption,
    owner_username: reel.owner_username || account.username,
    owner_full_name: reel.owner_full_name,
    cover_url: reel.source_cover_url,
    source_cover_url: reel.source_cover_url,
    published_at: reel.published_at,
    views: reel.views,
    likes: reel.likes,
    comments: reel.comments,
    sync_status: 'ready',
    last_synced_at: now,
    updated_at: now,
  }));

  const { data: saved, error } = await sb
    .from('reels')
    .upsert(rows, { onConflict: 'user_id,shortcode' })
    .select('id, shortcode, views');
  if (error) throw error;

  const snaps = (saved || []).map((row) => {
    const src = scraped.find((r) => r.shortcode === row.shortcode);
    return {
      reel_id: row.id,
      views: src?.views ?? row.views ?? 0,
      likes: src?.likes ?? 0,
      comments: src?.comments ?? 0,
    };
  });
  if (snaps.length) {
    const { error: snapError } = await sb.from('reel_metric_snapshots').insert(snaps);
    if (snapError) throw snapError;
  }

  const { error: accError } = await sb
    .from('instagram_accounts')
    .update({ sync_status: 'ready', last_synced_at: now, sync_error: null })
    .eq('id', account.id);
  if (accError) throw accError;

  return { checked: scraped.length, saved: saved?.length || 0 };
}

async function main() {
  requireEnv();
  if (!APIFY) throw new Error('APIFY_API_TOKEN required');

  const ts = Date.now();
  const emailA = `profile_a_${ts}@test.local`;
  const emailB = `profile_b_${ts}@test.local`;
  const pass = 'testpass123';

  console.log('1. Auth A/B');
  await signUp(emailA, pass, 'Profile A');
  await signUp(emailB, pass, 'Profile B');
  const sessionA = await signIn(emailA, pass);
  const sessionB = await signIn(emailB, pass);
  const sbA = anonClient(sessionA.access_token);
  const sbB = anonClient(sessionB.access_token);

  console.log('2. Create account + atomic claim');
  const username = PROFILE.replace(/\/$/, '').split('/').pop().replace('@', '');
  const { data: account, error: accInsErr } = await sbA
    .from('instagram_accounts')
    .insert({
      user_id: sessionA.user.id,
      username,
      profile_url: PROFILE.endsWith('/') ? PROFILE : `${PROFILE}/`,
      import_since: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      sync_status: 'ready',
    })
    .select()
    .single();
  if (accInsErr) throw accInsErr;

  const claimed = await claimAccount(sbA, account.id, sessionA.user.id);
  if (!claimed) throw new Error('first claim failed');
  const claimed2 = await claimAccount(sbA, account.id, sessionA.user.id);
  if (claimed2) throw new Error('second claim should fail while syncing');
  console.log('   concurrent claim blocked OK');

  console.log('3. Apify profile import (may take minutes)');
  const result = await importProfile(sbA, sessionA.user.id, { ...account, sync_status: 'syncing' });
  console.log('   imported', result);
  if (!(result.saved > 0)) throw new Error('no reels saved');

  console.log('4. RLS isolation');
  const { data: leakAcc } = await sbB.from('instagram_accounts').select('id').eq('id', account.id);
  const { data: leakReels } = await sbB.from('reels').select('id').eq('user_id', sessionA.user.id);
  if ((leakAcc && leakAcc.length) || (leakReels && leakReels.length)) {
    throw new Error('RLS leak');
  }

  const { count: snaps1 } = await sbA
    .from('reel_metric_snapshots')
    .select('*', { count: 'exact', head: true });

  console.log('5. Second sync snapshots');
  const admin = createClient(URL, SERVICE);
  await admin
    .from('instagram_accounts')
    .update({
      last_synced_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      sync_status: 'ready',
    })
    .eq('id', account.id);

  const { data: refreshed } = await sbA.from('instagram_accounts').select('*').eq('id', account.id).single();
  const gate = canStartSync(refreshed);
  if (!gate.ok) throw new Error(`expected can start sync, got ${gate.reason}`);

  const claimedAgain = await claimAccount(sbA, account.id, sessionA.user.id);
  if (!claimedAgain) throw new Error('second sync claim failed');
  await importProfile(sbA, sessionA.user.id, refreshed);

  const { count: snaps2 } = await sbA
    .from('reel_metric_snapshots')
    .select('*', { count: 'exact', head: true });
  if (!((snaps2 || 0) > (snaps1 || 0))) {
    throw new Error(`expected more snapshots (${snaps1} -> ${snaps2})`);
  }

  console.log('PASS smoke-profile-e2e');
}

main().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
