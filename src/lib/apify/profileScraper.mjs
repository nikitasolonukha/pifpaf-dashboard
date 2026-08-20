import { ApifyClient } from 'apify-client';
import { normalizeReelData } from './instagramNormalization.mjs';

function isErrorItem(item) {
  return !!(item?.error || item?.errorDescription);
}

async function listAllDatasetItems(client, datasetId) {
  const items = [];
  let offset = 0;
  const limit = 250;
  while (true) {
    const { items: batch } = await client.dataset(datasetId).listItems({ offset, limit });
    if (!batch?.length) break;
    items.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return items;
}

function parseItemTimestamp(item) {
  const ts = item?.timestamp ?? item?.takenAt ?? item?.taken_at;
  if (!ts) return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function filterByCutoff(items, cutoffDate) {
  if (!cutoffDate) return items;
  const cutoff = new Date(cutoffDate + 'T00:00:00.000Z');
  return items.filter(item => {
    const d = parseItemTimestamp(item);
    if (!d) return true;
    return d >= cutoff;
  });
}

/**
 * Scrape all reels from an Instagram profile for the given period.
 * Uses the same apify/instagram-reel-scraper actor with profile URL input.
 */
export async function scrapeProfileReels(profileUrl, { cutoffDate } = {}) {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error('APIFY_API_TOKEN not configured');

  const client = new ApifyClient({ token });

  const input = {
    username: [profileUrl],
    skipPinnedPosts: false,
    skipTrialReels: false,
    includeSharesCount: false,
    includeTranscript: false,
    includeDownloadedVideo: false,
  };

  if (cutoffDate) {
    input.onlyPostsNewerThan = cutoffDate;
  }

  let run;
  try {
    run = await client.actor('apify/instagram-reel-scraper').call(input);
  } catch (err) {
    console.error('Apify profile scrape failed:', err);
    throw new Error('Instagram сейчас не отдал данные. Попробуй обновить чуть позже.');
  }

  const rawItems = await listAllDatasetItems(client, run.defaultDatasetId);
  const filtered = filterByCutoff(rawItems.filter(i => !isErrorItem(i)), cutoffDate);

  const normalized = [];
  const errors = [];

  for (const item of filtered) {
    try {
      normalized.push(normalizeReelData(item));
    } catch (err) {
      errors.push({ shortcode: item?.shortCode, error: err.message });
    }
  }

  // Dedupe by shortcode before returning to import pipeline.
  const byShortcode = new Map();
  for (const reel of normalized) {
    if (!reel.shortcode) continue;
    byShortcode.set(reel.shortcode, reel);
  }
  const deduped = [...byShortcode.values()];

  if (deduped.length === 0 && rawItems.length > 0 && errors.length === filtered.length) {
    throw new Error('Не удалось обработать Reels профиля. Попробуй позже.');
  }

  return {
    reels: deduped,
    rawCount: rawItems.length,
    skipped: errors.length + (normalized.length - deduped.length),
  };
}
