/** Allowed Instagram import/sync lookback windows. */
export const SYNC_PERIODS = [
  { id: '30d', label: '30 дней', days: 30 },
  { id: '3m', label: '3 месяца', months: 3 },
  { id: '6m', label: '6 месяцев', months: 6 },
  { id: '12m', label: '12 месяцев', months: 12 },
];

export const DEFAULT_SYNC_PERIOD = '12m';

const BY_ID = Object.fromEntries(SYNC_PERIODS.map((p) => [p.id, p]));

export function isValidSyncPeriod(periodId) {
  return Boolean(periodId && BY_ID[periodId]);
}

export function getSyncPeriod(periodId) {
  return BY_ID[periodId] || BY_ID[DEFAULT_SYNC_PERIOD];
}

export function cutoffDateForPeriod(periodId, now = new Date()) {
  const period = getSyncPeriod(periodId);
  const d = new Date(now);
  if (period.days) {
    d.setUTCDate(d.getUTCDate() - period.days);
  } else {
    d.setUTCMonth(d.getUTCMonth() - (period.months || 12));
  }
  return d.toISOString().slice(0, 10);
}

export function labelForImportSince(importSince, now = new Date()) {
  if (!importSince) return getSyncPeriod(DEFAULT_SYNC_PERIOD).label;
  const since = new Date(`${importSince}T00:00:00.000Z`);
  if (Number.isNaN(since.getTime())) return getSyncPeriod(DEFAULT_SYNC_PERIOD).label;
  const days = Math.max(0, Math.round((now - since) / 86400000));
  if (days <= 40) return '30 дней';
  if (days <= 110) return '3 месяца';
  if (days <= 200) return '6 месяцев';
  return '12 месяцев';
}
