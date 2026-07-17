# FitCoach & NutriPro — Architektura

## Přehled systému

```
┌─────────────────────────────────────────────────────────────┐
│                    KLIENTSKÁ APLIKACE                        │
│              (React Native / Next.js PWA)                    │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Home     │  │ Trénink  │  │ Strava   │  │ Progress │   │
│  │ Screen   │  │ Logger   │  │ Logger   │  │ Charts   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS / REST API
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      API SERVER                              │
│                   (Fastify / Next.js)                        │
│                                                             │
│  ┌────────┐  ┌────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Auth   │  │ CRUD   │  │ Validace │  │ Rate Limit    │  │
│  │ JWT    │  │ Routes │  │ Zod      │  │ Helmet/CORS   │  │
│  └────────┘  └────────┘  └──────────┘  └───────────────┘  │
└──────────┬──────────────────────┬───────────────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐    ┌─────────────────────────────────────┐
│   PostgreSQL     │    │          AI ENGINE                    │
│                  │    │                                       │
│  20 tabulek      │    │   ┌─────────────────────────┐       │
│  3 views         │    │   │    ORCHESTRÁTOR          │       │
│  RLS policies    │    │   │                         │       │
│  pgcrypto        │    │   │  1. Sesbírej data       │       │
│                  │    │   │  2. Zavolej FitCoach    │       │
│                  │    │   │  3. Zavolej NutriPro    │       │
│                  │    │   │  4. Cross-check         │       │
│                  │    │   │  5. Týdenní shrnutí     │       │
│                  │    │   └────────┬────────────────┘       │
│                  │    │            │                         │
│                  │    │   ┌────────▼────────┐               │
│                  │    │   │   FitCoach AI   │               │
│                  │    │   │   (Claude API)  │               │
│                  │    │   │                 │               │
│                  │    │   │  System prompt: │               │
│                  │    │   │  - Pravidla     │               │
│                  │    │   │  - Bezpečnost   │               │
│                  │    │   │                 │               │
│                  │    │   │  User prompt:   │               │
│                  │    │   │  - Profil       │               │
│                  │    │   │  - 7d data      │               │
│                  │    │   │  - Bolesti      │               │
│                  │    │   └────────┬────────┘               │
│                  │    │            │ intenzita + info        │
│                  │    │   ┌────────▼────────┐               │
│                  │    │   │  NutriPro AI    │               │
│                  │    │   │  (Claude API)   │               │
│                  │    │   │                 │               │
│                  │    │   │  + FitCoach     │               │
│                  │    │   │    výstup jako  │               │
│                  │    │   │    kontext      │               │
│                  │    │   └────────┬────────┘               │
│                  │    │            │                         │
│                  │    │   ┌────────▼────────┐               │
│                  │    │   │  CROSS-CHECK    │               │
│                  │    │   │  (9 pravidel)   │               │
│                  │    │   │  v KÓDU, ne AI  │               │
│                  │    │   └─────────────────┘               │
│                  │    │                                       │
└──────────────────┘    └─────────────────────────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐    ┌─────────────────────────────────────┐
│     Redis        │    │       SCHEDULER (cron)               │
│                  │    │                                       │
│  - AI job queue  │    │  Ne 20:00  → Týdenní AI generování  │
│  - Rate limiting │    │  Denně 06:00 → Wearable sync         │
│  - Session cache │    │  Denně 07:00 → Check-in reminder     │
│                  │    │  1. v měsíci → Měsíční report        │
└──────────────────┘    └─────────────────────────────────────┘
```

## Datový tok — jeden den klienta

```
06:00  Wearable sync (cron) → Garmin/Withings API → wearable_data_daily
07:00  Push notifikace: "Vyplň check-in"
07:05  Klient vyplní check-in (30s) → daily_checkins
       └─ Bolest ≥ 6? → Okamžitý AI job (pain response)
17:30  Klient zapíše trénink → workout_sessions + workout_sets
       └─ Strava: "jedl podle plánu" → nutrition_logs
20:00  (Neděle) Cron → AI generování:
       └─ Orchestrátor sesbírá 7d data
       └─ FitCoach → tréninkový plán
       └─ NutriPro (+ FitCoach output) → nutriční plán
       └─ Cross-check (9 pravidel) → ok/block
       └─ Uloží ai_recommendations
       └─ Push: "Nový plán připravený!"
```

## Bezpečnostní pravidla (cross-check)

| # | Pravidlo | Severity | Popis |
|---|----------|----------|-------|
| 1 | calorie_change_limit | BLOCK | Max 20% změna kalorií/týden |
| 2 | minimum_calories | BLOCK | Nikdy pod 1.2× BMR |
| 3 | maximum_calories | BLOCK | Nikdy nad 1.6× TDEE |
| 4 | load_progression_limit | BLOCK | Max 10% nárůst zátěže/týden |
| 5 | pain_stop | BLOCK | Bolest ≥6 → žádné cviky na partii |
| 6 | insufficient_data | BLOCK/WARN | Chybí kritická data |
| 7 | deload_trigger | WARNING | RPE↑ 3× + spánek↓ → deload |
| 8 | protein_range | BLOCK | Bílkoviny 1.2–3.0g/kg |
| 9 | sleep_deprivation | BLOCK | Spánek <6h + vyšší intenzita |

## Stack

| Vrstva | Technologie | Proč |
|--------|------------|------|
| Frontend | React Native + Expo | iOS + Android z jednoho kódu |
| API | Fastify (nebo Next.js App Router) | Rychlé, TypeScript native |
| DB | PostgreSQL | Relační data, RLS, pgcrypto |
| Cache/Queue | Redis + BullMQ | AI job queue, rate limiting |
| AI | Claude API (Sonnet) | Nejlepší poměr kvalita/cena pro JSON |
| Auth | JWT + argon2 | Stateless, refresh tokeny |
| Hosting | Railway / Fly.io | Jednoduchý deploy, auto-scaling |
| Monitoring | Sentry + structured logs | Error tracking, performance |

## Soubory projektu

```
fitcoach-nutripro/
├── db/migrations/
│   └── 001_initial_schema.sql     # 20 tabulek, 3 views, RLS
├── src/
│   ├── types/
│   │   └── domain.ts              # Kompletní TypeScript typy
│   ├── utils/
│   │   └── nutrition-calc.ts      # BMR, TDEE, makra (Mifflin-St Jeor)
│   ├── validators/
│   │   └── schemas.ts             # Zod validace všech API vstupů
│   ├── ai/
│   │   ├── orchestrator.ts        # Hlavní AI sekvence
│   │   ├── fitcoach-agent.ts      # FitCoach prompt + LLM volání
│   │   ├── nutripro-agent.ts      # NutriPro prompt + LLM volání
│   │   └── cross-check.ts         # 9 bezpečnostních pravidel
│   ├── api/
│   │   └── routes.ts              # REST API endpointy
│   └── services/
│       ├── ai-worker.ts           # BullMQ worker pro AI generování
│       └── scheduler.ts           # Cron joby (týdenní AI, sync, reminders)
├── tests/
│   └── cross-check.test.ts        # Testy cross-check + BMR/TDEE
└── docs/
    └── ARCHITECTURE.md            # Tento soubor
```

## API Endpointy

| Metoda | Endpoint | Popis |
|--------|---------|-------|
| POST | /auth/register | Registrace + BMR/TDEE + první AI plán |
| POST | /auth/login | Přihlášení |
| GET | /today | Home screen — co dělat dnes |
| POST | /checkin | Denní ranní check-in |
| POST | /workout | Záznam tréninku |
| GET | /workouts | Historie tréninků |
| POST | /nutrition | Záznam jídla |
| GET | /nutrition | Strava za den |
| GET | /plans/training | Aktivní tréninkový plán |
| GET | /plans/nutrition | Aktivní nutriční plán |
| POST | /ai/generate | Spustit AI generování (202 + job_id) |
| GET | /ai/job/:id | Stav AI jobu |
| GET | /ai/recommendations | AI doporučení |
| POST | /ai/recommendations/:id/accept | Přijmout doporučení |
| POST | /ai/recommendations/:id/reject | Zamítnout doporučení |
| GET | /weekly-summary | Týdenní shrnutí |
| GET | /profile | Profil klienta |
| PATCH | /profile | Aktualizace profilu |
| GET | /progress | Měsíční progress |

## Co chybí pro produkci

1. **package.json + tsconfig** — project setup
2. **Prisma/Drizzle schema** — routes používají placeholder `db`
3. **Auth middleware** — JWT verifikace, refresh tokeny
4. **Rate limiting** — na API i AI generování
5. **Frontend** — React Native komponenty
6. **Wearable OAuth** — Garmin/Withings integration flow
7. **CI/CD** — GitHub Actions, testy před deployem
8. **Monitoring** — Sentry, structured logging (pino)
9. **GDPR** — consent management, data export/delete
10. **Právní** — ToS, disclaimer, GDPR čl. 9 pro zdravotní data
