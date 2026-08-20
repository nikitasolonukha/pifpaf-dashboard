'use client';

import SoftSelect from '@/components/SoftSelect';

/**
 * Compact switcher of Instagram profiles.
 */
export default function AccountSwitcher({ accounts = [], value, onChange, className = '' }) {
  if (!accounts?.length) return null;
  if (accounts.length === 1) {
    return (
      <span className={`text-sm font-semibold ${className}`}>
        @{accounts[0].username}
      </span>
    );
  }

  const options = accounts.map((a) => ({
    value: a.id,
    label: `@${a.username}`,
  }));

  return (
    <SoftSelect
      className={`max-w-[16rem] ${className}`}
      value={value || accounts[0].id}
      onChange={onChange}
      options={options}
      aria-label="Instagram профиль"
      buttonClassName="font-semibold w-full"
    />
  );
}
