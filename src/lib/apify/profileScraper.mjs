import { ApifyClient } from 'apify-client';
import { normalizeReelData } from './instagramNormalization.mjs';

/** Apify default is often ~10 — too low for multi-month profile imports. */
const DEFAULT_RESULTS_LIMIT = 500;

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

/** Apify schema accepts YYYY-MM-DD (full ISO timestamps can be rejected). */
export function normalizeCutoffDate(cutoffDate) {
  if (!cutoffDate) return null;
  const raw = String(cutoffDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
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

function resultsLimitForCutoff(cutoffDate) {
  if (!cutoffDate) return DEFAULT_RESULTS_LIMIT;
  const cutoff = new Date(cutoffDate + 'T00:00:00.000Z');
  if (Number.isNaN(cutoff.getTime())) return DEFAULT_RESULTS_LIMIT;
  const days = Math.max(1, Math.round((Date.now() - cutoff.getTime()) / 86400000));
  if (days <= 40) return 80;
  if (days <= 110) return 200;
  if (days <= 200) return 350;
  return DEFAULT_RESULTS_LIMIT;
}

/**
 * Scrape all reels from an Instagram profile for the given period.
 * Uses the same apify/instagram-reel-scraper actor with profile URL input.
 */
export async function scrapeProfileReels(profileUrl, { cutoffDate } = {}) {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error('APIFY_API_TOKEN not configured');

  const client = new ApifyClient({ token });
  const cutoff = normalizeCutoffDate(cutoffDate);

  const input = {
    username: [profileUrl],
    resultsLimit: resultsLimitForCutoff(cutoff),
    skipPinnedPosts: false,
    skipTrialReels: false,
    includeSharesCount: false,
    includeTranscript: false,
    includeDownloadedVideo: false,
  };

  if (cutoff) {
    input.onlyPostsNewerThan = cutoff;
  }

  let run;
  try {
    run = await client.actor('apify/instagram-reel-scraper').call(input);
  } catch (err) {
    console.error('Apify profile scrape failed:', err);
    throw new Error('Instagram сейчас не отдал данные. Попробуй обновить чуть позже.');
  }

  const rawItems = await listAllDatasetItems(client, run.defaultDatasetId);
  const filtered = filterByCutoff(rawItems.filter(i => !isErrorItem(i)), cutoff);

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
  const deduped = [...byShortcode.values()].sort((a, b) => {
    const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
    const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
    return tb - ta;
  });

  if (deduped.length === 0 && rawItems.length > 0 && errors.length === filtered.length) {
    throw new Error('Не удалось обработать Reels профиля. Попробуй позже.');
  }

  return {
    reels: deduped,
    rawCount: rawItems.length,
    skipped: errors.length + (normalized.length - deduped.length),
  };
}
