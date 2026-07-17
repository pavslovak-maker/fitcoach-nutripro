'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function ProfilePage() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [edited, setEdited] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    api.get('/profile').then(setProfile).catch(console.error);
  }, []);

  const handleChange = (field: string, value: any) => {
    setEdited((prev: any) => ({ ...prev, [field]: value }));
    setSaveError('');
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      const updated = await api.patch('/profile', edited);
      setProfile(updated);
      setEdited({});
      setEditMode(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setSaveError(e.message ?? 'Uložení selhalo');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return null;

  const displayValue = (field: string) => edited.hasOwnProperty(field) ? edited[field] : profile[field];

  return (
    <div className="px-5 pt-8 pb-24 animate-fade-in">
      {/* Avatar */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-full bg-brand-500 flex items-center justify-center mb-3">
          <span className="text-2xl font-bold text-white">{displayValue('jmeno')?.charAt(0)}</span>
        </div>
        <h1 className="text-xl font-bold">{displayValue('jmeno')}</h1>
        <p className="text-sm text-slate-400">{displayValue('vyska_cm')} cm · {Number(displayValue('aktualni_vaha_kg'))} kg</p>
      </div>

      {/* Numbers */}
      <h2 className="font-semibold mb-2">Tvoje čísla</h2>
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        <NumCard label="BMR" value={profile.bmr_kcal} unit="kcal/den" />
        <NumCard label="TDEE" value={profile.tdee_kcal} unit="kcal/den" />
        <NumCard label="Kalorický cíl" value={profile.cilove_kalorie} unit="kcal/den" />
        <NumCard label="Bílkoviny" value={profile.cilove_bilkoviny_g} unit="g/den" />
      </div>

      {/* Edit mode toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => {
            if (editMode) {
              setEdited({});
              setEditMode(false);
            } else {
              setEditMode(true);
            }
          }}
          className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-colors ${
            editMode
              ? 'bg-slate-200 text-slate-700'
              : 'bg-brand-500 text-white'
          }`}
        >
          {editMode ? '✕ Zrušit' : '✎ Editovat profil'}
        </button>
      </div>

      {/* Edit form */}
      {editMode && (
        <div className="card mb-6 space-y-4">
          <FormField
            label="Jméno"
            value={displayValue('jmeno')}
            onChange={(v) => handleChange('jmeno', v)}
            type="text"
          />

          <FormField
            label="Pohlaví"
            value={displayValue('pohlavi')}
            onChange={(v) => handleChange('pohlavi', v)}
            type="select"
            options={[
              { value: 'muz', label: 'Muž' },
              { value: 'zena', label: 'Žena' },
              { value: 'jine', label: 'Jiné' }
            ]}
          />

          <FormField
            label="Datum narození"
            value={displayValue('datum_narozeni')?.split('T')[0]}
            onChange={(v) => handleChange('datum_narozeni', v)}
            type="date"
          />

          <FormField
            label="Výška (cm)"
            value={displayValue('vyska_cm')}
            onChange={(v) => handleChange('vyska_cm', parseInt(v) || 0)}
            type="number"
          />

          <FormField
            label="Aktuální váha (kg)"
            value={displayValue('aktualni_vaha_kg')}
            onChange={(v) => handleChange('aktualni_vaha_kg', parseFloat(v) || 0)}
            type="number"
            step="0.1"
          />

          <FormField
            label="Úroveň cvičení"
            value={displayValue('uroven_cviceni')}
            onChange={(v) => handleChange('uroven_cviceni', v)}
            type="select"
            options={[
              { value: 'zacatecnik', label: 'Začátečník' },
              { value: 'mirne_pokrocily', label: 'Mírně pokročilý' },
              { value: 'pokrocily', label: 'Pokročilý' }
            ]}
          />

          <FormField
            label="Tréninků týdně"
            value={displayValue('treninky_tyden')}
            onChange={(v) => handleChange('treninky_tyden', parseInt(v) || 0)}
            type="number"
          />

          <FormField
            label="Délka tréninku (min)"
            value={displayValue('delka_treninku_min')}
            onChange={(v) => handleChange('delka_treninku_min', parseInt(v) || 0)}
            type="number"
          />

          <FormField
            label="Počet jídel denně"
            value={displayValue('pocet_jidel_denne')}
            onChange={(v) => handleChange('pocet_jidel_denne', parseInt(v) || 0)}
            type="number"
          />

          <FormField
            label="Zápis jídla"
            value={displayValue('food_logging_mode')}
            onChange={(v) => handleChange('food_logging_mode', v)}
            type="select"
            options={[
              { value: 'simple', label: 'Jednoduchý' },
              { value: 'text', label: 'Textový' },
              { value: 'detailed', label: 'Detailní' }
            ]}
          />

          <FormField
            label="Zdravotní omezení (oddělená čárkou)"
            value={Array.isArray(displayValue('zdravotni_omezeni')) ? displayValue('zdravotni_omezeni').join(', ') : displayValue('zdravotni_omezeni') || ''}
            onChange={(v) => handleChange('zdravotni_omezeni', v.split(',').map(s => s.trim()).filter(Boolean))}
            type="textarea"
          />

          <FormField
            label="Alergie/Intolerance (oddělené čárkou)"
            value={Array.isArray(displayValue('alergie_intolerance')) ? displayValue('alergie_intolerance').join(', ') : displayValue('alergie_intolerance') || ''}
            onChange={(v) => handleChange('alergie_intolerance', v.split(',').map(s => s.trim()).filter(Boolean))}
            type="textarea"
          />

          <FormField
            label="Léky"
            value={displayValue('leky') || ''}
            onChange={(v) => handleChange('leky', v || null)}
            type="textarea"
          />

          <FormField
            label="Stravovací preference"
            value={displayValue('stravovaci_preference') || ''}
            onChange={(v) => handleChange('stravovaci_preference', v || null)}
            type="textarea"
          />

          <FormField
            label="Preferovaný čas tréninku (např. 07:00)"
            value={displayValue('preferovany_cas_treninku') || ''}
            onChange={(v) => handleChange('preferovany_cas_treninku', v || null)}
            type="text"
          />

          {/* Available equipment */}
          <div>
            <label className="block text-sm font-medium mb-2">Dostupné vybavení</label>
            <input
              type="text"
              value={Array.isArray(displayValue('dostupne_vybaveni')) ? displayValue('dostupne_vybaveni').join(', ') : displayValue('dostupne_vybaveni') || ''}
              onChange={(e) => handleChange('dostupne_vybaveni', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="Činka, činky, guma, atd."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
            />
          </div>

          {saveError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{saveError}</div>}
          {saveSuccess && <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm">✓ Profil aktualizován!</div>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 bg-brand-500 text-white rounded-lg font-semibold text-sm hover:bg-brand-600 disabled:bg-slate-300 transition-colors"
          >
            {saving ? 'Ukládám...' : '💾 Uložit změny'}
          </button>
        </div>
      )}

      {/* Settings */}
      {!editMode && (
        <>
          <h2 className="font-semibold mb-2">Nastavení</h2>
          <div className="card mb-6 divide-y divide-slate-100">
            <Row label="Zápis jídla" value={displayValue('food_logging_mode') === 'simple' ? 'Jednoduchý' : displayValue('food_logging_mode') === 'text' ? 'Textový' : 'Detailní'} />
            <Row label="Jídel denně" value={displayValue('pocet_jidel_denne')} />
            <Row label="Tréninků týdně" value={`${displayValue('treninky_tyden')}×`} />
            <Row label="Délka tréninku" value={`${displayValue('delka_treninku_min')} min`} />
          </div>
        </>
      )}

      {/* AI generování */}
      <h2 className="font-semibold mb-2">AI plán</h2>
      <div className="card mb-6">
        <p className="text-sm text-slate-500 mb-3">
          FitCoach a NutriPro analyzují tvá data a vytvoří nový plán na příští týden.
        </p>
        <button
          onClick={async () => {
            setGenerating(true);
            setAiResult(null);
            try {
              const r = await api.post<any>('/ai/generate');
              setAiResult(r);
            } catch (e: any) {
              setAiResult({ error: e.message ?? 'Generování selhalo.' });
            } finally {
              setGenerating(false);
            }
          }}
          disabled={generating}
          className="btn-primary w-full text-sm"
        >
          {generating ? 'AI generuje plán... (~20s)' : '🤖 Vygenerovat nový plán'}
        </button>

        {aiResult && !aiResult.error && (
          <div className="mt-4 space-y-2 text-sm">
            <p className="text-success font-medium">✓ Plán vygenerován!</p>
            <p className="text-slate-600"><strong>FitCoach:</strong> {aiResult.fitcoach_zduvodneni}</p>
            <p className="text-slate-600"><strong>NutriPro:</strong> {aiResult.nutripro_zduvodneni}</p>
            {aiResult.upozorneni?.length > 0 && (
              <div className="bg-warning-light rounded-lg p-2">
                {aiResult.upozorneni.map((u: string, i: number) => (
                  <p key={i} className="text-xs text-warning-dark">⚠ {u}</p>
                ))}
              </div>
            )}
            <a href="/" className="block text-brand-500 text-center mt-2">Zobrazit nový plán →</a>
          </div>
        )}

        {aiResult?.error && (
          <p className="mt-3 text-sm text-danger">{aiResult.error}</p>
        )}
      </div>

      {/* Plans & History */}
      <h2 className="font-semibold mb-2">Moje plány</h2>
      <div className="space-y-1 mb-6">
        <LinkRow label="📋 Zobrazit historii plánů" onClick={() => window.location.href = '/plans'} />
      </div>

      {/* Legal */}
      <div className="space-y-1 mb-6">
        <LinkRow label="Podmínky používání" />
        <LinkRow label="Ochrana osobních údajů (GDPR)" />
        <LinkRow label="Exportovat moje data" onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL}/profile/export`)} />
        <button className="w-full text-left py-3 text-sm text-danger hover:bg-danger-light rounded-lg px-3 transition-colors">
          Smazat účet
        </button>
      </div>

      <button onClick={() => { if (confirm('Odhlásit se?')) logout(); }}
        className="w-full py-3 bg-surface rounded-2xl text-danger font-semibold hover:bg-surface-alt transition-colors">
        Odhlásit se
      </button>

      <p className="text-center text-xs text-slate-400 mt-6">FitCoach v0.1.0</p>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  step,
  options,
}: {
  label: string;
  value: any;
  onChange: (value: any) => void;
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea';
  placeholder?: string;
  step?: string;
  options?: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {type === 'select' ? (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
        >
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none"
          rows={3}
        />
      ) : (
        <input
          type={type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          step={step}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
        />
      )}
    </div>
  );
}

function NumCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="card text-center">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-slate-400">{unit}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between py-3">
      <span className="text-sm text-slate-700">{label}</span>
      <span className="text-sm text-slate-400">{value}</span>
    </div>
  );
}

function LinkRow({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left py-3 text-sm text-brand-500 hover:bg-brand-50 rounded-lg px-3 transition-colors">
      {label}
    </button>
  );
}
