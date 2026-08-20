import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInstagramProfile, parseInstagramUsername } from '../src/lib/apify/profileValidator.mjs';

test('parseInstagramUsername from @handle', () => {
  const r = parseInstagramUsername('@natgeo');
  assert.equal(r.username, 'natgeo');
  assert.equal(r.profileUrl, 'https://www.instagram.com/natgeo/');
});

test('parseInstagramUsername from profile URL', () => {
  const r = parseInstagramUsername('https://www.instagram.com/username/');
  assert.equal(r.username, 'username');
});

test('parseInstagramUsername from plain username', () => {
  const r = parseInstagramUsername('my_blog');
  assert.equal(r.username, 'my_blog');
});

test('rejects reel URL as profile', () => {
  const r = validateInstagramProfile('https://www.instagram.com/reel/ABC123/');
  assert.equal(r.valid, false);
});

test('rejects invalid hosts', () => {
  assert.equal(validateInstagramProfile('https://evil.com/user').valid, false);
});
