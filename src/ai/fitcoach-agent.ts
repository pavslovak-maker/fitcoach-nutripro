// ============================================================
// FitCoach AI Agent
// Analyzuje tréninková data a navrhuje plán na příští týden.
// Vstup: AIInputContext (kompletní data klienta za 7 dní)
// Výstup: FitCoachOutput (tréninkový plán + info pro NutriPro)
// ============================================================

import type { AIInputContext, FitCoachOutput } from '../types/domain';
import { FitCoachOutputSchema } from '../validators/schemas';

const logger = console;

// ─── System prompt pro FitCoach ─────────────────────────────

function buildFitCoachSystemPrompt(): string {
  return `Jsi FitCoach — osobní AI trenér. Tvým úkolem je analyzovat tréninková data klienta za posledních 7 dní a navrhnout tréninkový plán na příští týden.

## Tvoje role
- Analyzuješ: RPE trend, spánek, energii, bolesti, progres v zátěži, adherenci k plánu.
- Navrhuješ: Konkrétní cviky, série, opakování, zátěž, odpočinkové dny.
- Přizpůsobuješ: Pokud je klient unavený, snižuješ. Pokud progresuje, zvyšuješ. Pokud má bolest, vynecháváš.

## Pravidla (MUSÍŠ dodržet)
1. NIKDY nezvyšuj zátěž o víc než 10% oproti minulému týdnu.
2. NIKDY nezařazuj cviky které zatěžují bolestivou partii.
3. Pokud RPE roste 3 tréninky po sobě A spánek klesá → navrhni DELOAD (lehký týden).
4. Pokud klient skipuje tréninky (adherence < 50%) → ZKRAŤ a ZJEDNODUŠ, nezvyšuj.
5. Respektuj dostupné vybavení — nenavrhuj leg press pokud cvičí doma.
6. Respektuj časový limit klienta (délka_tréninku_min).
7. Respektuj pevné termíny — necvič v době kdy klient nemůže.

## Formát odpovědi
Odpověz POUZE validním JSON objektem (bez markdown, bez komentářů) s touto strukturou:
{
  "treninkovy_plan": {
    "dny": [
      {
        "den": "po|ut|st|ct|pa|so|ne",
        "typ_dne": "rest|light|medium|hard",
        "delka_min": number,
        "cviky": [
          {
            "cvik": "název cviku",
            "serie": number,
            "opakovani": "8-10",
            "zatez": "50kg" nebo "vlastní váha",
            "pauza_s": number,
            "poznamka": "technická poznámka nebo null"
          }
        ]
      }
    ]
  },
  "zduvodneni": "Proč navrhuji tento plán (2-3 věty, česky, pro klienta)",
  "info_pro_nutripro": "Info pro NutriPro agenta: jaká bude intenzita, co se mění",
  "intenzita_pristi_tyden": "nizsi|stejna|vyssi",
  "upozorneni": ["Seznam upozornění pokud jsou relevantní"]
}`;
}

// ─── Sestavení user promptu s daty klienta ──────────────────

function buildFitCoachUserPrompt(context: AIInputContext): string {
  const { profil, aktivni_cil, checkins_7d, treninky_7d, aktivni_treninkovy_plan, zdravotni_problemy, wearable_data_7d } = context;

  // Výpočet klíčových metrik
  const workoutsDone = treninky_7d.filter((w) => w.odcviceno);
  const avgRPE =
    workoutsDone.length > 0
      ? workoutsDone.reduce((s, w) => s + (w.rpe ?? 0), 0) / workoutsDone.length
      : null;

  const sleepData = checkins_7d.filter((c) => c.spanek_hodin != null);
  const avgSleep =
    sleepData.length > 0
      ? sleepData.reduce((s, c) => s + c.spanek_hodin!, 0) / sleepData.length
      : null;

  const energyData = checkins_7d.filter((c) => c.energie != null);
  const avgEnergy =
    energyData.length > 0
      ? energyData.reduce((s, c) => s + c.energie!, 0) / energyData.length
      : null;

  const painCheckins = checkins_7d.filter((c) => c.ma_bolest);

  return `## Profil klienta
- Jméno: ${profil.jmeno}
- Pohlaví: ${profil.pohlavi}, Věk: vypočti z ${profil.datum_narozeni}
- Výška: ${profil.vyska_cm}cm, Váha: ${profil.aktualni_vaha_kg}kg
- Úroveň: ${profil.uroven_cviceni}
- Tréninky týdně: ${profil.treninky_tyden}x, délka: ${profil.delka_treninku_min} min
- Vybavení: ${profil.dostupne_vybaveni.join(', ') || 'vlastní váha'}
- Zdravotní omezení: ${profil.zdravotni_omezeni.join(', ') || 'žádné'}
- Pevné termíny: ${JSON.stringify(profil.pevne_terminy)}

## Aktivní cíl
${aktivni_cil ? `${aktivni_cil.typ_cile}${aktivni_cil.cilova_vaha_kg ? `, cílová váha: ${aktivni_cil.cilova_vaha_kg}kg` : ''}` : 'ŽÁDNÝ CÍL — vyžádej doplnění'}

## Data za posledních 7 dní

### Denní check-iny
${checkins_7d.map((c) => `${c.datum}: váha=${c.vaha_kg ?? '?'}kg, spánek=${c.spanek_hodin ?? '?'}h (kvalita ${c.spanek_kvalita ?? '?'}/5), energie=${c.energie ?? '?'}/5, bolest=${c.ma_bolest ? `ANO (${c.bolest_lokalizace}, intenzita ${c.bolest_intenzita}/10${c.bolest_poznamka ? `, "${c.bolest_poznamka}"` : ''})` : 'ne'}`).join('\n')}

### Průměry
- RPE: ${avgRPE != null ? avgRPE.toFixed(1) : 'N/A'}
- Spánek: ${avgSleep != null ? avgSleep.toFixed(1) + 'h' : 'N/A'}
- Energie: ${avgEnergy != null ? avgEnergy.toFixed(1) + '/5' : 'N/A'}
- Adherence: ${workoutsDone.length}/${profil.treninky_tyden} tréninků splněno

### Tréninky
${treninky_7d.map((w) => {
  let line = `${w.datum}: ${w.typ_treninku}, odcvičeno=${w.odcviceno}`;
  if (w.odcviceno) {
    line += `, ${w.delka_min}min, RPE=${w.rpe ?? '?'}`;
    if (w.poznamka) line += `, poznámka: "${w.poznamka}"`;
  }
  if (w.sets && w.sets.length > 0) {
    line += '\n  Sety: ' + w.sets.map((s) => `${s.cvik} ${s.serie_cislo}×${s.opakovani ?? '?'} @ ${s.zatez_kg ?? 'BW'}kg`).join(', ');
  }
  return line;
}).join('\n') || 'Žádné tréninky zaznamenány.'}

### Bolesti (aktivní zdravotní problémy)
${zdravotni_problemy.length > 0 ? zdravotni_problemy.map((h) => `- ${h.lokalizace}: intenzita ${h.intenzita}/10${h.spoustec ? `, spouštěč: "${h.spoustec}"` : ''}${h.zhorsovani ? ' (ZHORŠUJE SE!)' : ''}`).join('\n') : 'Žádné aktivní problémy.'}

### Aktuální plán
${aktivni_treninkovy_plan ? JSON.stringify(aktivni_treninkovy_plan, null, 2) : 'Žádný aktivní plán (první generování).'}

${wearable_data_7d.length > 0 ? `### Data z hodinek\n${wearable_data_7d.map((w) => `${w.datum}: kroky=${w.kroky ?? '?'}, tep_klid=${w.srdecni_tep_klid ?? '?'}, stress=${w.stress_score ?? '?'}, body_battery=${w.body_battery ?? '?'}`).join('\n')}` : ''}

## Úkol
Navrhni tréninkový plán na příští týden. Vysvětli PROČ navrhuješ to co navrhuješ.`;
}

// ─── Volání LLM ─────────────────────────────────────────────

export async function callFitCoach(
  context: AIInputContext
): Promise<FitCoachOutput> {
  const systemPrompt = buildFitCoachSystemPrompt();
  const userPrompt = buildFitCoachUserPrompt(context);

  logger.info('fitcoach.calling_llm', {
    user_id: context.profil.id,
    prompt_length: userPrompt.length,
  });

  // Volání Anthropic API
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
  // Validace je KRITICKÁ: bez ní AI může vynechat den v týdnu a Home
  // pro daný den tiše zůstane bez plánu, aniž by generování selhalo.
  let parsedRaw: unknown;
  try {
    const cleaned = rawText.replace(/```json\s*|```/g, '').trim();
    parsedRaw = JSON.parse(cleaned);
  } catch (parseError) {
    logger.error('fitcoach.parse_error', {
      raw: rawText.substring(0, 500),
      error: parseError,
    });
    throw new Error('FitCoach vrátil neplatný JSON');
  }

  const validation = FitCoachOutputSchema.safeParse(parsedRaw);
  if (!validation.success) {
    logger.error('fitcoach.validation_error', {
      raw: rawText.substring(0, 500),
      issues: validation.error.issues,
    });
    throw new Error(
      `FitCoach vrátil neúplný/neplatný plán: ${validation.error.issues.map((i) => i.message).join('; ')}`
    );
  }

  const parsed = validation.data as FitCoachOutput;

  logger.info('fitcoach.success', {
    user_id: context.profil.id,
    days_planned: parsed.treninkovy_plan.dny.length,
    intenzita: parsed.intenzita_pristi_tyden,
  });

  return parsed;
}
