'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface WeightData { datum: string; vaha_kg: number; }

export function WeightChart({ data }: { data: WeightData[] }) {
  const formatted = data.map(d => ({
    ...d,
    label: new Date(d.datum).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' }),
  }));

  const weights = data.map(d => d.vaha_kg);
  const min = Math.floor(Math.min(...weights) - 1);
  const max = Math.ceil(Math.max(...weights) + 1);

  return (
    <div className="card !p-2">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={formatted} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false}
            interval={Math.max(0, Math.floor(data.length / 5) - 1)} />
          <YAxis domain={[min, max]} tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false}
            tickFormatter={v => `${v}`} />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: 12 }}
            formatter={(value: number) => [`${value} kg`, 'Váha']}
            labelFormatter={(label: string) => label}
          />
          <Line type="monotone" dataKey="vaha_kg" stroke="#2563EB" strokeWidth={2.5}
            dot={{ r: 2.5, fill: '#2563EB', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#2563EB', strokeWidth: 2, stroke: '#fff' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
