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
  days: TrainingDay[];
}

interface TrainingDay {
  id: string;
  den: string;
  typ_dne: string;
  delka_min: number;
  poznamka: string | null;
  exercises: Exercise[];
}

interface Exercise {
  id: string;
  poradi: number;
  cvik: string;
  serie: number;
  opakovani: string;
  zatez_doporucena: string | null;
  pauza_s: number;
  poznamka_technika: string | null;
}

export default function TrainingPlanDetailPage({ params }: { params: { id: string } }) {
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPlan();
  }, []);

  const loadPlan = async () => {
    setLoading(true);
    try {
      const data = await api.get<any>('/plans/training');
      // Hacky way — in real app you'd want /plans/training/:id endpoint
      // For now, we'll load from history and find it
      const historyData = await api.get<any>('/plans/history');
      const found = historyData.trainingPlans.find((p: any) => p.id === params.id);
      if (!found) throw new Error('Plán nenalezen');
      setPlan(found);
    } catch (e: any) {
      setError(e.message ?? 'Chyba při načítání plánu');
    } finally {
      setLoading(false);
    }
  };

  const daysOfWeek: Record<string, string> = {
    po: 'Pondělí',
    ut: 'Úterý',
    st: 'Středa',
    ct: 'Čtvrtek',
    pa: 'Pátek',
    so: 'Sobota',
    ne: 'Neděle',
  };

  const getDayColor = (typ: string) => {
    if (typ === 'rest') return 'bg-slate-50 border-l-4 border-slate-300';
    if (typ === 'light') return 'bg-blue-50 border-l-4 border-blue-300';
    if (typ === 'medium') return 'bg-orange-50 border-l-4 border-orange-300';
    return 'bg-red-50 border-l-4 border-red-300';
  };

  const getDayLabel = (typ: string) => {
    if (typ === 'rest') return '🛌 Odpočinek';
    if (typ === 'light') return '🏃 Lehký';
    if (typ === 'medium') return '💪 Středně těžký';
    return '🔥 Těžký';
  };

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
                      <title>${plan.nazev}</title>
                      <style>
                        body { font-family: Arial, sans-serif; }
                        .card { border: 1px solid #e2e8f0; padding: 16px; margin: 8px 0; }
                        .exercise { margin-left: 20px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
                        h2 { margin-top: 20px; }
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
          <h1 className="text-3xl font-bold mb-2">{plan.nazev}</h1>
          <p className="text-slate-600 mb-6">
            Platný od: <strong>{new Date(plan.platny_od).toLocaleDateString('cs-CZ')}</strong>
            {plan.platny_do && ` do ${new Date(plan.platny_do).toLocaleDateString('cs-CZ')}`}
          </p>

          {/* Days */}
          <div className="space-y-4">
            {plan.days
              .sort((a, b) => {
                const order = ['po', 'ut', 'st', 'ct', 'pa', 'so', 'ne'];
                return order.indexOf(a.den) - order.indexOf(b.den);
              })
              .map(day => (
                <div key={day.id} className={`card ${getDayColor(day.typ_dne)}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-bold">
                      {daysOfWeek[day.den] || day.den}
                    </h2>
                    <span className="text-sm font-semibold">
                      {getDayLabel(day.typ_dne)} — {day.delka_min} min
                    </span>
                  </div>

                  {day.poznamka && (
                    <p className="text-sm text-slate-700 mb-3 italic">💡 {day.poznamka}</p>
                  )}

                  {day.typ_dne === 'rest' ? (
                    <p className="text-slate-600">Odpočinuj si, regeneruj se 😊</p>
                  ) : (
                    <div className="space-y-3">
                      {day.exercises.map(ex => (
                        <div key={ex.id} className="exercise bg-white bg-opacity-50 p-3 rounded">
                          <div className="font-semibold text-slate-800">
                            {ex.poradi}. {ex.cvik}
                          </div>
                          <div className="text-sm text-slate-600 mt-1 space-y-0.5">
                            <p>
                              <strong>Série:</strong> {ex.serie} × {ex.opakovani} opakování
                            </p>
                            {ex.zatez_doporucena && (
                              <p>
                                <strong>Zátěž:</strong> {ex.zatez_doporucena}
                              </p>
                            )}
                            <p>
                              <strong>Pauza:</strong> {ex.pauza_s} sekund
                            </p>
                            {ex.poznamka_technika && (
                              <p className="italic text-slate-500">
                                💭 {ex.poznamka_technika}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
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
