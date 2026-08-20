import { parseReelUrl } from './instagramValidator.mjs';

export function extractShortcodeFromInstagramUrl(url) {
  const parsed = parseReelUrl(url);
  return parsed?.shortcode ?? null;
}

function itemShortcode(item) {
  if (!item || typeof item !== 'object') return null;
  const code = item.shortCode ?? item.shortcode ?? item.shortcodeStr;
  if (code && typeof code === 'string') return code.trim();
  const fromUrl = item.url ? extractShortcodeFromInstagramUrl(item.url) : null;
  if (fromUrl) return fromUrl;
  const fromInput = item.inputUrl ? extractShortcodeFromInstagramUrl(item.inputUrl) : null;
  return fromInput;
}

function isErrorItem(item) {
  return !!(item?.error || item?.errorDescription);
}

/**
 * Find exact Apify dataset item matching the user's input URL/shortcode.
 * Never returns a random first item if mismatch.
 */
export function findExactReelMatch(items, inputShortcode, inputUrl) {
  if (!Array.isArray(items) || items.length === 0) {
    return { match: null, reason: 'empty_dataset' };
  }

  const candidates = items.filter(i => !isErrorItem(i));

  if (candidates.length === 0) {
    const errItem = items.find(i => isErrorItem(i));
    return {
      match: null,
      reason: errItem?.errorDescription || errItem?.error || 'all_items_are_errors',
    };
  }

  const exact = candidates.find(item => {
    const code = itemShortcode(item);
    if (code && inputShortcode && code === inputShortcode) return true;

    if (inputUrl && item.url) {
      const inputCode = extractShortcodeFromInstagramUrl(inputUrl);
      const itemCode = extractShortcodeFromInstagramUrl(item.url);
      if (inputCode && itemCode && inputCode === itemCode) return true;
    }

    if (inputUrl && item.inputUrl) {
      const inputCode = extractShortcodeFromInstagramUrl(inputUrl);
      const itemCode = extractShortcodeFromInstagramUrl(item.inputUrl);
      if (inputCode && itemCode && inputCode === itemCode) return true;
    }

    return false;
  });

  if (exact) return { match: exact, reason: null };

  const returnedCodes = candidates.map(itemShortcode).filter(Boolean);
  return {
    match: null,
    reason: `shortcode_mismatch: expected=${inputShortcode}, got=[${returnedCodes.join(', ')}]`,
  };
}
