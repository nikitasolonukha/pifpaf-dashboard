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

export function buildReelUpsertRow({
  reel,
  existing = null,
  account,
  userId,
  coverUrl,
  now,
}) {
  return {
    // Never pass `id` — conflict is (user_id, shortcode); Postgres keeps/creates UUID.
    user_id: userId,
    instagram_account_id: account.id,
    instagram_url: reel.instagram_url_from_apify
      || (reel.shortcode ? `https://www.instagram.com/reel/${reel.shortcode}/` : null),
    instagram_reel_id: reel.instagram_reel_id ?? null,
    shortcode: reel.shortcode,
    caption: reel.caption ?? null,
    owner_username: reel.owner_username || account.username,
    owner_full_name: reel.owner_full_name ?? null,
    cover_url: coverUrl ?? existing?.cover_url ?? reel.source_cover_url ?? null,
    source_cover_url: reel.source_cover_url ?? null,
    published_at: reel.published_at ?? null,
    views: reel.views ?? 0,
    likes: reel.likes ?? 0,
    comments: reel.comments ?? 0,
    sync_status: 'ready',
    sync_error: null,
    last_synced_at: now,
    updated_at: now,
  };
}

export function filterScrapedForAccount(reels, accountUsername) {
  const uname = String(accountUsername || '').toLowerCase();
  return (reels || []).filter((reel) => {
    if (!reel?.owner_username) return true;
    return String(reel.owner_username).toLowerCase() === uname;
  });
}

export function assertSingleAccountConnect(primary, nextUsername) {
  if (!primary) return { ok: true };
  if (String(primary.username).toLowerCase() === String(nextUsername).toLowerCase()) {
    return { ok: true, same: true, account: primary };
  }
  return {
    ok: false,
    status: 409,
    error: 'Instagram уже подключён',
  };
}

export function scopeReelsToAccount(reels, account) {
  if (!account?.id) return reels || [];
  const uname = String(account.username || '').toLowerCase();
  return (reels || []).filter((r) => {
    if (r.instagram_account_id === account.id) return true;
    if (!r.instagram_account_id && r.owner_username
      && String(r.owner_username).toLowerCase() === uname) {
      return true;
    }
    return false;
  });
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
