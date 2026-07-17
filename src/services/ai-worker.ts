// ============================================================
// AI Worker — zpracovává AI generování z fronty (BullMQ)
// Běží jako samostatný proces — nezatěžuje API server
// ============================================================

import type { OrchestratorOutput } from '../types/domain';

// V produkci:
// import { Worker, Job } from 'bullmq';
// import { db } from '../db';
// import { generateRecommendation, collectAIInputContext } from '../ai/orchestrator';

const logger = console;

interface AIJobPayload {
  job_id: string;
  user_id: string;
  job_type?: string;
}

/**
 * Worker který zpracovává AI generování.
 * BullMQ automaticky retry-uje při selhání (max 3×, exponential backoff).
 */
export function startAIWorker() {
  // const worker = new Worker('ai-generation', processAIJob, {
  //   connection: { host: process.env.REDIS_HOST, port: 6379 },
  //   concurrency: 3, // Max 3 paralelní AI generování
  //   limiter: { max: 10, duration: 60000 }, // Max 10 jobů/minutu (rate limit)
  // });

  // worker.on('completed', (job) => {
  //   logger.info('ai-worker.completed', { jobId: job.id, data: job.data });
  // });

  // worker.on('failed', (job, err) => {
  //   logger.error('ai-worker.failed', { jobId: job?.id, error: err.message });
  // });

  logger.info('AI Worker started');
}

async function processAIJob(job: any /* Job<AIJobPayload> */): Promise<void> {
  const { job_id, user_id, job_type } = job.data;

  logger.info('ai-worker.processing', { job_id, user_id, job_type });

  try {
    // 1. Označ job jako "processing"
    await db.ai_jobs.update({
      where: { id: job_id },
      data: { status: 'processing', started_at: new Date() },
    });

    // 2. Sesbírej data z DB
    const context = await collectAIInputContext(user_id, db);

    // 3. Spusť orchestrátor (FitCoach → NutriPro → cross-check)
    const result: OrchestratorOutput | null = await generateRecommendation(
      context,
      { jobType: job_type }
    );

    if (!result) {
      await db.ai_jobs.update({
        where: { id: job_id },
        data: {
          status: 'failed',
          error_message: 'Cross-check selhal — AI návrh nebyl bezpečný.',
          completed_at: new Date(),
        },
      });
      return;
    }

    // 4. Ulož AI doporučení do DB
    const recommendation = await db.ai_recommendations.create({
      data: {
        user_id,
        typ: 'trenink_uprava',
        status: 'navrzeno',
        popis: result.weekly_summary.doporuceni,
        zduvodneni: result.fitcoach.zduvodneni + '\n\n' + result.nutripro.zduvodneni,
        puvodni_hodnota: null,
        navrzena_hodnota: {
          treninkovy_plan: result.fitcoach.treninkovy_plan,
          nutricni_plan: result.nutripro.nutricni_plan,
        },
        vstupni_data_snapshot: context,
        generated_by: 'orchestrator',
        cross_check_passed: result.cross_check.passed,
        cross_check_log: result.cross_check,
        idempotency_key: `rec_${job_id}`,
      },
    });

    // 5. Ulož týdenní analýzu
    const weekStart = getMonday(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    await db.weekly_analyses.upsert({
      where: {
        user_id_tyden_od: { user_id, tyden_od: weekStart.toISOString().split('T')[0] },
      },
      create: {
        user_id,
        tyden_od: weekStart.toISOString().split('T')[0],
        tyden_do: weekEnd.toISOString().split('T')[0],
        ...computeWeeklyMetrics(context),
        pozitivni_pozorovani: result.weekly_summary.pozitivni_pozorovani,
        vyzvy: result.weekly_summary.vyzvy,
        doporuceni: result.weekly_summary.doporuceni,
        motivacni_zprava: result.weekly_summary.motivacni_zprava,
      },
      update: {
        pozitivni_pozorovani: result.weekly_summary.pozitivni_pozorovani,
        vyzvy: result.weekly_summary.vyzvy,
        doporuceni: result.weekly_summary.doporuceni,
        motivacni_zprava: result.weekly_summary.motivacni_zprava,
      },
    });

    // 6. Pro onboarding: automaticky aktivuj plán (bez čekání na accept)
    if (job_type === 'onboarding') {
      await autoActivatePlan(user_id, recommendation.id, result);
    }

    // 7. Označ job jako completed
    await db.ai_jobs.update({
      where: { id: job_id },
      data: {
        status: 'completed',
        result_recommendation_id: recommendation.id,
        completed_at: new Date(),
      },
    });

    // 8. Pošli notifikaci klientovi
    await sendNotification(user_id, {
      title: job_type === 'onboarding' 
        ? 'Tvůj první plán je připravený! 🎉' 
        : 'Nový plán na příští týden',
      body: result.weekly_summary.motivacni_zprava,
    });

    logger.info('ai-worker.success', { job_id, recommendation_id: recommendation.id });
  } catch (error) {
    logger.error('ai-worker.error', { job_id, error: (error as Error).message });

    await db.ai_jobs.update({
      where: { id: job_id },
      data: {
        status: 'failed',
        error_message: (error as Error).message.substring(0, 500),
        completed_at: new Date(),
      },
    });

    throw error; // BullMQ retry
  }
}

// ─── Helpers ────────────────────────────────────────────────

function computeWeeklyMetrics(context: any) {
  const checkins = context.checkins_7d;
  const workouts = context.treninky_7d;

  const weights = checkins.filter((c: any) => c.vaha_kg != null);
  const sleeps = checkins.filter((c: any) => c.spanek_hodin != null);
  const energies = checkins.filter((c: any) => c.energie != null);
  const rpes = workouts.filter((w: any) => w.odcviceno && w.rpe != null);

  return {
    prumerna_vaha: weights.length > 0
      ? avg(weights.map((c: any) => c.vaha_kg))
      : null,
    zmena_vahy: context.vaha_trend_14d.zmena_za_14d_kg,
    prumerny_spanek: sleeps.length > 0
      ? avg(sleeps.map((c: any) => c.spanek_hodin))
      : null,
    prumerny_rpe: rpes.length > 0
      ? avg(rpes.map((w: any) => w.rpe))
      : null,
    prumerna_energie: energies.length > 0
      ? avg(energies.map((c: any) => c.energie))
      : null,
    pocet_treninku: workouts.filter((w: any) => w.odcviceno).length,
    pocet_planovanych_treninku: context.profil.treninky_tyden,
    adherence_treninky_pct: context.profil.treninky_tyden > 0
      ? Math.round((workouts.filter((w: any) => w.odcviceno).length / context.profil.treninky_tyden) * 100)
      : null,
  };
}

async function autoActivatePlan(
  userId: string,
  recommendationId: string,
  result: OrchestratorOutput
): Promise<void> {
  // Vytvoř tréninkový plán
  const trainingPlan = await db.training_plans.create({
    data: {
      user_id: userId,
      nazev: 'Tvůj první plán',
      status: 'active',
      platny_od: new Date().toISOString().split('T')[0],
      generated_by: 'fitcoach_ai',
      recommendation_id: recommendationId,
    },
  });

  // Vytvoř dny a cviky
  for (const day of result.fitcoach.treninkovy_plan.dny) {
    const planDay = await db.training_plan_days.create({
      data: {
        plan_id: trainingPlan.id,
        den: day.den,
        typ_dne: day.typ_dne,
        delka_min: day.delka_min,
      },
    });

    if (day.cviky) {
      await db.training_plan_exercises.createMany({
        data: day.cviky.map((ex: any, i: number) => ({
          plan_day_id: planDay.id,
          poradi: i + 1,
          cvik: ex.cvik,
          serie: ex.serie,
          opakovani: ex.opakovani,
          zatez_doporucena: ex.zatez,
          pauza_s: ex.pauza_s,
          poznamka_technika: ex.poznamka,
        })),
      });
    }
  }

  // Vytvoř nutriční plán
  const np = result.nutripro.nutricni_plan;
  const nutritionPlan = await db.nutrition_plans.create({
    data: {
      user_id: userId,
      status: 'active',
      kalorie_treninkovy_den: np.kalorie_treninkovy_den,
      kalorie_odpocinkovy_den: np.kalorie_odpocinkovy_den,
      bilkoviny_g: np.bilkoviny_g,
      sacharidy_g: np.sacharidy_g,
      tuky_g: np.tuky_g,
      platny_od: new Date().toISOString().split('T')[0],
      generated_by: 'nutripro_ai',
      recommendation_id: recommendationId,
    },
  });

  // Vytvoř jídla
  if (np.jidla) {
    await db.nutrition_plan_meals.createMany({
      data: np.jidla.map((meal: any) => ({
        plan_id: nutritionPlan.id,
        jidlo_typ: meal.typ,
        je_treninkovy_den: meal.je_treninkovy_den,
        nazev: meal.nazev,
        suroviny: meal.suroviny,
        kalorie: meal.kalorie,
        bilkoviny_g: meal.bilkoviny_g,
        sacharidy_g: meal.sacharidy_g,
        tuky_g: meal.tuky_g,
        poznamka: meal.poznamka,
      })),
    });
  }

  // Označ recommendation jako přijatou
  await db.ai_recommendations.update({
    where: { id: recommendationId },
    data: { status: 'prijato', decided_at: new Date() },
  });
}

async function sendNotification(userId: string, payload: { title: string; body: string }): Promise<void> {
  // V produkci: FCM / APNs push notification
  logger.info('notification.send', { userId, ...payload });
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

function avg(arr: number[]): number {
  return arr.length > 0
    ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10
    : 0;
}

// Placeholder pro DB
const db: any = {};
const collectAIInputContext: any = async () => ({});
const generateRecommendation: any = async () => null;
