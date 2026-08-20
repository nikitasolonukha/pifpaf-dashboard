export const SYNC_STALE_MS = 10 * 60 * 1000;
export const SYNC_ESTIMATE_SEC = 7 * 60;
export const SYNC_MIN_SEC = 3 * 60;
export const SYNC_MAX_SEC = 10 * 60;

export const SYNC_STAGES = [
  'Запускаем сбор Reels',
  'Получаем данные с Instagram',
  'Сохраняем статистику',
  'Финализируем импорт',
];

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

export function getSyncStage(elapsedSec) {
  if (elapsedSec < 30) return 0;
  if (elapsedSec < 120) return 1;
  if (elapsedSec < 300) return 2;
  return 3;
}

export function getSyncProgress(elapsedSec) {
  const linear = (elapsedSec / SYNC_ESTIMATE_SEC) * 92;
  return Math.min(95, Math.round(linear));
}

export function getSyncEtaText(elapsedSec) {
  if (elapsedSec < SYNC_MIN_SEC) {
    const left = Math.ceil((SYNC_MIN_SEC - elapsedSec) / 60);
    return `Обычно 3–10 минут · минимум ещё ~${left} мин`;
  }
  if (elapsedSec < SYNC_ESTIMATE_SEC) {
    const left = Math.max(1, Math.ceil((SYNC_ESTIMATE_SEC - elapsedSec) / 60));
    return `Осталось примерно ${left} мин`;
  }
  if (elapsedSec < SYNC_MAX_SEC) {
    return 'Почти готово — иногда занимает до 10 минут';
  }
  return 'Дольше обычного — всё ещё работаем, не закрывай страницу';
}
