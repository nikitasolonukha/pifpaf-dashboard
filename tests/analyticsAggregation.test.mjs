import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPortfolioViewsSeries, calcReelLatestDelta } from '../src/lib/analytics.mjs';

const dayLabel = (d) => d.toISOString().slice(0, 10);

test('CASE 1: one reel, multiple snapshots in one day -> uses last known views', () => {
  const reels = [{ id: 'r1' }];
  const snapshots = [
    { reel_id: 'r1', captured_at: '2026-01-01T10:00:00.000Z', views: 100 },
    { reel_id: 'r1', captured_at: '2026-01-01T20:00:00.000Z', views: 120 },
  ];
  const series = buildPortfolioViewsSeries(reels, snapshots, { dayLabel });
  assert.deepEqual(series, [{ date: '2026-01-01', views: 120 }]);
});

test('CASE 2: multiple reels -> sums last-known views per reel per day', () => {
  const reels = [{ id: 'r1' }, { id: 'r2' }];
  const snapshots = [
    { reel_id: 'r1', captured_at: '2026-01-01T10:00:00.000Z', views: 10 },
    { reel_id: 'r2', captured_at: '2026-01-01T12:00:00.000Z', views: 5 },
    { reel_id: 'r1', captured_at: '2026-01-02T10:00:00.000Z', views: 12 },
    { reel_id: 'r2', captured_at: '2026-01-02T12:00:00.000Z', views: 7 },
  ];
  const series = buildPortfolioViewsSeries(reels, snapshots, { dayLabel });
  assert.deepEqual(series, [
    { date: '2026-01-01', views: 15 },
    { date: '2026-01-02', views: 19 },
  ]);
});

test('CASE 3: reel added only on second day -> not counted on day1', () => {
  const reels = [{ id: 'r1' }, { id: 'r2' }];
  const snapshots = [
    { reel_id: 'r1', captured_at: '2026-01-01T10:00:00.000Z', views: 10 },
    { reel_id: 'r1', captured_at: '2026-01-02T10:00:00.000Z', views: 12 },
    { reel_id: 'r2', captured_at: '2026-01-02T12:00:00.000Z', views: 5 },
  ];
  const series = buildPortfolioViewsSeries(reels, snapshots, { dayLabel });
  assert.deepEqual(series, [
    { date: '2026-01-01', views: 10 },
    { date: '2026-01-02', views: 17 },
  ]);
});

test('CASE 4: reel not updated on a day -> uses last known state', () => {
  const reels = [{ id: 'r1' }, { id: 'r2' }];
  const snapshots = [
    { reel_id: 'r1', captured_at: '2026-01-01T10:00:00.000Z', views: 10 },
    { reel_id: 'r2', captured_at: '2026-01-01T12:00:00.000Z', views: 7 },
    { reel_id: 'r2', captured_at: '2026-01-02T12:00:00.000Z', views: 8 },
    { reel_id: 'r1', captured_at: '2026-01-03T10:00:00.000Z', views: 14 },
  ];
  const series = buildPortfolioViewsSeries(reels, snapshots, { dayLabel });
  assert.deepEqual(series, [
    { date: '2026-01-01', views: 17 },
    { date: '2026-01-02', views: 18 }, // r1 stays at 10, r2 becomes 8
    { date: '2026-01-03', views: 22 }, // r1 14, r2 stays at 8
  ]);
});

test('CASE 5: no snapshots -> empty series', () => {
  const reels = [{ id: 'r1' }];
  const series = buildPortfolioViewsSeries(reels, [], { dayLabel });
  assert.deepEqual(series, []);
});

test('CASE 6: snapshot with views = 0 is preserved', () => {
  const reels = [{ id: 'r1' }];
  const snapshots = [
    { reel_id: 'r1', captured_at: '2026-01-01T10:00:00.000Z', views: 0 },
    { reel_id: 'r1', captured_at: '2026-01-02T10:00:00.000Z', views: 5 },
  ];
  const series = buildPortfolioViewsSeries(reels, snapshots, { dayLabel });
  assert.deepEqual(series, [
    { date: '2026-01-01', views: 0 },
    { date: '2026-01-02', views: 5 },
  ]);
});

test('delta: calcReelLatestDelta returns null when only one snapshot', () => {
  assert.equal(calcReelLatestDelta([{ views: 10 }]), null);
});

test('delta: calcReelLatestDelta returns latest - previous (can be negative)', () => {
  const delta = calcReelLatestDelta([
    { views: 100, captured_at: '2026-01-01T00:00:00.000Z' },
    { views: 80, captured_at: '2026-01-02T00:00:00.000Z' },
  ]);
  assert.equal(delta, -20);
});

