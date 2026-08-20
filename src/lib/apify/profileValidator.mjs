const ALLOWED_HOSTS = new Set(['instagram.com', 'www.instagram.com']);
const USERNAME_RE = /^[a-zA-Z0-9._]{1,30}$/;

const RESERVED = new Set([
  'reel', 'reels', 'p', 'tv', 'stories', 'explore', 'accounts', 'direct', 'about', 'legal',
]);

function controlledError(message) {
  return { valid: false, error: message };
}

function buildProfileUrl(username) {
  return `https://www.instagram.com/${username}/`;
}

export function parseInstagramUsername(input) {
  if (!input || typeof input !== 'string') return null;
  let raw = input.trim();
  if (!raw) return null;

  if (raw.startsWith('@')) raw = raw.slice(1);

  // Plain username
  if (!raw.includes('/') && !raw.includes('.')) {
    const u = raw.toLowerCase();
    if (!USERNAME_RE.test(raw) || RESERVED.has(u)) return null;
    return { username: raw, profileUrl: buildProfileUrl(raw) };
  }

  // URL
  let urlStr = raw;
  if (!/^https?:\/\//i.test(urlStr)) urlStr = 'https://' + urlStr;

  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '');
  if (!ALLOWED_HOSTS.has(parsed.hostname) && host !== 'instagram.com') return null;

  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length !== 1) return null;

  const username = parts[0];
  if (!USERNAME_RE.test(username) || RESERVED.has(username.toLowerCase())) return null;

  return { username, profileUrl: buildProfileUrl(username) };
}

export function validateInstagramProfile(input) {
  const parsed = parseInstagramUsername(input);
  if (!parsed) {
    return controlledError('Укажи ссылку на профиль Instagram или @username');
  }
  return { valid: true, username: parsed.username, profileUrl: parsed.profileUrl };
}
