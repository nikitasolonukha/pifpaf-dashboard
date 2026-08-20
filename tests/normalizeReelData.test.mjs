import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeReelData } from '../src/lib/apify/instagramNormalization.mjs';

test('normalizes views from videoPlayCount (0 preserved)', () => {
  const apifyItem = {
    shortCode: 'abc',
    displayUrl: 'https://cdninstagram.com/cover.jpg',
    timestamp: '2026-08-19T10:00:00.000Z',
    ownerUsername: 'creator',
    ownerFullName: 'Creator Name',
    id: 'ig_1',
    caption: 'hello',
    videoPlayCount: 0,
    videoViewCount: 123,
    likesCount: 0,
    commentsCount: 2,
  };

  const res = normalizeReelData(apifyItem);
  assert.equal(res.shortcode, 'abc');
  assert.equal(res.views, 0);
  assert.equal(res.likes, 0);
  assert.equal(res.comments, 2);
});

test('normalizes views from videoViewCount when playCount missing', () => {
  const apifyItem = {
    shortCode: 'abc',
    displayUrl: 'https://cdninstagram.com/cover.jpg',
    timestamp: '2026-08-19T10:00:00.000Z',
    videoPlayCount: null,
    videoViewCount: 456,
    likesCount: 1,
    commentsCount: 0,
  };

  const res = normalizeReelData(apifyItem);
  assert.equal(res.views, 456);
});

test('throws controlled error when shortcode missing', () => {
  assert.throws(
    () => normalizeReelData({ displayUrl: 'x', videoPlayCount: 1 }),
    /shortcode/
  );
});

test('throws when view metrics missing (rate-limited scrape)', () => {
  assert.throws(
    () => normalizeReelData({ shortCode: 'abc', displayUrl: 'https://x.com/a.jpg' }),
    /Instagram сейчас не отдал/
  );
});

