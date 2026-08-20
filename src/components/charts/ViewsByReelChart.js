'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { formatViews, formatViewsFull, formatDate } from '@/lib/format';
import { CHART } from './chartTheme';

function ReelTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  const coverSrc = d.cover_url || d.source_cover_url;

  return (
    <div
      className="rounded-xl p-3 shadow-lg border text-xs max-w-[min(280px,calc(100vw-2rem))]"
      style={{ background: CHART.tooltipBg, borderColor: CHART.tooltipBorder }}
    >
      <div className="flex gap-3">
        <div className="w-14 h-[72px] rounded-lg overflow-hidden flex-shrink-0 relative bg-[var(--blush)] border border-[var(--border-soft)]">
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverSrc} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              Reel
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold mb-1">#{d.rank} · {formatViewsFull(d.views)}</p>
          {d.published_at && (
            <p className="mb-1" style={{ color: 'var(--text-secondary)' }}>
              {formatDate(d.published_at)}
            </p>
          )}
          {d.caption ? (
            <p className="line-clamp-3 leading-snug" style={{ color: 'var(--text-secondary)' }}>
              {d.caption}
            </p>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>{d.shortcode || 'Reel'}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ViewsByReelChart({ data }) {
  if (!data?.length) return null;

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: CHART.axis }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis
            tickFormatter={formatViews}
            tick={{ fontSize: 10, fill: CHART.axis }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            content={<ReelTooltip />}
            cursor={{ fill: 'rgba(243,201,212,0.15)' }}
            wrapperStyle={{ zIndex: 20, outline: 'none' }}
          />
          <Bar dataKey="views" radius={[6, 6, 0, 0]} maxBarSize={28} animationDuration={600}>
            {data.map((entry, i) => (
              <Cell key={entry.id || i} fill={i === 0 ? CHART.pinkDark : CHART.pink} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
