'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatViews } from '@/lib/format';

export default function ViewsChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0eeec" />
        <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#77716D' }} />
        <YAxis tickFormatter={formatViews} tick={{ fontSize: 12, fill: '#77716D' }} width={50} />
        <Tooltip formatter={(v) => [formatViews(v), 'Просмотры']} />
        <Line
          type="monotone"
          dataKey="views"
          stroke="#F3C9D4"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#F3C9D4' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
