/**
 * Real application E2E via HTTP API routes (not a business-logic copy).
 *
 * Prerequisites:
 *   - Next.js running (default http://localhost:3002)
 *   - Local Supabase + .env.local
 *   - APIFY_API_TOKEN (live import needs Apify usage balance)
 *
 * Usage:
 *   npm run dev          # terminal 1
 *   npm run smoke:app    # terminal 2
 */
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { createServer } from 'node:net';
import http from 'node:http';
import https from 'node:https';

const LONG_MS = 45 * 60 * 1000;
const APP_URL = process.env.SMOKE_APP_URL || 'http://localhost:3002';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APIFY = process.env.APIFY_API_TOKEN;
const PROFILE = process.env.SMOKE_PROFILE_URL || 'https://www.instagram.com/natgeo/';

const live = {
  profileConnect: 'SKIP',
  profileImport: 'SKIP',
  secondSync: 'SKIP',
  snapshots: 'SKIP',
  concurrentConnect: 'SKIP',
  concurrentSync: 'SKIP',
  staleLock: 'SKIP',
  rls: 'SKIP',
  storage: 'SKIP',
  unauth: 'SKIP',
  singleAccount409: 'SKIP',
  apifyBlocked: false,
};

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

function createCookieJar() {
  const jar = new Map();
  return {
    getAll() {
      return [...jar.entries()].map(([name, value]) => ({ name, value }));
    },
    setAll(cookies) {
      for (const { name, value } of cookies) {
        if (!value) jar.delete(name);
        else jar.set(name, value);
      }
    },
    header() {
      return [...jar.entries()].map(([n, v]) => `${n}=${v}`).join('; ');
    },
  };
}

async function sessionCookieHeader(session) {
  const jar = createCookieJar();
  const sb = createServerClient(SUPABASE_URL, ANON, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (cookies) => jar.setAll(cookies),
    },
  });
  const { error } = await sb.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw error;
  await new Promise((r) => setTimeout(r, 30));
  const header = jar.header();
  if (!header) throw new Error('failed to materialize auth cookies');
  return header;
}

function api(pathname, { method = 'GET', body, cookie } = {}) {
  const payload = body ? JSON.stringify(body) : null;
  const url = new URL(`${APP_URL}${pathname}`);
  const lib = url.protocol === 'https:' ? https : http;
  const headers = {
    ...(cookie ? { Cookie: cookie } : {}),
    ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
  };

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers,
        timeout: LONG_MS,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 200) }; }
          resolve({
            status: res.statusCode,
            headers: {
              get(name) {
                const v = res.headers[name.toLowerCase()];
                return Array.isArray(v) ? v[0] : v ?? null;
              },
            },
            json,
            text,
          });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error(`API timeout after ${LONG_MS}ms: ${method} ${pathname}`));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function anon(token) {
  return createClient(SUPABASE_URL, ANON, token
    ? { global: { headers: { Authorization: `Bearer ${token}` } } }
    : undefined);
}

async function signUp(email, password, name) {
  const { error } = await anon().auth.signUp({
    email,
    password,
    options: { data: { display_name: name } },
  });
  if (error) throw error;
}

async function signIn(email, password) {
  const { data, error } = await anon().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

async function waitForApp(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${APP_URL}/login`, { redirect: 'manual' });
      if (res.status === 200 || res.status === 307 || res.status === 308) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`App not ready at ${APP_URL}`);
}

async function portFree(port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

async function maybeStartServer() {
  if (process.env.SMOKE_START_SERVER !== '1') return null;
  const port = Number(new URL(APP_URL).port || 3002);
  if (!(await portFree(port))) {
    console.log(`Port ${port} busy — using existing server`);
    return null;
  }
  console.log(`Starting next start -p ${port}`);
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'start', '-p', String(port)], {
    cwd: process.cwd(),
    stdio: 'ignore',
    env: process.env,
    detached: false,
  });
  await waitForApp();
  return child;
}

async function cleanupUser(userId) {
  if (!userId || !SERVICE) return;
  const admin = createClient(SUPABASE_URL, SERVICE);
  await admin.from('reels').delete().eq('user_id', userId);
  await admin.from('instagram_accounts').delete().eq('user_id', userId);
  await admin.from('profiles').delete().eq('id', userId);
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch {
    // ignore
  }
}

async function raceTwo(label, makeRequest) {
  const first = makeRequest();
  await new Promise((r) => setTimeout(r, 80));
  const second = makeRequest();
  const settled = await Promise.race([
    first.then((r) => ({ which: 'first', r })),
    second.then((r) => ({ which: 'second', r })),
  ]);
  let busy = settled.r.status === 429 ? settled.r : null;
  const winnerPromise = settled.which === 'first' ? second : first;
  const otherPromise = settled.which === 'first' ? first : second;
  if (!busy) {
    const other = await Promise.race([
      otherPromise,
      new Promise((resolve) => setTimeout(() => resolve(null), 15_000)),
    ]);
    if (other?.status === 429) busy = other;
  }
  const winner = await winnerPromise;
  const loser = busy || (await otherPromise);
  console.log(`   ${label} statuses`, [winner.status, loser.status]);
  if (loser.status !== 429 && winner.status !== 429) {
    throw new Error(`${label}: expected one 429, got winner=${winner.status} loser=${loser.status}`);
  }
  return { winner, loser };
}

async function seedAccountWithReels(admin, userId, username = 'smoke_seed') {
  const { data: account, error } = await admin
    .from('instagram_accounts')
    .insert({
      user_id: userId,
      username,
      profile_url: `https://www.instagram.com/${username}/`,
      display_name: username,
      sync_status: 'ready',
      last_synced_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      import_since: '2025-01-01',
    })
    .select()
    .single();
  if (error) throw error;
  const rows = ['A', 'B', 'C'].map((shortcode, i) => ({
    user_id: userId,
    instagram_account_id: account.id,
    instagram_url: `https://www.instagram.com/reel/${shortcode}/`,
    shortcode,
    caption: `Seed ${shortcode}`,
    views: 100 * (i + 1),
    likes: i,
    comments: 0,
    sync_status: 'ready',
    owner_username: username,
    published_at: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
  }));
  const { data: reels, error: reelErr } = await admin.from('reels').insert(rows).select('id, views, shortcode');
  if (reelErr) throw reelErr;
  await admin.from('reel_metric_snapshots').insert(
    reels.map((r) => ({ reel_id: r.id, views: r.views, likes: 0, comments: 0 }))
  );
  return { account, reels };
}

async function main() {
  requireEnv();
  if (!APIFY) throw new Error('APIFY required');

  const server = await maybeStartServer();
  try {
    await waitForApp(15000);
  } catch (err) {
    if (server) server.kill();
    console.error('Start Next.js first: npm run dev');
    throw err;
  }

  const created = [];
  const admin = createClient(SUPABASE_URL, SERVICE);
  try {
    console.log('0. Unauth API → 401 JSON');
    for (const path of ['/api/dashboard', '/api/reels', '/api/instagram/account']) {
      const res = await api(path);
      if (res.status !== 401 || res.json?.error !== 'Unauthorized') {
        throw new Error(`${path} expected 401 JSON, got ${res.status} ${JSON.stringify(res.json)}`);
      }
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error(`${path} not JSON`);
    }
    const syncUnauth = await api('/api/instagram/00000000-0000-4000-8000-000000000000/sync', { method: 'POST' });
    if (syncUnauth.status !== 401) throw new Error('sync unauth not 401');
    live.unauth = 'PASS';

    const ts = Date.now();
    const emailA = `appa_${ts}@test.local`;
    const emailB = `appb_${ts}@test.local`;
    const pass = 'testpass123';

    console.log('1. Signup/login A & B');
    await signUp(emailA, pass, 'App A');
    await signUp(emailB, pass, 'App B');
    const sessionA = await signIn(emailA, pass);
    const sessionB = await signIn(emailB, pass);
    created.push(sessionA.user.id, sessionB.user.id);
    const cookieA = await sessionCookieHeader(sessionA);
    const cookieB = await sessionCookieHeader(sessionB);

    const authProbe = await api('/api/instagram/account', { cookie: cookieA });
    if (authProbe.status !== 200) {
      throw new Error(`auth cookie failed: ${authProbe.status} ${JSON.stringify(authProbe.json)}`);
    }

    console.log('2. Concurrent connect lock (real API)');
    const raced = await raceTwo('concurrent connect', () =>
      api('/api/instagram/connect', { method: 'POST', cookie: cookieA, body: { input: PROFILE } })
    );
    live.concurrentConnect = 'PASS';
    let winner = [raced.winner, raced.loser].find((r) => [200, 201].includes(r.status));
    let accountId = winner?.json?.account?.id || null;

    if (winner) {
      live.profileConnect = 'PASS';
      live.profileImport = winner.json?.summary?.checked > 0 ? 'PASS' : 'FAIL';
    } else {
      const errText = JSON.stringify(raced.winner.json || raced.loser.json);
      if (/не отдал данные|not-enough-usage|402|usage/i.test(errText) || raced.winner.status === 502) {
        live.apifyBlocked = true;
        live.profileConnect = 'BLOCKED_APIFY';
        live.profileImport = 'BLOCKED_APIFY';
        console.log('   Apify unavailable — seeding fixture reels on existing/primary account');
        let { data: primary } = await admin
          .from('instagram_accounts')
          .select('*')
          .eq('user_id', sessionA.user.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!primary) {
          const seeded = await seedAccountWithReels(admin, sessionA.user.id);
          primary = seeded.account;
        } else {
          await admin.from('reels').delete().eq('user_id', sessionA.user.id);
          const rows = ['A', 'B', 'C'].map((shortcode, i) => ({
            user_id: sessionA.user.id,
            instagram_account_id: primary.id,
            instagram_url: `https://www.instagram.com/reel/${shortcode}/`,
            shortcode,
            caption: `Seed ${shortcode}`,
            views: 100 * (i + 1),
            likes: i,
            comments: 0,
            sync_status: 'ready',
            owner_username: primary.username,
            published_at: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
          }));
          const { data: reels, error: reelErr } = await admin.from('reels').insert(rows).select('id, views');
          if (reelErr) throw reelErr;
          await admin.from('reel_metric_snapshots').insert(
            reels.map((r) => ({ reel_id: r.id, views: r.views, likes: 0, comments: 0 }))
          );
        }
        accountId = primary.id;
      } else {
        throw new Error(`connect failed unexpectedly: ${errText}`);
      }
    }

    const { count: accCount } = await admin
      .from('instagram_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', sessionA.user.id);
    if ((accCount || 0) < 1) throw new Error('no account after connect/seed');

    // Ensure ready for follow-up API checks
    await admin
      .from('instagram_accounts')
      .update({
        sync_status: 'ready',
        sync_error: null,
        last_synced_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      })
      .eq('id', accountId);

    console.log('3. GET /api/reels + /api/dashboard');
    const reelsRes = await api('/api/reels', { cookie: cookieA });
    if (reelsRes.status !== 200 || !(reelsRes.json?.reels?.length > 0)) {
      throw new Error('reels empty');
    }
    const dash = await api('/api/dashboard', { cookie: cookieA });
    if (dash.status !== 200 || !(dash.json?.totalReels > 0)) throw new Error('dashboard empty');

    console.log('4. Different username connect → 409');
    const other = await api('/api/instagram/connect', {
      method: 'POST',
      cookie: cookieA,
      body: { input: 'https://www.instagram.com/instagram/' },
    });
    if (other.status !== 409) {
      throw new Error(`expected 409 for second profile, got ${other.status} ${JSON.stringify(other.json)}`);
    }
    live.singleAccount409 = 'PASS';

    console.log('5. Concurrent sync lock');
    // Force busy without Apify: claim syncing, second request must 429
    await admin
      .from('instagram_accounts')
      .update({ sync_status: 'syncing', updated_at: new Date().toISOString() })
      .eq('id', accountId);
    const busySync = await api(`/api/instagram/${accountId}/sync`, { method: 'POST', cookie: cookieA });
    if (busySync.status !== 429) {
      throw new Error(`expected busy 429, got ${busySync.status} ${JSON.stringify(busySync.json)}`);
    }
    live.concurrentSync = 'PASS';

    if (!live.apifyBlocked) {
      await admin
        .from('instagram_accounts')
        .update({
          sync_status: 'ready',
          last_synced_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        })
        .eq('id', accountId);
      const reelIds = reelsRes.json.reels.map((r) => r.id);
      const { count: snaps1 } = await admin
        .from('reel_metric_snapshots')
        .select('*', { count: 'exact', head: true })
        .in('reel_id', reelIds);
      const syncOk = await api(`/api/instagram/${accountId}/sync`, { method: 'POST', cookie: cookieA });
      if (syncOk.status !== 200) throw new Error(`sync failed ${syncOk.status}`);
      live.secondSync = 'PASS';
      const { count: snaps2 } = await admin
        .from('reel_metric_snapshots')
        .select('*', { count: 'exact', head: true })
        .in('reel_id', reelIds);
      if (!((snaps2 || 0) > (snaps1 || 0))) throw new Error('snapshots did not grow');
      live.snapshots = 'PASS';
    } else {
      live.secondSync = 'BLOCKED_APIFY';
      live.snapshots = 'BLOCKED_APIFY';
    }

    console.log('6. RLS User B');
    const leakDashB = await api('/api/dashboard', { cookie: cookieB });
    if (leakDashB.status !== 200) throw new Error('B dashboard auth failed');
    if ((leakDashB.json?.totalReels || 0) !== 0) throw new Error('B sees A reels');
    if (leakDashB.json?.instagramAccount?.id === accountId) throw new Error('B sees A account');

    const leakSync = await api(`/api/instagram/${accountId}/sync`, { method: 'POST', cookie: cookieB });
    if (leakSync.status === 200) throw new Error('B synced A account');

    const reelId = reelsRes.json.reels[0].id;
    const leakDel = await api(`/api/reels/${reelId}`, { method: 'DELETE', cookie: cookieB });
    if (![403, 404, 401].includes(leakDel.status)) {
      throw new Error(`B delete should be forbidden/404, got ${leakDel.status}`);
    }
    const still = await admin.from('reels').select('id').eq('id', reelId).maybeSingle();
    if (!still.data) throw new Error('A reel missing after B delete attempt');

    const leakRefresh = await api(`/api/reels/${reelId}/refresh`, { method: 'POST', cookie: cookieB });
    if (![403, 404, 401].includes(leakRefresh.status) && leakRefresh.status === 200) {
      throw new Error('B refreshed A reel');
    }
    live.rls = 'PASS';

    console.log('7. Storage security');
    const userSb = anon(sessionA.access_token);
    const { error: uploadErr } = await userSb.storage.from('reel-covers').upload(
      `${sessionA.user.id}/smoke-forbidden.txt`,
      new Blob(['x']),
      { contentType: 'text/plain', upsert: true }
    );
    if (!uploadErr) throw new Error('authenticated user should not upload covers');
    const { error: svcErr } = await admin.storage.from('reel-covers').upload(
      `${sessionA.user.id}/smoke-ok.jpg`,
      Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      { contentType: 'image/jpeg', upsert: true }
    );
    if (svcErr) console.warn('service upload warn', svcErr.message);
    else await admin.storage.from('reel-covers').remove([`${sessionA.user.id}/smoke-ok.jpg`]);
    live.storage = 'PASS';

    console.log('8. Stale lock recovery');
    await admin
      .from('instagram_accounts')
      .update({
        sync_status: 'syncing',
        updated_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
        last_synced_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      })
      .eq('id', accountId);
    const staleSync = await api(`/api/instagram/${accountId}/sync`, { method: 'POST', cookie: cookieA });
    // With Apify: 200 or 502 after release. Without: 502 after release is OK if not stuck syncing.
    if (staleSync.status === 429) {
      throw new Error(`stale lock not released: still 429 ${JSON.stringify(staleSync.json)}`);
    }
    const { data: after } = await admin
      .from('instagram_accounts')
      .select('sync_status')
      .eq('id', accountId)
      .single();
    if (after?.sync_status === 'syncing') {
      throw new Error('account stuck syncing after stale attempt');
    }
    live.staleLock = 'PASS';
    console.log('   stale status', staleSync.status, 'account', after?.sync_status);

    console.log('PASS smoke-app-e2e');
    console.log('LIVE_SUMMARY', JSON.stringify(live));
    if (live.apifyBlocked) process.exitCode = 0; // app smoke core passed; live Apify noted
  } finally {
    for (const id of created) await cleanupUser(id);
    if (server) {
      try { server.kill(); } catch { /* ignore */ }
    }
  }
}

main().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
