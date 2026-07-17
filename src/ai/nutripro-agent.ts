// ============================================================
// NutriPro AI Agent
// Analyzuje nutriční data a navrhuje stravovací plán.
// KLÍČOVÉ: Dostává výstup FitCoache jako vstup →
// strava se přizpůsobuje tréninku, ne naopak.
// ============================================================

import type { AIInputContext, FitCoachOutput, NutriProOutput } from '../types/domain';
import { NutriProOutputSchema } from '../validators/schemas';

const logger = console;

// ─── System prompt pro NutriPro ─────────────────────────────

function buildNutriProSystemPrompt(): string {
  return `Jsi NutriPro — osobní AI výživový poradce. Tvým úkolem je analyzovat nutriční data klienta a navrhnout stravovací plán na příští týden.

## Tvoje role
- Analyzuješ: trend váhy (14-21 dní), kalorický příjem, makro rozložení, adherenci k plánu.
- Navrhuješ: Kalorický cíl (odlišný pro tréninkové a odpočinkové dny), makra, konkrétní jídla.
- Reaguješ na FitCoach: Dostáváš info o tréninkové intenzitě příštího týdne a přizpůsobuješ stravu.

## Pravidla (MUSÍŠ dodržet)
1. NIKDY neměň kalorie o víc než 10% oproti aktuálnímu plánu najednou.
2. NIKDY nenavrh kalorie pod 1.2× BMR klienta — to je hladovění.
3. NIKDY nenavrh kalorie nad 1.6× TDEE — to je nesmyslný surplus.
4. Bílkoviny: 1.6–2.2g na kg tělesné hmotnosti (2.0+ při hubnutí).
5. V tréninkové dny: víc sacharidů (kolem tréninku). V odpočinkové dny: víc tuků.
6. Respektuj alergie a intolerance — NIKDY nezařazuj alergeny.
7. Respektuj stravovací preference (vegetarián, vegan, atd.).
8. Pokud váha stojí > 2 týdny při hubnutí a adherence > 80% → sniž o 100-150 kcal.
9. Pokud váha klesá > 1% tělesné hmotnosti/týden → zvyš kalorie (ochrana svalů).

## Kontext od FitCoache
Dostaneš informaci o tréninkovém plánu na příští týden:
- Pokud je "vyssi" intenzita → navrhni víc sacharidů v tréninkové dny
- Pokud je "nizsi" (deload) → mírně sníž kalorie (nižší výdej)
- Pokud je "stejna" → udržuj aktuální plán

## Formát odpovědi
Odpověz POUZE validním JSON objektem (bez markdown, bez komentářů):
{
  "nutricni_plan": {
    "kalorie_treninkovy_den": number,
    "kalorie_odpocinkovy_den": number,
    "bilkoviny_g": number,
    "sacharidy_g": number,
    "tuky_g": number,
    "jidla": [
      {
        "typ": "snidane|obed|svacina|vecere",
        "je_treninkovy_den": boolean,
        "nazev": "Název jídla",
        "suroviny": [{"nazev": "vejce", "mnozstvi": "2 ks"}],
        "kalorie": number,
        "bilkoviny_g": number,
        "sacharidy_g": number,
        "tuky_g": number,
        "poznamka": "Skvělé před tréninkem" nebo null
      }
    ]
  },
  "zduvodneni": "Proč navrhuji tento plán (2-3 věty, česky, pro klienta)",
  "upozorneni": ["Seznam upozornění"]
}`;
}

// ─── Sestavení user promptu ─────────────────────────────────

function buildNutriProUserPrompt(
  context: AIInputContext,
  fitcoachOutput: FitCoachOutput
): string {
  const { profil, aktivni_cil, strava_7d, vaha_trend_14d, aktivni_nutricni_plan, checkins_7d } = context;

  // Denní souhrn kalorií za 7 dní
  const dailyCalories = new Map<string, { kcal: number; protein: number; carbs: number; fat: number; count: number }>();
  for (const meal of strava_7d) {
    const day = dailyCalories.get(meal.datum) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0 };
    day.kcal += meal.kalorie ?? 0;
    day.protein += meal.bilkoviny_g ?? 0;
    day.carbs += meal.sacharidy_g ?? 0;
    day.fat += meal.tuky_g ?? 0;
    day.count++;
    dailyCalories.set(meal.datum, day);
  }

  const avgCalories = dailyCalories.size > 0
    ? [...dailyCalories.values()].reduce((s, d) => s + d.kcal, 0) / dailyCalories.size
    : null;

  const adherence = strava_7d.filter((m) => m.dle_planu === true).length;
  const totalMeals = strava_7d.length;

  return `## Profil klienta
- Jméno: ${profil.jmeno}
- Pohlaví: ${profil.pohlavi}, Váha: ${profil.aktualni_vaha_kg}kg, Výška: ${profil.vyska_cm}cm
- BMR: ${profil.bmr_kcal} kcal, TDEE: ${profil.tdee_kcal} kcal
- Aktuální kalorický cíl: ${profil.cilove_kalorie} kcal
- Cílové makra: B=${profil.cilove_bilkoviny_g}g, S=${profil.cilove_sacharidy_g}g, T=${profil.cilove_tuky_g}g
- Alergie/intolerance: ${profil.alergie_intolerance.join(', ') || 'žádné'}
- Stravovací preference: ${profil.stravovaci_preference ?? 'bez omezení'}
- Počet jídel denně: ${profil.pocet_jidel_denne}

## Aktivní cíl
${aktivni_cil ? `${aktivni_cil.typ_cile}${aktivni_cil.cilova_vaha_kg ? `, cílová váha: ${aktivni_cil.cilova_vaha_kg}kg` : ''}` : 'ŽÁDNÝ'}

## Trend váhy (14 dní)
- Směr: ${vaha_trend_14d.smer}
- Změna: ${vaha_trend_14d.zmena_za_14d_kg ?? '?'}kg (${vaha_trend_14d.zmena_za_14d_pct ?? '?'}%)
- Průměr 7d: ${vaha_trend_14d.prumer_7d ?? '?'}kg
- Průměr 14d: ${vaha_trend_14d.prumer_14d ?? '?'}kg
- Data: ${vaha_trend_14d.hodnoty.map((v) => `${v.datum}: ${v.vaha_kg}kg`).join(', ')}

## Strava za 7 dní (denní souhrny)
${[...dailyCalories.entries()].map(([date, d]) => `${date}: ${d.kcal} kcal (B=${d.protein.toFixed(0)}g, S=${d.carbs.toFixed(0)}g, T=${d.fat.toFixed(0)}g) — ${d.count} jídel`).join('\n') || 'Žádné záznamy.'}

### Průměr
- Průměrný denní příjem: ${avgCalories != null ? Math.round(avgCalories) : '?'} kcal
- Adherence k plánu: ${totalMeals > 0 ? `${adherence}/${totalMeals} jídel (${Math.round((adherence / totalMeals) * 100)}%)` : 'N/A'}

## Aktuální nutriční plán
${aktivni_nutricni_plan ? `Kalorie tréninkov: ${aktivni_nutricni_plan.kalorie_treninkovy_den}, odpočinkov: ${aktivni_nutricni_plan.kalorie_odpocinkovy_den}, B=${aktivni_nutricni_plan.bilkoviny_g}g, S=${aktivni_nutricni_plan.sacharidy_g}g, T=${aktivni_nutricni_plan.tuky_g}g` : 'Žádný aktivní plán (první generování).'}

## Spánek a energie (kontext)
${checkins_7d.map((c) => `${c.datum}: spánek=${c.spanek_hodin ?? '?'}h, energie=${c.energie ?? '?'}/5`).join('\n')}

## INFO OD FITCOACHE (DŮLEŽITÉ)
Tréninkový plán příští týden:
- Intenzita: ${fitcoachOutput.intenzita_pristi_tyden}
- Detail: ${fitcoachOutput.info_pro_nutripro}
- Tréninkové dny: ${fitcoachOutput.treninkovy_plan.dny.filter((d) => d.typ_dne !== 'rest').map((d) => d.den).join(', ')}
- Odpočinkové dny: ${fitcoachOutput.treninkovy_plan.dny.filter((d) => d.typ_dne === 'rest').map((d) => d.den).join(', ')}
${fitcoachOutput.upozorneni.length > 0 ? `- Upozornění: ${fitcoachOutput.upozorneni.join('; ')}` : ''}

## Úkol
Navrhni nutriční plán na příští týden. Kalorie rozděl na tréninkové a odpočinkové dny. Navrhni konkrétní jídla (${profil.pocet_jidel_denne} jídel denně) pro oba typy dní. Vysvětli PROČ.`;
}

// ─── Volání LLM ─────────────────────────────────────────────

export async function callNutriPro(
  context: AIInputContext,
  fitcoachOutput: FitCoachOutput
): Promise<NutriProOutput> {
  const systemPrompt = buildNutriProSystemPrompt();
  const userPrompt = buildNutriProUserPrompt(context, fitcoachOutput);

  logger.info('nutripro.calling_llm', {
    user_id: context.profil.id,
    prompt_length: userPrompt.length,
    fitcoach_intenzita: fitcoachOutput.intenzita_pristi_tyden,
  });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const rawText = data.content
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('');

  // Parse a validace JSON odpovědi
  // Validace je KRITICKÁ: bez ní AI může vynechat jídla pro tréninkové
  // nebo odpočinkové dny a Home pro daný typ dne tiše zůstane bez stravy.
  let parsedRaw: unknown;
  try {
    const cleaned = rawText.replace(/```json\s*|```/g, '').trim();
    parsedRaw = JSON.parse(cleaned);
  } catch (parseError) {
    logger.error('nutripro.parse_error', {
      raw: rawText.substring(0, 500),
      error: parseError,
    });
    throw new Error('NutriPro vrátil neplatný JSON');
  }

  const validation = NutriProOutputSchema.safeParse(parsedRaw);
  if (!validation.success) {
    logger.error('nutripro.validation_error', {
      raw: rawText.substring(0, 500),
      issues: validation.error.issues,
    });
    throw new Error(
      `NutriPro vrátil neúplný/neplatný plán: ${validation.error.issues.map((i) => i.message).join('; ')}`
    );
  }

  const parsed = validation.data as NutriProOutput;

  logger.info('nutripro.success', {
    user_id: context.profil.id,
    kcal_training: parsed.nutricni_plan.kalorie_treninkovy_den,
    kcal_rest: parsed.nutricni_plan.kalorie_odpocinkovy_den,
    meals_count: parsed.nutricni_plan.jidla.length,
  });

  return parsed;
}
