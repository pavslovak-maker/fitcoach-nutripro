// Typy sdílené mezi frontendem a backendem
// Podmnožina z src/types/domain.ts — jen co frontend potřebuje

export type MealType = 'snidane' | 'obed' | 'svacina' | 'vecere';
export type BodyPart = 'zada' | 'koleno' | 'rameno' | 'krk' | 'kycel' | 'loket' | 'zapesti' | 'hlezno' | 'jine';

export interface TodayResponse {
  datum: string;
  den_v_tydnu: string;
  trenink: {
    je_treninkovy_den: boolean;
    plan_day: any | null;
    uz_zaznamenan: boolean;
    session: any | null;
  };
  jidlo: {
    plan_meals: any[];
    zaznamenane: any[];
    kalorie_celkem: number;
    kalorie_cil: number;
    bilkoviny_celkem: number;
    bilkoviny_cil: number;
  };
  checkin: {
    vyplnen: boolean;
    data: any | null;
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
