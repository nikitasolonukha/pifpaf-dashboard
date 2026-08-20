export const SYNC_COOLDOWN_MS = 3 * 60 * 1000;
export const SYNC_STALE_MS = 10 * 60 * 1000;

export function isSyncStale(account, now = Date.now(), staleMs = SYNC_STALE_MS) {
  if (!account || account.sync_status !== 'syncing') return false;
  const updatedAt = account.updated_at || account.created_at;
  if (!updatedAt) return true;
  return now - new Date(updatedAt).getTime() > staleMs;
}

export function resolveStaleReleaseStatus(account) {
  if (account?.last_synced_at) {
    return { sync_status: 'ready', sync_error: null };
  }
  return {
    sync_status: 'error',
    sync_error: 'Синхронизация прервана. Нажми «Синхронизировать» снова.',
  };
}

export function canStartSync(account, { now = Date.now(), cooldownMs = SYNC_COOLDOWN_MS } = {}) {
  if (!account) return { ok: false, reason: 'not_found', status: 404 };
  if (account.sync_status === 'syncing' && !isSyncStale(account, now)) {
    return { ok: false, reason: 'busy', status: 429 };
  }
  if (account.last_synced_at) {
    const elapsed = now - new Date(account.last_synced_at).getTime();
    if (elapsed < cooldownMs) {
      return {
        ok: false,
        reason: 'cooldown',
        status: 429,
        waitMs: cooldownMs - elapsed,
      };
    }
  }
  return { ok: true };
}
