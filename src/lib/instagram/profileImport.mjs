/**
 * Pure helpers for profile import: dedupe, partition, summary.
 */

/** Keep last occurrence per shortcode (Apify may repeat items). */
export function dedupeReelsByShortcode(reels) {
  const map = new Map();
  for (const reel of reels || []) {
    const shortcode = reel?.shortcode;
    if (!shortcode) continue;
    map.set(shortcode, reel);
  }
  return [...map.values()];
}

export function partitionImportReels(scraped, existingByShortcode) {
  const toUpdate = [];
  const toInsert = [];
  for (const reel of scraped || []) {
    const existing = existingByShortcode?.[reel.shortcode];
    if (existing) toUpdate.push({ reel, existing });
    else toInsert.push({ reel });
  }
  return { toUpdate, toInsert };
}

export function calcImportViewsDelta(toUpdate) {
  let viewsDelta = 0;
  for (const { reel, existing } of toUpdate || []) {
    viewsDelta += Number(reel.views ?? 0) - Number(existing.views ?? 0);
  }
  return viewsDelta;
}

export function buildSyncSummary({
  checked = 0,
  newCount = 0,
  updatedCount = 0,
  failedCount = 0,
  viewsDelta = 0,
  account = null,
} = {}) {
  return {
    checked,
    newCount,
    updatedCount,
    failedCount,
    viewsDelta,
    imported: newCount + updatedCount,
    partial: failedCount > 0,
    account,
  };
}

export async function mapWithConcurrency(items, concurrency, mapper) {
  const list = items || [];
  const limit = Math.max(1, Math.min(concurrency || 1, list.length || 1));
  const results = new Array(list.length);
  let cursor = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= list.length) break;
        results[index] = await mapper(list[index], index);
      }
    })
  );

  return results;
}

export function chunkArray(items, size = 50) {
  const out = [];
  const list = items || [];
  const chunkSize = Math.max(1, size);
  for (let i = 0; i < list.length; i += chunkSize) {
    out.push(list.slice(i, i + chunkSize));
  }
  return out;
}
