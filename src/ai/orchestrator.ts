// ============================================================
// AI Engine — Orchestrátor
// Koordinuje FitCoach a NutriPro agenty v sekvenci.
// Nikdy paralelně — NutriPro MUSÍ dostat výstup FitCoache.
// ============================================================

import type {
  AIInputContext,
  FitCoachOutput,
  NutriProOutput,
  OrchestratorOutput,
  WeightTrend,
  DailyCheckin,
  WorkoutSession,
  NutritionLog,
} from '../types/domain';
import { runCrossChecks } from './cross-check';
import { callFitCoach } from './fitcoach-agent';
import { callNutriPro } from './nutripro-agent';

const logger = console; // V produkci: structured logger (pino/winston)

// ─── Hlavní vstupní bod ─────────────────────────────────────

/**
 * Generuje kompletní návrh (trénink + strava) pro klienta.
 * Volá se:
 *  - 1× týdně (neděle večer) — pravidelný cyklus
 *  - Okamžitě při bolesti intenzity ≥ 6 — akutní reakce
 *  - Při onboardingu — první plán
 *
 * Vrací OrchestratorOutput nebo null pokud cross-check selže.
 * Při selhání cross-checku loguje důvod a vrací null.
 */
export async function generateRecommendation(
  context: AIInputContext,
  options: { maxRetries?: number; jobType?: string } = {}
): Promise<OrchestratorOutput | null> {
  const { maxRetries = 1, jobType = 'weekly_plan' } = options;

  logger.info('orchestrator.start', {
    user_id: context.profil.id,
    job_type: jobType,
    checkins: context.checkins_7d.length,
    treninky: context.treninky_7d.length,
  });

  // ─── Krok 1: Validace vstupních dat ───────────────────────
  const dataIssues = validateInputData(context);
  if (dataIssues.length > 0) {
    logger.warn('orchestrator.insufficient_data', { issues: dataIssues });
    // Pokud chybí kritická data, nevracíme nic
    if (dataIssues.some((i) => i.critical)) {
      return null;
    }
  }

  // ─── Krok 2: Zavolej FitCoach ─────────────────────────────
  logger.info('orchestrator.calling_fitcoach');
  let fitcoachOutput: FitCoachOutput;
  try {
    fitcoachOutput = await callFitCoach(context);
  } catch (error) {
    logger.error('orchestrator.fitcoach_failed', { error });
    throw new Error('FitCoach agent selhal: ' + (error as Error).message);
  }

  // ─── Krok 3: Zavolej NutriPro s výstupem FitCoache ───────
  logger.info('orchestrator.calling_nutripro', {
    intenzita_pristi_tyden: fitcoachOutput.intenzita_pristi_tyden,
  });
  let nutriproOutput: NutriProOutput;
  try {
    nutriproOutput = await callNutriPro(context, fitcoachOutput);
  } catch (error) {
    logger.error('orchestrator.nutripro_failed', { error });
    throw new Error('NutriPro agent selhal: ' + (error as Error).message);
  }

  // ─── Krok 4: Cross-check bezpečnostní pravidla ────────────
  const crossCheck = runCrossChecks(context, fitcoachOutput, nutriproOutput);

  if (!crossCheck.passed) {
    const blockers = crossCheck.rules.filter(
      (r) => !r.passed && r.severity === 'block'
    );

    logger.warn('orchestrator.cross_check_failed', {
      blockers: blockers.map((b) => ({
        pravidlo: b.pravidlo,
        detail: b.detail,
      })),
    });

    // Retry: pošli AI zpět s informací co opravit
    if (maxRetries > 0) {
      logger.info('orchestrator.retrying', { remaining_retries: maxRetries - 1 });
      // V produkci: přidej blockers do kontextu a zavolej znovu
      // Pro MVP: vrátíme null a uživatel dostane info
      return null;
    }

    return null;
  }

  // ─── Krok 5: Generuj týdenní shrnutí ──────────────────────
  const weeklySummary = generateWeeklySummary(context, fitcoachOutput, nutriproOutput);

  // ─── Krok 6: Sestav výstup ────────────────────────────────
  const output: OrchestratorOutput = {
    fitcoach: fitcoachOutput,
    nutripro: nutriproOutput,
    cross_check: crossCheck,
    weekly_summary: weeklySummary,
  };

  logger.info('orchestrator.completed', {
    user_id: context.profil.id,
    cross_check_passed: crossCheck.passed,
    warnings: crossCheck.rules.filter((r) => r.severity === 'warning').length,
  });

  return output;
}

// ─── Validace vstupních dat ─────────────────────────────────

interface DataIssue {
  field: string;
  message: string;
  critical: boolean;
}

function validateInputData(context: AIInputContext): DataIssue[] {
  const issues: DataIssue[] = [];

  if (!context.aktivni_cil) {
    issues.push({
      field: 'aktivni_cil',
      message: 'Klient nemá aktivní cíl. AI nemůže generovat plán.',
      critical: true,
    });
  }

  if (!context.profil.vyska_cm || !context.profil.aktualni_vaha_kg) {
    issues.push({
      field: 'profil',
      message: 'Chybí výška nebo váha v profilu.',
      critical: true,
    });
  }

  if (context.checkins_7d.length === 0) {
    issues.push({
      field: 'checkins',
      message: 'Žádné check-iny za posledních 7 dní.',
      critical: false,
    });
  }

  if (context.treninky_7d.length === 0 && context.aktivni_treninkovy_plan != null) {
    issues.push({
      field: 'treninky',
      message: 'Žádné tréninky za 7 dní ale existuje aktivní plán — možná klient skipuje.',
      critical: false,
    });
  }

  return issues;
}

// ─── Výpočet trendu váhy ────────────────────────────────────

export function computeWeightTrend(
  checkins: DailyCheckin[],
  daysBack: number = 14
): WeightTrend {
  const withWeight = checkins
    .filter((c) => c.vaha_kg != null)
    .sort((a, b) => a.datum.localeCompare(b.datum));

  if (withWeight.length < 2) {
    return {
      hodnoty: withWeight.map((c) => ({ datum: c.datum, vaha_kg: c.vaha_kg! })),
      prumer_7d: withWeight.length === 1 ? withWeight[0].vaha_kg : null,
      prumer_14d: null,
      smer: 'nedostatek_dat',
      zmena_za_14d_kg: null,
      zmena_za_14d_pct: null,
    };
  }

  const values = withWeight.map((c) => c.vaha_kg!);
  const last7 = values.slice(-Math.min(7, values.length));
  const last14 = values.slice(-Math.min(14, values.length));

  const avg7 = last7.reduce((s, v) => s + v, 0) / last7.length;
  const avg14 = last14.reduce((s, v) => s + v, 0) / last14.length;

  // Směr: porovnání průměru první a druhé poloviny 14denního okna
  const firstHalf = last14.slice(0, Math.floor(last14.length / 2));
  const secondHalf = last14.slice(Math.floor(last14.length / 2));
  const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;

  const diff = avgSecond - avgFirst;
  // Práh: méně než 0.3kg rozdíl za 7 dní = stojí
  let smer: WeightTrend['smer'];
  if (Math.abs(diff) < 0.3) smer = 'stoji';
  else if (diff < 0) smer = 'klesa';
  else smer = 'roste';

  const zmena = values[values.length - 1] - values[0];
  const zmenaPct = (zmena / values[0]) * 100;

  return {
    hodnoty: withWeight.map((c) => ({ datum: c.datum, vaha_kg: c.vaha_kg! })),
    prumer_7d: Math.round(avg7 * 10) / 10,
    prumer_14d: Math.round(avg14 * 10) / 10,
    smer,
    zmena_za_14d_kg: Math.round(zmena * 10) / 10,
    zmena_za_14d_pct: Math.round(zmenaPct * 10) / 10,
  };
}

// ─── Týdenní shrnutí ────────────────────────────────────────

function generateWeeklySummary(
  context: AIInputContext,
  fitcoach: FitCoachOutput,
  nutripro: NutriProOutput
): OrchestratorOutput['weekly_summary'] {
  const checkins = context.checkins_7d;
  const workouts = context.treninky_7d;

  // Adherence
  const planned = context.profil.treninky_tyden;
  const done = workouts.filter((w) => w.odcviceno).length;
  const adherencePct = planned > 0 ? Math.round((done / planned) * 100) : 0;

  // Průměry
  const avgSleep =
    checkins.filter((c) => c.spanek_hodin != null).length > 0
      ? checkins
          .filter((c) => c.spanek_hodin != null)
          .reduce((s, c) => s + c.spanek_hodin!, 0) /
        checkins.filter((c) => c.spanek_hodin != null).length
      : null;

  const avgEnergie =
    checkins.filter((c) => c.energie != null).length > 0
      ? checkins
          .filter((c) => c.energie != null)
          .reduce((s, c) => s + c.energie!, 0) /
        checkins.filter((c) => c.energie != null).length
      : null;

  // Sestavení textů
  const positives: string[] = [];
  const challenges: string[] = [];

  if (adherencePct >= 80) positives.push(`Splnil/a jsi ${adherencePct}% tréninků — skvělé!`);
  else if (adherencePct >= 50) challenges.push(`Tréninky na ${adherencePct}% — zkusíme to zlepšit.`);
  else challenges.push(`Pouze ${adherencePct}% tréninků. Pojďme najít realistický plán.`);

  if (avgSleep != null && avgSleep >= 7.5) positives.push(`Spánek výborný (${avgSleep.toFixed(1)}h).`);
  else if (avgSleep != null && avgSleep < 6.5) challenges.push(`Spánek je nízký (${avgSleep.toFixed(1)}h) — ovlivňuje regeneraci.`);

  if (context.vaha_trend_14d.smer === 'klesa' && context.aktivni_cil?.typ_cile === 'hubnuti') {
    positives.push(`Váha klesá (${context.vaha_trend_14d.zmena_za_14d_kg}kg za 14 dní) — jsi na správné cestě!`);
  }

  if (context.vaha_trend_14d.smer === 'stoji' && context.aktivni_cil?.typ_cile === 'hubnuti') {
    challenges.push('Váha stojí — NutriPro upraví kalorie.');
  }

  // Upozornění z obou agentů
  const allWarnings = [...fitcoach.upozorneni, ...nutripro.upozorneni];
  for (const w of allWarnings) {
    challenges.push(w);
  }

  return {
    pozitivni_pozorovani: positives.join(' ') || 'Pokračuj v tom co děláš!',
    vyzvy: challenges.join(' ') || 'Žádné zásadní výzvy — super!',
    doporuceni: fitcoach.zduvodneni + ' ' + nutripro.zduvodneni,
    motivacni_zprava: generateMotivation(adherencePct, context.vaha_trend_14d.smer),
  };
}

function generateMotivation(
  adherence: number,
  weightDirection: string
): string {
  if (adherence >= 80 && weightDirection === 'klesa') {
    return 'Máš to skvěle! Výsledky přicházejí. Drž se toho! 💪';
  }
  if (adherence >= 80) {
    return 'Skvělá disciplína! Výsledky přijdou, dej tomu čas.';
  }
  if (adherence >= 50) {
    return 'Každý trénink se počítá. Pojďme příští týden přidat jeden navíc.';
  }
  return 'Těžký týden? Stává se. Důležité je nezastavit se úplně. Jeden malý krok zítra.';
}

// ─── Sesbírání dat z DB ─────────────────────────────────────
// V produkci: tohle volá repository vrstva

export async function collectAIInputContext(
  userId: string,
  db: any // V produkci: Prisma/Drizzle client
): Promise<AIInputContext> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twentyOneDaysAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);

  const [
    profil,
    aktivniCil,
    checkins7d,
    treninky7d,
    strava7d,
    aktivniTrenink,
    aktivniNutrice,
    checkinsForTrend,
    zdravotniProblemy,
    wearableData,
  ] = await Promise.all([
    db.fitness_profiles.findUnique({ where: { id: userId } }),
    db.goals.findFirst({ where: { user_id: userId, aktivni: true } }),
    db.daily_checkins.findMany({
      where: { user_id: userId, datum: { gte: sevenDaysAgo } },
      orderBy: { datum: 'asc' },
    }),
    db.workout_sessions.findMany({
      where: { user_id: userId, datum: { gte: sevenDaysAgo } },
      include: { sets: true },
      orderBy: { datum: 'asc' },
    }),
    db.nutrition_logs.findMany({
      where: { user_id: userId, datum: { gte: sevenDaysAgo } },
      orderBy: { datum: 'asc' },
    }),
    db.training_plans.findFirst({
      where: { user_id: userId, status: 'active' },
      include: { days: { include: { exercises: true } } },
    }),
    db.nutrition_plans.findFirst({
      where: { user_id: userId, status: 'active' },
      include: { meals: true },
    }),
    db.daily_checkins.findMany({
      where: { user_id: userId, datum: { gte: twentyOneDaysAgo } },
      orderBy: { datum: 'asc' },
    }),
    db.health_issues.findMany({
      where: { user_id: userId, vyreseno: false },
    }),
    db.wearable_data_daily.findMany({
      where: { user_id: userId, datum: { gte: sevenDaysAgo } },
      orderBy: { datum: 'asc' },
    }),
  ]);

  return {
    profil,
    aktivni_cil: aktivniCil,
    checkins_7d: checkins7d,
    treninky_7d: treninky7d,
    strava_7d: strava7d,
    aktivni_treninkovy_plan: aktivniTrenink,
    aktivni_nutricni_plan: aktivniNutrice,
    vaha_trend_14d: computeWeightTrend(checkinsForTrend),
    zdravotni_problemy: zdravotniProblemy,
    wearable_data_7d: wearableData,
  };
}
