-- ============================================================
-- FitCoach & NutriPro — MVP Database Schema
-- Migration 001: Initial schema
-- ============================================================
-- Princip: Vše co AI potřebuje k analýze + audit trail.
-- Bezpečnost: Zdravotní data šifrována, RLS na všech tabulkách.
-- ============================================================

-- Enum typy
CREATE TYPE user_role AS ENUM ('client', 'admin');
CREATE TYPE gender AS ENUM ('muz', 'zena', 'jine');
CREATE TYPE exercise_level AS ENUM ('zacatecnik', 'mirne_pokrocily', 'pokrocily');
CREATE TYPE goal_type AS ENUM ('hubnuti', 'nabirani', 'udrzeni', 'vykon');
CREATE TYPE plan_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE meal_type AS ENUM ('snidane', 'obed', 'svacina', 'vecere');
CREATE TYPE day_of_week AS ENUM ('po', 'ut', 'st', 'ct', 'pa', 'so', 'ne');
CREATE TYPE recommendation_type AS ENUM ('trenink_uprava', 'kalorie_uprava', 'deload', 'jine');
CREATE TYPE recommendation_status AS ENUM ('navrzeno', 'prijato', 'zamitnuto');
CREATE TYPE training_day_type AS ENUM ('rest', 'light', 'medium', 'hard');
CREATE TYPE body_part AS ENUM ('zada', 'koleno', 'rameno', 'krk', 'kycel', 'loket', 'zapesti', 'hlezno', 'jine');
CREATE TYPE food_logging_mode AS ENUM ('simple', 'text', 'detailed');
CREATE TYPE wearable_type AS ENUM ('garmin', 'suunto', 'withings', 'fitbit', 'google_fit');
CREATE TYPE sync_status AS ENUM ('success', 'token_expired', 'api_error', 'rate_limit', 'no_new_data');

-- ============================================================
-- 1. USERS (autentizace)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'client',
  is_active BOOLEAN NOT NULL DEFAULT true,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- 2. FITNESS_PROFILES (registrační data — základ pro AI)
-- ============================================================
CREATE TABLE fitness_profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  
  -- Základní údaje (povinné při registraci)
  jmeno TEXT NOT NULL,
  pohlavi gender NOT NULL,
  datum_narozeni DATE NOT NULL,
  vyska_cm INTEGER NOT NULL CHECK (vyska_cm BETWEEN 100 AND 250),
  aktualni_vaha_kg NUMERIC(5,1) NOT NULL CHECK (aktualni_vaha_kg BETWEEN 30 AND 300),
  
  -- Cvičení (povinné)
  uroven_cviceni exercise_level NOT NULL,
  treninky_tyden INTEGER NOT NULL CHECK (treninky_tyden BETWEEN 1 AND 7),
  delka_treninku_min INTEGER NOT NULL CHECK (delka_treninku_min BETWEEN 10 AND 120),
  dostupne_vybaveni TEXT[] NOT NULL DEFAULT '{}',
  -- Příklady: 'vlastni_vaha', 'cinky', 'trx', 'posilovna', 'venku'
  
  -- Zdravotní omezení (povinné — bezpečnostně kritické)
  -- Šifrováno na aplikační vrstvě (pgcrypto) — GDPR čl. 9
  zdravotni_omezeni TEXT[] NOT NULL DEFAULT '{}',
  leky TEXT,
  alergie_intolerance TEXT[] NOT NULL DEFAULT '{}',
  
  -- Stravovací preference (volitelné)
  stravovaci_preference TEXT, -- 'vegetarian', 'vegan', 'bez_omezeni'
  pocet_jidel_denne INTEGER DEFAULT 4 CHECK (pocet_jidel_denne BETWEEN 2 AND 6),
  food_logging_mode food_logging_mode NOT NULL DEFAULT 'simple',
  
  -- Pevné termíny (volitelné)
  -- Uloženo jako JSONB: [{"den":"po","cas_od":"09:00","cas_do":"17:00","aktivita":"práce"}]
  pevne_terminy JSONB DEFAULT '[]',
  
  -- Vypočtené hodnoty (systém generuje při registraci a aktualizuje)
  bmr_kcal INTEGER, -- Bazální metabolismus
  tdee_kcal INTEGER, -- Celkový denní výdej
  cilove_kalorie INTEGER, -- Kalorický cíl (TDEE +/- deficit/surplus)
  cilove_bilkoviny_g INTEGER,
  cilove_sacharidy_g INTEGER,
  cilove_tuky_g INTEGER,
  
  -- Kdy cvičit (volitelné)
  preferovany_cas_treninku TEXT, -- 'rano', 'dopoledne', 'odpoledne', 'vecer'
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. GOALS (cíle klienta — max 1 aktivní)
-- ============================================================
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  typ_cile goal_type NOT NULL,
  cilova_vaha_kg NUMERIC(5,1), -- NULL pokud cíl není váhový
  datum_od DATE NOT NULL DEFAULT CURRENT_DATE,
  datum_do DATE, -- NULL = bez časového limitu
  aktivni BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Business pravidlo: max 1 aktivní cíl na uživatele
CREATE UNIQUE INDEX idx_goals_one_active 
  ON goals(user_id) WHERE aktivni = true;

CREATE INDEX idx_goals_user ON goals(user_id);

-- ============================================================
-- 4. DAILY_CHECKIN (denní ranní zápis — srdce systému)
-- ============================================================
CREATE TABLE daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  datum DATE NOT NULL,
  
  -- Váha (volitelné — stačí 3-4x týdně)
  vaha_kg NUMERIC(5,1) CHECK (vaha_kg BETWEEN 30 AND 300),
  
  -- Spánek (denně)
  spanek_hodin NUMERIC(3,1) CHECK (spanek_hodin BETWEEN 0 AND 24),
  spanek_kvalita INTEGER CHECK (spanek_kvalita BETWEEN 1 AND 5),
  -- 1=hrozný, 2=špatný, 3=průměrný, 4=dobrý, 5=výborný
  
  -- Energie a nálada (denně)
  energie INTEGER CHECK (energie BETWEEN 1 AND 5),
  -- 1=vyčerpaný, 2=unavený, 3=normální, 4=dobře, 5=skvěle
  
  -- Bolest (denně)
  ma_bolest BOOLEAN NOT NULL DEFAULT false,
  bolest_lokalizace body_part,
  bolest_intenzita INTEGER CHECK (bolest_intenzita BETWEEN 1 AND 10),
  bolest_poznamka TEXT, -- "Při předklonu", "Po běhu"
  
  -- Pitný režim (denně, orientační)
  pitny_rezim_litru NUMERIC(3,1) CHECK (pitny_rezim_litru BETWEEN 0 AND 10),
  
  -- Kroky (z hodinek nebo ruční zápis)
  kroky INTEGER CHECK (kroky >= 0),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Jeden záznam na den na uživatele
CREATE UNIQUE INDEX idx_checkin_user_date ON daily_checkins(user_id, datum);
CREATE INDEX idx_checkin_datum ON daily_checkins(user_id, datum DESC);

-- ============================================================
-- 5. WORKOUT_SESSIONS (záznam tréninku)
-- ============================================================
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_day_id UUID, -- odkaz na plánovaný den (NULL pokud ad-hoc)
  datum DATE NOT NULL,
  
  -- Základní info
  typ_treninku TEXT NOT NULL, -- "horní tělo", "dolní tělo", "full body", "kardio"
  odcviceno BOOLEAN NOT NULL, -- i "ne" je cenný údaj
  
  -- Detaily (pokud odcvičeno = true)
  delka_min INTEGER CHECK (delka_min BETWEEN 1 AND 300),
  rpe INTEGER CHECK (rpe BETWEEN 1 AND 10),
  -- RPE 1-3=lehké, 4-6=střední, 7-8=těžké, 9-10=maximální
  
  poznamka TEXT, -- "Bolelo rameno při benchpressu"
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workout_user_date ON workout_sessions(user_id, datum DESC);

-- ============================================================
-- 6. WORKOUT_SETS (detailní zápis cviků — volitelný mód)
-- ============================================================
CREATE TABLE workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  
  cvik TEXT NOT NULL, -- "bench press", "squat", "deadlift"
  serie_cislo INTEGER NOT NULL CHECK (serie_cislo >= 1),
  opakovani INTEGER CHECK (opakovani >= 0),
  zatez_kg NUMERIC(5,1) CHECK (zatez_kg >= 0),
  
  -- Volitelné
  technika_ok BOOLEAN, -- Kouč/klient hodnotí techniku
  poznamka TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sets_session ON workout_sets(session_id);

-- ============================================================
-- 7. NUTRITION_LOG (záznam stravy)
-- ============================================================
CREATE TABLE nutrition_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  datum DATE NOT NULL,
  jidlo_typ meal_type NOT NULL,
  
  -- Jednoduchý mód: "jedl podle plánu"
  dle_planu BOOLEAN,
  
  -- Střední mód: textový popis
  popis TEXT, -- "2 vejce, chleba s máslem, rajče"
  
  -- Detailní mód / AI odhad
  kalorie INTEGER CHECK (kalorie >= 0),
  bilkoviny_g NUMERIC(5,1) CHECK (bilkoviny_g >= 0),
  sacharidy_g NUMERIC(5,1) CHECK (sacharidy_g >= 0),
  tuky_g NUMERIC(5,1) CHECK (tuky_g >= 0),
  
  -- Foto (volitelné)
  foto_url TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nutrition_user_date ON nutrition_logs(user_id, datum DESC);

-- ============================================================
-- 8. TRAINING_PLANS (AI generovaný tréninkový plán)
-- ============================================================
CREATE TABLE training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  nazev TEXT NOT NULL, -- "Týden 3 — Progrese"
  status plan_status NOT NULL DEFAULT 'draft',
  platny_od DATE NOT NULL,
  platny_do DATE,
  
  -- Metadata
  generated_by TEXT NOT NULL DEFAULT 'fitcoach_ai',
  recommendation_id UUID, -- odkaz na AI doporučení které tento plán vytvořilo
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Max 1 aktivní plán na uživatele
CREATE UNIQUE INDEX idx_training_plan_active 
  ON training_plans(user_id) WHERE status = 'active';

CREATE INDEX idx_training_plans_user ON training_plans(user_id);

-- ============================================================
-- 9. TRAINING_PLAN_DAYS (dny v tréninkovém plánu)
-- ============================================================
CREATE TABLE training_plan_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  
  den day_of_week NOT NULL,
  typ_dne training_day_type NOT NULL,
  delka_min INTEGER NOT NULL CHECK (delka_min BETWEEN 0 AND 120),
  poznamka TEXT, -- "Focus na mobilitu" nebo "Těžký den — jez víc sacharidů"
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plan_days ON training_plan_days(plan_id);

-- ============================================================
-- 10. TRAINING_PLAN_EXERCISES (cviky v plánu)
-- ============================================================
CREATE TABLE training_plan_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_day_id UUID NOT NULL REFERENCES training_plan_days(id) ON DELETE CASCADE,
  
  poradi INTEGER NOT NULL CHECK (poradi >= 1),
  cvik TEXT NOT NULL,
  serie INTEGER NOT NULL CHECK (serie >= 1),
  opakovani TEXT NOT NULL, -- "8-10" nebo "12" nebo "max"
  zatez_doporucena TEXT, -- "50kg" nebo "vlastní váha" nebo "60% 1RM"
  pauza_s INTEGER DEFAULT 90 CHECK (pauza_s >= 0),
  poznamka_technika TEXT, -- "Lokty u těla, kontrolovaný pohyb dolů"
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plan_exercises ON training_plan_exercises(plan_day_id);

-- ============================================================
-- 11. NUTRITION_PLANS (AI generovaný nutriční plán)
-- ============================================================
CREATE TABLE nutrition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  status plan_status NOT NULL DEFAULT 'draft',
  
  -- Denní cíle
  kalorie_treninkovy_den INTEGER NOT NULL,
  kalorie_odpocinkovy_den INTEGER NOT NULL,
  bilkoviny_g INTEGER NOT NULL,
  sacharidy_g INTEGER NOT NULL,
  tuky_g INTEGER NOT NULL,
  
  -- Metadata
  generated_by TEXT NOT NULL DEFAULT 'nutripro_ai',
  recommendation_id UUID,
  platny_od DATE NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Max 1 aktivní nutriční plán na uživatele
CREATE UNIQUE INDEX idx_nutrition_plan_active 
  ON nutrition_plans(user_id) WHERE status = 'active';

-- ============================================================
-- 12. NUTRITION_PLAN_MEALS (jídla v nutričním plánu)
-- ============================================================
CREATE TABLE nutrition_plan_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES nutrition_plans(id) ON DELETE CASCADE,
  
  jidlo_typ meal_type NOT NULL,
  je_treninkovy_den BOOLEAN NOT NULL DEFAULT false,
  -- Stejný plán může mít jiná jídla pro tréninkové vs odpočinkové dny
  
  nazev TEXT NOT NULL, -- "Vejce se zeleninou a celozrnným chlebem"
  suroviny JSONB NOT NULL DEFAULT '[]',
  -- [{"nazev":"vejce","mnozstvi":"2 ks"},{"nazev":"chleb celozrnný","mnozstvi":"2 plátky"}]
  
  kalorie INTEGER NOT NULL,
  bilkoviny_g NUMERIC(5,1) NOT NULL,
  sacharidy_g NUMERIC(5,1) NOT NULL,
  tuky_g NUMERIC(5,1) NOT NULL,
  
  poznamka TEXT, -- "Skvělé před tréninkem — rychlé sacharidy"
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plan_meals ON nutrition_plan_meals(plan_id);

-- ============================================================
-- 13. AI_RECOMMENDATIONS (audit trail — klíčová tabulka)
-- ============================================================
CREATE TABLE ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  typ recommendation_type NOT NULL,
  status recommendation_status NOT NULL DEFAULT 'navrzeno',
  
  -- Co AI navrhuje
  popis TEXT NOT NULL, -- Lidsky čitelné vysvětlení
  zduvodneni TEXT NOT NULL, -- Proč to navrhuje (pro uživatele)
  
  -- Technický detail
  puvodni_hodnota JSONB, -- Co bylo předtím
  navrzena_hodnota JSONB, -- Co AI navrhuje
  
  -- Snapshot vstupních dat (audit trail)
  -- Kompletní data ze kterých AI vycházela
  vstupni_data_snapshot JSONB NOT NULL,
  
  -- FitCoach nebo NutriPro
  generated_by TEXT NOT NULL, -- 'fitcoach' nebo 'nutripro' nebo 'orchestrator'
  
  -- Rozhodnutí
  decided_at TIMESTAMPTZ,
  
  -- Bezpečnostní check
  cross_check_passed BOOLEAN NOT NULL DEFAULT false,
  cross_check_log JSONB, -- Které pravidla prošly/neprošly
  
  -- Idempotence
  idempotency_key TEXT UNIQUE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recommendations_user ON ai_recommendations(user_id, created_at DESC);
CREATE INDEX idx_recommendations_status ON ai_recommendations(user_id, status);

-- ============================================================
-- 14. WEEKLY_ANALYSIS (týdenní shrnutí generované AI)
-- ============================================================
CREATE TABLE weekly_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  tyden_od DATE NOT NULL,
  tyden_do DATE NOT NULL,
  
  -- Metriky
  prumerna_vaha NUMERIC(5,1),
  zmena_vahy NUMERIC(4,1), -- oproti minulému týdnu
  prumerny_spanek NUMERIC(3,1),
  prumerny_rpe NUMERIC(3,1),
  prumerna_energie NUMERIC(3,1),
  pocet_treninku INTEGER NOT NULL DEFAULT 0,
  pocet_planovanych_treninku INTEGER NOT NULL DEFAULT 0,
  adherence_treninky_pct INTEGER, -- 0-100
  adherence_strava_pct INTEGER, -- 0-100
  prumerny_kaloricky_prijem INTEGER,
  
  -- AI Insights
  pozitivni_pozorovani TEXT,
  vyzvy TEXT,
  doporuceni TEXT,
  motivacni_zprava TEXT,
  
  -- Co se změní příští týden
  plan_next_week JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_weekly_user_week ON weekly_analyses(user_id, tyden_od);

-- ============================================================
-- 15. HEALTH_ISSUES (zdravotní problémy — sledování)
-- ============================================================
CREATE TABLE health_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  lokalizace body_part NOT NULL,
  intenzita INTEGER NOT NULL CHECK (intenzita BETWEEN 1 AND 10),
  typ_bolesti TEXT, -- "ostrá", "tupá", "pálí", "tahá"
  kdy_zacala DATE,
  spoustec TEXT, -- "po deadliftu", "ráno po probuzení"
  zhorsovani BOOLEAN DEFAULT false,
  
  -- Red flag detekce (systém nastaví automaticky)
  is_red_flag BOOLEAN NOT NULL DEFAULT false,
  red_flag_reason TEXT,
  
  -- Akce
  doporucen_lekar BOOLEAN DEFAULT false,
  datum_lekarske_konzultace DATE,
  lekar_vysledek TEXT,
  
  -- Stav
  vyreseno BOOLEAN NOT NULL DEFAULT false,
  vyreseno_datum DATE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_health_user ON health_issues(user_id, created_at DESC);
CREATE INDEX idx_health_active ON health_issues(user_id) WHERE vyreseno = false;

-- ============================================================
-- 16. WEARABLE_DEVICES (propojení s hodinkami/váhami)
-- ============================================================
CREATE TABLE wearable_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  typ wearable_type NOT NULL,
  external_id TEXT, -- ID u poskytovatele
  
  -- Tokeny (ŠIFROVANÉ na aplikační vrstvě!)
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  
  je_aktivni BOOLEAN NOT NULL DEFAULT true,
  posledni_sync TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_device_user_type ON wearable_devices(user_id, typ);

-- ============================================================
-- 17. WEARABLE_DATA_DAILY (data z hodinek za den)
-- ============================================================
CREATE TABLE wearable_data_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  datum DATE NOT NULL,
  zdroj wearable_type NOT NULL,
  
  kroky INTEGER,
  kalorie_spalene INTEGER,
  kalorie_aktivni INTEGER,
  srdecni_tep_klid INTEGER,
  srdecni_tep_max INTEGER,
  stress_score INTEGER CHECK (stress_score BETWEEN 0 AND 100),
  body_battery INTEGER CHECK (body_battery BETWEEN 0 AND 100),
  
  spanek_hodin NUMERIC(3,1),
  spanek_deep_min INTEGER,
  spanek_rem_min INTEGER,
  spanek_light_min INTEGER,
  
  vaha_kg NUMERIC(5,1),
  telesny_tuk_pct NUMERIC(4,1),
  svalova_hmota_kg NUMERIC(5,1),
  
  -- Surová data pro debug
  raw_data JSONB,
  
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_wearable_daily ON wearable_data_daily(user_id, datum, zdroj);

-- ============================================================
-- 18. AI_JOBS (fronta AI generování — idempotence)
-- ============================================================
CREATE TABLE ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  idempotency_key TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  -- 'queued', 'processing', 'completed', 'failed'
  
  job_type TEXT NOT NULL, -- 'weekly_plan', 'immediate_pain', 'onboarding'
  
  result_recommendation_id UUID REFERENCES ai_recommendations(id),
  error_message TEXT,
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_jobs_user ON ai_jobs(user_id, created_at DESC);
CREATE INDEX idx_ai_jobs_status ON ai_jobs(status) WHERE status IN ('queued', 'processing');

-- ============================================================
-- 19. NOTIFICATION_PREFERENCES (co chce klient dostávat)
-- ============================================================
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  
  ranní_checkin BOOLEAN NOT NULL DEFAULT true,
  pred_treninkem BOOLEAN NOT NULL DEFAULT true,
  po_treninku BOOLEAN NOT NULL DEFAULT true,
  jidlo_reminder BOOLEAN NOT NULL DEFAULT false,
  tydenni_shrnuti BOOLEAN NOT NULL DEFAULT true,
  mesicni_progress BOOLEAN NOT NULL DEFAULT true,
  
  preferovany_cas_ranni TIME DEFAULT '07:00',
  
  push_token TEXT, -- FCM / APNs token
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 20. AUDIT_LOG (kdo co kdy viděl/udělal)
-- ============================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  -- 'profile_viewed', 'plan_accepted', 'health_data_accessed', ...
  resource_type TEXT,
  resource_id UUID,
  detail JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);
-- Particionovat po měsících v produkci (velký objem)

-- ============================================================
-- VIEWS pro AI Engine (rychlý přístup k datům)
-- ============================================================

-- Klouzavý průměr váhy za 7 dní
CREATE VIEW v_weight_trend AS
SELECT 
  user_id,
  datum,
  vaha_kg,
  AVG(vaha_kg) OVER (
    PARTITION BY user_id 
    ORDER BY datum 
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS vaha_7d_avg,
  AVG(vaha_kg) OVER (
    PARTITION BY user_id 
    ORDER BY datum 
    ROWS BETWEEN 13 PRECEDING AND CURRENT ROW
  ) AS vaha_14d_avg
FROM daily_checkins
WHERE vaha_kg IS NOT NULL;

-- RPE trend (poslední 5 tréninků)
CREATE VIEW v_rpe_trend AS
SELECT 
  user_id,
  datum,
  rpe,
  AVG(rpe) OVER (
    PARTITION BY user_id 
    ORDER BY datum 
    ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
  ) AS rpe_5_avg,
  LAG(rpe, 1) OVER (PARTITION BY user_id ORDER BY datum) AS rpe_prev_1,
  LAG(rpe, 2) OVER (PARTITION BY user_id ORDER BY datum) AS rpe_prev_2
FROM workout_sessions
WHERE odcviceno = true AND rpe IS NOT NULL;

-- Denní souhrn kalorií
CREATE VIEW v_daily_nutrition_summary AS
SELECT 
  user_id,
  datum,
  COUNT(*) AS pocet_jidel,
  SUM(kalorie) AS kalorie_celkem,
  SUM(bilkoviny_g) AS bilkoviny_celkem,
  SUM(sacharidy_g) AS sacharidy_celkem,
  SUM(tuky_g) AS tuky_celkem,
  COUNT(*) FILTER (WHERE dle_planu = true) AS jidel_dle_planu
FROM nutrition_logs
GROUP BY user_id, datum;

-- ============================================================
-- RLS (Row Level Security) — defense-in-depth
-- ============================================================
ALTER TABLE fitness_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

-- Uživatel vidí jen svá data
CREATE POLICY user_owns_profile ON fitness_profiles
  FOR ALL USING (id = current_setting('app.current_user_id')::uuid);

CREATE POLICY user_owns_goals ON goals
  FOR ALL USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY user_owns_checkins ON daily_checkins
  FOR ALL USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY user_owns_workouts ON workout_sessions
  FOR ALL USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY user_owns_nutrition ON nutrition_logs
  FOR ALL USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY user_owns_health ON health_issues
  FOR ALL USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY user_owns_recommendations ON ai_recommendations
  FOR ALL USING (user_id = current_setting('app.current_user_id')::uuid);
