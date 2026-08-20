import test from 'node:test';
import assert from 'node:assert/strict';

import { validateInstagramUrl } from '../src/lib/apify/instagramValidator.mjs';

test('valid instagram reel URL (/reel)', () => {
  const input = 'https://www.instagram.com/reel/AbcDE123_/';
  const res = validateInstagramUrl(input);
  assert.equal(res.valid, true);
  assert.equal(res.shortcode, 'AbcDE123_');
  assert.equal(res.url, input);
});

test('valid instagram reel URL (/reels)', () => {
  const input = 'https://instagram.com/reels/xyz-99/';
  const res = validateInstagramUrl(input);
  assert.equal(res.valid, true);
  assert.equal(res.shortcode, 'xyz-99');
});

test('rejects non-instagram hosts', () => {
  const res = validateInstagramUrl('https://evilinstagram.com/reel/abc');
  assert.equal(res.valid, false);
});

test('rejects instagram.com.evil.com', () => {
  const res = validateInstagramUrl('https://instagram.com.evil.com/reel/abc');
  assert.equal(res.valid, false);
});

test('rejects random paths', () => {
  const res = validateInstagramUrl('https://www.instagram.com/p/abc123/');
  assert.equal(res.valid, false);
});

test('rejects empty shortcode', () => {
  const res = validateInstagramUrl('https://www.instagram.com/reel//');
  assert.equal(res.valid, false);
});

