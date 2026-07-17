'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

interface TrainingPlan {
  id: string;
  nazev: string;
  status: 'active' | 'archived' | 'draft';
  platny_od: string;
  platny_do: string | null;
  days: any[];
}

interface NutritionPlan {
  id: string;
  status: 'active' | 'archived' | 'draft';
  kalorie_treninkovy_den: number;
  kalorie_odpocinkovy_den: number;
  bilkoviny_g: number;
  platny_od: string;
  meals: any[];
}

export default function PlansPage() {
  const [trainingPlans, setTrainingPlans] = useState<TrainingPlan[]>([]);
  const [nutritionPlans, setNutritionPlans] = useState<NutritionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'training' | 'nutrition'>('training');
  const [activating, setActivating] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await api.get<any>('/plans/history');
      setTrainingPlans(data.trainingPlans || []);
      setNutritionPlans(data.nutritionPlans || []);
    } catch (e: any) {
      setError(e.message ?? 'Chyba při načítání plánů');
    } finally {
      setLoading(false);
    }
  };

  const activateTrainingPlan = async (id: string) => {
    setActivating(id);
    try {
      const updated = await api.patch(`/plans/training/${id}/activate`, {});
      setTrainingPlans(prev =>
        prev.map(p => ({ ...p, status: p.id === id ? 'active' : p.status === 'active' ? 'archived' : p.status }))
      );
    } catch (e: any) {
      setError(e.message ?? 'Aktivace plánu selhala');
    } finally {
      setActivating(null);
    }
  };

  const activateNutritionPlan = async (id: string) => {
    setActivating(id);
    try {
      const updated = await api.patch(`/plans/nutrition/${id}/activate`, {});
      setNutritionPlans(prev =>
        prev.map(p => ({ ...p, status: p.id === id ? 'active' : p.status === 'active' ? 'archived' : p.status }))
      );
    } catch (e: any) {
      setError(e.message ?? 'Aktivace plánu selhala');
    } finally {
      setActivating(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('cs-CZ', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active')
      return <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded">Aktivní</span>;
    if (status === 'archived')
      return <span className="px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-700 rounded">Archivovaný</span>;
    return <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-700 rounded">Koncept</span>;
  };

  if (loading)
    return (
      <div className="px-5 pt-8 pb-24">
        <p className="text-slate-500">Načítám plány...</p>
      </div>
    );

  return (
    <div className="px-5 pt-8 pb-24 animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">📋 Historie plánů</h1>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('training')}
          className={`pb-3 font-medium transition-colors ${
            activeTab === 'training'
              ? 'text-brand-500 border-b-2 border-brand-500'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          🏋️ Tréninky ({trainingPlans.length})
        </button>
        <button
          onClick={() => setActiveTab('nutrition')}
          className={`pb-3 font-medium transition-colors ${
            activeTab === 'nutrition'
              ? 'text-brand-500 border-b-2 border-brand-500'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          🍗 Výživa ({nutritionPlans.length})
        </button>
      </div>

      {/* Training Plans */}
      {activeTab === 'training' && (
        <div className="space-y-3">
          {trainingPlans.length === 0 ? (
            <p className="text-slate-500 text-center py-8">Žádné tréninkové plány</p>
          ) : (
            trainingPlans.map(plan => (
              <div key={plan.id} className="card p-4">
                <div className="flex items-start justify-between mb-3">
                  <button
                    onClick={() => window.location.href = `/plans/training/${plan.id}`}
                    className="flex-1 text-left hover:opacity-70 transition-opacity"
                  >
                    <h3 className="font-semibold hover:underline">{plan.nazev}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatDate(plan.platny_od)}
                      {plan.platny_do && ` – ${formatDate(plan.platny_do)}`}
                    </p>
                  </button>
                  <div>{getStatusBadge(plan.status)}</div>
                </div>

                <div className="text-sm text-slate-600 mb-3">
                  {plan.days.length} dní v týdnu
                </div>

                <button
                  onClick={() => activateTrainingPlan(plan.id)}
                  disabled={plan.status === 'active' || activating === plan.id}
                  className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
                    plan.status === 'active'
                      ? 'bg-green-100 text-green-700 cursor-default'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  } ${activating === plan.id ? 'opacity-50' : ''}`}
                >
                  {plan.status === 'active'
                    ? '✓ Aktivní plán'
                    : activating === plan.id
                      ? 'Aktivuji...'
                      : '▶ Aktivovat plán'}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Nutrition Plans */}
      {activeTab === 'nutrition' && (
        <div className="space-y-3">
          {nutritionPlans.length === 0 ? (
            <p className="text-slate-500 text-center py-8">Žádné nutriční plány</p>
          ) : (
            nutritionPlans.map(plan => (
              <div key={plan.id} className="card p-4">
                <div className="flex items-start justify-between mb-3">
                  <button
                    onClick={() => window.location.href = `/plans/nutrition/${plan.id}`}
                    className="flex-1 text-left hover:opacity-70 transition-opacity"
                  >
                    <h3 className="font-semibold hover:underline">Nutriční plán</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatDate(plan.platny_od)}
                    </p>
                  </button>
                  <div>{getStatusBadge(plan.status)}</div>
                </div>

                <div className="text-sm text-slate-600 mb-3 space-y-1">
                  <p>📍 Tréninkový den: <strong>{plan.kalorie_treninkovy_den} kcal</strong></p>
                  <p>📍 Odpočinkový den: <strong>{plan.kalorie_odpocinkovy_den} kcal</strong></p>
                  <p>🥚 Bílkoviny: <strong>{plan.bilkoviny_g}g</strong></p>
                  <p>🍽️ Jídel: <strong>{plan.meals.length}</strong></p>
                </div>

                <button
                  onClick={() => activateNutritionPlan(plan.id)}
                  disabled={plan.status === 'active' || activating === plan.id}
                  className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
                    plan.status === 'active'
                      ? 'bg-green-100 text-green-700 cursor-default'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  } ${activating === plan.id ? 'opacity-50' : ''}`}
                >
                  {plan.status === 'active'
                    ? '✓ Aktivní plán'
                    : activating === plan.id
                      ? 'Aktivuji...'
                      : '▶ Aktivovat plán'}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/profile" className="text-brand-500 text-sm hover:underline">
          ← Zpět na profil
        </Link>
      </div>
    </div>
  );
}
