'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const BODY_PARTS = [
  { value: 'zada', label: 'Záda' }, { value: 'koleno', label: 'Koleno' },
  { value: 'rameno', label: 'Rameno' }, { value: 'krk', label: 'Krk' },
  { value: 'kycel', label: 'Kyčel' }, { value: 'loket', label: 'Loket' },
  { value: 'zapesti', label: 'Zápěstí' }, { value: 'hlezno', label: 'Hlezno' },
  { value: 'jine', label: 'Jiné' },
] as const;

export default function CheckinPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [vaha, setVaha] = useState('');
  const [spanek, setSpanek] = useState('');
  const [kvalita, setKvalita] = useState<number | null>(null);
  const [energie, setEnergie] = useState<number | null>(null);
  const [bolest, setBolest] = useState(false);
  const [bolestKde, setBolestKde] = useState('');
  const [bolestSila, setBolestSila] = useState<number | null>(null);
  const [bolestPozn, setBolestPozn] = useState('');
  const [voda, setVoda] = useState('');

  const valid = kvalita != null && energie != null && (!bolest || (bolestKde && bolestSila != null));

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await api.post('/checkin', {
        vaha_kg: vaha ? parseFloat(vaha) : undefined,
        spanek_hodin: spanek ? parseFloat(spanek) : undefined,
        spanek_kvalita: kvalita,
        energie,
        ma_bolest: bolest,
        bolest_lokalizace: bolest ? bolestKde : undefined,
        bolest_intenzita: bolest ? bolestSila : undefined,
        bolest_poznamka: bolest && bolestPozn ? bolestPozn : undefined,
        pitny_rezim_litru: voda ? parseFloat(voda) : undefined,
      });
      router.push('/');
    } catch {
      alert('Nepodařilo se uložit. Zkus to znovu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-5 pt-8 pb-24 animate-fade-in">
      <h1 className="text-2xl font-bold mb-1">Dobré ráno ☀️</h1>
      <p className="text-slate-500 text-sm mb-8">Jak se dnes cítíš?</p>

      {/* Váha */}
      <Field label="Váha (volitelné)">
        <div className="flex items-baseline gap-2">
          <input type="number" step="0.1" className="input w-28 text-xl font-bold" placeholder="85.0" value={vaha} onChange={e => setVaha(e.target.value)} />
          <span className="text-sm text-slate-400">kg</span>
        </div>
      </Field>

      {/* Spánek */}
      <Field label="Kolik hodin jsi spal/a?">
        <div className="flex items-baseline gap-2">
          <input type="number" step="0.5" className="input w-24 text-xl font-bold" placeholder="7.5" value={spanek} onChange={e => setSpanek(e.target.value)} />
          <span className="text-sm text-slate-400">h</span>
        </div>
      </Field>

      <Field label="Kvalita spánku">
        <Rating value={kvalita} onChange={setKvalita} labels={['Hrozný', 'Špatný', 'OK', 'Dobrý', 'Super']} />
      </Field>

      {/* Energie */}
      <Field label="Energie dnes ráno">
        <Rating value={energie} onChange={setEnergie} labels={['Vyčerpaný', 'Unavený', 'Normální', 'Dobře', 'Skvěle']} />
      </Field>

      {/* Bolest */}
      <Field label="Bolí tě dnes něco?">
        <div className="flex gap-2">
          <button onClick={() => { setBolest(false); setBolestKde(''); setBolestSila(null); }}
            className={`flex-1 py-3 rounded-xl font-medium transition-all ${!bolest ? 'bg-brand-50 text-brand-500 ring-2 ring-brand-500' : 'bg-surface text-slate-400'}`}>
            Ne
          </button>
          <button onClick={() => setBolest(true)}
            className={`flex-1 py-3 rounded-xl font-medium transition-all ${bolest ? 'bg-danger-light text-danger ring-2 ring-danger' : 'bg-surface text-slate-400'}`}>
            Ano
          </button>
        </div>
      </Field>

      {bolest && (
        <>
          <Field label="Kde?">
            <div className="flex flex-wrap gap-2">
              {BODY_PARTS.map(p => (
                <button key={p.value} onClick={() => setBolestKde(p.value)}
                  className={`chip ${bolestKde === p.value ? 'bg-danger-light text-danger font-semibold ring-2 ring-danger' : ''}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Jak moc? (1 = mírně, 10 = nesnesitelně)">
            <div className="flex flex-wrap gap-1.5">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button key={n} onClick={() => setBolestSila(n)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                    bolestSila === n
                      ? n >= 8 ? 'bg-danger text-white' : n >= 6 ? 'bg-warning text-white' : 'bg-brand-500 text-white'
                      : 'bg-surface text-slate-400'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
            {bolestSila != null && bolestSila >= 8 && (
              <p className="text-xs text-danger font-semibold mt-2">⚠️ Vysoká intenzita — zvažte konzultaci s lékařem</p>
            )}
          </Field>

          <Field label="Poznámka (volitelné)">
            <input className="input" placeholder="Např. po deadliftu, ráno po probuzení..." value={bolestPozn} onChange={e => setBolestPozn(e.target.value)} />
          </Field>
        </>
      )}

      {/* Voda */}
      <Field label="Kolik jsi včera vypil/a? (volitelné)">
        <div className="flex items-baseline gap-2">
          <input type="number" step="0.5" className="input w-24 text-xl font-bold" placeholder="2.0" value={voda} onChange={e => setVoda(e.target.value)} />
          <span className="text-sm text-slate-400">l</span>
        </div>
      </Field>

      <button onClick={submit} disabled={!valid || submitting}
        className="btn-primary w-full mt-4">
        {submitting ? 'Ukládám...' : 'Hotovo ✓'}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Rating({ value, onChange, labels }: { value: number | null; onChange: (v: number) => void; labels: string[] }) {
  return (
    <div>
      <div className="flex gap-2">
        {[1,2,3,4,5].map(n => (
          <button key={n} onClick={() => onChange(n)}
            className={`w-12 h-12 rounded-xl text-lg font-bold transition-all ${
              value === n ? 'bg-brand-500 text-white shadow-md' : 'bg-surface text-slate-400 hover:bg-surface-alt'
            }`}>
            {n}
          </button>
        ))}
      </div>
      {value != null && <p className="text-xs text-slate-400 mt-1.5">{labels[value - 1]}</p>}
    </div>
  );
}
