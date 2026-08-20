import { validateInstagramProfile } from '@/lib/apify/profileValidator.mjs';
import { scrapeProfileReels } from '@/lib/apify/profileScraper.mjs';
import { uploadCover } from '@/lib/apify/cover';

const SYNC_COOLDOWN_MS = 3 * 60 * 1000;
const SYNC_STALE_MS = 10 * 60 * 1000;
const IMPORT_MONTHS = 12;

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
    /instagram_accounts/.test(msg) && /(does not exist|schema cache)/i.test(msg)
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
    if (!account || account.sync_status !== 'syncing') return false;
    const updatedAt = account.updated_at || account.created_at;
    if (!updatedAt) return true;
    return Date.now() - new Date(updatedAt).getTime() > SYNC_STALE_MS;
  }

  async releaseStaleSync(account) {
    if (!this.isSyncStale(account)) return account;

    const nextStatus = account.last_synced_at ? 'ready' : 'error';
    const syncError = nextStatus === 'error'
      ? 'Синхронизация прервана. Нажми «Синхронизировать» снова.'
      : null;

    const { data } = await this.supabase
      .from('instagram_accounts')
      .update({
        sync_status: nextStatus,
        sync_error: syncError,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.id)
      .eq('user_id', this.userId)
      .eq('sync_status', 'syncing')
      .select()
      .maybeSingle();

    return data || { ...account, sync_status: nextStatus, sync_error: syncError };
  }

  async getPrimaryAccount() {
    const { data } = await this.supabase
      .from('instagram_accounts')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    return this.releaseStaleSync(data);
  }

  async saveAccountRecord(validation, importSince) {
    const payload = {
      user_id: this.userId,
      username: validation.username,
      profile_url: validation.profileUrl,
      import_since: importSince,
      sync_status: 'syncing',
      sync_error: null,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: findError } = await this.supabase
      .from('instagram_accounts')
      .select('id')
      .eq('user_id', this.userId)
      .eq('username', validation.username)
      .maybeSingle();

    if (findError) {
      return { account: null, error: mapAccountDbError(findError) };
    }

    if (existing?.id) {
      const { data, error } = await this.supabase
        .from('instagram_accounts')
        .update(payload)
        .eq('id', existing.id)
        .eq('user_id', this.userId)
        .select()
        .single();
      if (error) return { account: null, error: mapAccountDbError(error) };
      return { account: data, error: null };
    }

    const { data, error } = await this.supabase
      .from('instagram_accounts')
      .insert(payload)
      .select()
      .single();

    if (error) return { account: null, error: mapAccountDbError(error) };
    return { account: data, error: null };
  }

  async connect(input) {
    const validation = validateInstagramProfile(input);
    if (!validation.valid) {
      return { ok: false, error: validation.error, status: 400 };
    }

    const importSince = cutoffDateMonthsAgo();
    const { account, error: saveError } = await this.saveAccountRecord(validation, importSince);

    if (saveError || !account) {
      return { ok: false, error: saveError || 'Не удалось сохранить аккаунт', status: 500 };
    }

    try {
      const summary = await this.runProfileImport(account, importSince);
      return { ok: true, account: summary.account, summary };
    } catch (err) {
      await this.supabase
        .from('instagram_accounts')
        .update({ sync_status: 'error', sync_error: err.message })
        .eq('id', account.id);
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

    const activeAccount = await this.releaseStaleSync(account);

    if (activeAccount.sync_status === 'syncing') {
      return { ok: false, error: 'Синхронизация уже выполняется', status: 429 };
    }

    if (activeAccount.last_synced_at) {
      const elapsed = Date.now() - new Date(activeAccount.last_synced_at).getTime();
      if (elapsed < SYNC_COOLDOWN_MS) {
        const waitMin = Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 60000);
        return {
          ok: false,
          error: `Подожди ${waitMin} мин перед следующей синхронизацией`,
          status: 429,
        };
      }
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
      await this.supabase
        .from('instagram_accounts')
        .update({ sync_status: 'error', sync_error: err.message })
        .eq('id', activeAccount.id);
      return { ok: false, error: err.message, status: 502 };
    }
  }

  async claimAccountSync(accountId) {
    const { data } = await this.supabase
      .from('instagram_accounts')
      .update({ sync_status: 'syncing', sync_error: null, updated_at: new Date().toISOString() })
      .eq('id', accountId)
      .eq('user_id', this.userId)
      .neq('sync_status', 'syncing')
      .select('id');
    return data?.length > 0;
  }

  async runProfileImport(account, cutoffDate) {
    const { reels: scraped } = await scrapeProfileReels(account.profile_url, { cutoffDate });

    const { data: existingReels } = await this.supabase
      .from('reels')
      .select('id, shortcode, views, cover_url, source_cover_url')
      .eq('user_id', this.userId);

    const byShortcode = {};
    for (const r of existingReels || []) {
      if (r.shortcode) byShortcode[r.shortcode] = r;
    }

    let newCount = 0;
    let updatedCount = 0;
    let viewsDelta = 0;
    const now = new Date().toISOString();

    for (const reelData of scraped) {
      const shortcode = reelData.shortcode;
      if (!shortcode) continue;

      const existing = byShortcode[shortcode];
      const instagramUrl = reelData.instagram_url_from_apify || reelInstagramUrl(shortcode);

      if (existing) {
        const prevViews = Number(existing.views ?? 0);
        viewsDelta += Number(reelData.views ?? 0) - prevViews;

        let coverUrl = existing.cover_url;
        if (reelData.source_cover_url && reelData.source_cover_url !== existing.source_cover_url) {
          const uploaded = await uploadCover(reelData.source_cover_url, this.userId, shortcode);
          coverUrl = uploaded || reelData.source_cover_url || existing.cover_url;
        }

        await this.supabase
          .from('reels')
          .update({
            caption: reelData.caption,
            owner_username: reelData.owner_username || account.username,
            owner_full_name: reelData.owner_full_name,
            cover_url: coverUrl,
            source_cover_url: reelData.source_cover_url,
            published_at: reelData.published_at,
            views: reelData.views,
            likes: reelData.likes,
            comments: reelData.comments,
            instagram_account_id: account.id,
            sync_status: 'ready',
            sync_error: null,
            last_synced_at: now,
            updated_at: now,
          })
          .eq('id', existing.id);

        await this.supabase.from('reel_metric_snapshots').insert({
          reel_id: existing.id,
          views: reelData.views,
          likes: reelData.likes,
          comments: reelData.comments,
        });

        updatedCount += 1;
      } else {
        const coverUrl = await uploadCover(reelData.source_cover_url, this.userId, shortcode);

        const { data: inserted, error: insertError } = await this.supabase
          .from('reels')
          .insert({
            user_id: this.userId,
            instagram_account_id: account.id,
            instagram_url: instagramUrl,
            instagram_reel_id: reelData.instagram_reel_id,
            shortcode,
            caption: reelData.caption,
            owner_username: reelData.owner_username || account.username,
            owner_full_name: reelData.owner_full_name,
            cover_url: coverUrl || reelData.source_cover_url,
            source_cover_url: reelData.source_cover_url,
            published_at: reelData.published_at,
            views: reelData.views,
            likes: reelData.likes,
            comments: reelData.comments,
            sync_status: 'ready',
            last_synced_at: now,
          })
          .select('id')
          .single();

        if (insertError) {
          if (insertError.code === '23505') {
            updatedCount += 1;
            continue;
          }
          console.error('Insert reel error:', insertError);
          continue;
        }

        await this.supabase.from('reel_metric_snapshots').insert({
          reel_id: inserted.id,
          views: reelData.views,
          likes: reelData.likes,
          comments: reelData.comments,
        });

        byShortcode[shortcode] = inserted;
        newCount += 1;
      }
    }

    const { data: updatedAccount } = await this.supabase
      .from('instagram_accounts')
      .update({
        sync_status: 'ready',
        sync_error: null,
        last_synced_at: now,
        display_name: scraped[0]?.owner_full_name || account.display_name,
        updated_at: now,
      })
      .eq('id', account.id)
      .select()
      .single();

    await this.supabase
      .from('profiles')
      .update({ instagram_username: account.username, updated_at: now })
      .eq('id', this.userId);

    return {
      account: updatedAccount,
      checked: scraped.length,
      newCount,
      updatedCount,
      viewsDelta,
      imported: scraped.length,
    };
  }
}
