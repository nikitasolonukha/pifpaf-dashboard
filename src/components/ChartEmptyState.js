import { TrendingUp } from 'lucide-react';

export default function ChartEmptyState({ message, compact = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center rounded-[var(--radius)] border border-dashed border-[var(--border-soft)] ${
        compact ? 'py-10 px-4' : 'py-14 px-6'
      }`}
      style={{ background: 'rgba(255,255,255,0.5)' }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
        style={{ background: 'var(--lavender)' }}
      >
        <TrendingUp size={22} style={{ color: 'var(--text-secondary)', opacity: 0.7 }} />
      </div>
      <p className="text-sm max-w-sm" style={{ color: 'var(--text-secondary)' }}>
        {message}
      </p>
    </div>
  );
}
