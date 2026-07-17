// ============================================================
// Testy pro bezpečnostní cross-check pravidla
// Tohle MUSÍ projít před každým deployem — safety-critical kód
// ============================================================

import { describe, it, expect } from 'vitest';
import { runCrossChecks } from '../src/ai/cross-check';
import {
  calculateBMR,
  calculateTDEE,
  calculateTargetCalories,
  calculateMacros,
  calculateAge,
} from '../src/utils/nutrition-calc';
import type {
  AIInputContext,
  FitCoachOutput,
  NutriProOutput,
  DailyCheckin,
  FitnessProfile,
  Goal,
} from '../src/types/domain';

// ─── Test data factories ────────────────────────────────────

function makeProfile(overrides: Partial<FitnessProfile> = {}): FitnessProfile {
  return {
    id: 'test-user-1',
    jmeno: 'Tomáš',
    pohlavi: 'muz',
    datum_narozeni: '1991-03-15',
    vyska_cm: 180,
    aktualni_vaha_kg: 85,
    uroven_cviceni: 'mirne_pokrocily',
    treninky_tyden: 4,
    delka_treninku_min: 45,
    dostupne_vybaveni: ['posilovna'],
    zdravotni_omezeni: [],
    leky: null,
    alergie_intolerance: [],
    stravovaci_preference: null,
    pocet_jidel_denne: 4,
    food_logging_mode: 'simple',
    pevne_terminy: [],
    bmr_kcal: 1800,
    tdee_kcal: 2700,
    cilove_kalorie: 2200,
    cilove_bilkoviny_g: 170,
    cilove_sacharidy_g: 220,
    cilove_tuky_g: 61,
    preferovany_cas_treninku: 'vecer',
    ...overrides,
  };
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    user_id: 'test-user-1',
    typ_cile: 'hubnuti',
    cilova_vaha_kg: 78,
    datum_od: '2026-07-01',
    datum_do: null,
    aktivni: true,
    ...overrides,
  };
}

function makeCheckin(datum: string, overrides: Partial<DailyCheckin> = {}): DailyCheckin {
  return {
    id: `checkin-${datum}`,
    user_id: 'test-user-1',
    datum,
    vaha_kg: 85,
    spanek_hodin: 7.5,
    spanek_kvalita: 4,
    energie: 4,
    ma_bolest: false,
    bolest_lokalizace: null,
    bolest_intenzita: null,
    bolest_poznamka: null,
    pitny_rezim_litru: 2,
    kroky: 8000,
    ...overrides,
  };
}

function makeContext(overrides: Partial<AIInputContext> = {}): AIInputContext {
  return {
    profil: makeProfile(),
    aktivni_cil: makeGoal(),
    checkins_7d: [
      makeCheckin('2026-07-08'),
      makeCheckin('2026-07-09'),
      makeCheckin('2026-07-10'),
      makeCheckin('2026-07-11'),
      makeCheckin('2026-07-12'),
    ],
    treninky_7d: [],
    strava_7d: [],
    aktivni_treninkovy_plan: null,
    aktivni_nutricni_plan: null,
    vaha_trend_14d: {
      hodnoty: [],
      prumer_7d: 85,
      prumer_14d: 85.3,
      smer: 'stoji',
      zmena_za_14d_kg: -0.3,
      zmena_za_14d_pct: -0.4,
    },
    zdravotni_problemy: [],
    wearable_data_7d: [],
    ...overrides,
  };
}

function makeFitCoachOutput(overrides: Partial<FitCoachOutput> = {}): FitCoachOutput {
  return {
    treninkovy_plan: {
      dny: [
        {
          den: 'po',
          typ_dne: 'medium',
          delka_min: 45,
          cviky: [
            { cvik: 'bench_press', serie: 3, opakovani: '8', zatez: '55', pauza_s: 90, poznamka: null },
            { cvik: 'lat_pulldown', serie: 3, opakovani: '10', zatez: '50', pauza_s: 90, poznamka: null },
          ],
        },
      ],
    },
    zduvodneni: 'Test plan',
    info_pro_nutripro: 'Stejná intenzita',
    intenzita_pristi_tyden: 'stejna',
    upozorneni: [],
    ...overrides,
  };
}

function makeNutriProOutput(overrides: Partial<NutriProOutput> = {}): NutriProOutput {
  return {
    nutricni_plan: {
      kalorie_treninkovy_den: 2300,
      kalorie_odpocinkovy_den: 2100,
      bilkoviny_g: 170,
      sacharidy_g: 220,
      tuky_g: 61,
      jidla: [],
    },
    zduvodneni: 'Test nutrition plan',
    upozorneni: [],
    ...overrides,
  };
}

// ─── Cross-check testy ──────────────────────────────────────

describe('Cross-check safety rules', () => {
  describe('Calorie change limit (max 20%)', () => {
    it('schválí změnu pod 20%', () => {
      const context = makeContext({
        aktivni_nutricni_plan: {
          id: 'np-1', user_id: 'test-user-1', status: 'active',
          kalorie_treninkovy_den: 2200, kalorie_odpocinkovy_den: 2000,
          bilkoviny_g: 170, sacharidy_g: 220, tuky_g: 61,
          platny_od: '2026-07-01', meals: [],
        },
      });
      const nutripro = makeNutriProOutput({
        nutricni_plan: { ...makeNutriProOutput().nutricni_plan, kalorie_treninkovy_den: 2300, kalorie_odpocinkovy_den: 2100 },
      });

      const result = runCrossChecks(context, makeFitCoachOutput(), nutripro);
      const rule = result.rules.find((r) => r.pravidlo === 'calorie_change_limit');
      expect(rule?.passed).toBe(true);
    });

    it('zamítne změnu nad 20%', () => {
      const context = makeContext({
        aktivni_nutricni_plan: {
          id: 'np-1', user_id: 'test-user-1', status: 'active',
          kalorie_treninkovy_den: 2000, kalorie_odpocinkovy_den: 1800,
          bilkoviny_g: 170, sacharidy_g: 220, tuky_g: 61,
          platny_od: '2026-07-01', meals: [],
        },
      });
      const nutripro = makeNutriProOutput({
        nutricni_plan: { ...makeNutriProOutput().nutricni_plan, kalorie_treninkovy_den: 2500, kalorie_odpocinkovy_den: 2300 },
      });

      const result = runCrossChecks(context, makeFitCoachOutput(), nutripro);
      const rule = result.rules.find((r) => r.pravidlo === 'calorie_change_limit');
      expect(rule?.passed).toBe(false);
      expect(rule?.severity).toBe('block');
    });

    it('schválí změnu mezi 10% a 20%', () => {
      const context = makeContext({
        aktivni_nutricni_plan: {
          id: 'np-1', user_id: 'test-user-1', status: 'active',
          kalorie_treninkovy_den: 2100, kalorie_odpocinkovy_den: 1900,
          bilkoviny_g: 170, sacharidy_g: 220, tuky_g: 61,
          platny_od: '2026-07-01', meals: [],
        },
      });
      const nutripro = makeNutriProOutput({
        nutricni_plan: { ...makeNutriProOutput().nutricni_plan, kalorie_treninkovy_den: 2400, kalorie_odpocinkovy_den: 2200 },
      });

      // Změna: průměr 2000 → 2300 = 15% (mezi 10% a 20%, měla by projít)
      const result = runCrossChecks(context, makeFitCoachOutput(), nutripro);
      const rule = result.rules.find((r) => r.pravidlo === 'calorie_change_limit');
      expect(rule?.passed).toBe(true);
    });
  });

  describe('Minimum calories (1.2× BMR)', () => {
    it('zamítne kalorie pod 1.2× BMR', () => {
      const nutripro = makeNutriProOutput({
        nutricni_plan: {
          ...makeNutriProOutput().nutricni_plan,
          kalorie_treninkovy_den: 1500,
          kalorie_odpocinkovy_den: 1200, // Pod 1.2× BMR (~2160)
        },
      });

      const result = runCrossChecks(makeContext(), makeFitCoachOutput(), nutripro);
      const rule = result.rules.find((r) => r.pravidlo === 'minimum_calories');
      expect(rule?.passed).toBe(false);
      expect(rule?.severity).toBe('block');
    });
  });

  describe('Pain stop', () => {
    it('zamítne cviky na bolestivou partii', () => {
      const context = makeContext({
        checkins_7d: [
          makeCheckin('2026-07-10', {
            ma_bolest: true,
            bolest_lokalizace: 'rameno',
            bolest_intenzita: 7,
          }),
        ],
      });

      const fitcoach = makeFitCoachOutput({
        treninkovy_plan: {
          dny: [{
            den: 'po', typ_dne: 'medium', delka_min: 45,
            cviky: [
              { cvik: 'bench_press', serie: 3, opakovani: '8', zatez: '50', pauza_s: 90, poznamka: null },
            ],
          }],
        },
      });

      const result = runCrossChecks(context, fitcoach, makeNutriProOutput());
      const rule = result.rules.find((r) => r.pravidlo === 'pain_stop');
      expect(rule?.passed).toBe(false);
    });

    it('schválí plán bez cviků na bolestivou partii', () => {
      const context = makeContext({
        checkins_7d: [
          makeCheckin('2026-07-10', {
            ma_bolest: true,
            bolest_lokalizace: 'koleno',
            bolest_intenzita: 7,
          }),
        ],
      });

      // lat_pulldown nezatěžuje koleno
      const fitcoach = makeFitCoachOutput({
        treninkovy_plan: {
          dny: [{
            den: 'po', typ_dne: 'medium', delka_min: 45,
            cviky: [
              { cvik: 'lat_pulldown', serie: 3, opakovani: '10', zatez: '50', pauza_s: 90, poznamka: null },
            ],
          }],
        },
      });

      const result = runCrossChecks(context, fitcoach, makeNutriProOutput());
      const rule = result.rules.find((r) => r.pravidlo === 'pain_stop');
      // Passed by neměl být false — lat pulldown nezatěžuje koleno
      expect(rule?.severity).not.toBe('block');
    });
  });

  describe('Deload trigger', () => {
    it('varuje když RPE roste 3× po sobě a spánek klesá', () => {
      const context = makeContext({
        checkins_7d: [
          makeCheckin('2026-07-08', { spanek_hodin: 7.5 }),
          makeCheckin('2026-07-09', { spanek_hodin: 7.0 }),
          makeCheckin('2026-07-10', { spanek_hodin: 6.5 }),
        ],
        treninky_7d: [
          { id: 'w1', user_id: 'test-user-1', plan_day_id: null, datum: '2026-07-08', typ_treninku: 'full', odcviceno: true, delka_min: 45, rpe: 6, poznamka: null },
          { id: 'w2', user_id: 'test-user-1', plan_day_id: null, datum: '2026-07-09', typ_treninku: 'full', odcviceno: true, delka_min: 45, rpe: 7, poznamka: null },
          { id: 'w3', user_id: 'test-user-1', plan_day_id: null, datum: '2026-07-10', typ_treninku: 'full', odcviceno: true, delka_min: 45, rpe: 8, poznamka: null },
        ],
      });

      const result = runCrossChecks(context, makeFitCoachOutput(), makeNutriProOutput());
      const rule = result.rules.find((r) => r.pravidlo === 'deload_trigger');
      expect(rule?.severity).toBe('warning');
      expect(rule?.detail).toContain('RPE roste');
    });
  });

  describe('Protein range', () => {
    it('zamítne příliš nízké bílkoviny', () => {
      const nutripro = makeNutriProOutput({
        nutricni_plan: { ...makeNutriProOutput().nutricni_plan, bilkoviny_g: 50 }, // 85kg × 1.2 = 102g minimum
      });

      const result = runCrossChecks(makeContext(), makeFitCoachOutput(), nutripro);
      const rule = result.rules.find((r) => r.pravidlo === 'protein_range');
      expect(rule?.passed).toBe(false);
    });
  });

  describe('Sleep deprivation + high intensity', () => {
    it('zamítne zvýšení intenzity při nedostatku spánku', () => {
      const context = makeContext({
        checkins_7d: [
          makeCheckin('2026-07-08', { spanek_hodin: 5.0 }),
          makeCheckin('2026-07-09', { spanek_hodin: 5.5 }),
          makeCheckin('2026-07-10', { spanek_hodin: 5.0 }),
        ],
      });

      const fitcoach = makeFitCoachOutput({ intenzita_pristi_tyden: 'vyssi' });

      const result = runCrossChecks(context, fitcoach, makeNutriProOutput());
      const rule = result.rules.find((r) => r.pravidlo === 'sleep_deprivation_warning');
      expect(rule?.passed).toBe(false);
      expect(rule?.severity).toBe('block');
    });
  });

  describe('Overall cross-check result', () => {
    it('celkově projde pokud žádný blocker neselže', () => {
      const result = runCrossChecks(makeContext(), makeFitCoachOutput(), makeNutriProOutput());
      expect(result.passed).toBe(true);
    });

    it('celkově selže pokud jakýkoliv blocker selže', () => {
      const nutripro = makeNutriProOutput({
        nutricni_plan: { ...makeNutriProOutput().nutricni_plan, bilkoviny_g: 30 },
      });

      const result = runCrossChecks(makeContext(), makeFitCoachOutput(), nutripro);
      expect(result.passed).toBe(false);
    });
  });
});

// ─── Nutrition calculation testy ────────────────────────────

describe('Nutrition calculations', () => {
  describe('BMR (Mifflin-St Jeor)', () => {
    it('muž 85kg, 180cm, 35 let', () => {
      const bmr = calculateBMR(85, 180, 35, 'muz');
      // 10*85 + 6.25*180 - 5*35 + 5 = 850 + 1125 - 175 + 5 = 1805
      expect(bmr).toBe(1805);
    });

    it('žena 65kg, 165cm, 28 let', () => {
      const bmr = calculateBMR(65, 165, 28, 'zena');
      // 10*65 + 6.25*165 - 5*28 - 161 = 650 + 1031.25 - 140 - 161 = 1380
      expect(bmr).toBe(1380);
    });
  });

  describe('TDEE', () => {
    it('začátečník 2x týdně', () => {
      const tdee = calculateTDEE(1800, 'zacatecnik', 2);
      expect(tdee).toBe(2340); // 1800 * 1.3
    });

    it('pokročilý 5x týdně', () => {
      const tdee = calculateTDEE(1800, 'pokrocily', 5);
      expect(tdee).toBe(3150); // 1800 * 1.75
    });
  });

  describe('Target calories', () => {
    it('hubnutí pro začátečníka = TDEE - 300', () => {
      const kcal = calculateTargetCalories(2500, 'hubnuti', 'zacatecnik');
      expect(kcal).toBe(2200);
    });

    it('nabírání pro pokročilého = TDEE + 300', () => {
      const kcal = calculateTargetCalories(2800, 'nabirani', 'pokrocily');
      expect(kcal).toBe(3100);
    });

    it('udržení = TDEE', () => {
      const kcal = calculateTargetCalories(2500, 'udrzeni', 'mirne_pokrocily');
      expect(kcal).toBe(2500);
    });
  });

  describe('Macros', () => {
    it('hubnutí: protein 2.0g/kg', () => {
      const macros = calculateMacros(2200, 85, 'hubnuti');
      expect(macros.bilkoviny_g).toBe(170); // 85 * 2.0
      expect(macros.tuky_g).toBe(61); // 2200 * 0.25 / 9
      // Sacharidy: (2200 - 170*4 - 61*9) / 4 = (2200 - 680 - 549) / 4 ≈ 243
      expect(macros.sacharidy_g).toBeGreaterThan(200);
    });
  });

  describe('Age calculation', () => {
    it('počítá věk správně', () => {
      // Pokud je dnes 15.7.2026 a datum narození je 15.3.1991
      const age = calculateAge('1991-03-15');
      expect(age).toBe(35);
    });
  });
});
