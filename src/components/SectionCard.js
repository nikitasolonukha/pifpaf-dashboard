export default function SectionCard({ title, subtitle, action, children, tint, className = '' }) {
  return (
    <section
      className={`rounded-[var(--radius-lg)] border border-[var(--border-soft)] p-5 md:p-6 shadow-[var(--shadow-soft)] ${className}`}
      style={{ background: tint || 'var(--surface)' }}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          {title && (
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{title}</h2>
              {subtitle && (
                <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  {subtitle}
                </p>
              )}
            </div>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
