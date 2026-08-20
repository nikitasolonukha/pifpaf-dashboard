'use client';

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { formatViews, formatViewsFull } from '@/lib/format';
import { CHART } from './chartTheme';
import ChartEmptyState from '@/components/ChartEmptyState';

export default function GrowthChart({ data, hasGrowth }) {
  if (!data?.length) {
    return (
      <ChartEmptyState
        compact
        message="История появится после первой синхронизации"
      />
    );
  }

  if (!hasGrowth && data.length === 1) {
    return (
      <div className="py-8 px-4 text-center rounded-[var(--radius)] border border-dashed border-[var(--border-soft)]" style={{ background: 'rgba(255,255,255,0.5)' }}>
        <p className="text-sm font-medium mb-1">История уже началась ✨</p>
        <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Синхронизируй профиль позже ещё раз — и здесь появится линия роста.
        </p>
        <p className="text-2xl font-semibold mt-4">{formatViews(data[0].views)}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>отслеживаемых просмотров · {data[0].date}</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.pink} stopOpacity={0.45} />
            <stop offset="100%" stopColor={CHART.pink} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: CHART.axis }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={formatViews} tick={{ fontSize: 10, fill: CHART.axis }} tickLine={false} axisLine={false} width={44} />
        <Tooltip
          formatter={(v) => [formatViewsFull(v), '']}
          contentStyle={{ borderRadius: 12, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 12 }}
        />
        <Area
          type="monotone"
          dataKey="views"
          stroke={CHART.pinkDark}
          strokeWidth={2.5}
          fill="url(#growthFill)"
          dot={{ r: 3, fill: CHART.pinkDark }}
          activeDot={{ r: 5 }}
          animationDuration={700}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
