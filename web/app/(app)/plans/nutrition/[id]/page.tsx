'use client';

import { useEffect, useState, use } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

interface NutritionPlan {
  id: string;
  status: 'active' | 'archived' | 'draft';
  kalorie_treninkovy_den: number;
  kalorie_odpocinkovy_den: number;
  bilkoviny_g: number;
  sacharidy_g: number;
  tuky_g: number;
  platny_od: string;
  meals: Meal[];
}

interface Meal {
  id: string;
  jidlo_typ: string;
  je_treninkovy_den: boolean;
  nazev: string;
  suroviny: { nazev: string; mnozstvi: string }[];
  kalorie: number;
  bilkoviny_g: number;
  sacharidy_g: number;
  tuky_g: number;
  poznamka: string | null;
}

export default function NutritionPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPlan();
  }, []);

  const loadPlan = async () => {
    setLoading(true);
    try {
      const historyData = await api.get<any>('/plans/history');
      const found = historyData.nutritionPlans.find((p: any) => p.id === id);
      if (!found) throw new Error('Plán nenalezen');
      setPlan(found);
    } catch (e: any) {
      setError(e.message ?? 'Chyba při načítání plánu');
    } finally {
      setLoading(false);
    }
  };

  const mealTypeLabel: Record<string, string> = {
    snidane: '🌅 Snídaně',
    obed: '🍽️ Oběd',
    svacina: '🍎 Svačina',
    vecere: '🌙 Večeře',
  };

  const trainingMeals = plan?.meals.filter(m => m.je_treninkovy_den) || [];
  const restMeals = plan?.meals.filter(m => !m.je_treninkovy_den) || [];

  if (loading)
    return (
      <div className="px-5 pt-8 pb-24">
        <p className="text-slate-500">Načítám plán...</p>
      </div>
    );

  if (error || !plan)
    return (
      <div className="px-5 pt-8 pb-24">
        <p className="text-red-600">{error || 'Plán nenalezen'}</p>
        <Link href="/plans" className="text-brand-500 text-sm mt-4 block hover:underline">
          ← Zpět na historii
        </Link>
      </div>
    );

  return (
    <div className="printable-page">
      <style>{`
        @media print {
          .no-print { display: none; }
          body { background: white; }
          .printable-page { padding: 0; }
          .card { border: 1px solid #e2e8f0; page-break-inside: avoid; }
        }
      `}</style>

      <div className="px-5 pt-8 pb-24 animate-fade-in">
        {/* Header */}
        <div className="mb-6 no-print">
          <Link href="/plans" className="text-brand-500 text-sm hover:underline">
            ← Zpět na historii
          </Link>
        </div>

        {/* Print Controls */}
        <div className="flex gap-2 mb-6 no-print print:hidden">
          <button
            onClick={() => window.print()}
            className="flex-1 py-2 bg-brand-500 text-white rounded-lg font-semibold text-sm hover:bg-brand-600"
          >
            🖨️ Vytisknout
          </button>
          <button
            onClick={() => {
              const element = document.getElementById('plan-content');
              if (!element) return;
              const html = element.innerHTML;
              const printWindow = window.open('', '', 'height=600,width=800');
              if (printWindow) {
                printWindow.document.write(`
                  <html>
                    <head>
                      <title>Nutriční plán</title>
                      <style>
                        body { font-family: Arial, sans-serif; }
                        .card { border: 1px solid #e2e8f0; padding: 16px; margin: 8px 0; }
                        .meal { margin-left: 20px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
                        h2, h3 { margin-top: 20px; }
                      </style>
                    </head>
                    <body>${html}</body>
                  </html>
                `);
                printWindow.document.close();
                setTimeout(() => printWindow.print(), 250);
              }
            }}
            className="flex-1 py-2 bg-slate-500 text-white rounded-lg font-semibold text-sm hover:bg-slate-600"
          >
            📥 Stáhnout
          </button>
        </div>

        {/* Plan Content */}
        <div id="plan-content">
          <h1 className="text-3xl font-bold mb-2">🍗 Nutriční plán</h1>
          <p className="text-slate-600 mb-6">
            Platný od: <strong>{new Date(plan.platny_od).toLocaleDateString('cs-CZ')}</strong>
          </p>

          {/* Summary */}
          <div className="card mb-6 p-4">
            <h2 className="text-xl font-bold mb-4">📊 Přehled makronutrientů</h2>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">💪 Tréninkový den</h3>
                <div className="space-y-1 text-sm">
                  <p>
                    <strong>Kalorie:</strong> {plan.kalorie_treninkovy_den} kcal
                  </p>
                  <p>
                    <strong>Bílkoviny:</strong> {plan.bilkoviny_g}g
                  </p>
                  <p>
                    <strong>Sacharidy:</strong> {plan.sacharidy_g}g
                  </p>
                  <p>
                    <strong>Tuky:</strong> {plan.tuky_g}g
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-slate-800 mb-2">🛌 Odpočinkový den</h3>
                <div className="space-y-1 text-sm">
                  <p>
                    <strong>Kalorie:</strong> {plan.kalorie_odpocinkovy_den} kcal
                  </p>
                  <p>
                    <strong>Bílkoviny:</strong> {plan.bilkoviny_g}g
                  </p>
                  <p>
                    <strong>Sacharidy:</strong> {plan.sacharidy_g}g
                  </p>
                  <p>
                    <strong>Tuky:</strong> {plan.tuky_g}g
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Training Day Meals */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-4">💪 Jídla na tréninkový den</h2>
            <div className="space-y-3">
              {trainingMeals
                .sort((a, b) => {
                  const order = ['snidane', 'obed', 'svacina', 'vecere'];
                  return order.indexOf(a.jidlo_typ) - order.indexOf(b.jidlo_typ);
                })
                .map(meal => (
                  <MealCard key={meal.id} meal={meal} />
                ))}
            </div>
          </div>

          {/* Rest Day Meals */}
          <div>
            <h2 className="text-2xl font-bold mb-4">🛌 Jídla na odpočinkový den</h2>
            <div className="space-y-3">
              {restMeals
                .sort((a, b) => {
                  const order = ['snidane', 'obed', 'svacina', 'vecere'];
                  return order.indexOf(a.jidlo_typ) - order.indexOf(b.jidlo_typ);
                })
                .map(meal => (
                  <MealCard key={meal.id} meal={meal} />
                ))}
            </div>
          </div>

          {/* Footer for Print */}
          <div className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
            <p>FitCoach & NutriPro — Váš osobní fitness koučink</p>
            <p>
              Vygenerováno: {new Date().toLocaleDateString('cs-CZ', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MealCard({ meal }: { meal: Meal }) {
  const mealTypeLabel: Record<string, string> = {
    snidane: '🌅 Snídaně',
    obed: '🍽️ Oběd',
    svacina: '🍎 Svačina',
    vecere: '🌙 Večeře',
  };

  return (
    <div className="card p-4 bg-slate-50">
      <h3 className="font-bold text-slate-800 mb-2">
        {mealTypeLabel[meal.jidlo_typ]} — {meal.nazev}
      </h3>

      {/* Ingredients */}
      {meal.suroviny && meal.suroviny.length > 0 && (
        <div className="mb-3 text-sm">
          <strong>Složení:</strong>
          <ul className="list-disc list-inside text-slate-700 mt-1">
            {meal.suroviny.map((ing, i) => (
              <li key={i}>
                {ing.nazev} — {ing.mnozstvi}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Macros */}
      <div className="text-sm text-slate-600 space-y-0.5 border-t pt-3">
        <p>
          🔥 <strong>Kalorie:</strong> {meal.kalorie} kcal
        </p>
        <p>
          🥚 <strong>Bílkoviny:</strong> {meal.bilkoviny_g}g
        </p>
        <p>
          🌾 <strong>Sacharidy:</strong> {meal.sacharidy_g}g
        </p>
        <p>
          🧈 <strong>Tuky:</strong> {meal.tuky_g}g
        </p>
      </div>

      {meal.poznamka && (
        <p className="mt-2 text-xs text-slate-600 italic">💡 {meal.poznamka}</p>
      )}
    </div>
  );
}
