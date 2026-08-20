import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildViewsByReelChart,
  buildTopReelsRanking,
  buildReelsByMonthChart,
  buildViewsByPublishMonthChart,
  calcMedianViews,
  hasGrowthHistory,
} from '../src/lib/performanceAnalytics.mjs';

const reels = [
  { id: '1', shortcode: 'a', caption: 'A', published_at: '2025-03-15T12:00:00.000Z', views: 1000, likes: 10 },
  { id: '2', shortcode: 'b', caption: 'B', published_at: '2025-03-20T12:00:00.000Z', views: 3000, likes: 20 },
  { id: '3', shortcode: 'c', caption: 'C', published_at: '2025-04-01T12:00:00.000Z', views: 2000, likes: 15 },
];

test('buildViewsByReelChart returns top reels by views', () => {
  const chart = buildViewsByReelChart(reels);
  assert.equal(chart.length, 3);
  assert.equal(chart[0].id, '2');
  assert.equal(chart[0].views, 3000);
  assert.equal(chart[0].rank, 1);
  assert.equal(chart[0].label, '#1');
  assert.equal(chart[2].id, '1');
});

test('buildTopReelsRanking normalizes bars', () => {
  const top = buildTopReelsRanking(reels, 2);
  assert.equal(top.length, 2);
  assert.equal(top[0].rank, 1);
  assert.equal(top[0].barPercent, 100);
  assert.ok(top[1].barPercent < 100);
});

test('buildReelsByMonthChart counts per month', () => {
  const months = buildReelsByMonthChart(reels);
  assert.equal(months.length, 2);
  const mar = months.find(m => m.month.endsWith('-03'));
  assert.equal(mar.count, 2);
});

test('buildViewsByPublishMonthChart sums views', () => {
  const months = buildViewsByPublishMonthChart(reels);
  const mar = months.find(m => m.month.endsWith('-03'));
  assert.equal(mar.views, 4000);
});

test('calcMedianViews', () => {
  assert.equal(calcMedianViews(reels), 2000);
});

test('hasGrowthHistory requires 2+ snapshots on any reel', () => {
  assert.equal(hasGrowthHistory([{ reel_id: '1' }]), false);
  assert.equal(hasGrowthHistory([{ reel_id: '1' }, { reel_id: '1' }]), true);
});
