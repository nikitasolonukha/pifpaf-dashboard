'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { formatViews } from '@/lib/format';
import { CHART } from './chartTheme';

export default function ReelsByMonthChart({ data, valueKey = 'count', label = 'Reels' }) {
  if (!data?.length) return null;

  const isViews = valueKey === 'views';

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: CHART.axis }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={isViews ? formatViews : v => v}
          tick={{ fontSize: 10, fill: CHART.axis }}
          tickLine={false}
          axisLine={false}
          width={40}
          allowDecimals={false}
        />
        <Tooltip
          formatter={(v) => [isViews ? formatViews(v) : v, label]}
          contentStyle={{
            borderRadius: 12,
            border: `1px solid ${CHART.tooltipBorder}`,
            fontSize: 12,
          }}
        />
        <Bar
          dataKey={valueKey}
          fill={isViews ? CHART.peach : CHART.lavender}
          radius={[6, 6, 0, 0]}
          maxBarSize={36}
          animationDuration={600}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
