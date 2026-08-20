/**
 * E2E smoke: auth, RLS isolation, Apify import.
 * Run: node --env-file=.env.local scripts/smoke-e2e.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { ApifyClient } from 'apify-client';
import { normalizeReelData } from '../src/lib/apify/instagramNormalization.mjs';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APIFY = process.env.APIFY_API_TOKEN;
const TEST_REEL = 'https://www.instagram.com/reel/DH56yy7p3lZ/';

function client(token) {
  const opts = token
    ? { global: { headers: { Authorization: `Bearer ${token}` } } }
    : {};
  return createClient(URL, ANON, opts);
}

async function scrapeReel(url) {
  const apify = new ApifyClient({ token: APIFY });
  const run = await apify.actor('apify/instagram-reel-scraper').call({
    username: [url],
    resultsLimit: 1,
    skipPinnedPosts: false,
    skipTrialReels: false,
    includeSharesCount: false,
    includeTranscript: false,
    includeDownloadedVideo: false,
  });
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  if (!items?.length) throw new Error('Empty Apify dataset');
  return normalizeReelData(items[0]);
}

async function uploadCover(sourceUrl, userId, shortcode) {
  if (!sourceUrl) return null;
  const admin = createClient(URL, SERVICE);
  const res = await fetch(sourceUrl, { headers: { 'User-Agent': 'PifPafAI/cover-downloader' } });
  if (!res.ok) return null;
  const ct = res.headers.get('content-type') || '';
  if (!ct.toLowerCase().includes('image/jpeg')) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > 5 * 1024 * 1024) return null;
  const path = `${userId}/${shortcode}.jpg`;
  const { error } = await admin.storage.from('reel-covers').upload(path, buf, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) return null;
  return admin.storage.from('reel-covers').getPublicUrl(path).data.publicUrl;
}

async function signUp(email, password, name) {
  const { error } = await client().auth.signUp({
    email,
    password,
    options: { data: { display_name: name } },
  });
  if (error) throw error;
}

async function signIn(email, password) {
  const { data, error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

async function main() {
  const ts = Date.now();
  const emailA = `usera_${ts}@test.local`;
  const emailB = `userb_${ts}@test.local`;
  const pass = 'testpass123';

  console.log('1. Sign up User A & B');
  await signUp(emailA, pass, 'User A');
  await signUp(emailB, pass, 'User B');

  const sessionA = await signIn(emailA, pass);
  const sessionB = await signIn(emailB, pass);
  const sbA = client(sessionA.access_token);
  const sbB = client(sessionB.access_token);

  console.log('2. Apify scrape (live)');
  const reelData = await scrapeReel(TEST_REEL);
  console.log('   views:', reelData.views, 'shortcode:', reelData.shortcode);

  console.log('3. User A adds reel + cover');
  const coverUrl = await uploadCover(reelData.source_cover_url, sessionA.user.id, reelData.shortcode);
  console.log('   cover:', coverUrl ? 'stored' : 'fallback to source');

  const { data: reel, error: insErr } = await sbA.from('reels').insert({
    user_id: sessionA.user.id,
    instagram_url: TEST_REEL,
    instagram_reel_id: reelData.instagram_reel_id,
    shortcode: reelData.shortcode,
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
  }).select().single();
  if (insErr) throw insErr;

  await sbA.from('reel_metric_snapshots').insert({
    reel_id: reel.id,
    views: reelData.views,
    likes: reelData.likes,
    comments: reelData.comments,
  });

  console.log('4. User A sees reel:', (await sbA.from('reels').select('id')).data?.length);

  const bCount = (await sbB.from('reels').select('id')).data?.length ?? -1;
  console.log('5. User B reels count:', bCount, bCount === 0 ? 'OK' : 'FAIL');

  const bDirect = (await sbB.from('reels').select('*').eq('id', reel.id)).data?.length ?? -1;
  console.log('6. User B direct access:', bDirect === 0 ? 'OK' : 'FAIL');

  const bSnaps = (await sbB.from('reel_metric_snapshots').select('*').eq('reel_id', reel.id)).data?.length ?? -1;
  console.log('7. User B snapshots:', bSnaps === 0 ? 'OK' : 'FAIL');

  console.log('8. Refresh → snapshot #2');
  const reelData2 = await scrapeReel(TEST_REEL);
  await sbA.from('reel_metric_snapshots').insert({
    reel_id: reel.id,
    views: reelData2.views,
    likes: reelData2.likes,
    comments: reelData2.comments,
  });
  const snaps = (await sbA.from('reel_metric_snapshots').select('views').eq('reel_id', reel.id).order('captured_at')).data;
  const delta = Number(snaps?.[1]?.views ?? 0) - Number(snaps?.[0]?.views ?? 0);
  console.log('   snapshots:', snaps?.length, 'delta:', delta);

  if (bCount !== 0 || bDirect !== 0 || bSnaps !== 0) process.exit(1);
  console.log('\n✅ Smoke E2E passed');
}

main().catch(e => {
  console.error('\n❌ Smoke failed:', e.message);
  process.exit(1);
});
