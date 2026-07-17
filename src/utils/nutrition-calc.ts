// ============================================================
// Výpočty BMR, TDEE, makra
// Mifflin-St Jeor vzorec — nejpřesnější pro běžnou populaci
// ============================================================

import type { Gender, ExerciseLevel, GoalType } from '../types/domain';

interface CalcInput {
  vaha_kg: number;
  vyska_cm: number;
  vek: number;
  pohlavi: Gender;
  uroven_cviceni: ExerciseLevel;
  treninky_tyden: number;
  typ_cile: GoalType;
}

interface CalcOutput {
  bmr_kcal: number;
  tdee_kcal: number;
  cilove_kalorie: number;
  cilove_bilkoviny_g: number;
  cilove_sacharidy_g: number;
  cilove_tuky_g: number;
}

/** Spočítá věk z data narození */
export function calculateAge(datum_narozeni: string): number {
  const birth = new Date(datum_narozeni);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Mifflin-St Jeor vzorec pro BMR
 * Muži:  10 × váha(kg) + 6.25 × výška(cm) − 5 × věk(roky) + 5
 * Ženy:  10 × váha(kg) + 6.25 × výška(cm) − 5 × věk(roky) − 161
 */
export function calculateBMR(
  vaha_kg: number,
  vyska_cm: number,
  vek: number,
  pohlavi: Gender
): number {
  const base = 10 * vaha_kg + 6.25 * vyska_cm - 5 * vek;
  // Pro 'jine' použijeme průměr obou vzorců
  if (pohlavi === 'muz') return Math.round(base + 5);
  if (pohlavi === 'zena') return Math.round(base - 161);
  return Math.round(base - 78); // průměr +5 a -161
}

/**
 * TDEE = BMR × activity factor
 * Faktor aktivity závisí na úrovni cvičení a počtu tréninků
 */
export function calculateTDEE(bmr: number, uroven: ExerciseLevel, treninky_tyden: number): number {
  let factor: number;

  if (uroven === 'zacatecnik') {
    if (treninky_tyden <= 2) factor = 1.3;
    else if (treninky_tyden <= 3) factor = 1.4;
    else factor = 1.5;
  } else if (uroven === 'mirne_pokrocily') {
    if (treninky_tyden <= 3) factor = 1.5;
    else if (treninky_tyden <= 4) factor = 1.6;
    else factor = 1.7;
  } else {
    // pokrocily
    if (treninky_tyden <= 4) factor = 1.6;
    else if (treninky_tyden <= 5) factor = 1.75;
    else factor = 1.9;
  }

  return Math.round(bmr * factor);
}

/**
 * Kalorický cíl na základě typu cíle
 * Hubnutí: TDEE - 300 až -500 (podle úrovně — začátečník méně agresivní)
 * Nabírání: TDEE + 200 až +300
 * Udržení/výkon: TDEE
 */
export function calculateTargetCalories(
  tdee: number,
  typ_cile: GoalType,
  uroven: ExerciseLevel
): number {
  switch (typ_cile) {
    case 'hubnuti': {
      // Začátečník: menší deficit (snáze udržitelný)
      const deficit = uroven === 'zacatecnik' ? 300 : uroven === 'mirne_pokrocily' ? 400 : 500;
      return Math.round(tdee - deficit);
    }
    case 'nabirani': {
      const surplus = uroven === 'zacatecnik' ? 200 : 300;
      return Math.round(tdee + surplus);
    }
    case 'udrzeni':
    case 'vykon':
      return tdee;
    default:
      return tdee;
  }
}

/**
 * Makro rozložení
 * Bílkoviny: 1.6–2.2g/kg (podle cíle)
 * Tuky: 25–30% kalorií
 * Sacharidy: zbytek
 */
export function calculateMacros(
  cilove_kalorie: number,
  vaha_kg: number,
  typ_cile: GoalType
): { bilkoviny_g: number; tuky_g: number; sacharidy_g: number } {
  // Bílkoviny: vyšší při hubnutí (ochrana svalů), nižší při udržení
  let proteinPerKg: number;
  switch (typ_cile) {
    case 'hubnuti':
      proteinPerKg = 2.0;
      break;
    case 'nabirani':
      proteinPerKg = 1.8;
      break;
    default:
      proteinPerKg = 1.6;
  }

  const bilkoviny_g = Math.round(vaha_kg * proteinPerKg);
  const bilkoviny_kcal = bilkoviny_g * 4;

  // Tuky: 25% kalorií (minimum pro hormonální zdraví)
  const tuky_kcal = cilove_kalorie * 0.25;
  const tuky_g = Math.round(tuky_kcal / 9);

  // Sacharidy: co zbyde
  const sacharidy_kcal = cilove_kalorie - bilkoviny_kcal - tuky_kcal;
  const sacharidy_g = Math.max(0, Math.round(sacharidy_kcal / 4));

  return { bilkoviny_g, tuky_g, sacharidy_g };
}

/** Kompletní výpočet při registraci */
export function calculateAllNutrition(input: CalcInput): CalcOutput {
  const bmr = calculateBMR(input.vaha_kg, input.vyska_cm, input.vek, input.pohlavi);
  const tdee = calculateTDEE(bmr, input.uroven_cviceni, input.treninky_tyden);
  const cilove_kalorie = calculateTargetCalories(tdee, input.typ_cile, input.uroven_cviceni);
  const macros = calculateMacros(cilove_kalorie, input.vaha_kg, input.typ_cile);

  return {
    bmr_kcal: bmr,
    tdee_kcal: tdee,
    cilove_kalorie,
    cilove_bilkoviny_g: macros.bilkoviny_g,
    cilove_sacharidy_g: macros.sacharidy_g,
    cilove_tuky_g: macros.tuky_g,
  };
}
