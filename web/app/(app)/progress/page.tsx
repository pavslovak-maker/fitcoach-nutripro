'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { WeightChart } from '@/components/charts/WeightChart';

type Range = '7d' | '30d' | '90d';

export default function ProgressPage() {
  const [range, setRange] = useState<Range>('30d');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      const from = new Date(); from.setDate(from.getDate() - days);
      try {
        const res = await api.get(`/progress?from=${from.toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}`);
        setData(res);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [range]);

  if (loading) return <div className="flex justify-center pt-20"><div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!data) return null;

  return (
    <div className="px-5 pt-8 pb-24 animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Progress</h1>

      {/* Range picker */}
      <div className="flex gap-2 mb-6">
        {(['7d', '30d', '90d'] as Range[]).map(r => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              range === r ? 'bg-brand-500 text-white' : 'bg-surface text-slate-400'
            }`}>
            {r === '7d' ? '7 dní' : r === '30d' ? '30 dní' : '90 dní'}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        <div className="card text-center">
          <p className="text-[11px] text-slate-400">Start</p>
          <p className="text-lg font-bold">{data.vaha_start ?? '—'}<span className="text-xs text-slate-400 ml-0.5">kg</span></p>
        </div>
        <div className="card text-center">
          <p className="text-[11px] text-slate-400">Teď</p>
          <p className="text-lg font-bold">{data.vaha_end ?? '—'}<span className="text-xs text-slate-400 ml-0.5">kg</span></p>
        </div>
        <div className="card text-center">
          <p className="text-[11px] text-slate-400">Změna</p>
          <p className={`text-lg font-bold ${
            data.vaha_zmena < 0 ? 'text-success' : data.vaha_zmena > 0 ? 'text-danger' : ''
          }`}>
            {data.vaha_zmena != null ? `${data.vaha_zmena > 0 ? '+' : ''}${data.vaha_zmena}` : '—'}
            <span className="text-xs text-slate-400 ml-0.5">kg</span>
          </p>
        </div>
      </div>

      {/* Chart */}
      {data.vaha_historie?.length >= 2 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-2">Trend váhy</h2>
          <WeightChart data={data.vaha_historie} />
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        <MetricCard icon="🏋️" label="Tréninky" value={`${data.pocet_treninku}`} />
        <MetricCard icon="💤" label="Ø Spánek" value={data.prumerny_spanek ? `${data.prumerny_spanek}h` : '—'}
          good={data.prumerny_spanek >= 7} />
        <MetricCard icon="⚡" label="Ø Energie" value={data.prumerna_energie ? `${data.prumerna_energie}/5` : '—'}
          good={data.prumerna_energie >= 3.5} />
      </div>

      {/* Weekly analyses */}
      {data.tydenni_analyzy?.length > 0 && (
        <div>
          <h2 className="font-semibold mb-2">Týdenní přehledy</h2>
          <div className="space-y-2">
            {data.tydenni_analyzy.slice(-4).reverse().map((wa: any) => (
              <div key={wa.id} className="card">
                <p className="text-sm font-medium text-slate-700 mb-1">
                  {new Date(wa.tyden_od).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })} –{' '}
                  {new Date(wa.tyden_do).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}
                </p>
                {wa.pozitivni_pozorovani && <p className="text-xs text-success">✓ {wa.pozitivni_pozorovani}</p>}
                {wa.vyzvy && <p className="text-xs text-warning">⚠ {wa.vyzvy}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, good }: { icon: string; label: string; value: string; good?: boolean }) {
  return (
    <div className="card text-center">
      <span className="text-xl">{icon}</span>
      <p className="text-lg font-bold mt-1">{value}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
      {good != null && (
        <p className={`text-[10px] font-medium mt-0.5 ${good ? 'text-success' : 'text-warning'}`}>
          {good ? 'OK' : 'nízké'}
        </p>
      )}
    </div>
  );
}
