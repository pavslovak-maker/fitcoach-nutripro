'use client';

export function MacroRing({ current, target, size = 48 }: { current: number; target: number; size?: number }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(current / target, 1);
  const offset = circ * (1 - pct);
  const color = pct >= 1 ? '#D97706' : pct >= 0.8 ? '#059669' : '#2563EB';

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size/2} cy={size/2} r={r} stroke="#E2E8F0" strokeWidth={stroke} fill="none" />
      <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} className="transition-all duration-500" />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" className="text-[10px] font-semibold fill-slate-500">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}
