// ============================================================
// Cross-Check Safety Rules
// Bezpečnostní pojistky které AI NESMÍ obejít.
// Běží jako kód, ne jako AI prompt.
// ============================================================

import type {
  AIInputContext,
  FitCoachOutput,
  NutriProOutput,
  CrossCheckResult,
  CrossCheckRuleResult,
} from '../types/domain';
import { calculateBMR, calculateAge } from '../utils/nutrition-calc';

/**
 * Spustí všechna bezpečnostní pravidla nad návrhem AI.
 * Pokud jakékoliv pravidlo se severity 'block' selže,
 * celý návrh je zamítnut a AI musí přepracovat.
 */
export function runCrossChecks(
  input: AIInputContext,
  fitcoach: FitCoachOutput,
  nutripro: NutriProOutput
): CrossCheckResult {
  const rules: CrossCheckRuleResult[] = [
    checkCalorieChangeLimit(input, nutripro),
    checkMinimumCalories(input, nutripro),
    checkMaximumCalories(input, nutripro),
    checkLoadProgressionLimit(input, fitcoach),
    checkPainStop(input, fitcoach),
    checkInsufficientData(input),
    checkDeloadTrigger(input),
    checkProteinRange(input, nutripro),
    checkSleepDeprivationWarning(input, fitcoach),
  ];

  return {
    passed: rules.every((r) => r.passed || r.severity !== 'block'),
    rules,
  };
}

// ─── Pravidlo 1: Limit úpravy kalorií ───────────────────────
// Změna > 20% týdenního průměru → zamítnout
function checkCalorieChangeLimit(
  input: AIInputContext,
  nutripro: NutriProOutput
): CrossCheckRuleResult {
  const currentPlan = input.aktivni_nutricni_plan;
  if (!currentPlan) {
    return {
      pravidlo: 'calorie_change_limit',
      passed: true,
      detail: 'Žádný aktivní nutriční plán — první nastavení, limit se neaplikuje.',
      severity: 'info',
    };
  }

  const currentAvg =
    (currentPlan.kalorie_treninkovy_den + currentPlan.kalorie_odpocinkovy_den) / 2;
  const proposedAvg =
    (nutripro.nutricni_plan.kalorie_treninkovy_den +
      nutripro.nutricni_plan.kalorie_odpocinkovy_den) /
    2;

  const changePct = Math.abs((proposedAvg - currentAvg) / currentAvg) * 100;

  if (changePct > 20) {
    return {
      pravidlo: 'calorie_change_limit',
      passed: false,
      detail: `Navržená změna kalorií ${changePct.toFixed(1)}% překračuje limit 20%. Aktuální průměr: ${currentAvg} kcal, navržený: ${proposedAvg} kcal.`,
      severity: 'block',
    };
  }

  return {
    pravidlo: 'calorie_change_limit',
    passed: true,
    detail: `Změna kalorií ${changePct.toFixed(1)}% je v limitu.`,
    severity: 'info',
  };
}

// ─── Pravidlo 2: Minimální kalorie (1.2× BMR) ──────────────
// Nikdy pod 1.2× BMR — to je hladovění
function checkMinimumCalories(
  input: AIInputContext,
  nutripro: NutriProOutput
): CrossCheckRuleResult {
  const vek = calculateAge(input.profil.datum_narozeni);
  const bmr = calculateBMR(
    input.profil.aktualni_vaha_kg,
    input.profil.vyska_cm,
    vek,
    input.profil.pohlavi
  );
  const minCalories = Math.round(bmr * 1.2);

  const lowestProposed = Math.min(
    nutripro.nutricni_plan.kalorie_treninkovy_den,
    nutripro.nutricni_plan.kalorie_odpocinkovy_den
  );

  if (lowestProposed < minCalories) {
    return {
      pravidlo: 'minimum_calories',
      passed: false,
      detail: `Navržené kalorie ${lowestProposed} kcal jsou pod bezpečným minimem ${minCalories} kcal (1.2× BMR ${bmr}).`,
      severity: 'block',
    };
  }

  return {
    pravidlo: 'minimum_calories',
    passed: true,
    detail: `Kalorie ${lowestProposed} kcal jsou nad minimem ${minCalories} kcal.`,
    severity: 'info',
  };
}

// ─── Pravidlo 3: Maximální kalorie (1.6× TDEE) ─────────────
function checkMaximumCalories(
  input: AIInputContext,
  nutripro: NutriProOutput
): CrossCheckRuleResult {
  const tdee = input.profil.tdee_kcal;
  if (!tdee) {
    return {
      pravidlo: 'maximum_calories',
      passed: true,
      detail: 'TDEE není k dispozici — přeskakuji.',
      severity: 'info',
    };
  }

  const maxCalories = Math.round(tdee * 1.6);
  const highestProposed = Math.max(
    nutripro.nutricni_plan.kalorie_treninkovy_den,
    nutripro.nutricni_plan.kalorie_odpocinkovy_den
  );

  if (highestProposed > maxCalories) {
    return {
      pravidlo: 'maximum_calories',
      passed: false,
      detail: `Navržené kalorie ${highestProposed} kcal překračují maximum ${maxCalories} kcal (1.6× TDEE ${tdee}).`,
      severity: 'block',
    };
  }

  return {
    pravidlo: 'maximum_calories',
    passed: true,
    detail: `Kalorie ${highestProposed} kcal jsou pod maximem ${maxCalories} kcal.`,
    severity: 'info',
  };
}

// ─── Pravidlo 4: Limit nárůstu zátěže (max +10% týden-na-týden) ──
function checkLoadProgressionLimit(
  input: AIInputContext,
  fitcoach: FitCoachOutput
): CrossCheckRuleResult {
  // Porovná navržené zátěže s posledními záznamy
  const lastWeekSets = input.treninky_7d.flatMap((t) => t.sets ?? []);
  if (lastWeekSets.length === 0) {
    return {
      pravidlo: 'load_progression_limit',
      passed: true,
      detail: 'Žádné předchozí sety — první týden, limit se neaplikuje.',
      severity: 'info',
    };
  }

  // Skupiny podle cviku — max zátěž za minulý týden
  const lastWeekMaxByExercise = new Map<string, number>();
  for (const set of lastWeekSets) {
    if (set.zatez_kg != null && set.zatez_kg > 0) {
      const current = lastWeekMaxByExercise.get(set.cvik) ?? 0;
      if (set.zatez_kg > current) {
        lastWeekMaxByExercise.set(set.cvik, set.zatez_kg);
      }
    }
  }

  const violations: string[] = [];

  for (const day of fitcoach.treninkovy_plan.dny) {
    for (const ex of day.cviky) {
      const proposedLoad = parseFloat(ex.zatez);
      if (isNaN(proposedLoad) || proposedLoad <= 0) continue;

      const lastMax = lastWeekMaxByExercise.get(ex.cvik);
      if (lastMax == null) continue;

      const increasePct = ((proposedLoad - lastMax) / lastMax) * 100;
      if (increasePct > 10) {
        violations.push(
          `${ex.cvik}: ${lastMax}kg → ${proposedLoad}kg (+${increasePct.toFixed(1)}%)`
        );
      }
    }
  }

  if (violations.length > 0) {
    return {
      pravidlo: 'load_progression_limit',
      passed: false,
      detail: `Příliš rychlá progrese: ${violations.join('; ')}. Max povoleno +10%/týden.`,
      severity: 'block',
    };
  }

  return {
    pravidlo: 'load_progression_limit',
    passed: true,
    detail: 'Progrese zátěže je v bezpečném rozmezí.',
    severity: 'info',
  };
}

// ─── Pravidlo 5: Bolest = stop ──────────────────────────────
// Intenzita ≥ 6 → nenavrhnout zátěž na postiženou partii
function checkPainStop(
  input: AIInputContext,
  fitcoach: FitCoachOutput
): CrossCheckRuleResult {
  const painCheckins = input.checkins_7d.filter(
    (c) => c.ma_bolest && c.bolest_intenzita != null && c.bolest_intenzita >= 6
  );

  if (painCheckins.length === 0) {
    return {
      pravidlo: 'pain_stop',
      passed: true,
      detail: 'Žádná bolest ≥ 6 v posledních 7 dnech.',
      severity: 'info',
    };
  }

  // Mapování bolestivých partií na zakázané cviky
  const painToExercises: Record<string, string[]> = {
    zada: ['deadlift', 'squat', 'barbell_row', 'bent_over_row', 'good_morning'],
    koleno: ['squat', 'leg_press', 'lunges', 'leg_extension', 'box_jump'],
    rameno: ['overhead_press', 'lateral_raise', 'bench_press', 'dip', 'pike_push_up'],
    krk: ['overhead_press', 'shrug', 'upright_row'],
    kycel: ['squat', 'deadlift', 'lunges', 'hip_thrust'],
    loket: ['bench_press', 'tricep_extension', 'curl', 'skull_crusher'],
    zapesti: ['bench_press', 'push_up', 'clean', 'front_squat'],
    hlezno: ['squat', 'calf_raise', 'jump', 'running'],
  };

  const affectedParts = [...new Set(painCheckins.map((c) => c.bolest_lokalizace).filter(Boolean))];
  const forbiddenExercises = new Set(
    affectedParts.flatMap((part) => painToExercises[part!] ?? [])
  );

  // Kontrola jestli FitCoach nezařadil zakázaný cvik
  const violations: string[] = [];
  for (const day of fitcoach.treninkovy_plan.dny) {
    for (const ex of day.cviky) {
      const normalizedCvik = ex.cvik.toLowerCase().replace(/\s+/g, '_');
      if (forbiddenExercises.has(normalizedCvik)) {
        violations.push(`${ex.cvik} (bolest: ${affectedParts.join(', ')})`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pravidlo: 'pain_stop',
      passed: false,
      detail: `Cviky zakázány kvůli bolesti: ${violations.join('; ')}. Klient hlásí bolest intenzity ≥6 v: ${affectedParts.join(', ')}.`,
      severity: 'block',
    };
  }

  return {
    pravidlo: 'pain_stop',
    passed: true,
    detail: `Bolest detekována (${affectedParts.join(', ')}), ale FitCoach nezařadil zakázané cviky.`,
    severity: 'warning',
  };
}

// ─── Pravidlo 6: Nedostatek dat ─────────────────────────────
function checkInsufficientData(input: AIInputContext): CrossCheckRuleResult {
  const issues: string[] = [];

  if (!input.aktivni_cil) {
    issues.push('Chybí aktivní cíl');
  }

  if (input.profil.zdravotni_omezeni === undefined) {
    issues.push('Zdravotní omezení nejsou vyplněna');
  }

  if (input.checkins_7d.length < 3) {
    issues.push(`Pouze ${input.checkins_7d.length} check-inů za 7 dní (minimum 3)`);
  }

  if (issues.length > 0) {
    return {
      pravidlo: 'insufficient_data',
      passed: false,
      detail: `Nedostatek dat pro bezpečné generování: ${issues.join('; ')}.`,
      severity: issues.includes('Chybí aktivní cíl') ? 'block' : 'warning',
    };
  }

  return {
    pravidlo: 'insufficient_data',
    passed: true,
    detail: 'Dostatečná data pro generování.',
    severity: 'info',
  };
}

// ─── Pravidlo 7: Deload trigger ─────────────────────────────
// RPE roste 3 tréninky po sobě + spánek klesá → navrhni deload
function checkDeloadTrigger(input: AIInputContext): CrossCheckRuleResult {
  const recentWorkouts = input.treninky_7d
    .filter((w) => w.odcviceno && w.rpe != null)
    .sort((a, b) => a.datum.localeCompare(b.datum));

  if (recentWorkouts.length < 3) {
    return {
      pravidlo: 'deload_trigger',
      passed: true,
      detail: 'Méně než 3 tréninky za týden — nelze vyhodnotit.',
      severity: 'info',
    };
  }

  const last3 = recentWorkouts.slice(-3);
  const rpeRising =
    last3[0].rpe! < last3[1].rpe! && last3[1].rpe! < last3[2].rpe!;

  const recentSleep = input.checkins_7d
    .filter((c) => c.spanek_hodin != null)
    .sort((a, b) => a.datum.localeCompare(b.datum));

  let sleepDecreasing = false;
  if (recentSleep.length >= 3) {
    const last3Sleep = recentSleep.slice(-3);
    sleepDecreasing =
      last3Sleep[0].spanek_hodin! > last3Sleep[1].spanek_hodin! &&
      last3Sleep[1].spanek_hodin! > last3Sleep[2].spanek_hodin!;
  }

  if (rpeRising && sleepDecreasing) {
    return {
      pravidlo: 'deload_trigger',
      passed: true, // Prošlo, ale s varováním — AI by MĚLA navrhnout deload
      detail: `RPE roste 3 tréninky po sobě (${last3.map((w) => w.rpe).join('→')}) a spánek klesá. Systém doporučuje deload týden.`,
      severity: 'warning',
    };
  }

  return {
    pravidlo: 'deload_trigger',
    passed: true,
    detail: 'Žádný deload trigger.',
    severity: 'info',
  };
}

// ─── Pravidlo 8: Rozumný rozsah bílkovin ────────────────────
function checkProteinRange(
  input: AIInputContext,
  nutripro: NutriProOutput
): CrossCheckRuleResult {
  const vaha = input.profil.aktualni_vaha_kg;
  const minProtein = Math.round(vaha * 1.2); // absolutní minimum
  const maxProtein = Math.round(vaha * 3.0); // nesmyslně vysoké

  const proposed = nutripro.nutricni_plan.bilkoviny_g;

  if (proposed < minProtein || proposed > maxProtein) {
    return {
      pravidlo: 'protein_range',
      passed: false,
      detail: `Navržené bílkoviny ${proposed}g jsou mimo rozsah ${minProtein}–${maxProtein}g (${vaha}kg × 1.2–3.0).`,
      severity: 'block',
    };
  }

  return {
    pravidlo: 'protein_range',
    passed: true,
    detail: `Bílkoviny ${proposed}g v normě.`,
    severity: 'info',
  };
}

// ─── Pravidlo 9: Nedostatek spánku + těžký trénink ─────────
function checkSleepDeprivationWarning(
  input: AIInputContext,
  fitcoach: FitCoachOutput
): CrossCheckRuleResult {
  const avgSleep = input.checkins_7d
    .filter((c) => c.spanek_hodin != null)
    .reduce((sum, c, _, arr) => sum + c.spanek_hodin! / arr.length, 0);

  if (avgSleep < 6 && fitcoach.intenzita_pristi_tyden === 'vyssi') {
    return {
      pravidlo: 'sleep_deprivation_warning',
      passed: false,
      detail: `Průměrný spánek ${avgSleep.toFixed(1)}h (<6h) a FitCoach navrhuje vyšší intenzitu. Blokováno — nejdřív spánek.`,
      severity: 'block',
    };
  }

  if (avgSleep < 6.5) {
    return {
      pravidlo: 'sleep_deprivation_warning',
      passed: true,
      detail: `Průměrný spánek ${avgSleep.toFixed(1)}h je nízký. Upozornění pro uživatele.`,
      severity: 'warning',
    };
  }

  return {
    pravidlo: 'sleep_deprivation_warning',
    passed: true,
    detail: `Spánek OK (${avgSleep.toFixed(1)}h).`,
    severity: 'info',
  };
}
