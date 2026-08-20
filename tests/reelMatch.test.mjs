import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractShortcodeFromInstagramUrl,
  findExactReelMatch,
} from '../src/lib/apify/reelMatch.mjs';

test('extractShortcodeFromInstagramUrl parses /reel/ and /reels/', () => {
  assert.equal(
    extractShortcodeFromInstagramUrl('https://www.instagram.com/reel/ABC123xyz/'),
    'ABC123xyz'
  );
  assert.equal(
    extractShortcodeFromInstagramUrl('https://instagram.com/reels/XYZ_9ab/?utm=1'),
    'XYZ_9ab'
  );
  assert.equal(extractShortcodeFromInstagramUrl('https://example.com/foo'), null);
});

test('findExactReelMatch returns exact item by shortCode', () => {
  const items = [
    { shortCode: 'WRONG1', url: 'https://www.instagram.com/reel/WRONG1/' },
    { shortCode: 'TARGET', url: 'https://www.instagram.com/reel/TARGET/' },
  ];
  const { match, reason } = findExactReelMatch(items, 'TARGET', 'https://www.instagram.com/reel/TARGET/');
  assert.equal(match?.shortCode, 'TARGET');
  assert.equal(reason, null);
});

test('findExactReelMatch rejects when shortcode mismatches', () => {
  const items = [
    { shortCode: 'OTHER', url: 'https://www.instagram.com/reel/OTHER/' },
  ];
  const { match, reason } = findExactReelMatch(items, 'WANTED', 'https://www.instagram.com/reel/WANTED/');
  assert.equal(match, null);
  assert.match(reason, /shortcode_mismatch/);
});

test('findExactReelMatch skips error items and matches valid one', () => {
  const items = [
    { error: 'Not found', errorDescription: 'missing' },
    { shortCode: 'GOOD', url: 'https://www.instagram.com/reel/GOOD/' },
  ];
  const { match } = findExactReelMatch(items, 'GOOD', 'https://www.instagram.com/reel/GOOD/');
  assert.equal(match?.shortCode, 'GOOD');
});

test('findExactReelMatch matches via normalized URL when shortCode field missing', () => {
  const items = [
    { url: 'https://www.instagram.com/reel/URLONLY/' },
  ];
  const { match, reason } = findExactReelMatch(
    items,
    'URLONLY',
    'https://www.instagram.com/reels/URLONLY/?igsh=abc'
  );
  assert.equal(reason, null);
  assert.ok(match);
});

test('findExactReelMatch returns empty_dataset for empty array', () => {
  const { match, reason } = findExactReelMatch([], 'X', 'https://www.instagram.com/reel/X/');
  assert.equal(match, null);
  assert.equal(reason, 'empty_dataset');
});
