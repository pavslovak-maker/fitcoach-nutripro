import 'dotenv/config';
// ============================================================
// Seed — testovací data pro vývoj
// Spouštět: npx prisma db seed
// ============================================================

import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ─── Test user ──────────────────────────────────────────
  const passwordHash = await hash('Test12345!');

  const user = await prisma.user.upsert({
    where: { email: 'tomas@test.cz' },
    update: {},
    create: {
      email: 'tomas@test.cz',
      password_hash: passwordHash,
      role: 'client',
      is_active: true,
      email_verified: true,
    },
  });

  console.log(`User: ${user.id}`);

  // ─── Fitness profil ────────────────────────────────────
  await prisma.fitnessProfile.upsert({
    where: { id: user.id },
    update: {},
    create: {
      id: user.id,
      jmeno: 'Tomáš Novák',
      pohlavi: 'muz',
      datum_narozeni: new Date('1991-03-15'),
      vyska_cm: 180,
      aktualni_vaha_kg: 85.0,
      uroven_cviceni: 'mirne_pokrocily',
      treninky_tyden: 4,
      delka_treninku_min: 45,
      dostupne_vybaveni: ['posilovna'],
      zdravotni_omezeni: [],
      alergie_intolerance: ['laktoza'],
      stravovaci_preference: 'bez_omezeni',
      pocet_jidel_denne: 4,
      food_logging_mode: 'simple',
      pevne_terminy: [
        { den: 'po', cas_od: '08:00', cas_do: '17:00', aktivita: 'práce' },
        { den: 'ut', cas_od: '08:00', cas_do: '17:00', aktivita: 'práce' },
        { den: 'st', cas_od: '08:00', cas_do: '17:00', aktivita: 'práce' },
        { den: 'ct', cas_od: '08:00', cas_do: '17:00', aktivita: 'práce' },
        { den: 'pa', cas_od: '08:00', cas_do: '17:00', aktivita: 'práce' },
      ],
      bmr_kcal: 1805,
      tdee_kcal: 2888,
      cilove_kalorie: 2488,
      cilove_bilkoviny_g: 170,
      cilove_sacharidy_g: 260,
      cilove_tuky_g: 69,
      preferovany_cas_treninku: 'vecer',
    },
  });

  // ─── Cíl ──────────────────────────────────────────────
  await prisma.goal.create({
    data: {
      user_id: user.id,
      typ_cile: 'hubnuti',
      cilova_vaha_kg: 78.0,
      aktivni: true,
    },
  });

  // ─── Notifikační preference ────────────────────────────
  await prisma.notificationPreferences.upsert({
    where: { id: user.id },
    update: {},
    create: {
      id: user.id,
      preferovany_cas_ranni: new Date('1970-01-01T07:00:00'),
    },
  });

  // ─── Check-iny za posledních 7 dní ────────────────────
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    await prisma.dailyCheckin.upsert({
      where: {
        user_id_datum: { user_id: user.id, datum: new Date(dateStr) },
      },
      update: {},
      create: {
        user_id: user.id,
        datum: new Date(dateStr),
        vaha_kg: 85.0 - i * 0.1, // Mírný pokles
        spanek_hodin: 6.5 + Math.random() * 1.5,
        spanek_kvalita: Math.floor(3 + Math.random() * 2),
        energie: Math.floor(3 + Math.random() * 2),
        ma_bolest: false,
        pitny_rezim_litru: 1.5 + Math.random() * 1.0,
        kroky: Math.floor(6000 + Math.random() * 6000),
      },
    });
  }

  // ─── Tréninkový plán ──────────────────────────────────
  const trainingPlan = await prisma.trainingPlan.create({
    data: {
      user_id: user.id,
      nazev: 'Úvodní plán — Týden 1',
      status: 'active',
      platny_od: new Date(today.toISOString().split('T')[0]),
    },
  });

  const days: { den: any; typ: any; delka: number; cviky: any[] }[] = [
    {
      den: 'po', typ: 'hard', delka: 45,
      cviky: [
        { cvik: 'Bench press', serie: 3, opakovani: '8-10', zatez: '50kg', pauza_s: 120, poznamka: 'Lokty 45° od těla' },
        { cvik: 'Lat pulldown', serie: 3, opakovani: '10-12', zatez: '45kg', pauza_s: 90, poznamka: null },
        { cvik: 'Dumbbell row', serie: 3, opakovani: '10', zatez: '20kg', pauza_s: 90, poznamka: 'Záda rovná' },
        { cvik: 'Overhead press', serie: 3, opakovani: '8', zatez: '30kg', pauza_s: 120, poznamka: null },
      ],
    },
    { den: 'ut', typ: 'rest', delka: 0, cviky: [] },
    {
      den: 'st', typ: 'hard', delka: 45,
      cviky: [
        { cvik: 'Squat', serie: 3, opakovani: '8', zatez: '60kg', pauza_s: 150, poznamka: 'Kolena za špičky' },
        { cvik: 'Romanian deadlift', serie: 3, opakovani: '10', zatez: '50kg', pauza_s: 120, poznamka: null },
        { cvik: 'Leg press', serie: 3, opakovani: '12', zatez: '80kg', pauza_s: 90, poznamka: null },
        { cvik: 'Calf raise', serie: 3, opakovani: '15', zatez: '40kg', pauza_s: 60, poznamka: null },
      ],
    },
    { den: 'ct', typ: 'light', delka: 30, cviky: [
      { cvik: 'Chůze', serie: 1, opakovani: '30 min', zatez: 'vlastní váha', pauza_s: 0, poznamka: 'Aktivní regenerace' },
    ] },
    {
      den: 'pa', typ: 'medium', delka: 45,
      cviky: [
        { cvik: 'Incline dumbbell press', serie: 3, opakovani: '10', zatez: '18kg', pauza_s: 90, poznamka: null },
        { cvik: 'Cable row', serie: 3, opakovani: '12', zatez: '40kg', pauza_s: 90, poznamka: null },
        { cvik: 'Lateral raise', serie: 3, opakovani: '12', zatez: '8kg', pauza_s: 60, poznamka: null },
        { cvik: 'Plank', serie: 3, opakovani: '45s', zatez: 'vlastní váha', pauza_s: 60, poznamka: null },
      ],
    },
    { den: 'so', typ: 'rest', delka: 0, cviky: [] },
    { den: 'ne', typ: 'rest', delka: 0, cviky: [] },
  ];

  for (const day of days) {
    const planDay = await prisma.trainingPlanDay.create({
      data: {
        plan_id: trainingPlan.id,
        den: day.den,
        typ_dne: day.typ,
        delka_min: day.delka,
      },
    });

    if (day.cviky.length > 0) {
      await prisma.trainingPlanExercise.createMany({
        data: day.cviky.map((ex, i) => ({
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

  // ─── Nutriční plán ────────────────────────────────────
  const nutritionPlan = await prisma.nutritionPlan.create({
    data: {
      user_id: user.id,
      status: 'active',
      kalorie_treninkovy_den: 2500,
      kalorie_odpocinkovy_den: 2200,
      bilkoviny_g: 170,
      sacharidy_g: 260,
      tuky_g: 69,
      platny_od: new Date(today.toISOString().split('T')[0]),
    },
  });

  // Tréninkový den — jídla
  const meals = [
    { typ: 'snidane', trenink: true, nazev: 'Ovesná kaše s bílkovinou', suroviny: [{ nazev: 'ovesné vločky', mnozstvi: '80g' }, { nazev: 'whey protein', mnozstvi: '30g' }, { nazev: 'banán', mnozstvi: '1 ks' }], kcal: 520, b: 35, s: 72, t: 10 },
    { typ: 'obed', trenink: true, nazev: 'Kuřecí prsa s rýží a zeleninou', suroviny: [{ nazev: 'kuřecí prsa', mnozstvi: '180g' }, { nazev: 'rýže basmati', mnozstvi: '100g' }, { nazev: 'brokolice', mnozstvi: '150g' }], kcal: 650, b: 50, s: 70, t: 12 },
    { typ: 'svacina', trenink: true, nazev: 'Řecký jogurt s ořechy (bezlaktózový)', suroviny: [{ nazev: 'bezlaktózový řecký jogurt', mnozstvi: '200g' }, { nazev: 'vlašské ořechy', mnozstvi: '20g' }], kcal: 280, b: 20, s: 15, t: 16 },
    { typ: 'vecere', trenink: true, nazev: 'Losos se sladkým bramborem', suroviny: [{ nazev: 'losos', mnozstvi: '150g' }, { nazev: 'sladký brambor', mnozstvi: '200g' }, { nazev: 'špenát', mnozstvi: '100g' }], kcal: 620, b: 40, s: 55, t: 22 },
    // Odpočinkový den
    { typ: 'snidane', trenink: false, nazev: 'Vajíčka se zeleninou', suroviny: [{ nazev: 'vejce', mnozstvi: '3 ks' }, { nazev: 'špenát', mnozstvi: '100g' }, { nazev: 'rajče', mnozstvi: '1 ks' }], kcal: 380, b: 25, s: 10, t: 22 },
    { typ: 'obed', trenink: false, nazev: 'Hovězí guláš s kořenovou zeleninou', suroviny: [{ nazev: 'hovězí', mnozstvi: '150g' }, { nazev: 'mrkev', mnozstvi: '100g' }, { nazev: 'celer', mnozstvi: '80g' }], kcal: 550, b: 42, s: 30, t: 20 },
    { typ: 'svacina', trenink: false, nazev: 'Proteinový shake', suroviny: [{ nazev: 'whey protein', mnozstvi: '30g' }, { nazev: 'mandlové mléko', mnozstvi: '250ml' }], kcal: 200, b: 28, s: 5, t: 5 },
    { typ: 'vecere', trenink: false, nazev: 'Tuňákový salát', suroviny: [{ nazev: 'tuňák', mnozstvi: '150g' }, { nazev: 'avokádo', mnozstvi: '80g' }, { nazev: 'mix salátů', mnozstvi: '100g' }], kcal: 450, b: 38, s: 8, t: 25 },
  ];

  await prisma.nutritionPlanMeal.createMany({
    data: meals.map((m) => ({
      plan_id: nutritionPlan.id,
      jidlo_typ: m.typ as any,
      je_treninkovy_den: m.trenink,
      nazev: m.nazev,
      suroviny: m.suroviny,
      kalorie: m.kcal,
      bilkoviny_g: m.b,
      sacharidy_g: m.s,
      tuky_g: m.t,
    })),
  });

  console.log('Seed complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
