// ============================================================
// FitCoach & NutriPro — Domain Types
// Zrcadlí DB schéma 1:1, plus odvozené typy pro API a AI Engine
// ============================================================

// --- Enums ---

export type Gender = 'muz' | 'zena' | 'jine';
export type ExerciseLevel = 'zacatecnik' | 'mirne_pokrocily' | 'pokrocily';
export type GoalType = 'hubnuti' | 'nabirani' | 'udrzeni' | 'vykon';
export type PlanStatus = 'draft' | 'active' | 'archived';
export type MealType = 'snidane' | 'obed' | 'svacina' | 'vecere';
export type DayOfWeek = 'po' | 'ut' | 'st' | 'ct' | 'pa' | 'so' | 'ne';
export type RecommendationType = 'trenink_uprava' | 'kalorie_uprava' | 'deload' | 'jine';
export type RecommendationStatus = 'navrzeno' | 'prijato' | 'zamitnuto';
export type TrainingDayType = 'rest' | 'light' | 'medium' | 'hard';
export type BodyPart = 'zada' | 'koleno' | 'rameno' | 'krk' | 'kycel' | 'loket' | 'zapesti' | 'hlezno' | 'jine';
export type FoodLoggingMode = 'simple' | 'text' | 'detailed';

// --- Core Entities ---

export interface FitnessProfile {
  id: string;
  jmeno: string;
  pohlavi: Gender;
  datum_narozeni: string; // ISO date
  vyska_cm: number;
  aktualni_vaha_kg: number;

  uroven_cviceni: ExerciseLevel;
  treninky_tyden: number;
  delka_treninku_min: number;
  dostupne_vybaveni: string[];

  zdravotni_omezeni: string[];
  leky: string | null;
  alergie_intolerance: string[];

  stravovaci_preference: string | null;
  pocet_jidel_denne: number;
  food_logging_mode: FoodLoggingMode;

  pevne_terminy: FixedScheduleEntry[];

  bmr_kcal: number | null;
  tdee_kcal: number | null;
  cilove_kalorie: number | null;
  cilove_bilkoviny_g: number | null;
  cilove_sacharidy_g: number | null;
  cilove_tuky_g: number | null;

  preferovany_cas_treninku: string | null;
}

export interface FixedScheduleEntry {
  den: DayOfWeek;
  cas_od: string; // "09:00"
  cas_do: string; // "17:00"
  aktivita: string;
}

export interface Goal {
  id: string;
  user_id: string;
  typ_cile: GoalType;
  cilova_vaha_kg: number | null;
  datum_od: string;
  datum_do: string | null;
  aktivni: boolean;
}

export interface DailyCheckin {
  id: string;
  user_id: string;
  datum: string;
  vaha_kg: number | null;
  spanek_hodin: number | null;
  spanek_kvalita: number | null; // 1-5
  energie: number | null; // 1-5
  ma_bolest: boolean;
  bolest_lokalizace: BodyPart | null;
  bolest_intenzita: number | null; // 1-10
  bolest_poznamka: string | null;
  pitny_rezim_litru: number | null;
  kroky: number | null;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  plan_day_id: string | null;
  datum: string;
  typ_treninku: string;
  odcviceno: boolean;
  delka_min: number | null;
  rpe: number | null; // 1-10
  poznamka: string | null;
}

export interface WorkoutSet {
  id: string;
  session_id: string;
  cvik: string;
  serie_cislo: number;
  opakovani: number | null;
  zatez_kg: number | null;
  technika_ok: boolean | null;
  poznamka: string | null;
}

export interface NutritionLog {
  id: string;
  user_id: string;
  datum: string;
  jidlo_typ: MealType;
  dle_planu: boolean | null;
  popis: string | null;
  kalorie: number | null;
  bilkoviny_g: number | null;
  sacharidy_g: number | null;
  tuky_g: number | null;
  foto_url: string | null;
}

// --- Plans ---

export interface TrainingPlan {
  id: string;
  user_id: string;
  nazev: string;
  status: PlanStatus;
  platny_od: string;
  platny_do: string | null;
  days: TrainingPlanDay[];
}

export interface TrainingPlanDay {
  id: string;
  plan_id: string;
  den: DayOfWeek;
  typ_dne: TrainingDayType;
  delka_min: number;
  poznamka: string | null;
  exercises: TrainingPlanExercise[];
}

export interface TrainingPlanExercise {
  id: string;
  plan_day_id: string;
  poradi: number;
  cvik: string;
  serie: number;
  opakovani: string; // "8-10" nebo "12"
  zatez_doporucena: string | null;
  pauza_s: number;
  poznamka_technika: string | null;
}

export interface NutritionPlan {
  id: string;
  user_id: string;
  status: PlanStatus;
  kalorie_treninkovy_den: number;
  kalorie_odpocinkovy_den: number;
  bilkoviny_g: number;
  sacharidy_g: number;
  tuky_g: number;
  platny_od: string;
  meals: NutritionPlanMeal[];
}

export interface NutritionPlanMeal {
  id: string;
  plan_id: string;
  jidlo_typ: MealType;
  je_treninkovy_den: boolean;
  nazev: string;
  suroviny: Ingredient[];
  kalorie: number;
  bilkoviny_g: number;
  sacharidy_g: number;
  tuky_g: number;
  poznamka: string | null;
}

export interface Ingredient {
  nazev: string;
  mnozstvi: string;
}

// --- AI ---

export interface AIRecommendation {
  id: string;
  user_id: string;
  typ: RecommendationType;
  status: RecommendationStatus;
  popis: string;
  zduvodneni: string;
  puvodni_hodnota: Record<string, unknown> | null;
  navrzena_hodnota: Record<string, unknown> | null;
  vstupni_data_snapshot: AIInputContext;
  generated_by: 'fitcoach' | 'nutripro' | 'orchestrator';
  cross_check_passed: boolean;
  cross_check_log: CrossCheckResult | null;
  decided_at: string | null;
  created_at: string;
}

export interface WeeklyAnalysis {
  id: string;
  user_id: string;
  tyden_od: string;
  tyden_do: string;
  prumerna_vaha: number | null;
  zmena_vahy: number | null;
  prumerny_spanek: number | null;
  prumerny_rpe: number | null;
  prumerna_energie: number | null;
  pocet_treninku: number;
  pocet_planovanych_treninku: number;
  adherence_treninky_pct: number | null;
  adherence_strava_pct: number | null;
  prumerny_kaloricky_prijem: number | null;
  pozitivni_pozorovani: string | null;
  vyzvy: string | null;
  doporuceni: string | null;
  motivacni_zprava: string | null;
  plan_next_week: Record<string, unknown> | null;
}

// --- AI Engine Input/Output ---

/** Kompletní kontext který orchestrátor posílá AI agentům */
export interface AIInputContext {
  profil: FitnessProfile;
  aktivni_cil: Goal | null;
  checkins_7d: DailyCheckin[];
  treninky_7d: (WorkoutSession & { sets?: WorkoutSet[] })[];
  strava_7d: NutritionLog[];
  aktivni_treninkovy_plan: TrainingPlan | null;
  aktivni_nutricni_plan: NutritionPlan | null;
  vaha_trend_14d: WeightTrend;
  zdravotni_problemy: HealthIssue[];
  wearable_data_7d: WearableDataDaily[];
}

export interface WeightTrend {
  hodnoty: { datum: string; vaha_kg: number }[];
  prumer_7d: number | null;
  prumer_14d: number | null;
  smer: 'klesa' | 'stoji' | 'roste' | 'nedostatek_dat';
  zmena_za_14d_kg: number | null;
  zmena_za_14d_pct: number | null;
}

/** Výstup FitCoach agenta */
export interface FitCoachOutput {
  treninkovy_plan: {
    dny: {
      den: DayOfWeek;
      typ_dne: TrainingDayType;
      delka_min: number;
      cviky: {
        cvik: string;
        serie: number;
        opakovani: string;
        zatez: string;
        pauza_s: number;
        poznamka: string | null;
      }[];
    }[];
  };
  zduvodneni: string;
  info_pro_nutripro: string;
  // Předává NutriPro: "Příští týden těžší" nebo "Deload" nebo "Stejné"
  intenzita_pristi_tyden: 'nizsi' | 'stejna' | 'vyssi';
  upozorneni: string[];
  // Např. ["Bolest kolena — vyřazeny dřepy", "RPE roste — snížen objem"]
}

/** Výstup NutriPro agenta */
export interface NutriProOutput {
  nutricni_plan: {
    kalorie_treninkovy_den: number;
    kalorie_odpocinkovy_den: number;
    bilkoviny_g: number;
    sacharidy_g: number;
    tuky_g: number;
    jidla: {
      typ: MealType;
      je_treninkovy_den: boolean;
      nazev: string;
      suroviny: Ingredient[];
      kalorie: number;
      bilkoviny_g: number;
      sacharidy_g: number;
      tuky_g: number;
      poznamka: string | null;
    }[];
  };
  zduvodneni: string;
  upozorneni: string[];
}

/** Výstup orchestrátoru (kombinace obou) */
export interface OrchestratorOutput {
  fitcoach: FitCoachOutput;
  nutripro: NutriProOutput;
  cross_check: CrossCheckResult;
  weekly_summary: {
    pozitivni_pozorovani: string;
    vyzvy: string;
    doporuceni: string;
    motivacni_zprava: string;
  };
}

// --- Cross-check (bezpečnostní pravidla) ---

export interface CrossCheckResult {
  passed: boolean;
  rules: CrossCheckRuleResult[];
}

export interface CrossCheckRuleResult {
  pravidlo: string;
  passed: boolean;
  detail: string;
  severity: 'info' | 'warning' | 'block';
}

// --- Health Issues ---

export interface HealthIssue {
  id: string;
  user_id: string;
  lokalizace: BodyPart;
  intenzita: number;
  typ_bolesti: string | null;
  kdy_zacala: string | null;
  spoustec: string | null;
  zhorsovani: boolean;
  is_red_flag: boolean;
  red_flag_reason: string | null;
  doporucen_lekar: boolean;
  vyreseno: boolean;
}

// --- Wearable ---

export interface WearableDataDaily {
  user_id: string;
  datum: string;
  zdroj: string;
  kroky: number | null;
  kalorie_spalene: number | null;
  srdecni_tep_klid: number | null;
  stress_score: number | null;
  body_battery: number | null;
  spanek_hodin: number | null;
  spanek_deep_min: number | null;
  spanek_rem_min: number | null;
  vaha_kg: number | null;
  telesny_tuk_pct: number | null;
}

// --- API Request/Response typy ---

export interface RegisterRequest {
  email: string;
  password: string;
  profile: {
    jmeno: string;
    pohlavi: Gender;
    datum_narozeni: string;
    vyska_cm: number;
    aktualni_vaha_kg: number;
    uroven_cviceni: ExerciseLevel;
    treninky_tyden: number;
    delka_treninku_min: number;
    dostupne_vybaveni: string[];
    zdravotni_omezeni: string[];
    alergie_intolerance: string[];
    leky?: string;
    stravovaci_preference?: string;
    pocet_jidel_denne?: number;
    food_logging_mode?: FoodLoggingMode;
    pevne_terminy?: FixedScheduleEntry[];
    preferovany_cas_treninku?: string;
  };
  goal: {
    typ_cile: GoalType;
    cilova_vaha_kg?: number;
  };
}

export interface DailyCheckinRequest {
  vaha_kg?: number;
  spanek_hodin?: number;
  spanek_kvalita?: number;
  energie?: number;
  ma_bolest: boolean;
  bolest_lokalizace?: BodyPart;
  bolest_intenzita?: number;
  bolest_poznamka?: string;
  pitny_rezim_litru?: number;
  kroky?: number;
}

export interface WorkoutLogRequest {
  typ_treninku: string;
  odcviceno: boolean;
  delka_min?: number;
  rpe?: number;
  poznamka?: string;
  sets?: {
    cvik: string;
    serie_cislo: number;
    opakovani?: number;
    zatez_kg?: number;
    poznamka?: string;
  }[];
}

export interface NutritionLogRequest {
  jidlo_typ: MealType;
  dle_planu?: boolean;
  popis?: string;
  kalorie?: number;
  bilkoviny_g?: number;
  sacharidy_g?: number;
  tuky_g?: number;
  foto_url?: string;
}

/** Home screen — co uživatel vidí každý den */
export interface TodayResponse {
  datum: string;
  den_v_tydnu: string;

  trenink: {
    je_treninkovy_den: boolean;
    plan_day: TrainingPlanDay | null;
    uz_zaznamenan: boolean;
    session: WorkoutSession | null;
  };

  jidlo: {
    plan_meals: NutritionPlanMeal[];
    zaznamenane: NutritionLog[];
    kalorie_celkem: number;
    kalorie_cil: number;
    bilkoviny_celkem: number;
    bilkoviny_cil: number;
  };

  checkin: {
    vyplnen: boolean;
    data: DailyCheckin | null;
  };

  stats: {
    vaha_aktualni: number | null;
    vaha_trend_7d: number | null;
    vaha_zmena: number | null;
    spanek_prumer_7d: number | null;
    energie_prumer_7d: number | null;
    kroky_dnes: number | null;
    kroky_cil: number;
    adherence_tyden_pct: number | null;
  };

  motivace: string | null;
  upozorneni: string[];
}
