'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';

const EQUIPMENT = [
  { v: 'vlastni_vaha', l: '🏠 Vlastní váha' }, { v: 'cinky', l: '🏋️ Činky' },
  { v: 'trx', l: '🔗 TRX / gumy' }, { v: 'posilovna', l: '🏢 Posilovna' }, { v: 'venku', l: '🌳 Venku' },
];
const HEALTH = [
  { v: 'bolesti_zad', l: 'Bolesti zad' }, { v: 'problem_kolena', l: 'Kolena' },
  { v: 'problem_ramena', l: 'Ramena' }, { v: 'vysoky_tlak', l: 'Vysoký tlak' },
  { v: 'cukrovka', l: 'Cukrovka' }, { v: 'astma', l: 'Astma' },
];
const ALLERGIES = [
  { v: 'laktoza', l: 'Laktóza' }, { v: 'lepek', l: 'Lepek' },
  { v: 'orechy', l: 'Ořechy' }, { v: 'vejce', l: 'Vejce' }, { v: 'ryby', l: 'Ryby' },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({
    jmeno: '', email: '', password: '', pohlavi: '', datum_narozeni: '',
    vyska_cm: '', aktualni_vaha_kg: '', typ_cile: '', cilova_vaha_kg: '',
    uroven_cviceni: '', treninky_tyden: 3, delka_treninku_min: 45,
    dostupne_vybaveni: [] as string[], zdravotni_omezeni: [] as string[],
    alergie_intolerance: [] as string[], leky: '',
    stravovaci_preference: '', pocet_jidel_denne: 4, food_logging_mode: 'simple',
  });

  const u = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const toggle = (k: string, item: string) => setF((p: any) => {
    const arr = (p as any)[k] as string[];
    return { ...p, [k]: arr.includes(item) ? arr.filter((i: string) => i !== item) : [...arr, item] };
  });

  const stepValid = [
    null,
    f.jmeno && f.email && f.password.length >= 8 && f.pohlavi && f.datum_narozeni,
    f.vyska_cm && f.aktualni_vaha_kg && f.typ_cile,
    f.uroven_cviceni && f.dostupne_vybaveni.length > 0,
    true, true,
  ];

  const submit = async () => {
    setSubmitting(true);
    try {
      await register({
        email: f.email, password: f.password,
        profile: {
          jmeno: f.jmeno, pohlavi: f.pohlavi, datum_narozeni: f.datum_narozeni,
          vyska_cm: parseInt(f.vyska_cm), aktualni_vaha_kg: parseFloat(f.aktualni_vaha_kg),
          uroven_cviceni: f.uroven_cviceni, treninky_tyden: f.treninky_tyden,
          delka_treninku_min: f.delka_treninku_min, dostupne_vybaveni: f.dostupne_vybaveni,
          zdravotni_omezeni: f.zdravotni_omezeni, alergie_intolerance: f.alergie_intolerance,
          leky: f.leky || undefined, stravovaci_preference: f.stravovaci_preference || undefined,
          pocet_jidel_denne: f.pocet_jidel_denne, food_logging_mode: f.food_logging_mode as any,
        },
        goal: { typ_cile: f.typ_cile, cilova_vaha_kg: f.cilova_vaha_kg ? parseFloat(f.cilova_vaha_kg) : undefined },
      });
    } catch (e: any) { alert(e.details ?? 'Registrace selhala.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen flex flex-col animate-fade-in">
      {/* Progress */}
      <div className="px-6 pt-4">
        <div className="h-1 bg-surface-alt rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 rounded-full transition-all duration-300" style={{ width: `${(step / 5) * 100}%` }} />
        </div>
        <p className="text-center text-xs text-slate-400 mt-2">Krok {step} z 5</p>
      </div>

      <div className="flex-1 px-6 pt-4 pb-24 overflow-y-auto">
        {step === 1 && (
          <div>
            <h1 className="text-2xl font-bold mb-6">Pojďme se seznámit</h1>
            <Field label="Jak se jmenuješ?"><input className="input" value={f.jmeno} onChange={e => u('jmeno', e.target.value)} placeholder="Tomáš" autoFocus /></Field>
            <Field label="Email"><input type="email" className="input" value={f.email} onChange={e => u('email', e.target.value)} placeholder="tomas@email.cz" /></Field>
            <Field label="Heslo (min. 8 znaků)"><input type="password" className="input" value={f.password} onChange={e => u('password', e.target.value)} placeholder="••••••••" /></Field>
            <Field label="Pohlaví">
              <Opts options={[{ v: 'muz', l: 'Muž' }, { v: 'zena', l: 'Žena' }, { v: 'jine', l: 'Jiné' }]} selected={f.pohlavi} onSelect={v => u('pohlavi', v)} />
            </Field>
            <Field label="Datum narození"><input type="date" className="input" value={f.datum_narozeni} onChange={e => u('datum_narozeni', e.target.value)} /></Field>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-2xl font-bold mb-6">Tvoje tělo a cíl</h1>
            <Field label="Výška (cm)"><input type="number" className="input w-32 text-xl font-bold" value={f.vyska_cm} onChange={e => u('vyska_cm', e.target.value)} placeholder="180" /></Field>
            <Field label="Aktuální váha (kg)"><input type="number" step="0.1" className="input w-32 text-xl font-bold" value={f.aktualni_vaha_kg} onChange={e => u('aktualni_vaha_kg', e.target.value)} placeholder="85.0" /></Field>
            <Field label="Hlavní cíl">
              <Opts vertical options={[
                { v: 'hubnuti', l: '🔥 Zhubnout' }, { v: 'nabirani', l: '💪 Nabrat svaly' },
                { v: 'udrzeni', l: '⚖️ Udržet' }, { v: 'vykon', l: '🏃 Zlepšit výkon' },
              ]} selected={f.typ_cile} onSelect={v => u('typ_cile', v)} />
            </Field>
            {f.typ_cile === 'hubnuti' && (
              <Field label="Cílová váha (volitelné)"><input type="number" step="0.1" className="input w-32 text-xl font-bold" value={f.cilova_vaha_kg} onChange={e => u('cilova_vaha_kg', e.target.value)} placeholder="78.0" /></Field>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="text-2xl font-bold mb-6">Jak cvičíš?</h1>
            <Field label="Tvoje úroveň">
              <Opts vertical options={[
                { v: 'zacatecnik', l: '🌱 Začátečník' }, { v: 'mirne_pokrocily', l: '🌿 Občas cvičím' }, { v: 'pokrocily', l: '🌳 Pravidelně' },
              ]} selected={f.uroven_cviceni} onSelect={v => u('uroven_cviceni', v)} />
            </Field>
            <Field label={`Kolikrát týdně? ${f.treninky_tyden}×`}>
              <Opts options={[{ v: '2', l: '2×' }, { v: '3', l: '3×' }, { v: '4', l: '4×' }, { v: '5', l: '5×' }]}
                selected={String(f.treninky_tyden)} onSelect={v => u('treninky_tyden', parseInt(v))} />
            </Field>
            <Field label={`Délka tréninku? ${f.delka_treninku_min} min`}>
              <Opts options={[{ v: '20', l: '20' }, { v: '30', l: '30' }, { v: '45', l: '45' }, { v: '60', l: '60' }]}
                selected={String(f.delka_treninku_min)} onSelect={v => u('delka_treninku_min', parseInt(v))} />
            </Field>
            <Field label="Kde cvičíš? (vyber vše)">
              <Chips items={EQUIPMENT} selected={f.dostupne_vybaveni} onToggle={v => toggle('dostupne_vybaveni', v)} />
            </Field>
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 className="text-2xl font-bold mb-1">Zdraví a omezení</h1>
            <p className="text-sm text-slate-500 mb-6">Důležité pro bezpečný plán. Pokud nemáš omezení, pokračuj.</p>
            <Field label="Zdravotní omezení">
              <Chips items={HEALTH} selected={f.zdravotni_omezeni} onToggle={v => toggle('zdravotni_omezeni', v)} color="danger" />
            </Field>
            <Field label="Alergie / intolerance">
              <Chips items={ALLERGIES} selected={f.alergie_intolerance} onToggle={v => toggle('alergie_intolerance', v)} color="warning" />
            </Field>
            <Field label="Léky (volitelné)"><input className="input" value={f.leky} onChange={e => u('leky', e.target.value)} placeholder="Metformin, beta-blokátor..." /></Field>
          </div>
        )}

        {step === 5 && (
          <div>
            <h1 className="text-2xl font-bold mb-6">Stravování</h1>
            <Field label="Preference">
              <Opts options={[{ v: 'bez_omezeni', l: '🥩 Bez omezení' }, { v: 'vegetarian', l: '🥦 Vegetarián' }, { v: 'vegan', l: '🌱 Vegan' }]}
                selected={f.stravovaci_preference} onSelect={v => u('stravovaci_preference', v)} />
            </Field>
            <Field label="Kolik jídel denně?">
              <Opts options={[{ v: '3', l: '3 hlavní' }, { v: '4', l: '3 + svačina' }, { v: '5', l: '3 + 2 svačiny' }]}
                selected={String(f.pocet_jidel_denne)} onSelect={v => u('pocet_jidel_denne', parseInt(v))} />
            </Field>
            <Field label="Jak chceš zapisovat jídlo?">
              <Opts vertical options={[
                { v: 'simple', l: '⚡ Jednoduše — "jedl podle plánu"' },
                { v: 'text', l: '📝 Textově — popíšu co jsem jedl' },
                { v: 'detailed', l: '🔬 Detailně — gramáže a makra' },
              ]} selected={f.food_logging_mode} onSelect={v => u('food_logging_mode', v)} />
            </Field>
            <div className="bg-brand-50 rounded-2xl p-6 text-center mt-4">
              <span className="text-4xl block mb-2">🎯</span>
              <p className="font-semibold text-brand-700">Vše připraveno</p>
              <p className="text-sm text-brand-600/70 mt-1">AI spočítá metabolismus a vytvoří první plán za pár sekund.</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-slate-100 px-6 py-3">
        <div className="max-w-md mx-auto flex items-center gap-3">
          {step > 1 && <button onClick={() => setStep(s => s - 1)} className="text-sm text-slate-400 hover:text-slate-600">← Zpět</button>}
          <div className="flex-1" />
          {step < 5 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!stepValid[step]}
              className="btn-primary !py-3 !px-8 disabled:opacity-40">Pokračovat →</button>
          ) : (
            <button onClick={submit} disabled={submitting}
              className="btn-primary !py-3 !px-8 !bg-success hover:!bg-emerald-700">{submitting ? 'Vytvářím plán...' : 'Začít! 🚀'}</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mb-5"><label className="label">{label}</label>{children}</div>;
}

function Opts({ options, selected, onSelect, vertical }: { options: { v: string; l: string }[]; selected: string; onSelect: (v: string) => void; vertical?: boolean }) {
  return (
    <div className={`${vertical ? 'space-y-2' : 'flex flex-wrap gap-2'}`}>
      {options.map(o => (
        <button key={o.v} onClick={() => onSelect(o.v)}
          className={`${vertical ? 'w-full' : 'flex-1 min-w-[70px]'} py-3 px-3 rounded-xl text-sm font-medium text-center transition-all ${
            selected === o.v ? 'bg-brand-50 text-brand-500 ring-2 ring-brand-500' : 'bg-surface text-slate-400 hover:bg-surface-alt'
          }`}>{o.l}</button>
      ))}
    </div>
  );
}

function Chips({ items, selected, onToggle, color = 'brand' }: { items: { v: string; l: string }[]; selected: string[]; onToggle: (v: string) => void; color?: string }) {
  const colors: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-500 ring-brand-500',
    danger: 'bg-danger-light text-danger ring-danger',
    warning: 'bg-warning-light text-warning ring-warning',
  };
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(i => (
        <button key={i.v} onClick={() => onToggle(i.v)}
          className={`chip ${selected.includes(i.v) ? `${colors[color]} font-semibold ring-2` : ''}`}>{i.l}</button>
      ))}
    </div>
  );
}
