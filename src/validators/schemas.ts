// ============================================================
// Zod validační schémata pro všechny API vstupy
// Validace na hranici API — nikdy nepustit nevalidní data dál
// ============================================================

import { z } from 'zod';

// --- Enums ---

const Gender = z.enum(['muz', 'zena', 'jine']);
const ExerciseLevel = z.enum(['zacatecnik', 'mirne_pokrocily', 'pokrocily']);
const GoalType = z.enum(['hubnuti', 'nabirani', 'udrzeni', 'vykon']);
const MealType = z.enum(['snidane', 'obed', 'svacina', 'vecere']);
const DayOfWeek = z.enum(['po', 'ut', 'st', 'ct', 'pa', 'so', 'ne']);
const BodyPart = z.enum(['zada', 'koleno', 'rameno', 'krk', 'kycel', 'loket', 'zapesti', 'hlezno', 'jine']);
const FoodLoggingMode = z.enum(['simple', 'text', 'detailed']);

// --- Registrace ---

export const FixedScheduleEntrySchema = z.object({
  den: DayOfWeek,
  cas_od: z.string().regex(/^\d{2}:\d{2}$/),
  cas_do: z.string().regex(/^\d{2}:\d{2}$/),
  aktivita: z.string().min(1).max(100),
});

export const RegisterSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  profile: z.object({
    jmeno: z.string().min(1).max(100),
    pohlavi: Gender,
    datum_narozeni: z.string().date(), // "YYYY-MM-DD"
    vyska_cm: z.number().int().min(100).max(250),
    aktualni_vaha_kg: z.number().min(30).max(300),
    uroven_cviceni: ExerciseLevel,
    treninky_tyden: z.number().int().min(1).max(7),
    delka_treninku_min: z.number().int().min(10).max(120),
    dostupne_vybaveni: z.array(z.string().max(50)).max(20),
    zdravotni_omezeni: z.array(z.string().max(100)).max(20),
    alergie_intolerance: z.array(z.string().max(50)).max(20),
    leky: z.string().max(500).optional(),
    stravovaci_preference: z.string().max(50).optional(),
    pocet_jidel_denne: z.number().int().min(2).max(6).optional(),
    food_logging_mode: FoodLoggingMode.optional(),
    pevne_terminy: z.array(FixedScheduleEntrySchema).max(20).optional(),
    preferovany_cas_treninku: z.string().max(20).optional(),
  }),
  goal: z.object({
    typ_cile: GoalType,
    cilova_vaha_kg: z.number().min(30).max(300).optional(),
  }),
});

// --- Denní check-in ---

export const DailyCheckinSchema = z.object({
  vaha_kg: z.number().min(30).max(300).optional(),
  spanek_hodin: z.number().min(0).max(24).optional(),
  spanek_kvalita: z.number().int().min(1).max(5).optional(),
  energie: z.number().int().min(1).max(5).optional(),
  ma_bolest: z.boolean(),
  bolest_lokalizace: BodyPart.optional(),
  bolest_intenzita: z.number().int().min(1).max(10).optional(),
  bolest_poznamka: z.string().max(500).optional(),
  pitny_rezim_litru: z.number().min(0).max(10).optional(),
  kroky: z.number().int().min(0).optional(),
}).refine(
  // Pokud ma_bolest je true, musí být lokalizace a intenzita
  (data) => {
    if (data.ma_bolest) {
      return data.bolest_lokalizace != null && data.bolest_intenzita != null;
    }
    return true;
  },
  { message: 'Pokud máš bolest, musíš zadat kde a jak moc (1-10).' }
);

// --- Trénink ---

export const WorkoutSetSchema = z.object({
  cvik: z.string().min(1).max(100),
  serie_cislo: z.number().int().min(1).max(20),
  opakovani: z.number().int().min(0).max(100).optional(),
  zatez_kg: z.number().min(0).max(500).optional(),
  poznamka: z.string().max(500).optional(),
});

export const WorkoutLogSchema = z.object({
  typ_treninku: z.string().min(1).max(100),
  odcviceno: z.boolean(),
  delka_min: z.number().int().min(1).max(300).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  poznamka: z.string().max(1000).optional(),
  sets: z.array(WorkoutSetSchema).max(50).optional(),
}).refine(
  // Pokud odcvičeno, musí být RPE
  (data) => {
    if (data.odcviceno) return data.rpe != null;
    return true;
  },
  { message: 'Pokud jsi cvičil/a, zadej jak těžké to bylo (RPE 1-10).' }
);

// --- Strava ---

export const NutritionLogSchema = z.object({
  jidlo_typ: MealType,
  dle_planu: z.boolean().optional(),
  popis: z.string().max(1000).optional(),
  kalorie: z.number().int().min(0).max(5000).optional(),
  bilkoviny_g: z.number().min(0).max(500).optional(),
  sacharidy_g: z.number().min(0).max(500).optional(),
  tuky_g: z.number().min(0).max(500).optional(),
  foto_url: z.string().url().max(500).optional(),
}).refine(
  // Musí mít buď dle_planu=true, nebo popis, nebo kalorie
  (data) => {
    return data.dle_planu === true || data.popis != null || data.kalorie != null;
  },
  { message: 'Zadej buď "jedl/a jsem podle plánu", popis jídla, nebo kalorie.' }
);

// --- AI výstupy (FitCoach / NutriPro) ---
// Validujeme, že AI vrátila KOMPLETNÍ plán — bez tohohle se může stát,
// že AI vynechá den nebo typ dne a Home screen pro daný den tiše zůstane prázdný,
// aniž by generování nahlásilo chybu.

const TrainingDayType = z.enum(['rest', 'light', 'medium', 'hard']);
const ALL_DAYS = ['po', 'ut', 'st', 'ct', 'pa', 'so', 'ne'] as const;

export const FitCoachExerciseSchema = z.object({
  cvik: z.string().min(1).max(150),
  serie: z.number().int().min(1).max(20),
  opakovani: z.string().min(1).max(20),
  zatez: z.string().min(1).max(50),
  pauza_s: z.number().int().min(0).max(600),
  poznamka: z.string().max(500).nullable(),
});

export const FitCoachDaySchema = z.object({
  den: DayOfWeek,
  typ_dne: TrainingDayType,
  delka_min: z.number().int().min(0).max(300),
  cviky: z.array(FitCoachExerciseSchema),
});

export const FitCoachOutputSchema = z
  .object({
    treninkovy_plan: z.object({
      dny: z.array(FitCoachDaySchema).min(1),
    }),
    zduvodneni: z.string().min(1),
    info_pro_nutripro: z.string().min(1),
    intenzita_pristi_tyden: z.enum(['nizsi', 'stejna', 'vyssi']),
    upozorneni: z.array(z.string()),
  })
  .refine(
    (data) => {
      const days = new Set(data.treninkovy_plan.dny.map((d) => d.den));
      return ALL_DAYS.every((d) => days.has(d));
    },
    {
      message:
        'FitCoach musí vygenerovat plán pro všech 7 dní v týdnu (chybějící den = prázdný Home v ten den).',
    }
  );

export const NutriProIngredientSchema = z.object({
  nazev: z.string().min(1).max(100),
  mnozstvi: z.string().min(1).max(50),
});

export const NutriProMealSchema = z.object({
  typ: MealType,
  je_treninkovy_den: z.boolean(),
  nazev: z.string().min(1).max(150),
  suroviny: z.array(NutriProIngredientSchema),
  kalorie: z.number().int().min(0).max(5000),
  bilkoviny_g: z.number().min(0).max(500),
  sacharidy_g: z.number().min(0).max(500),
  tuky_g: z.number().min(0).max(500),
  poznamka: z.string().max(500).nullable(),
});

export const NutriProOutputSchema = z
  .object({
    nutricni_plan: z.object({
      kalorie_treninkovy_den: z.number().int().min(0),
      kalorie_odpocinkovy_den: z.number().int().min(0),
      bilkoviny_g: z.number().min(0),
      sacharidy_g: z.number().min(0),
      tuky_g: z.number().min(0),
      jidla: z.array(NutriProMealSchema).min(1),
    }),
    zduvodneni: z.string().min(1),
    upozorneni: z.array(z.string()),
  })
  .refine((data) => data.nutricni_plan.jidla.some((m) => m.je_treninkovy_den === true), {
    message:
      'NutriPro musí vygenerovat jídla i pro TRÉNINKOVÉ dny (chybí = prázdná strava na Home v tréninkový den).',
  })
  .refine((data) => data.nutricni_plan.jidla.some((m) => m.je_treninkovy_den === false), {
    message:
      'NutriPro musí vygenerovat jídla i pro ODPOČINKOVÉ dny (chybí = prázdná strava na Home v den volna).',
  });

// --- Query params ---

export const DateRangeQuery = z.object({
  from: z.string().date(),
  to: z.string().date(),
});

export const DateQuery = z.object({
  date: z.string().date(),
});

// Export typy
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type DailyCheckinInput = z.infer<typeof DailyCheckinSchema>;
export type WorkoutLogInput = z.infer<typeof WorkoutLogSchema>;
export type NutritionLogInput = z.infer<typeof NutritionLogSchema>;
