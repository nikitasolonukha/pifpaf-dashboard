import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReelUpsertRow,
  assertSingleAccountConnect,
  scopeReelsToAccount,
  filterScrapedForAccount,
  partitionImportReels,
  buildSyncSummary,
  dedupeReelsByShortcode,
} from '../src/lib/instagram/profileImport.mjs';
import { canStartSync, isSyncStale, SYNC_STALE_MS } from '../src/lib/instagram/syncLock.mjs';
import { getCoverSources, pickNextCoverSrc } from '../src/lib/apify/coverSources.mjs';
import { findExactReelMatch } from '../src/lib/apify/reelMatch.mjs';
import { throwOnError } from '../src/lib/supabase/assert.js';

test('buildReelUpsertRow never includes id (mixed upsert safety)', () => {
  const existing = { id: 'uuid-existing', cover_url: 'https://a.jpg', views: 10 };
  const account = { id: 'acc-1', username: 'creator' };
  const rowExisting = buildReelUpsertRow({
    reel: { shortcode: 'AAA', views: 20, source_cover_url: 'https://b.jpg' },
    existing,
    account,
    userId: 'user-1',
    coverUrl: 'https://c.jpg',
    now: '2026-01-01T00:00:00.000Z',
  });
  const rowNew = buildReelUpsertRow({
    reel: { shortcode: 'NEW1', views: 5, source_cover_url: 'https://n.jpg' },
    account,
    userId: 'user-1',
    coverUrl: 'https://n.jpg',
    now: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(Object.hasOwn(rowExisting, 'id'), false);
  assert.equal(Object.hasOwn(rowNew, 'id'), false);
  assert.equal(rowExisting.shortcode, 'AAA');
  assert.equal(rowNew.shortcode, 'NEW1');
  assert.equal(rowExisting.user_id, 'user-1');
  assert.equal(rowNew.instagram_account_id, 'acc-1');
});

test('mixed partition: 3 existing + 1 new', () => {
  const scraped = [
    { shortcode: 'A', views: 11 },
    { shortcode: 'B', views: 22 },
    { shortcode: 'C', views: 33 },
    { shortcode: 'D_NEW', views: 44 },
  ];
  const existing = {
    A: { id: '1', shortcode: 'A', views: 10 },
    B: { id: '2', shortcode: 'B', views: 20 },
    C: { id: '3', shortcode: 'C', views: 30 },
  };
  const { toUpdate, toInsert } = partitionImportReels(scraped, existing);
  assert.equal(toUpdate.length, 3);
  assert.equal(toInsert.length, 1);
  assert.equal(toInsert[0].reel.shortcode, 'D_NEW');
});

test('scopeReelsToAccount separates two profiles', () => {
  const accountA = { id: 'acc-a', username: 'alice' };
  const accountB = { id: 'acc-b', username: 'bob' };
  const reels = [
    { id: '1', instagram_account_id: 'acc-a', shortcode: 'a' },
    { id: '2', instagram_account_id: 'acc-b', shortcode: 'b' },
    { id: '3', instagram_account_id: null, owner_username: 'alice', shortcode: 'c' },
  ];
  assert.deepEqual(scopeReelsToAccount(reels, accountA).map(r => r.id).sort(), ['1', '3']);
  assert.deepEqual(scopeReelsToAccount(reels, accountB).map(r => r.id), ['2']);
});

test('assertSingleAccountConnect still documents same-username reuse', () => {
  const res = assertSingleAccountConnect({ username: 'alice', id: '1' }, 'Alice');
  assert.equal(res.ok, true);
  assert.equal(res.same, true);
});

test('filterScrapedForAccount drops foreign owners', () => {
  const out = filterScrapedForAccount([
    { shortcode: '1', owner_username: 'me' },
    { shortcode: '2', owner_username: 'other' },
    { shortcode: '3' },
  ], 'me');
  assert.deepEqual(out.map(r => r.shortcode), ['1', '3']);
});

test('partial summary marks partial=true', () => {
  const s = buildSyncSummary({ checked: 10, newCount: 1, updatedCount: 7, failedCount: 2 });
  assert.equal(s.partial, true);
  assert.equal(s.imported, 8);
});

test('stale lock can start after release window', () => {
  const stale = {
    sync_status: 'syncing',
    updated_at: new Date(Date.now() - SYNC_STALE_MS - 5000).toISOString(),
    last_synced_at: '2024-01-01T00:00:00.000Z',
  };
  assert.equal(isSyncStale(stale), true);
  const afterRelease = { ...stale, sync_status: 'ready' };
  assert.equal(canStartSync(afterRelease, { cooldownMs: 0 }).ok, true);
});

test('cover identical dead urls → empty after fail', () => {
  const sources = getCoverSources({
    cover_url: 'https://cdn/x.jpg',
    source_cover_url: 'https://cdn/x.jpg',
  });
  assert.equal(sources.length, 1);
  assert.equal(pickNextCoverSrc(sources, sources), '');
});

test('exact reel match rejects wrong first item', () => {
  const items = [
    { shortCode: 'YYY', url: 'https://www.instagram.com/reel/YYY/' },
    { shortCode: 'XXX', url: 'https://www.instagram.com/reel/XXX/' },
    { shortCode: 'ZZZ', url: 'https://www.instagram.com/reel/ZZZ/' },
  ];
  const { match } = findExactReelMatch(items, 'XXX', 'https://www.instagram.com/reel/XXX/');
  assert.equal(match.shortCode, 'XXX');
});

test('throwOnError throws on supabase error shape', () => {
  assert.throws(() => throwOnError({ error: { message: 'boom', code: 'X' } }, 'ctx'), /boom/);
});

test('dedupe keeps one shortcode', () => {
  assert.equal(dedupeReelsByShortcode([
    { shortcode: 'a', views: 1 },
    { shortcode: 'a', views: 9 },
  ]).length, 1);
});
