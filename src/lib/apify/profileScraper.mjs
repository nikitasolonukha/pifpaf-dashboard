import { ApifyClient } from 'apify-client';
import { normalizeReelData } from './instagramNormalization.mjs';

/** Apify default is often ~10 — too low for multi-month profile imports. */
const DEFAULT_RESULTS_LIMIT = 500;
const ACTOR_ID = 'apify/instagram-reel-scraper';

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

function buildActorInput(profileUrl, cutoff) {
  const input = {
    username: [profileUrl],
    resultsLimit: resultsLimitForCutoff(cutoff),
    skipPinnedPosts: false,
    skipTrialReels: false,
    includeSharesCount: false,
    includeTranscript: false,
    includeDownloadedVideo: false,
  };
  if (cutoff) input.onlyPostsNewerThan = cutoff;
  return input;
}

function normalizeDatasetItems(rawItems, cutoff) {
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

function getClient() {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error('APIFY_API_TOKEN not configured');
  return new ApifyClient({ token });
}

/** Start Apify run without waiting (Vercel-safe). */
export async function startProfileReelsScrape(profileUrl, { cutoffDate } = {}) {
  const client = getClient();
  const cutoff = normalizeCutoffDate(cutoffDate);
  try {
    const run = await client.actor(ACTOR_ID).start(buildActorInput(profileUrl, cutoff));
    return {
      runId: run.id,
      datasetId: run.defaultDatasetId,
      cutoff,
    };
  } catch (err) {
    console.error('Apify profile scrape start failed:', err);
    throw new Error('Instagram сейчас не отдал данные. Попробуй обновить чуть позже.');
  }
}

/** Check Apify run; if succeeded, return normalized reels. */
export async function collectProfileReelsRun(runId, datasetId, { cutoffDate } = {}) {
  const client = getClient();
  const cutoff = normalizeCutoffDate(cutoffDate);
  const run = await client.run(runId).get();
  const status = run?.status || 'UNKNOWN';

  if (status === 'RUNNING' || status === 'READY' || status === 'PENDING') {
    return { status: 'running', reels: null };
  }
  if (status !== 'SUCCEEDED') {
    return { status: 'failed', reels: null, error: `Apify status: ${status}` };
  }

  const rawItems = await listAllDatasetItems(client, datasetId || run.defaultDatasetId);
  const normalized = normalizeDatasetItems(rawItems, cutoff);
  return { status: 'succeeded', ...normalized };
}

/**
 * Scrape all reels from an Instagram profile for the given period (blocking).
 * Prefer start+collect on serverless hosts with short timeouts.
 */
export async function scrapeProfileReels(profileUrl, { cutoffDate } = {}) {
  const client = getClient();
  const cutoff = normalizeCutoffDate(cutoffDate);

  let run;
  try {
    run = await client.actor(ACTOR_ID).call(buildActorInput(profileUrl, cutoff));
  } catch (err) {
    console.error('Apify profile scrape failed:', err);
    throw new Error('Instagram сейчас не отдал данные. Попробуй обновить чуть позже.');
  }

  const rawItems = await listAllDatasetItems(client, run.defaultDatasetId);
  return normalizeDatasetItems(rawItems, cutoff);
}

export const APIFY_PENDING_PREFIX = '__apify__:';

export function encodeApifyPending({ runId, datasetId, cutoff }) {
  return `${APIFY_PENDING_PREFIX}${runId}|${datasetId || ''}|${cutoff || ''}`;
}

export function decodeApifyPending(syncError) {
  if (!syncError || !String(syncError).startsWith(APIFY_PENDING_PREFIX)) return null;
  const raw = String(syncError).slice(APIFY_PENDING_PREFIX.length);
  const [runId, datasetId, cutoff] = raw.split('|');
  if (!runId) return null;
  return { runId, datasetId: datasetId || null, cutoff: cutoff || null };
}

export function sanitizeAccountForClient(account) {
  if (!account) return account;
  if (account.sync_error && String(account.sync_error).startsWith(APIFY_PENDING_PREFIX)) {
    return { ...account, sync_error: null };
  }
  return account;
}
