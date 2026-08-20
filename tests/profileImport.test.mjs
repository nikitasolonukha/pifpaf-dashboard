import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeReelsByShortcode,
  partitionImportReels,
  calcImportViewsDelta,
  buildSyncSummary,
} from '../src/lib/instagram/profileImport.mjs';
import {
  isSyncStale,
  canStartSync,
  resolveStaleReleaseStatus,
  SYNC_STALE_MS,
  SYNC_COOLDOWN_MS,
} from '../src/lib/instagram/syncLock.mjs';
import { getCoverSources, pickNextCoverSrc } from '../src/lib/apify/coverSources.mjs';
import { buildTotalGrowthDelta, calcReelLatestDelta } from '../src/lib/analytics.mjs';

test('dedupeReelsByShortcode keeps last occurrence', () => {
  const input = [
    { shortcode: 'aaa', views: 1 },
    { shortcode: 'bbb', views: 2 },
    { shortcode: 'aaa', views: 99 },
  ];
  const out = dedupeReelsByShortcode(input);
  assert.equal(out.length, 2);
  assert.equal(out.find(r => r.shortcode === 'aaa').views, 99);
});

test('partitionImportReels splits existing and new', () => {
  const scraped = [
    { shortcode: 'a', views: 10 },
    { shortcode: 'b', views: 20 },
  ];
  const existing = { a: { id: '1', shortcode: 'a', views: 5 } };
  const { toUpdate, toInsert } = partitionImportReels(scraped, existing);
  assert.equal(toUpdate.length, 1);
  assert.equal(toInsert.length, 1);
  assert.equal(calcImportViewsDelta(toUpdate), 5);
});

test('buildSyncSummary marks partial failures', () => {
  const s = buildSyncSummary({
    checked: 10,
    newCount: 2,
    updatedCount: 7,
    failedCount: 1,
    viewsDelta: 100,
  });
  assert.equal(s.partial, true);
  assert.equal(s.imported, 9);
});

test('sync lock: busy while syncing and not stale', () => {
  const account = {
    sync_status: 'syncing',
    updated_at: new Date().toISOString(),
    last_synced_at: null,
  };
  const gate = canStartSync(account);
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, 'busy');
});

test('sync lock: stale sync can be released', () => {
  const account = {
    sync_status: 'syncing',
    updated_at: new Date(Date.now() - SYNC_STALE_MS - 1000).toISOString(),
    last_synced_at: '2024-01-01T00:00:00.000Z',
  };
  assert.equal(isSyncStale(account), true);
  assert.deepEqual(resolveStaleReleaseStatus(account), {
    sync_status: 'ready',
    sync_error: null,
  });
});

test('sync lock: cooldown blocks early sync', () => {
  const account = {
    sync_status: 'ready',
    last_synced_at: new Date().toISOString(),
  };
  const gate = canStartSync(account, { cooldownMs: SYNC_COOLDOWN_MS });
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, 'cooldown');
});

test('cover sources dedupe identical urls', () => {
  const sources = getCoverSources({
    cover_url: 'https://cdn/a.jpg',
    source_cover_url: 'https://cdn/a.jpg',
  });
  assert.deepEqual(sources, ['https://cdn/a.jpg']);
  assert.equal(pickNextCoverSrc(sources, ['https://cdn/a.jpg']), '');
});

test('cover fallback uses second unique source', () => {
  const sources = getCoverSources({
    cover_url: 'https://cdn/a.jpg',
    source_cover_url: 'https://cdn/b.jpg',
  });
  assert.equal(pickNextCoverSrc(sources, ['https://cdn/a.jpg']), 'https://cdn/b.jpg');
});

test('growth: multi reel deltas sum including negatives', () => {
  const reels = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
  const snapshots = [
    { reel_id: 'A', views: 100, captured_at: '2024-01-01T00:00:00.000Z' },
    { reel_id: 'A', views: 120, captured_at: '2024-01-02T00:00:00.000Z' },
    { reel_id: 'B', views: 200, captured_at: '2024-01-01T00:00:00.000Z' },
    { reel_id: 'B', views: 250, captured_at: '2024-01-02T00:00:00.000Z' },
    { reel_id: 'C', views: 100, captured_at: '2024-01-01T00:00:00.000Z' },
    { reel_id: 'C', views: 90, captured_at: '2024-01-02T00:00:00.000Z' },
  ];
  assert.equal(buildTotalGrowthDelta(reels, snapshots), 60);
});

test('growth unavailable with single snapshot', () => {
  assert.equal(calcReelLatestDelta([{ views: 10 }]), null);
  assert.equal(buildTotalGrowthDelta([{ id: 'A' }], [{ reel_id: 'A', views: 10, captured_at: '2024-01-01T00:00:00.000Z' }]), 0);
});
