export const SYNC_STALE_MS = 10 * 60 * 1000;

export function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function isSyncInProgress(account, syncing = false) {
  if (syncing) return true;
  if (!account || account.sync_status !== 'syncing') return false;
  const updatedAt = account.updated_at || account.created_at;
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() <= SYNC_STALE_MS;
}
