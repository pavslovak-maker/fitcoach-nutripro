// ============================================================
// AI Service — synchronní generování plánu
// Sesbírá data → zavolá orchestrátor → uloží plán do DB
// ============================================================

import prisma from '../db/client';
import { generateRecommendation, computeWeightTrend } from '../ai/orchestrator';
import type { AIInputContext, OrchestratorOutput } from '../types/domain';

const logger = console;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Date(d.toISOString().split('T')[0]);
}

function todayDate(): Date {
  return new Date(new Date().toISOString().split('T')[0]);
}

/**
 * Sesbírá kompletní kontext pro AI z databáze.
 */
export async function collectContext(userId: string): Promise<AIInputContext | null> {
  const [
    profil,
    cil,
    checkins7d,
    treninky7d,
    strava7d,
    trainPlan,
    nutriPlan,
    checkins21d,
    zdravi,
    wearable,
  ] = await Promise.all([
    prisma.fitnessProfile.findUnique({ where: { id: userId } }),
    prisma.goal.findFirst({ where: { user_id: userId, aktivni: true } }),
    prisma.dailyCheckin.findMany({
      where: { user_id: userId, datum: { gte: daysAgo(7) } },
      orderBy: { datum: 'asc' },
    }),
    prisma.workoutSession.findMany({
      where: { user_id: userId, datum: { gte: daysAgo(7) } },
      include: { sets: true },
      orderBy: { datum: 'asc' },
    }),
    prisma.nutritionLog.findMany({
      where: { user_id: userId, datum: { gte: daysAgo(7) } },
      orderBy: { datum: 'asc' },
    }),
    prisma.trainingPlan.findFirst({
      where: { user_id: userId, status: 'active' },
      include: { days: { include: { exercises: true } } },
    }),
    prisma.nutritionPlan.findFirst({
      where: { user_id: userId, status: 'active' },
      include: { meals: true },
    }),
    prisma.dailyCheckin.findMany({
      where: { user_id: userId, datum: { gte: daysAgo(21) } },
      orderBy: { datum: 'asc' },
    }),
    prisma.healthIssue.findMany({ where: { user_id: userId, vyreseno: false } }),
    prisma.wearableDataDaily.findMany({
      where: { user_id: userId, datum: { gte: daysAgo(7) } },
      orderBy: { datum: 'asc' },
    }),
  ]);

  if (!profil) return null;

  // Prisma vrací Decimal a Date — převedeme na primitivy pro AI
  const normalize = (arr: any[]) =>
    arr.map((item) => ({
      ...item,
      datum: item.datum instanceof Date ? item.datum.toISOString().split('T')[0] : item.datum,
      vaha_kg: item.vaha_kg != null ? Number(item.vaha_kg) : null,
      spanek_hodin: item.spanek_hodin != null ? Number(item.spanek_hodin) : null,
      pitny_rezim_litru: item.pitny_rezim_litru != null ? Number(item.pitny_rezim_litru) : null,
      bilkoviny_g: item.bilkoviny_g != null ? Number(item.bilkoviny_g) : null,
      sacharidy_g: item.sacharidy_g != null ? Number(item.sacharidy_g) : null,
      tuky_g: item.tuky_g != null ? Number(item.tuky_g) : null,
      zatez_kg: item.zatez_kg != null ? Number(item.zatez_kg) : null,
    }));

  return {
    profil: {
      ...profil,
      datum_narozeni: profil.datum_narozeni.toISOString().split('T')[0],
      aktualni_vaha_kg: Number(profil.aktualni_vaha_kg),
      pevne_terminy: (profil.pevne_terminy as any) ?? [],
    } as any,
    aktivni_cil: cil
      ? {
          ...cil,
          cilova_vaha_kg: cil.cilova_vaha_kg != null ? Number(cil.cilova_vaha_kg) : null,
          datum_od: cil.datum_od.toISOString().split('T')[0],
          datum_do: cil.datum_do?.toISOString().split('T')[0] ?? null,
        } as any
      : null,
    checkins_7d: normalize(checkins7d) as any,
    treninky_7d: treninky7d.map((t) => ({
      ...t,
      datum: t.datum.toISOString().split('T')[0],
      sets: t.sets.map((s) => ({ ...s, zatez_kg: s.zatez_kg != null ? Number(s.zatez_kg) : null })),
    })) as any,
    strava_7d: normalize(strava7d) as any,
    aktivni_treninkovy_plan: trainPlan as any,
    aktivni_nutricni_plan: nutriPlan
      ? {
          ...nutriPlan,
          meals: nutriPlan.meals.map((m) => ({
            ...m,
            bilkoviny_g: Number(m.bilkoviny_g),
            sacharidy_g: Number(m.sacharidy_g),
            tuky_g: Number(m.tuky_g),
          })),
        } as any
      : null,
    vaha_trend_14d: computeWeightTrend(normalize(checkins21d) as any),
    zdravotni_problemy: zdravi as any,
    wearable_data_7d: normalize(wearable) as any,
  };
}

/**
 * Uloží AI výstup do databáze — archivuje staré plány, vytvoří nové.
 */
export async function savePlans(
  userId: string,
  result: OrchestratorOutput
): Promise<{ trainingPlanId: string; nutritionPlanId: string; recommendationId: string }> {
  return prisma.$transaction(async (tx) => {
    // 1. Archivuj staré aktivní plány
    await tx.trainingPlan.updateMany({
      where: { user_id: userId, status: 'active' },
      data: { status: 'archived', platny_do: todayDate() },
    });
    await tx.nutritionPlan.updateMany({
      where: { user_id: userId, status: 'active' },
      data: { status: 'archived' },
    });

    // 2. Ulož AI doporučení (audit trail)
    const rec = await tx.aIRecommendation.create({
      data: {
        user_id: userId,
        typ: 'trenink_uprava',
        status: 'prijato',
        popis: result.weekly_summary.doporuceni.slice(0, 500),
        zduvodneni: `${result.fitcoach.zduvodneni}\n\n${result.nutripro.zduvodneni}`,
        navrzena_hodnota: {
          treninkovy_plan: result.fitcoach.treninkovy_plan,
          nutricni_plan: result.nutripro.nutricni_plan,
        } as any,
        vstupni_data_snapshot: {} as any, // šetříme místo — snapshot je velký
        generated_by: 'orchestrator',
        cross_check_passed: result.cross_check.passed,
        cross_check_log: result.cross_check as any,
        decided_at: new Date(),
      },
    });

    // 3. Vytvoř tréninkový plán
    const trainingPlan = await tx.trainingPlan.create({
      data: {
        user_id: userId,
        nazev: `Plán od ${new Date().toLocaleDateString('cs-CZ')}`,
        status: 'active',
        platny_od: todayDate(),
        generated_by: 'fitcoach_ai',
        recommendation_id: rec.id,
      },
    });

    for (const day of result.fitcoach.treninkovy_plan.dny) {
      const planDay = await tx.trainingPlanDay.create({
        data: {
          plan_id: trainingPlan.id,
          den: day.den,
          typ_dne: day.typ_dne,
          delka_min: day.delka_min,
        },
      });

      if (day.cviky?.length) {
        await tx.trainingPlanExercise.createMany({
          data: day.cviky.map((ex, i) => ({
            plan_day_id: planDay.id,
            poradi: i + 1,
            cvik: ex.cvik,
            serie: ex.serie,
            opakovani: String(ex.opakovani),
            zatez_doporucena: ex.zatez ?? null,
            pauza_s: ex.pauza_s ?? 90,
            poznamka_technika: ex.poznamka ?? null,
          })),
        });
      }
    }

    // 4. Vytvoř nutriční plán
    const np = result.nutripro.nutricni_plan;
    const nutritionPlan = await tx.nutritionPlan.create({
      data: {
        user_id: userId,
        status: 'active',
        kalorie_treninkovy_den: np.kalorie_treninkovy_den,
        kalorie_odpocinkovy_den: np.kalorie_odpocinkovy_den,
        bilkoviny_g: np.bilkoviny_g,
        sacharidy_g: np.sacharidy_g,
        tuky_g: np.tuky_g,
        platny_od: todayDate(),
        generated_by: 'nutripro_ai',
        recommendation_id: rec.id,
      },
    });

    if (np.jidla?.length) {
      await tx.nutritionPlanMeal.createMany({
        data: np.jidla.map((m) => ({
          plan_id: nutritionPlan.id,
          jidlo_typ: m.typ,
          je_treninkovy_den: m.je_treninkovy_den,
          nazev: m.nazev,
          suroviny: (m.suroviny ?? []) as any,
          kalorie: m.kalorie,
          bilkoviny_g: m.bilkoviny_g,
          sacharidy_g: m.sacharidy_g,
          tuky_g: m.tuky_g,
          poznamka: m.poznamka ?? null,
        })),
      });
    }

    return {
      trainingPlanId: trainingPlan.id,
      nutritionPlanId: nutritionPlan.id,
      recommendationId: rec.id,
    };
  }, { timeout: 20000 }); // AI transakce může trvat déle
}

/**
 * Kompletní flow: sesbírej data → generuj → ulož.
 * Vrací null pokud AI selhala nebo cross-check zablokoval.
 */
export async function generateAndSavePlan(
  userId: string,
  jobType: 'onboarding' | 'weekly_plan' | 'immediate_pain' = 'weekly_plan'
): Promise<{ success: boolean; error?: string; result?: OrchestratorOutput }> {
  logger.info('ai-service.start', { userId, jobType });

  try {
    // 1. Sesbírej kontext
    const context = await collectContext(userId);
    if (!context) {
      return { success: false, error: 'profile_not_found' };
    }
    if (!context.aktivni_cil) {
      return { success: false, error: 'no_active_goal' };
    }

    // 2. Zavolej AI
    const result = await generateRecommendation(context, { jobType });

    if (!result) {
      return { success: false, error: 'cross_check_failed' };
    }

    // 3. Ulož
    await savePlans(userId, result);

    logger.info('ai-service.success', { userId, jobType });
    return { success: true, result };
  } catch (error: any) {
    logger.error('ai-service.error', { userId, error: error.message });
    return { success: false, error: error.message };
  }
}
