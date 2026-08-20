const ALLOWED_HOSTS = new Set(['instagram.com', 'www.instagram.com']);
const SHORTCODE_RE = /^[A-Za-z0-9_-]+$/;

function controlledError(message) {
  return { valid: false, error: message };
}

function extractShortcodeFromPath(pathname) {
  // Normalize: "/reel/<shortcode>" or "/reels/<shortcode>"
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  const [kind, shortcode] = parts;

  if (kind !== 'reel' && kind !== 'reels') return null;
  if (!shortcode || !SHORTCODE_RE.test(shortcode)) return null;
  return shortcode;
}

export function parseReelUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname?.toLowerCase();
    if (!ALLOWED_HOSTS.has(host)) return null;
    const shortcode = extractShortcodeFromPath(u.pathname);
    if (!shortcode) return null;
    return { shortcode, cleanUrl: u.toString() };
  } catch {
    return null;
  }
}

export function validateInstagramUrl(input) {
  if (!input || typeof input !== 'string') return controlledError('Вставь ссылку на Reel');

  const trimmed = input.trim();
  if (!trimmed) return controlledError('Вставь ссылку на Reel');

  let u;
  try {
    u = new URL(trimmed);
  } catch {
    return controlledError('Это не валидная ссылка');
  }

  const host = u.hostname?.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return controlledError('Это не Instagram ссылка');

  const shortcode = extractShortcodeFromPath(u.pathname);
  if (!shortcode) return controlledError('Не удалось найти Reel в этой ссылке');

  return { valid: true, shortcode, url: trimmed };
}

