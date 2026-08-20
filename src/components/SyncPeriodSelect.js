'use client';

import SoftSelect from '@/components/SoftSelect';
import { SYNC_PERIODS, DEFAULT_SYNC_PERIOD } from '@/lib/instagram/syncPeriods.mjs';

const OPTIONS = SYNC_PERIODS.map((p) => ({ value: p.id, label: p.label }));

export default function SyncPeriodSelect({
  value = DEFAULT_SYNC_PERIOD,
  onChange,
  disabled = false,
  className = '',
  id,
}) {
  return (
    <SoftSelect
      id={id}
      value={value}
      onChange={onChange}
      options={OPTIONS}
      disabled={disabled}
      className={className}
      aria-label="Период синхронизации"
    />
  );
}
