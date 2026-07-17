'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function WorkoutPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [planDay, setPlanDay] = useState<any>(null);
  const [done, setDone] = useState<boolean | null>(null);
  const [type, setType] = useState('');
  const [minutes, setMinutes] = useState('');
  const [rpe, setRpe] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'simple' | 'detailed'>('simple');
  const [sets, setSets] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const today = await api.get<any>('/today');
        if (today.trenink.plan_day) {
          setPlanDay(today.trenink.plan_day);
          setType(today.trenink.plan_day.typ_dne);
          setMinutes(String(today.trenink.plan_day.delka_min));
          if (today.trenink.plan_day.exercises) {
            const s: any[] = [];
            for (const ex of today.trenink.plan_day.exercises) {
              for (let i = 1; i <= ex.serie; i++) {
                s.push({ cvik: ex.cvik, serie: i, reps: ex.opakovani, kg: ex.zatez_doporucena ?? '' });
              }
            }
            setSets(s);
          }
        }
      } catch (e) { console.error(e); }
    })();
  }, []);

  const valid = done != null && type && (!done || rpe != null);

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await api.post('/workout', {
        typ_treninku: type,
        odcviceno: done,
        delka_min: done && minutes ? parseInt(minutes) : undefined,
        rpe: done ? rpe : undefined,
        poznamka: note || undefined,
        sets: mode === 'detailed' && done ? sets.filter(s => s.reps).map(s => ({
          cvik: s.cvik, serie_cislo: s.serie,
          opakovani: parseInt(s.reps) || undefined,
          zatez_kg: parseFloat(s.kg) || undefined,
        })) : undefined,
      });
      router.push('/');
    } catch { alert('Nepodařilo se uložit.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="px-5 pt-8 pb-24 animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Trénink</h1>

      {/* Done? */}
      <div className="mb-6">
        <label className="label">Cvičil/a jsi dnes?</label>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setDone(true)}
            className={`py-5 rounded-2xl text-center transition-all ${done === true ? 'bg-success-light ring-2 ring-success' : 'bg-surface'}`}>
            <span className="text-3xl block mb-1">💪</span>
            <span className={`font-medium ${done === true ? 'text-slate-900' : 'text-slate-400'}`}>Ano!</span>
          </button>
          <button onClick={() => setDone(false)}
            className={`py-5 rounded-2xl text-center transition-all ${done === false ? 'bg-surface-alt ring-2 ring-slate-400' : 'bg-surface'}`}>
            <span className="text-3xl block mb-1">😴</span>
            <span className={`font-medium ${done === false ? 'text-slate-900' : 'text-slate-400'}`}>Ne</span>
          </button>
        </div>
      </div>

      {done === false && (
        <div className="card mb-6">
          <p className="text-sm text-slate-500 mb-3">Nevadí — odpočinek je taky trénink.</p>
          <label className="label">Proč ne? (volitelné)</label>
          <input className="input" placeholder="Byl jsem unavený..." value={note} onChange={e => setNote(e.target.value)} />
        </div>
      )}

      {done === true && (
        <>
          <div className="mb-6">
            <label className="label">Typ tréninku</label>
            <input className="input" value={type} onChange={e => setType(e.target.value)} placeholder="Horní tělo, Full body..." />
          </div>

          <div className="mb-6">
            <label className="label">Délka (min)</label>
            <input type="number" className="input w-28 text-xl font-bold" value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="45" />
          </div>

          <div className="mb-6">
            <label className="label">Jak těžké to bylo? (RPE)</label>
            <div className="flex flex-wrap gap-1.5">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button key={n} onClick={() => setRpe(n)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                    rpe === n ? (n <= 4 ? 'bg-success' : n <= 7 ? 'bg-warning' : 'bg-danger') + ' text-white' : 'bg-surface text-slate-400'
                  }`}>{n}</button>
              ))}
            </div>
            {rpe != null && (
              <p className="text-xs text-slate-400 mt-1">
                {rpe <= 3 ? 'Lehké' : rpe <= 5 ? 'Střední' : rpe <= 7 ? 'Těžké' : rpe <= 9 ? 'Velmi těžké' : 'Maximum'}
              </p>
            )}
          </div>

          {/* Mode switch */}
          <div className="flex gap-2 mb-6">
            <button onClick={() => setMode('simple')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${mode === 'simple' ? 'bg-brand-50 text-brand-500 ring-2 ring-brand-500' : 'bg-surface text-slate-400'}`}>
              ⚡ Jednoduchý
            </button>
            <button onClick={() => setMode('detailed')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${mode === 'detailed' ? 'bg-brand-50 text-brand-500 ring-2 ring-brand-500' : 'bg-surface text-slate-400'}`}>
              📝 Detailní
            </button>
          </div>

          {/* Detailed sets */}
          {mode === 'detailed' && sets.length > 0 && (
            <div className="mb-6 space-y-3">
              {groupSets(sets).map(([cvik, exSets]) => (
                <div key={cvik} className="card">
                  <p className="font-medium text-slate-700 text-sm mb-2">{cvik}</p>
                  {exSets.map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-slate-400 w-5">{s.serie}.</span>
                      <input className="input !py-2 w-16 text-center text-sm" value={s.reps}
                        onChange={e => { const c = [...sets]; c[sets.indexOf(s)].reps = e.target.value; setSets(c); }}
                        placeholder="reps" />
                      <span className="text-xs text-slate-400">×</span>
                      <input className="input !py-2 w-16 text-center text-sm" value={s.kg}
                        onChange={e => { const c = [...sets]; c[sets.indexOf(s)].kg = e.target.value; setSets(c); }}
                        placeholder="kg" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="mb-6">
            <label className="label">Poznámka (volitelné)</label>
            <textarea className="input min-h-[60px]" value={note} onChange={e => setNote(e.target.value)}
              placeholder="Bolelo rameno, cítil jsem se skvěle..." />
          </div>
        </>
      )}

      {done != null && (
        <button onClick={submit} disabled={!valid || submitting} className="btn-primary w-full">
          {submitting ? 'Ukládám...' : done ? 'Uložit trénink ✓' : 'Zaznamenat ✓'}
        </button>
      )}
    </div>
  );
}

function groupSets(sets: any[]): [string, any[]][] {
  const m = new Map<string, any[]>();
  for (const s of sets) { m.set(s.cvik, [...(m.get(s.cvik) ?? []), s]); }
  return [...m.entries()];
}
