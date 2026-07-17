-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('client', 'admin');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('muz', 'zena', 'jine');

-- CreateEnum
CREATE TYPE "ExerciseLevel" AS ENUM ('zacatecnik', 'mirne_pokrocily', 'pokrocily');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('hubnuti', 'nabirani', 'udrzeni', 'vykon');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('snidane', 'obed', 'svacina', 'vecere');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('po', 'ut', 'st', 'ct', 'pa', 'so', 'ne');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('trenink_uprava', 'kalorie_uprava', 'deload', 'jine');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('navrzeno', 'prijato', 'zamitnuto');

-- CreateEnum
CREATE TYPE "TrainingDayType" AS ENUM ('rest', 'light', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "BodyPart" AS ENUM ('zada', 'koleno', 'rameno', 'krk', 'kycel', 'loket', 'zapesti', 'hlezno', 'jine');

-- CreateEnum
CREATE TYPE "FoodLoggingMode" AS ENUM ('simple', 'text', 'detailed');

-- CreateEnum
CREATE TYPE "WearableType" AS ENUM ('garmin', 'suunto', 'withings', 'fitbit', 'google_fit');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('success', 'token_expired', 'api_error', 'rate_limit', 'no_new_data');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'client',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fitness_profiles" (
    "id" UUID NOT NULL,
    "jmeno" TEXT NOT NULL,
    "pohlavi" "Gender" NOT NULL,
    "datum_narozeni" DATE NOT NULL,
    "vyska_cm" INTEGER NOT NULL,
    "aktualni_vaha_kg" DECIMAL(5,1) NOT NULL,
    "uroven_cviceni" "ExerciseLevel" NOT NULL,
    "treninky_tyden" INTEGER NOT NULL,
    "delka_treninku_min" INTEGER NOT NULL,
    "dostupne_vybaveni" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "zdravotni_omezeni" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "leky" TEXT,
    "alergie_intolerance" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stravovaci_preference" TEXT,
    "pocet_jidel_denne" INTEGER NOT NULL DEFAULT 4,
    "food_logging_mode" "FoodLoggingMode" NOT NULL DEFAULT 'simple',
    "pevne_terminy" JSONB NOT NULL DEFAULT '[]',
    "bmr_kcal" INTEGER,
    "tdee_kcal" INTEGER,
    "cilove_kalorie" INTEGER,
    "cilove_bilkoviny_g" INTEGER,
    "cilove_sacharidy_g" INTEGER,
    "cilove_tuky_g" INTEGER,
    "preferovany_cas_treninku" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "fitness_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "typ_cile" "GoalType" NOT NULL,
    "cilova_vaha_kg" DECIMAL(5,1),
    "datum_od" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "datum_do" DATE,
    "aktivni" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_checkins" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "datum" DATE NOT NULL,
    "vaha_kg" DECIMAL(5,1),
    "spanek_hodin" DECIMAL(3,1),
    "spanek_kvalita" INTEGER,
    "energie" INTEGER,
    "ma_bolest" BOOLEAN NOT NULL DEFAULT false,
    "bolest_lokalizace" "BodyPart",
    "bolest_intenzita" INTEGER,
    "bolest_poznamka" TEXT,
    "pitny_rezim_litru" DECIMAL(3,1),
    "kroky" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_day_id" UUID,
    "datum" DATE NOT NULL,
    "typ_treninku" TEXT NOT NULL,
    "odcviceno" BOOLEAN NOT NULL,
    "delka_min" INTEGER,
    "rpe" INTEGER,
    "poznamka" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sets" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "cvik" TEXT NOT NULL,
    "serie_cislo" INTEGER NOT NULL,
    "opakovani" INTEGER,
    "zatez_kg" DECIMAL(5,1),
    "technika_ok" BOOLEAN,
    "poznamka" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "datum" DATE NOT NULL,
    "jidlo_typ" "MealType" NOT NULL,
    "dle_planu" BOOLEAN,
    "popis" TEXT,
    "kalorie" INTEGER,
    "bilkoviny_g" DECIMAL(5,1),
    "sacharidy_g" DECIMAL(5,1),
    "tuky_g" DECIMAL(5,1),
    "foto_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nutrition_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nazev" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'draft',
    "platny_od" DATE NOT NULL,
    "platny_do" DATE,
    "generated_by" TEXT NOT NULL DEFAULT 'fitcoach_ai',
    "recommendation_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plan_days" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "den" "DayOfWeek" NOT NULL,
    "typ_dne" "TrainingDayType" NOT NULL,
    "delka_min" INTEGER NOT NULL,
    "poznamka" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_plan_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plan_exercises" (
    "id" UUID NOT NULL,
    "plan_day_id" UUID NOT NULL,
    "poradi" INTEGER NOT NULL,
    "cvik" TEXT NOT NULL,
    "serie" INTEGER NOT NULL,
    "opakovani" TEXT NOT NULL,
    "zatez_doporucena" TEXT,
    "pauza_s" INTEGER NOT NULL DEFAULT 90,
    "poznamka_technika" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_plan_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'draft',
    "kalorie_treninkovy_den" INTEGER NOT NULL,
    "kalorie_odpocinkovy_den" INTEGER NOT NULL,
    "bilkoviny_g" INTEGER NOT NULL,
    "sacharidy_g" INTEGER NOT NULL,
    "tuky_g" INTEGER NOT NULL,
    "generated_by" TEXT NOT NULL DEFAULT 'nutripro_ai',
    "recommendation_id" UUID,
    "platny_od" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "nutrition_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_plan_meals" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "jidlo_typ" "MealType" NOT NULL,
    "je_treninkovy_den" BOOLEAN NOT NULL DEFAULT false,
    "nazev" TEXT NOT NULL,
    "suroviny" JSONB NOT NULL DEFAULT '[]',
    "kalorie" INTEGER NOT NULL,
    "bilkoviny_g" DECIMAL(5,1) NOT NULL,
    "sacharidy_g" DECIMAL(5,1) NOT NULL,
    "tuky_g" DECIMAL(5,1) NOT NULL,
    "poznamka" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nutrition_plan_meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_recommendations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "typ" "RecommendationType" NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'navrzeno',
    "popis" TEXT NOT NULL,
    "zduvodneni" TEXT NOT NULL,
    "puvodni_hodnota" JSONB,
    "navrzena_hodnota" JSONB,
    "vstupni_data_snapshot" JSONB NOT NULL,
    "generated_by" TEXT NOT NULL,
    "decided_at" TIMESTAMPTZ,
    "cross_check_passed" BOOLEAN NOT NULL DEFAULT false,
    "cross_check_log" JSONB,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_analyses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tyden_od" DATE NOT NULL,
    "tyden_do" DATE NOT NULL,
    "prumerna_vaha" DECIMAL(5,1),
    "zmena_vahy" DECIMAL(4,1),
    "prumerny_spanek" DECIMAL(3,1),
    "prumerny_rpe" DECIMAL(3,1),
    "prumerna_energie" DECIMAL(3,1),
    "pocet_treninku" INTEGER NOT NULL DEFAULT 0,
    "pocet_planovanych_treninku" INTEGER NOT NULL DEFAULT 0,
    "adherence_treninky_pct" INTEGER,
    "adherence_strava_pct" INTEGER,
    "prumerny_kaloricky_prijem" INTEGER,
    "pozitivni_pozorovani" TEXT,
    "vyzvy" TEXT,
    "doporuceni" TEXT,
    "motivacni_zprava" TEXT,
    "plan_next_week" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_issues" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lokalizace" "BodyPart" NOT NULL,
    "intenzita" INTEGER NOT NULL,
    "typ_bolesti" TEXT,
    "kdy_zacala" DATE,
    "spoustec" TEXT,
    "zhorsovani" BOOLEAN NOT NULL DEFAULT false,
    "is_red_flag" BOOLEAN NOT NULL DEFAULT false,
    "red_flag_reason" TEXT,
    "doporucen_lekar" BOOLEAN NOT NULL DEFAULT false,
    "datum_lekarske_konzultace" DATE,
    "lekar_vysledek" TEXT,
    "vyreseno" BOOLEAN NOT NULL DEFAULT false,
    "vyreseno_datum" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "health_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wearable_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "typ" "WearableType" NOT NULL,
    "external_id" TEXT,
    "access_token_encrypted" TEXT NOT NULL,
    "refresh_token_encrypted" TEXT,
    "token_expires_at" TIMESTAMPTZ,
    "je_aktivni" BOOLEAN NOT NULL DEFAULT true,
    "posledni_sync" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wearable_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wearable_data_daily" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "datum" DATE NOT NULL,
    "zdroj" "WearableType" NOT NULL,
    "kroky" INTEGER,
    "kalorie_spalene" INTEGER,
    "kalorie_aktivni" INTEGER,
    "srdecni_tep_klid" INTEGER,
    "srdecni_tep_max" INTEGER,
    "stress_score" INTEGER,
    "body_battery" INTEGER,
    "spanek_hodin" DECIMAL(3,1),
    "spanek_deep_min" INTEGER,
    "spanek_rem_min" INTEGER,
    "spanek_light_min" INTEGER,
    "vaha_kg" DECIMAL(5,1),
    "telesny_tuk_pct" DECIMAL(4,1),
    "svalova_hmota_kg" DECIMAL(5,1),
    "raw_data" JSONB,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wearable_data_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "job_type" TEXT NOT NULL,
    "result_recommendation_id" UUID,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "ranni_checkin" BOOLEAN NOT NULL DEFAULT true,
    "pred_treninkem" BOOLEAN NOT NULL DEFAULT true,
    "po_treninku" BOOLEAN NOT NULL DEFAULT true,
    "jidlo_reminder" BOOLEAN NOT NULL DEFAULT false,
    "tydenni_shrnuti" BOOLEAN NOT NULL DEFAULT true,
    "mesicni_progress" BOOLEAN NOT NULL DEFAULT true,
    "preferovany_cas_ranni" TIME,
    "push_token" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" UUID,
    "detail" JSONB,
    "ip_address" INET,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "goals_user_id_idx" ON "goals"("user_id");

-- CreateIndex
CREATE INDEX "daily_checkins_user_id_datum_idx" ON "daily_checkins"("user_id", "datum" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "daily_checkins_user_id_datum_key" ON "daily_checkins"("user_id", "datum");

-- CreateIndex
CREATE INDEX "workout_sessions_user_id_datum_idx" ON "workout_sessions"("user_id", "datum" DESC);

-- CreateIndex
CREATE INDEX "workout_sets_session_id_idx" ON "workout_sets"("session_id");

-- CreateIndex
CREATE INDEX "nutrition_logs_user_id_datum_idx" ON "nutrition_logs"("user_id", "datum" DESC);

-- CreateIndex
CREATE INDEX "training_plans_user_id_idx" ON "training_plans"("user_id");

-- CreateIndex
CREATE INDEX "training_plan_days_plan_id_idx" ON "training_plan_days"("plan_id");

-- CreateIndex
CREATE INDEX "training_plan_exercises_plan_day_id_idx" ON "training_plan_exercises"("plan_day_id");

-- CreateIndex
CREATE INDEX "nutrition_plan_meals_plan_id_idx" ON "nutrition_plan_meals"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_recommendations_idempotency_key_key" ON "ai_recommendations"("idempotency_key");

-- CreateIndex
CREATE INDEX "ai_recommendations_user_id_created_at_idx" ON "ai_recommendations"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_recommendations_user_id_status_idx" ON "ai_recommendations"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_analyses_user_id_tyden_od_key" ON "weekly_analyses"("user_id", "tyden_od");

-- CreateIndex
CREATE INDEX "health_issues_user_id_created_at_idx" ON "health_issues"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "wearable_devices_user_id_typ_key" ON "wearable_devices"("user_id", "typ");

-- CreateIndex
CREATE UNIQUE INDEX "wearable_data_daily_user_id_datum_zdroj_key" ON "wearable_data_daily"("user_id", "datum", "zdroj");

-- CreateIndex
CREATE UNIQUE INDEX "ai_jobs_idempotency_key_key" ON "ai_jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "ai_jobs_user_id_created_at_idx" ON "ai_jobs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_user_id_created_at_idx" ON "audit_log"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "fitness_profiles" ADD CONSTRAINT "fitness_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_checkins" ADD CONSTRAINT "daily_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutrition_logs" ADD CONSTRAINT "nutrition_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_days" ADD CONSTRAINT "training_plan_days_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_exercises" ADD CONSTRAINT "training_plan_exercises_plan_day_id_fkey" FOREIGN KEY ("plan_day_id") REFERENCES "training_plan_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutrition_plans" ADD CONSTRAINT "nutrition_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutrition_plan_meals" ADD CONSTRAINT "nutrition_plan_meals_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "nutrition_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_analyses" ADD CONSTRAINT "weekly_analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_issues" ADD CONSTRAINT "health_issues_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wearable_devices" ADD CONSTRAINT "wearable_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wearable_data_daily" ADD CONSTRAINT "wearable_data_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_id_fkey" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
