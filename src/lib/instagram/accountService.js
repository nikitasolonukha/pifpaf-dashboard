import { validateInstagramProfile } from '@/lib/apify/profileValidator.mjs';
import { scrapeProfileReels } from '@/lib/apify/profileScraper.mjs';
import { uploadCover } from '@/lib/apify/cover';
import { throwOnError } from '@/lib/supabase/assert';
import {
  dedupeReelsByShortcode,
  partitionImportReels,
  calcImportViewsDelta,
  buildSyncSummary,
  mapWithConcurrency,
  chunkArray,
} from '@/lib/instagram/profileImport.mjs';
import {
  SYNC_COOLDOWN_MS,
  SYNC_STALE_MS,
  isSyncStale,
  resolveStaleReleaseStatus,
  canStartSync,
} from '@/lib/instagram/syncLock.mjs';

const IMPORT_MONTHS = 12;
const COVER_CONCURRENCY = 5;
const DB_CHUNK_SIZE = 50;

function cutoffDateMonthsAgo(months = IMPORT_MONTHS) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function reelInstagramUrl(shortcode) {
  return `https://www.instagram.com/reel/${shortcode}/`;
}

function mapAccountDbError(error) {
  const msg = String(error?.message || '');
  const code = error?.code || '';

  if (
    code === '42P01' ||
    code === 'PGRST205' ||
    (/instagram_accounts/.test(msg) && /(does not exist|schema cache)/i.test(msg))
  ) {
    return 'База не обновлена. В терминале проекта выполни: npm run db:push';
  }
  if (code === '42501' || /permission denied/i.test(msg)) {
    return 'Нет доступа к instagram_accounts. Примени миграции: npm run db:push';
  }
  console.error('Account DB error:', error);
  return 'Не удалось сохранить аккаунт';
}

export class InstagramAccountService {
  constructor(supabase, userId) {
    this.supabase = supabase;
    this.userId = userId;
  }

  isSyncStale(account) {
    return isSyncStale(account, Date.now(), SYNC_STALE_MS);
  }

  async releaseStaleSync(account) {
    if (!this.isSyncStale(account)) return account;

    const next = resolveStaleReleaseStatus(account);
    const { data, error } = await this.supabase
      .from('instagram_accounts')
      .update({
        ...next,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.id)
      .eq('user_id', this.userId)
      .eq('sync_status', 'syncing')
      .select()
      .maybeSingle();

    if (error) throwOnError({ error }, 'releaseStaleSync');
    return data || { ...account, ...next };
  }

  async getPrimaryAccount() {
    const { data, error } = await this.supabase
      .from('instagram_accounts')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throwOnError({ error }, 'getPrimaryAccount');
    if (!data) return null;
    return this.releaseStaleSync(data);
  }

  async ensureAccountRecord(validation, importSince) {
    const base = {
      user_id: this.userId,
      username: validation.username,
      profile_url: validation.profileUrl,
      import_since: importSince,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: findError } = await this.supabase
      .from('instagram_accounts')
      .select('*')
      .eq('user_id', this.userId)
      .eq('username', validation.username)
      .maybeSingle();

    if (findError) {
      return { account: null, error: mapAccountDbError(findError) };
    }

    if (existing?.id) {
      const { data, error } = await this.supabase
        .from('instagram_accounts')
        .update({
          profile_url: validation.profileUrl,
          import_since: importSince,
          updated_at: base.updated_at,
        })
        .eq('id', existing.id)
        .eq('user_id', this.userId)
        .select()
        .single();
      if (error) return { account: null, error: mapAccountDbError(error) };
      return { account: data, error: null };
    }

    const { data, error } = await this.supabase
      .from('instagram_accounts')
      .insert({
        ...base,
        sync_status: 'ready',
        sync_error: null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        const { data: raced } = await this.supabase
          .from('instagram_accounts')
          .select('*')
          .eq('user_id', this.userId)
          .eq('username', validation.username)
          .maybeSingle();
        if (raced) return { account: raced, error: null };
      }
      return { account: null, error: mapAccountDbError(error) };
    }
    return { account: data, error: null };
  }

  async markAccountError(accountId, message) {
    const { error } = await this.supabase
      .from('instagram_accounts')
      .update({
        sync_status: 'error',
        sync_error: message || 'Ошибка синхронизации',
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId)
      .eq('user_id', this.userId);
    if (error) console.error('markAccountError failed:', error.message);
  }

  async claimAccountSync(accountId) {
    const { data, error } = await this.supabase
      .from('instagram_accounts')
      .update({
        sync_status: 'syncing',
        sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId)
      .eq('user_id', this.userId)
      .neq('sync_status', 'syncing')
      .select('id');

    if (error) throwOnError({ error }, 'claimAccountSync');
    return data?.length > 0;
  }

  async connect(input) {
    const validation = validateInstagramProfile(input);
    if (!validation.valid) {
      return { ok: false, error: validation.error, status: 400 };
    }

    const importSince = cutoffDateMonthsAgo();
    const { account: saved, error: saveError } = await this.ensureAccountRecord(validation, importSince);
    if (saveError || !saved) {
      return { ok: false, error: saveError || 'Не удалось сохранить аккаунт', status: 500 };
    }

    let account = await this.releaseStaleSync(saved);
    const gate = canStartSync(account, { cooldownMs: 0 });
    if (!gate.ok && gate.reason === 'busy') {
      return { ok: false, error: 'Синхронизация уже выполняется', status: 429 };
    }

    const claimed = await this.claimAccountSync(account.id);
    if (!claimed) {
      return { ok: false, error: 'Синхронизация уже выполняется', status: 429 };
    }

    try {
      const summary = await this.runProfileImport(account, importSince);
      return { ok: true, account: summary.account, summary };
    } catch (err) {
      await this.markAccountError(account.id, err.message);
      return { ok: false, error: err.message, status: 502 };
    }
  }

  async sync(accountId) {
    const { data: account, error } = await this.supabase
      .from('instagram_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', this.userId)
      .maybeSingle();

    if (error || !account) {
      return { ok: false, error: 'Аккаунт не найден', status: 404 };
    }

    let activeAccount = await this.releaseStaleSync(account);
    const gate = canStartSync(activeAccount, { cooldownMs: SYNC_COOLDOWN_MS });
    if (!gate.ok) {
      if (gate.reason === 'busy') {
        return { ok: false, error: 'Синхронизация уже выполняется', status: 429 };
      }
      if (gate.reason === 'cooldown') {
        const waitMin = Math.ceil(gate.waitMs / 60000);
        return {
          ok: false,
          error: `Подожди ${waitMin} мин перед следующей синхронизацией`,
          status: 429,
        };
      }
      return { ok: false, error: 'Аккаунт не найден', status: 404 };
    }

    const claimed = await this.claimAccountSync(activeAccount.id);
    if (!claimed) {
      return { ok: false, error: 'Синхронизация уже выполняется', status: 429 };
    }

    const importSince = activeAccount.import_since || cutoffDateMonthsAgo();

    try {
      const summary = await this.runProfileImport(activeAccount, importSince);
      return { ok: true, account: summary.account, summary };
    } catch (err) {
      await this.markAccountError(activeAccount.id, err.message);
      return { ok: false, error: err.message, status: 502 };
    }
  }

  async runProfileImport(account, cutoffDate) {
    const { reels: scrapedRaw } = await scrapeProfileReels(account.profile_url, { cutoffDate });
    const scraped = dedupeReelsByShortcode(scrapedRaw);

    const { data: existingReels, error: existingError } = await this.supabase
      .from('reels')
      .select('id, shortcode, views, cover_url, source_cover_url')
      .eq('user_id', this.userId);

    throwOnError({ error: existingError }, 'load existing reels');

    const byShortcode = {};
    for (const r of existingReels || []) {
      if (r.shortcode) byShortcode[r.shortcode] = r;
    }

    const { toUpdate, toInsert } = partitionImportReels(scraped, byShortcode);
    const now = new Date().toISOString();
    let failedCount = 0;

    const coverJobs = [];
    for (const item of toUpdate) {
      if (
        item.reel.source_cover_url &&
        item.reel.source_cover_url !== item.existing.source_cover_url
      ) {
        coverJobs.push({
          key: item.reel.shortcode,
          sourceUrl: item.reel.source_cover_url,
          shortcode: item.reel.shortcode,
          fallback: item.existing.cover_url,
        });
      }
    }
    for (const item of toInsert) {
      if (item.reel.source_cover_url) {
        coverJobs.push({
          key: item.reel.shortcode,
          sourceUrl: item.reel.source_cover_url,
          shortcode: item.reel.shortcode,
          fallback: item.reel.source_cover_url,
        });
      }
    }

    const coverResults = await mapWithConcurrency(coverJobs, COVER_CONCURRENCY, async (job) => {
      const uploaded = await uploadCover(job.sourceUrl, this.userId, job.shortcode);
      return { key: job.key, coverUrl: uploaded || job.fallback || job.sourceUrl || null };
    });
    const coverByShortcode = Object.fromEntries(coverResults.map(r => [r.key, r.coverUrl]));

    const upsertRows = [];

    for (const { reel, existing } of toUpdate) {
      upsertRows.push({
        id: existing.id,
        user_id: this.userId,
        instagram_account_id: account.id,
        instagram_url: reel.instagram_url_from_apify || reelInstagramUrl(reel.shortcode),
        instagram_reel_id: reel.instagram_reel_id,
        shortcode: reel.shortcode,
        caption: reel.caption,
        owner_username: reel.owner_username || account.username,
        owner_full_name: reel.owner_full_name,
        cover_url: coverByShortcode[reel.shortcode] ?? existing.cover_url,
        source_cover_url: reel.source_cover_url,
        published_at: reel.published_at,
        views: reel.views,
        likes: reel.likes,
        comments: reel.comments,
        sync_status: 'ready',
        sync_error: null,
        last_synced_at: now,
        updated_at: now,
      });
    }

    for (const { reel } of toInsert) {
      upsertRows.push({
        user_id: this.userId,
        instagram_account_id: account.id,
        instagram_url: reel.instagram_url_from_apify || reelInstagramUrl(reel.shortcode),
        instagram_reel_id: reel.instagram_reel_id,
        shortcode: reel.shortcode,
        caption: reel.caption,
        owner_username: reel.owner_username || account.username,
        owner_full_name: reel.owner_full_name,
        cover_url: coverByShortcode[reel.shortcode] || reel.source_cover_url,
        source_cover_url: reel.source_cover_url,
        published_at: reel.published_at,
        views: reel.views,
        likes: reel.likes,
        comments: reel.comments,
        sync_status: 'ready',
        sync_error: null,
        last_synced_at: now,
        updated_at: now,
      });
    }

    const savedRows = [];
    for (const chunk of chunkArray(upsertRows, DB_CHUNK_SIZE)) {
      const { data, error } = await this.supabase
        .from('reels')
        .upsert(chunk, { onConflict: 'user_id,shortcode' })
        .select('id, shortcode, views');

      if (error) {
        console.error('Bulk upsert reels failed:', error);
        continue;
      }
      savedRows.push(...(data || []));
    }

    const savedShortcodes = new Set(savedRows.map(r => r.shortcode));
    failedCount = upsertRows.filter(r => !savedShortcodes.has(r.shortcode)).length;

    const scrapedByShortcode = Object.fromEntries(scraped.map(r => [r.shortcode, r]));
    const snapshots = savedRows.map(row => {
      const src = scrapedByShortcode[row.shortcode];
      return {
        reel_id: row.id,
        views: src?.views ?? row.views ?? 0,
        likes: src?.likes ?? 0,
        comments: src?.comments ?? 0,
      };
    });

    for (const chunk of chunkArray(snapshots, DB_CHUNK_SIZE)) {
      if (!chunk.length) continue;
      const { error } = await this.supabase.from('reel_metric_snapshots').insert(chunk);
      if (error) {
        console.error('Bulk snapshot insert failed:', error);
        failedCount += chunk.length;
        throwOnError({ error }, 'insert snapshots');
      }
    }

    const successfulUpdates = toUpdate.filter(({ reel }) => savedShortcodes.has(reel.shortcode));
    const successfulInserts = toInsert.filter(({ reel }) => savedShortcodes.has(reel.shortcode));
    const viewsDelta = calcImportViewsDelta(successfulUpdates);

    const { data: updatedAccount, error: accountUpdateError } = await this.supabase
      .from('instagram_accounts')
      .update({
        sync_status: failedCount > 0 && savedRows.length === 0 ? 'error' : 'ready',
        sync_error: failedCount > 0 && savedRows.length === 0
          ? 'Не удалось сохранить Reels'
          : failedCount > 0
            ? `Часть Reels не сохранена (${failedCount})`
            : null,
        last_synced_at: now,
        display_name: scraped[0]?.owner_full_name || account.display_name,
        updated_at: now,
      })
      .eq('id', account.id)
      .eq('user_id', this.userId)
      .select()
      .single();

    throwOnError({ error: accountUpdateError }, 'finalize account sync');

    const { error: profileError } = await this.supabase
      .from('profiles')
      .update({ instagram_username: account.username, updated_at: now })
      .eq('id', this.userId);

    if (profileError) console.error('Profile update error:', profileError.message);

    if (savedRows.length === 0 && scraped.length > 0) {
      throw new Error('Не удалось сохранить Reels в базу');
    }

    return buildSyncSummary({
      checked: scraped.length,
      newCount: successfulInserts.length,
      updatedCount: successfulUpdates.length,
      failedCount,
      viewsDelta,
      account: updatedAccount,
    });
  }
}

export { SYNC_COOLDOWN_MS, SYNC_STALE_MS };
