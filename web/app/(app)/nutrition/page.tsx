'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

const MEALS = ['snidane', 'obed', 'svacina', 'vecere'] as const;
const LABELS: Record<string, string> = { snidane: '🌅 Snídaně', obed: '☀️ Oběd', svacina: '🍎 Svačina', vecere: '🌙 Večeře' };

export default function NutritionPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [mealType, setMealType] = useState(params.get('type') ?? 'obed');
  const [mode, setMode] = useState<'simple' | 'text' | 'detailed'>('simple');
  const [planMeal, setPlanMeal] = useState<any>(null);
  const [dlePlanu, setDlePlanu] = useState<boolean | null>(null);
  const [popis, setPopis] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const today = await api.get<any>('/today');
        const meal = today.jidlo.plan_meals?.find((m: any) => m.jidlo_typ === mealType);
        if (meal) setPlanMeal(meal);
      } catch (e) { console.error(e); }
    })();
  }, [mealType]);

  const valid =
    (mode === 'simple' && dlePlanu != null && (dlePlanu || popis)) ||
    (mode === 'text' && popis) ||
    (mode === 'detailed' && kcal);

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await api.post('/nutrition', {
        jidlo_typ: mealType,
        dle_planu: mode === 'simple' ? dlePlanu : undefined,
        popis: (mode === 'simple' && !dlePlanu) || mode === 'text' ? popis : undefined,
        kalorie: mode === 'detailed' ? parseInt(kcal) : undefined,
        bilkoviny_g: mode === 'detailed' && protein ? parseFloat(protein) : undefined,
        sacharidy_g: mode === 'detailed' && carbs ? parseFloat(carbs) : undefined,
        tuky_g: mode === 'detailed' && fat ? parseFloat(fat) : undefined,
      });
      router.push('/');
    } catch { alert('Nepodařilo se uložit.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="px-5 pt-8 pb-24 animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Zaznamenat jídlo</h1>

      {/* Meal type */}
      <div className="flex flex-wrap gap-2 mb-6">
        {MEALS.map(t => (
          <button key={t} onClick={() => setMealType(t)}
            className={`chip ${mealType === t ? 'chip-active' : ''}`}>
            {LABELS[t]}
          </button>
        ))}
      </div>

      {/* Plan preview */}
      {planMeal && (
        <div className="card mb-6">
          <p className="text-[11px] text-slate-400">Plán</p>
          <p className="font-semibold text-slate-800">{planMeal.nazev}</p>
          <p className="text-xs text-slate-400 mt-1">
            {planMeal.kalorie} kcal · B: {planMeal.bilkoviny_g}g · S: {planMeal.sacharidy_g}g · T: {planMeal.tuky_g}g
          </p>
        </div>
      )}

      {/* Mode switch */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[
          { m: 'simple' as const, label: '⚡ Dle plánu' },
          { m: 'text' as const, label: '📝 Textově' },
          { m: 'detailed' as const, label: '🔬 Detailně' },
        ].map(({ m, label }) => (
          <button key={m} onClick={() => setMode(m)}
            className={`py-2.5 rounded-xl text-xs font-medium transition-all ${
              mode === m ? 'bg-brand-50 text-brand-500 ring-2 ring-brand-500' : 'bg-surface text-slate-400'
            }`}>{label}</button>
        ))}
      </div>

      {/* Simple */}
      {mode === 'simple' && (
        <div className="space-y-2 mb-6">
          <button onClick={() => setDlePlanu(true)}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${
              dlePlanu === true ? 'bg-success-light ring-2 ring-success' : 'bg-surface'
            }`}>
            <span className="text-xl">✅</span>
            <span className={`font-medium ${dlePlanu === true ? 'text-slate-900' : 'text-slate-400'}`}>Ano, přesně podle plánu</span>
          </button>
          <button onClick={() => setDlePlanu(false)}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${
              dlePlanu === false ? 'bg-warning-light ring-2 ring-warning' : 'bg-surface'
            }`}>
            <span className="text-xl">🔄</span>
            <span className={`font-medium ${dlePlanu === false ? 'text-slate-900' : 'text-slate-400'}`}>Ne, jedl/a jsem jinak</span>
          </button>
          {dlePlanu === false && (
            <div className="mt-4">
              <label className="label">Co jsi jedl/a?</label>
              <input className="input" placeholder="Pizza, salát s tuňákem..." value={popis} onChange={e => setPopis(e.target.value)} />
            </div>
          )}
        </div>
      )}

      {/* Text */}
      {mode === 'text' && (
        <div className="mb-6">
          <label className="label">Popiš co jsi jedl/a</label>
          <textarea className="input min-h-[100px]" value={popis} onChange={e => setPopis(e.target.value)}
            placeholder="2 vejce se špenátem, celozrnný chleba s máslem, rajče, káva..." autoFocus />
          <p className="text-xs text-slate-400 mt-1 italic">AI odhadne kalorie a makra z popisu.</p>
        </div>
      )}

      {/* Detailed */}
      {mode === 'detailed' && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <MacroInput label="Kalorie" value={kcal} onChange={setKcal} unit="kcal" placeholder="550" />
          <MacroInput label="Bílkoviny" value={protein} onChange={setProtein} unit="g" placeholder="35" />
          <MacroInput label="Sacharidy" value={carbs} onChange={setCarbs} unit="g" placeholder="45" />
          <MacroInput label="Tuky" value={fat} onChange={setFat} unit="g" placeholder="18" />
        </div>
      )}

      <button onClick={submit} disabled={!valid || submitting} className="btn-primary w-full">
        {submitting ? 'Ukládám...' : 'Uložit ✓'}
      </button>
    </div>
  );
}

function MacroInput({ label, value, onChange, unit, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; unit: string; placeholder: string;
}) {
  return (
    <div className="card relative">
      <p className="text-[11px] text-slate-400 mb-1">{label}</p>
      <input type="number" className="w-full text-xl font-bold text-slate-900 bg-transparent outline-none"
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      <span className="absolute bottom-3 right-4 text-xs text-slate-400">{unit}</span>
    </div>
  );
}
