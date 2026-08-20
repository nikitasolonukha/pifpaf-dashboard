'use client';

const DEFAULT_OPTIONS = [
  { id: 'all', label: 'Все' },
  { id: 'recent', label: 'Последние' },
  { id: 'best', label: 'Лучшие' },
  { id: 'growing', label: 'Растут' },
];

export default function FilterChips({ value, onChange, options = DEFAULT_OPTIONS }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              active
                ? 'border-transparent shadow-sm'
                : 'border-[var(--border-soft)] bg-white/60 hover:bg-white'
            }`}
            style={{
              background: active ? 'var(--pink-bg)' : undefined,
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
