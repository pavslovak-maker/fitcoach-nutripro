'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { MacroRing } from '@/components/ui/MacroRing';
import type { TodayResponse } from '@/lib/types';

const dayNames: Record<string, string> = {
  po: 'Pondělí', ut: 'Úterý', st: 'Středa',
  ct: 'Čtvrtek', pa: 'Pátek', so: 'Sobota', ne: 'Neděle',
};

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchToday = useCallback(async () => {
    try {
      const res = await api.get<TodayResponse>('/today');
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const planDay = data.trenink.plan_day;
  const isTraining = data.trenink.je_treninkovy_den;

  return (
    <div className="px-5 pt-8 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{dayNames[data.den_v_tydnu]}</h1>
        <p className="text-slate-500 text-sm">{formatDate(data.datum)}</p>
      </div>

      {/* Alerts */}
      {data.upozorneni.length > 0 && (
        <div className="space-y-2 mb-5">
          {data.upozorneni.map((alert, i) => (
            <button
              key={i}
              onClick={() => {
                if (alert.includes('check-in')) router.push('/checkin');
                if (alert.includes('trénink')) router.push('/workout');
              }}
              className="w-full text-left bg-warning-light border-l-3 border-warning rounded-xl px-4 py-3 text-sm text-warning-dark"
            >
              {alert}
            </button>
          ))}
        </div>
      )}

      {/* Check-in CTA */}
      {!data.checkin.vyplnen && (
        <button
          onClick={() => router.push('/checkin')}
          className="w-full flex items-center gap-4 bg-brand-50 rounded-2xl p-4 mb-6 text-left hover:bg-brand-100 transition-colors"
        >
          <span className="text-3xl">☀️</span>
          <div className="flex-1">
            <p className="font-semibold text-brand-500">Ranní check-in</p>
            <p className="text-xs text-brand-700/70">30 sekund — jak se dnes cítíš?</p>
          </div>
          <span className="text-2xl text-brand-400">›</span>
        </button>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        <StatCard
          label="Váha"
          value={data.stats.vaha_aktualni ? `${data.stats.vaha_aktualni}` : '—'}
          unit="kg"
          trend={data.stats.vaha_zmena}
        />
        <StatCard
          label="Spánek"
          value={data.stats.spanek_prumer_7d ? `${data.stats.spanek_prumer_7d}` : '—'}
          unit="h"
          good={data.stats.spanek_prumer_7d != null && data.stats.spanek_prumer_7d >= 7}
        />
        <StatCard
          label="Energie"
          value={data.stats.energie_prumer_7d ? `${data.stats.energie_prumer_7d}` : '—'}
          unit="/5"
          good={data.stats.energie_prumer_7d != null && data.stats.energie_prumer_7d >= 3.5}
        />
      </div>

      {/* Training */}
      <section className="mb-6">
        <h2 className="font-semibold text-slate-900 mb-2.5">Trénink</h2>
        {isTraining && planDay ? (
          <button
            onClick={() => router.push('/workout')}
            className="w-full card text-left hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-center mb-3">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-md ${
                planDay.typ_dne === 'hard' ? 'bg-danger-light text-danger' :
                planDay.typ_dne === 'medium' ? 'bg-warning-light text-warning' :
                'bg-success-light text-success'
              }`}>
                {planDay.typ_dne === 'hard' ? 'Těžký' : planDay.typ_dne === 'medium' ? 'Střední' : 'Lehký'}
              </span>
              <span className="text-xs text-slate-400">{planDay.delka_min} min</span>
            </div>
            {planDay.exercises?.slice(0, 4).map((ex: any) => (
              <div key={ex.id} className="flex justify-between py-1">
                <span className="text-sm text-slate-700">{ex.cvik}</span>
                <span className="text-xs text-slate-400">{ex.serie}×{ex.opakovani}</span>
              </div>
            ))}
            <div className="border-t border-slate-100 mt-3 pt-2.5 text-center">
              <span className={`text-sm font-medium ${data.trenink.uz_zaznamenan ? 'text-success' : 'text-brand-500'}`}>
                {data.trenink.uz_zaznamenan ? '✓ Splněno' : 'Zaznamenat trénink →'}
              </span>
            </div>
          </button>
        ) : (
          <div className="card text-center py-8">
            <span className="text-4xl">🧘</span>
            <p className="font-semibold text-slate-700 mt-2">Odpočinkový den</p>
            <p className="text-xs text-slate-400 mt-1">Procházka, stretching, sauna</p>
          </div>
        )}
      </section>

      {/* Nutrition */}
      <section className="mb-6">
        <div className="flex justify-between items-center mb-2.5">
          <h2 className="font-semibold text-slate-900">Strava</h2>
          <MacroRing current={data.jidlo.kalorie_celkem} target={data.jidlo.kalorie_cil} size={44} />
        </div>
        <p className="text-sm text-slate-500 mb-3">
          {data.jidlo.kalorie_celkem} / {data.jidlo.kalorie_cil} kcal
          <span className="mx-1.5">·</span>
          B: {data.jidlo.bilkoviny_celkem}g / {data.jidlo.bilkoviny_cil}g
        </p>
        <div className="space-y-1.5">
          {(['snidane', 'obed', 'svacina', 'vecere'] as const).map((type) => {
            const plan = data.jidlo.plan_meals.find((m: any) => m.jidlo_typ === type);
            const logged = data.jidlo.zaznamenane.find((m: any) => m.jidlo_typ === type);
            const labels = { snidane: 'Snídaně', obed: 'Oběd', svacina: 'Svačina', vecere: 'Večeře' };
            return (
              <button
                key={type}
                onClick={() => !logged && router.push(`/nutrition?type=${type}`)}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                  logged ? 'bg-slate-50 opacity-50' : 'bg-surface hover:bg-surface-alt'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  logged ? 'bg-success border-success' : 'border-slate-300'
                }`}>
                  {logged && <span className="text-white text-[10px] font-bold">✓</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${logged ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                    {labels[type]}
                  </span>
                  {plan && <span className="text-xs text-slate-400 ml-2 truncate">{plan.nazev}</span>}
                </div>
                {plan && <span className="text-xs text-slate-400">{plan.kalorie} kcal</span>}
              </button>
            );
          })}
        </div>
      </section>

      {/* Adherence */}
      {data.stats.adherence_tyden_pct != null && (
        <section className="mb-6">
          <h2 className="font-semibold text-slate-900 mb-2">Tento týden</h2>
          <div className="h-2 bg-surface-alt rounded-full overflow-hidden mb-1">
            <div
              className={`h-full rounded-full transition-all ${
                data.stats.adherence_tyden_pct >= 80 ? 'bg-success' :
                data.stats.adherence_tyden_pct >= 50 ? 'bg-warning' : 'bg-danger'
              }`}
              style={{ width: `${Math.min(data.stats.adherence_tyden_pct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400">{data.stats.adherence_tyden_pct}% tréninků splněno</p>
        </section>
      )}

      {/* Motivation */}
      {data.motivace && (
        <div className="card text-center mb-8">
          <p className="text-sm text-slate-500 italic">{data.motivace}</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, unit, trend, good }: {
  label: string; value: string; unit: string; trend?: number | null; good?: boolean;
}) {
  return (
    <div className="card relative">
      <p className="text-[11px] text-slate-400">{label}</p>
      <div className="flex items-baseline gap-0.5 mt-1">
        <span className="text-lg font-bold text-slate-900">{value}</span>
        <span className="text-[11px] text-slate-400">{unit}</span>
      </div>
      {trend != null && (
        <p className={`text-[11px] mt-0.5 ${trend < 0 ? 'text-success' : trend > 0 ? 'text-warning' : 'text-slate-400'}`}>
          {trend > 0 ? '+' : ''}{trend} za 7d
        </p>
      )}
      {good != null && (
        <div className={`absolute top-3 right-3 w-1.5 h-1.5 rounded-full ${good ? 'bg-success' : 'bg-warning'}`} />
      )}
    </div>
  );
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' });
}
