// ============================================================
// API Routes — REÁLNÁ IMPLEMENTACE
// Fastify + Prisma + argon2 + JWT
// ============================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import prisma from '../db/client';
import { calculateAllNutrition, calculateAge } from '../utils/nutrition-calc';
import { generateAndSavePlan } from '../services/ai-service';
import type {
  RegisterRequest,
  DailyCheckinRequest,
  WorkoutLogRequest,
  NutritionLogRequest,
} from '../types/domain';

const JWT_SECRET = process.env.JWT_SECRET!;

// ─── Auth helpers ───────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

function generateToken(payload: { userId: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function requireAuth() {
  return async (req: any, reply: FastifyReply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'missing_token' });
    }
    try {
      const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as any;
      req.auth = { userId: decoded.userId, role: decoded.role };
    } catch {
      return reply.status(401).send({ error: 'invalid_token' });
    }
  };
}

// ─── Date helpers ───────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function todayDate(): Date {
  return new Date(todayStr());
}

function getDayOfWeek(date: Date): string {
  return ['ne', 'po', 'ut', 'st', 'ct', 'pa', 'so'][date.getDay()];
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Date(d.toISOString().split('T')[0]);
}

function weekStart(): Date {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return new Date(d.toISOString().split('T')[0]);
}

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── Routes ─────────────────────────────────────────────

export function registerRoutes(app: FastifyInstance) {

  // ════════════════════════════════════════════════════════
  // AUTH
  // ════════════════════════════════════════════════════════

  app.post('/auth/register', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as RegisterRequest;

    // Kontrola duplicity
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.status(409).send({ error: 'email_taken' });
    }

    // Výpočty
    const age = calculateAge(body.profile.datum_narozeni);
    const nutrition = calculateAllNutrition({
      vaha_kg: body.profile.aktualni_vaha_kg,
      vyska_cm: body.profile.vyska_cm,
      vek: age,
      pohlavi: body.profile.pohlavi,
      uroven_cviceni: body.profile.uroven_cviceni,
      treninky_tyden: body.profile.treninky_tyden,
      typ_cile: body.goal.typ_cile,
    });

    // Transakce: user + profil + cíl + notifikace
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: body.email,
          password_hash: await hashPassword(body.password),
          role: 'client',
        },
      });

      await tx.fitnessProfile.create({
        data: {
          id: u.id,
          jmeno: body.profile.jmeno,
          pohlavi: body.profile.pohlavi,
          datum_narozeni: new Date(body.profile.datum_narozeni),
          vyska_cm: body.profile.vyska_cm,
          aktualni_vaha_kg: body.profile.aktualni_vaha_kg,
          uroven_cviceni: body.profile.uroven_cviceni,
          treninky_tyden: body.profile.treninky_tyden,
          delka_treninku_min: body.profile.delka_treninku_min,
          dostupne_vybaveni: body.profile.dostupne_vybaveni,
          zdravotni_omezeni: body.profile.zdravotni_omezeni,
          alergie_intolerance: body.profile.alergie_intolerance,
          leky: body.profile.leky ?? null,
          stravovaci_preference: body.profile.stravovaci_preference ?? null,
          pocet_jidel_denne: body.profile.pocet_jidel_denne ?? 4,
          food_logging_mode: body.profile.food_logging_mode ?? 'simple',
          pevne_terminy: (body.profile.pevne_terminy ?? []) as any,
          preferovany_cas_treninku: body.profile.preferovany_cas_treninku ?? null,
          bmr_kcal: nutrition.bmr_kcal,
          tdee_kcal: nutrition.tdee_kcal,
          cilove_kalorie: nutrition.cilove_kalorie,
          cilove_bilkoviny_g: nutrition.cilove_bilkoviny_g,
          cilove_sacharidy_g: nutrition.cilove_sacharidy_g,
          cilove_tuky_g: nutrition.cilove_tuky_g,
        },
      });

      await tx.goal.create({
        data: {
          user_id: u.id,
          typ_cile: body.goal.typ_cile,
          cilova_vaha_kg: body.goal.cilova_vaha_kg ?? null,
          aktivni: true,
        },
      });

      await tx.notificationPreferences.create({ data: { id: u.id } });

      return u;
    });

    const token = generateToken({ userId: user.id, role: user.role });

    // Vygeneruj první plán na pozadí — neblokuje odpověď.
    // Uživatel dostane token hned, plán se objeví za ~20s.
    generateAndSavePlan(user.id, 'onboarding')
      .then((r) => req.log.info({ userId: user.id, ok: r.success }, 'onboarding.plan'))
      .catch((e) => req.log.error({ userId: user.id, err: e.message }, 'onboarding.plan.failed'));

    return reply.status(201).send({ token, refreshToken: token, userId: user.id });
  });

  app.post('/auth/login', async (req: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = req.body as { email: string; password: string };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return reply.status(401).send({ error: 'invalid_credentials' });
    }
    if (!user.is_active) {
      return reply.status(403).send({ error: 'account_disabled' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    const token = generateToken({ userId: user.id, role: user.role });
    return reply.send({ token, refreshToken: token, userId: user.id });
  });

  // ════════════════════════════════════════════════════════
  // HOME SCREEN
  // ════════════════════════════════════════════════════════

  app.get('/today', { preHandler: requireAuth() }, async (req: any, reply: FastifyReply) => {
    const userId = req.auth.userId;
    const dow = getDayOfWeek(new Date());

    const [profile, checkin, workout, nutrition, trainPlan, nutriPlan, last7, wearable] =
      await Promise.all([
        prisma.fitnessProfile.findUnique({ where: { id: userId } }),
        prisma.dailyCheckin.findUnique({
          where: { user_id_datum: { user_id: userId, datum: todayDate() } },
        }),
        prisma.workoutSession.findFirst({
          where: { user_id: userId, datum: todayDate() },
        }),
        prisma.nutritionLog.findMany({
          where: { user_id: userId, datum: todayDate() },
        }),
        prisma.trainingPlan.findFirst({
          where: { user_id: userId, status: 'active' },
          include: {
            days: {
              where: { den: dow as any },
              include: { exercises: { orderBy: { poradi: 'asc' } } },
            },
          },
        }),
        prisma.nutritionPlan.findFirst({
          where: { user_id: userId, status: 'active' },
          include: { meals: true },
        }),
        prisma.dailyCheckin.findMany({
          where: { user_id: userId, datum: { gte: daysAgo(7) } },
          orderBy: { datum: 'desc' },
        }),
        prisma.wearableDataDaily.findFirst({
          where: { user_id: userId, datum: todayDate() },
        }),
      ]);

    if (!profile) return reply.status(404).send({ error: 'profile_not_found' });

    const planDay = trainPlan?.days?.[0] ?? null;
    const isTraining = planDay != null && planDay.typ_dne !== 'rest';

    const planMeals = nutriPlan?.meals?.filter((m) => m.je_treninkovy_den === isTraining) ?? [];

    const kcalTotal = nutrition.reduce((s, n) => s + (n.kalorie ?? 0), 0);
    const proteinTotal = nutrition.reduce((s, n) => s + Number(n.bilkoviny_g ?? 0), 0);

    const weights = last7.filter((c) => c.vaha_kg != null);
    const sleeps = last7.filter((c) => c.spanek_hodin != null);
    const energies = last7.filter((c) => c.energie != null);

    const workoutsThisWeek = await prisma.workoutSession.count({
      where: { user_id: userId, datum: { gte: weekStart() }, odcviceno: true },
    });

    const alerts: string[] = [];
    if (!checkin) alerts.push('Nezapomeň vyplnit ranní check-in!');
    if (isTraining && !workout) alerts.push(`Dnes máš v plánu trénink: ${planDay!.typ_dne}`);

    return reply.send({
      datum: todayStr(),
      den_v_tydnu: dow,
      trenink: {
        je_treninkovy_den: isTraining,
        plan_day: planDay,
        uz_zaznamenan: workout != null,
        session: workout,
      },
      jidlo: {
        plan_meals: planMeals,
        zaznamenane: nutrition,
        kalorie_celkem: kcalTotal,
        kalorie_cil: isTraining
          ? (nutriPlan?.kalorie_treninkovy_den ?? profile.cilove_kalorie ?? 2000)
          : (nutriPlan?.kalorie_odpocinkovy_den ?? profile.cilove_kalorie ?? 2000),
        bilkoviny_celkem: Math.round(proteinTotal),
        bilkoviny_cil: nutriPlan?.bilkoviny_g ?? profile.cilove_bilkoviny_g ?? 100,
      },
      checkin: { vyplnen: checkin != null, data: checkin },
      stats: {
        vaha_aktualni: weights[0] ? Number(weights[0].vaha_kg) : null,
        vaha_trend_7d: weights.length >= 2 ? round1(avg(weights.map((c) => Number(c.vaha_kg)))) : null,
        vaha_zmena: weights.length >= 2
          ? round1(Number(weights[0].vaha_kg) - Number(weights[weights.length - 1].vaha_kg))
          : null,
        spanek_prumer_7d: sleeps.length ? round1(avg(sleeps.map((c) => Number(c.spanek_hodin)))) : null,
        energie_prumer_7d: energies.length ? round1(avg(energies.map((c) => c.energie!))) : null,
        kroky_dnes: wearable?.kroky ?? checkin?.kroky ?? null,
        kroky_cil: 10000,
        adherence_tyden_pct: profile.treninky_tyden > 0
          ? Math.round((workoutsThisWeek / profile.treninky_tyden) * 100)
          : null,
      },
      motivace: null,
      upozorneni: alerts,
    });
  });

  // ════════════════════════════════════════════════════════
  // CHECK-IN
  // ════════════════════════════════════════════════════════

  app.post('/checkin', { preHandler: requireAuth() }, async (req: any, reply: FastifyReply) => {
    const userId = req.auth.userId;
    const body = req.body as DailyCheckinRequest;

    const data = {
      vaha_kg: body.vaha_kg ?? null,
      spanek_hodin: body.spanek_hodin ?? null,
      spanek_kvalita: body.spanek_kvalita ?? null,
      energie: body.energie ?? null,
      ma_bolest: body.ma_bolest,
      bolest_lokalizace: body.bolest_lokalizace ?? null,
      bolest_intenzita: body.bolest_intenzita ?? null,
      bolest_poznamka: body.bolest_poznamka ?? null,
      pitny_rezim_litru: body.pitny_rezim_litru ?? null,
      kroky: body.kroky ?? null,
    };

    const checkin = await prisma.dailyCheckin.upsert({
      where: { user_id_datum: { user_id: userId, datum: todayDate() } },
      create: { user_id: userId, datum: todayDate(), ...data },
      update: data,
    });

    // Bolest ≥ 6 → vytvoř health issue
    if (body.ma_bolest && body.bolest_intenzita && body.bolest_intenzita >= 6) {
      await prisma.healthIssue.create({
        data: {
          user_id: userId,
          lokalizace: body.bolest_lokalizace!,
          intenzita: body.bolest_intenzita,
          spoustec: body.bolest_poznamka ?? null,
          is_red_flag: body.bolest_intenzita >= 8,
          red_flag_reason: body.bolest_intenzita >= 8
            ? `Vysoká intenzita: ${body.bolest_intenzita}/10`
            : null,
        },
      });
    }

    return reply.send(checkin);
  });

  // ════════════════════════════════════════════════════════
  // WORKOUT
  // ════════════════════════════════════════════════════════

  app.post('/workout', { preHandler: requireAuth() }, async (req: any, reply: FastifyReply) => {
    const userId = req.auth.userId;
    const body = req.body as WorkoutLogRequest;

    const session = await prisma.workoutSession.create({
      data: {
        user_id: userId,
        datum: todayDate(),
        typ_treninku: body.typ_treninku,
        odcviceno: body.odcviceno,
        delka_min: body.delka_min ?? null,
        rpe: body.rpe ?? null,
        poznamka: body.poznamka ?? null,
      },
    });

    if (body.sets?.length) {
      await prisma.workoutSet.createMany({
        data: body.sets.map((s) => ({
          session_id: session.id,
          cvik: s.cvik,
          serie_cislo: s.serie_cislo,
          opakovani: s.opakovani ?? null,
          zatez_kg: s.zatez_kg ?? null,
          poznamka: s.poznamka ?? null,
        })),
      });
    }

    return reply.status(201).send(session);
  });

  app.get('/workouts', { preHandler: requireAuth() }, async (req: any, reply: FastifyReply) => {
    const { from, to } = req.query as { from?: string; to?: string };
    const sessions = await prisma.workoutSession.findMany({
      where: {
        user_id: req.auth.userId,
        ...(from && to ? { datum: { gte: new Date(from), lte: new Date(to) } } : {}),
      },
      include: { sets: true },
      orderBy: { datum: 'desc' },
      take: 50,
    });
    return reply.send(sessions);
  });

  // ════════════════════════════════════════════════════════
  // NUTRITION
  // ════════════════════════════════════════════════════════

  app.post('/nutrition', { preHandler: requireAuth() }, async (req: any, reply: FastifyReply) => {
    const userId = req.auth.userId;
    const body = req.body as NutritionLogRequest;

    let { kalorie, bilkoviny_g, sacharidy_g, tuky_g } = body;

    // Auto-fill z plánu
    if (body.dle_planu) {
      const plan = await prisma.nutritionPlan.findFirst({
        where: { user_id: userId, status: 'active' },
        include: { meals: { where: { jidlo_typ: body.jidlo_typ } } },
      });
      const meal = plan?.meals?.[0];
      if (meal) {
        kalorie = meal.kalorie;
        bilkoviny_g = Number(meal.bilkoviny_g);
        sacharidy_g = Number(meal.sacharidy_g);
        tuky_g = Number(meal.tuky_g);
      }
    }

    const log = await prisma.nutritionLog.create({
      data: {
        user_id: userId,
        datum: todayDate(),
        jidlo_typ: body.jidlo_typ,
        dle_planu: body.dle_planu ?? null,
        popis: body.popis ?? null,
        kalorie: kalorie ?? null,
        bilkoviny_g: bilkoviny_g ?? null,
        sacharidy_g: sacharidy_g ?? null,
        tuky_g: tuky_g ?? null,
        foto_url: body.foto_url ?? null,
      },
    });

    return reply.status(201).send(log);
  });

  app.get('/nutrition', { preHandler: requireAuth() }, async (req: any, reply: FastifyReply) => {
    const { date } = req.query as { date?: string };
    const logs = await prisma.nutritionLog.findMany({
      where: {
        user_id: req.auth.userId,
        datum: date ? new Date(date) : todayDate(),
      },
      orderBy: { created_at: 'asc' },
    });
    return reply.send(logs);
  });

  // ════════════════════════════════════════════════════════
  // PLANS
  // ════════════════════════════════════════════════════════

  app.get('/plans/training', { preHandler: requireAuth() }, async (req: any, reply: FastifyReply) => {
    const plan = await prisma.trainingPlan.findFirst({
      where: { user_id: req.auth.userId, status: 'active' },
      include: { days: { include: { exercises: { orderBy: { poradi: 'asc' } } } } },
    });
    return reply.send(plan);
  });

  app.get('/plans/nutrition', { preHandler: requireAuth() }, async (req: any, reply: FastifyReply) => {
    const plan = await prisma.nutritionPlan.findFirst({
      where: { user_id: req.auth.userId, status: 'active' },
      include: { meals: true },
    });
    return reply.send(plan);
  });

  // Historie plánů
  app.get('/plans/history', { preHandler: requireAuth() }, async (req: any, reply: FastifyReply) => {
    const userId = req.auth.userId;
    const trainingPlans = await prisma.trainingPlan.findMany({
      where: { user_id: userId },
      include: { days: { include: { exercises: { orderBy: { poradi: 'asc' } } } } },
      orderBy: { platny_od: 'desc' },
    });

    const nutritionPlans = await prisma.nutritionPlan.findMany({
      where: { user_id: userId },
      include: { meals: true },
      orderBy: { platny_od: 'desc' },
    });

    return reply.send({ trainingPlans, nutritionPlans });
  });

  // Aktivace starého plánu
  app.patch('/plans/training/:id/activate', { preHandler: requireAuth() }, async (req: any, reply: FastifyReply) => {
    const userId = req.auth.userId;
    const planId = req.params.id;

    // Deaktivuj starý aktivní plán
    await prisma.trainingPlan.updateMany({
      where: { user_id: userId, status: 'active' },
      data: { status: 'archived' },
    });

    // Aktivuj nový plán
    const updated = await prisma.trainingPlan.update({
      where: { id: planId },
      data: { status: 'active' },
      include: { days: { include: { exercises: { orderBy: { poradi: 'asc' } } } } },
    });

    return reply.send(updated);
  });

  app.patch('/plans/nutrition/:id/activate', { preHandler: requireAuth() }, async (req: any, reply: FastifyReply) => {
    const userId = req.auth.userId;
    const planId = req.params.id;

    // Deaktivuj starý aktivní plán
    await prisma.nutritionPlan.updateMany({
      where: { user_id: userId, status: 'active' },
      data: { status: 'archived' },
    });

    // Aktivuj nový plán
    const updated = await prisma.nutritionPlan.update({
      where: { id: planId },
      data: { status: 'active' },
      include: { meals: true },
    });

    return reply.send(updated);
  });

  // ════════════════════════════════════════════════════════
  // PROFILE
  // ════════════════════════════════════════════════════════

  app.get('/profile', { preHandler: requireAuth() }, async (req: any, reply: FastifyReply) => {
    const profile = await prisma.fitnessProfile.findUnique({
      where: { id: req.auth.userId },
    });
    if (!profile) return reply.status(404).send({ error: 'not_found' });
    return reply.send(profile);
  });

  app.patch('/profile', { preHandler: requireAuth() }, async (req: any, reply: FastifyReply) => {
    const updated = await prisma.fitnessProfile.update({
      where: { id: req.auth.userId },
      data: req.body as any,
    });
    return reply.send(updated);
  });

  // ════════════════════════════════════════════════════════
  // PROGRESS
  // ════════════════════════════════════════════════════════

  app.get('/progress', { preHandler: requireAuth() }, async (req: any, reply: FastifyReply) => {
    const { from, to } = req.query as { from: string; to: string };
    const userId = req.auth.userId;

    const [checkins, workouts, weeklies] = await Promise.all([
      prisma.dailyCheckin.findMany({
        where: { user_id: userId, datum: { gte: new Date(from), lte: new Date(to) } },
        orderBy: { datum: 'asc' },
      }),
      prisma.workoutSession.findMany({
        where: {
          user_id: userId,
          datum: { gte: new Date(from), lte: new Date(to) },
          odcviceno: true,
        },
      }),
      prisma.weeklyAnalysis.findMany({
        where: { user_id: userId, tyden_od: { gte: new Date(from), lte: new Date(to) } },
        orderBy: { tyden_od: 'asc' },
      }),
    ]);

    const weights = checkins.filter((c) => c.vaha_kg != null);
    const sleeps = checkins.filter((c) => c.spanek_hodin != null);
    const energies = checkins.filter((c) => c.energie != null);

    return reply.send({
      vaha_start: weights[0] ? Number(weights[0].vaha_kg) : null,
      vaha_end: weights.length ? Number(weights[weights.length - 1].vaha_kg) : null,
      vaha_zmena: weights.length >= 2
        ? round1(Number(weights[weights.length - 1].vaha_kg) - Number(weights[0].vaha_kg))
        : null,
      pocet_treninku: workouts.length,
      prumerny_spanek: sleeps.length ? round1(avg(sleeps.map((c) => Number(c.spanek_hodin)))) : null,
      prumerna_energie: energies.length ? round1(avg(energies.map((c) => c.energie!))) : null,
      tydenni_analyzy: weeklies,
      vaha_historie: weights.map((c) => ({
        datum: c.datum.toISOString().split('T')[0],
        vaha_kg: Number(c.vaha_kg),
      })),
    });
  });

  // ════════════════════════════════════════════════════════
  // AI RECOMMENDATIONS
  // ════════════════════════════════════════════════════════

  app.get('/ai/recommendations', { preHandler: requireAuth() }, async (req: any, reply: FastifyReply) => {
    const recs = await prisma.aIRecommendation.findMany({
      where: { user_id: req.auth.userId },
      orderBy: { created_at: 'desc' },
      take: 20,
    });
    return reply.send(recs);
  });

  app.post('/ai/recommendations/:id/accept', { preHandler: requireAuth() }, async (req: any, reply: FastifyReply) => {
    const rec = await prisma.aIRecommendation.findUnique({ where: { id: req.params.id } });
    if (!rec || rec.user_id !== req.auth.userId) return reply.status(404).send();
    if (rec.status !== 'navrzeno') return reply.status(409).send({ error: 'already_decided' });

    await prisma.aIRecommendation.update({
      where: { id: rec.id },
      data: { status: 'prijato', decided_at: new Date() },
    });
    return reply.send({ status: 'prijato' });
  });

  app.post('/ai/recommendations/:id/reject', { preHandler: requireAuth() }, async (req: any, reply: FastifyReply) => {
    const rec = await prisma.aIRecommendation.findUnique({ where: { id: req.params.id } });
    if (!rec || rec.user_id !== req.auth.userId) return reply.status(404).send();

    await prisma.aIRecommendation.update({
      where: { id: rec.id },
      data: { status: 'zamitnuto', decided_at: new Date() },
    });
    return reply.send({ status: 'zamitnuto' });
  });

  // ════════════════════════════════════════════════════════
  // AI GENEROVÁNÍ (synchronní — počká na výsledek)
  // ════════════════════════════════════════════════════════

  app.post('/ai/generate', { preHandler: requireAuth() }, async (req: any, reply: FastifyReply) => {
    const userId = req.auth.userId;

    // Ochrana: max 1 generování za 60 sekund
    const recent = await prisma.aIRecommendation.findFirst({
      where: {
        user_id: userId,
        created_at: { gte: new Date(Date.now() - 60_000) },
      },
    });
    if (recent) {
      return reply.status(429).send({
        error: 'rate_limited',
        message: 'Počkej minutu před dalším generováním.',
      });
    }

    req.log.info({ userId }, 'ai.generate.start');

    const result = await generateAndSavePlan(userId, 'weekly_plan');

    if (!result.success) {
      const messages: Record<string, string> = {
        no_active_goal: 'Nemáš nastavený cíl. Doplň ho v profilu.',
        profile_not_found: 'Profil nenalezen.',
        cross_check_failed: 'AI vygenerovala nebezpečný plán — zkus to znovu.',
      };
      return reply.status(422).send({
        error: result.error,
        message: messages[result.error!] ?? 'Generování selhalo. Zkus to znovu.',
      });
    }

    return reply.send({
      status: 'completed',
      fitcoach_zduvodneni: result.result!.fitcoach.zduvodneni,
      nutripro_zduvodneni: result.result!.nutripro.zduvodneni,
      motivace: result.result!.weekly_summary.motivacni_zprava,
      upozorneni: [
        ...result.result!.fitcoach.upozorneni,
        ...result.result!.nutripro.upozorneni,
      ],
      cross_check: {
        passed: result.result!.cross_check.passed,
        warnings: result.result!.cross_check.rules
          .filter((r) => r.severity === 'warning')
          .map((r) => r.detail),
      },
    });
  });

  // ════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ════════════════════════════════════════════════════════

  app.post('/notifications/register', { preHandler: requireAuth() }, async (req: any, reply: FastifyReply) => {
    const { push_token } = req.body as { push_token: string };
    await prisma.notificationPreferences.upsert({
      where: { id: req.auth.userId },
      update: { push_token },
      create: { id: req.auth.userId, push_token },
    });
    return reply.send({ status: 'registered' });
  });
}
