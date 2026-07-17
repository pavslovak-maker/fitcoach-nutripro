# Deployment Guide — FitCoach & NutriPro

## Architektura produkce

```
                    ┌─────────────────┐
                    │  Expo (iOS/And) │
                    │  EAS Build      │
                    └────────┬────────┘
                             │ HTTPS
                    ┌────────▼────────┐
                    │   Cloudflare    │
                    │   (CDN + WAF)   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼────┐  ┌─────▼─────┐  ┌─────▼─────┐
     │  API Server │  │ AI Worker │  │ Scheduler │
     │  (Fastify)  │  │ (BullMQ)  │  │  (cron)   │
     │  port 3001  │  │  no port  │  │  no port  │
     └──────┬──────┘  └─────┬─────┘  └─────┬─────┘
            │               │               │
     ┌──────▼───────────────▼───────────────▼──────┐
     │              Managed Services                │
     │                                              │
     │  ┌──────────┐  ┌───────┐  ┌──────────────┐  │
     │  │PostgreSQL│  │ Redis │  │ Anthropic API│  │
     │  │(Railway/ │  │(Upstash│  │  (external)  │  │
     │  │ Neon)    │  │ /Fly)  │  │              │  │
     │  └──────────┘  └───────┘  └──────────────┘  │
     └──────────────────────────────────────────────┘
```

## Varianta A: Railway (doporučeno pro start)

Nejjednodušší. Vše v jedné platformě, managed PostgreSQL + Redis.

### 1. Příprava

```bash
# Nainstaluj Railway CLI
npm install -g @railway/cli
railway login
```

### 2. Vytvoř projekt

```bash
railway init
# Vyber "Empty Project"
```

### 3. Přidej databáze

V Railway dashboardu:
- "+ New" → PostgreSQL (dostaneš DATABASE_URL automaticky)
- "+ New" → Redis (dostaneš REDIS_URL automaticky)

### 4. Nastav environment variables

```bash
railway variables set JWT_SECRET=$(openssl rand -base64 64)
railway variables set ENCRYPTION_KEY=$(openssl rand -hex 32)
railway variables set ANTHROPIC_API_KEY=sk-ant-api-xxxxx
railway variables set NODE_ENV=production
railway variables set CORS_ORIGIN=https://fitcoach.app
```

### 5. Deploy API

```bash
# V root projektu
railway up
```

### 6. Deploy Worker (druhý service)

```bash
# V Railway dashboardu: "+ New Service" → link stejný repo
# Nastav: Start Command = "node dist/services/ai-worker.js"
# Sdílí stejné PostgreSQL + Redis
```

### 7. Custom domain

```bash
railway domain
# → přidej CNAME: api.fitcoach.app → xxx.railway.app
```

**Cena:** ~$5-10/měsíc (Hobby plan, 2 services + PostgreSQL + Redis)

---

## Varianta B: Fly.io (lepší pro škálování)

Containers na edge, globální distribuce, lepší kontrola.

### 1. Příprava

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

### 2. Launch

```bash
cd fitcoach-nutripro
fly launch --dockerfile docker/Dockerfile --region fra
# fra = Frankfurt (nejblíž CZ)
```

### 3. PostgreSQL

```bash
fly postgres create --name fitcoach-db --region fra --vm-size shared-cpu-1x
fly postgres attach fitcoach-db
# Automaticky nastaví DATABASE_URL
```

### 4. Redis (Upstash)

```bash
fly redis create --name fitcoach-redis --region fra
# Automaticky nastaví REDIS_URL
```

### 5. Secrets

```bash
fly secrets set JWT_SECRET=$(openssl rand -base64 64)
fly secrets set ENCRYPTION_KEY=$(openssl rand -hex 32)
fly secrets set ANTHROPIC_API_KEY=sk-ant-api-xxxxx
```

### 6. Deploy

```bash
fly deploy
```

### 7. Worker (druhý proces)

```bash
# fly.toml — přidej worker process
fly scale count api=1 worker=1

# Nebo separátní app:
fly launch --name fitcoach-worker --dockerfile docker/Dockerfile
fly secrets set ... (stejné jako API)
# Nastav CMD na: node dist/services/ai-worker.js
```

### 8. Custom domain

```bash
fly certs create api.fitcoach.app
# Přidej CNAME v DNS
```

**Cena:** ~$5-7/měsíc (shared-cpu-1x, 256MB, PostgreSQL, Redis)

---

## Varianta C: PostgreSQL na Neon (serverless)

Pro úsporu — Neon má free tier s auto-sleep.

```bash
# 1. Vytvoř DB na neon.tech (free tier: 0.5GB)
# 2. Zkopíruj connection string
# 3. Nastav v Railway/Fly:
railway variables set DATABASE_URL="postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/fitcoach?sslmode=require"
```

**Výhoda:** Free tier, auto-scaling, branching pro dev/staging.
**Nevýhoda:** Cold start ~500ms po neaktivitě.

---

## Mobile App — EAS Build + Submit

### 1. Setup

```bash
npx expo install expo-dev-client
eas login
eas build:configure
```

### 2. Development build

```bash
# iOS Simulator
eas build --platform ios --profile development

# Android
eas build --platform android --profile development
```

### 3. Preview (TestFlight / Internal Testing)

```bash
eas build --platform all --profile preview
```

### 4. Production build

```bash
eas build --platform all --profile production
```

### 5. Submit to stores

```bash
# iOS → App Store Connect (TestFlight → Review → Release)
eas submit --platform ios

# Android → Google Play Console (Internal → Closed → Production)
eas submit --platform android
```

---

## Monitoring & Observability

### Sentry (error tracking)

```bash
npx expo install @sentry/react-native
# Server: npm install @sentry/node

# V .env:
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Structured logging (Pino → Axiom/Datadog)

```typescript
// Už implementováno v server.ts
// Pro cloud: pino-transport do Axiom
// npm install @axiomhq/pino
```

### Uptime monitoring

```bash
# BetterStack (formerly BetterUptime) — free tier
# Monitor: https://api.fitcoach.app/health
# Alert: Slack / Email když padne
```

### Key metrics to track

1. **API latency** — p50 < 100ms, p99 < 500ms
2. **AI generation time** — p50 < 15s, p99 < 30s
3. **Daily active users** — checkin count
4. **Adherence rate** — % splněných tréninků
5. **Error rate** — < 0.1% 5xx
6. **Cross-check block rate** — kolik AI návrhů je zamítnuto

---

## Checklist před launchem

### Bezpečnost
- [ ] JWT_SECRET je unikátní a silný (64+ bytes)
- [ ] ENCRYPTION_KEY je 32-byte hex
- [ ] CORS povoluje jen produkční domény
- [ ] Rate limiting na auth endpointech (5 req/min)
- [ ] Rate limiting na AI endpointech (2 req/min)
- [ ] HTTPS everywhere (Cloudflare nebo Fly TLS)
- [ ] Helmet headers aktivní

### Data
- [ ] PostgreSQL backup nastavený (daily)
- [ ] DB connection pooling (PgBouncer nebo Prisma pool)
- [ ] Prisma migrace aplikované
- [ ] Seed data NENÍ v produkci

### Právní
- [ ] Terms of Service připravené
- [ ] Privacy Policy (GDPR čl. 9 — zdravotní data)
- [ ] Consent formulář pro zdravotní data
- [ ] Cookie banner (pokud web)
- [ ] Disclaimer: "Neposkytuje lékařské rady"
- [ ] Data export endpoint (/profile/export)
- [ ] Account deletion endpoint (/profile/delete)

### Monitoring
- [ ] Sentry DSN nastavený
- [ ] Health check endpoint responduje
- [ ] Uptime monitor aktivní
- [ ] Alert na error rate > 1%
- [ ] Log retention nastavený (30 dní)

### Mobile
- [ ] EAS projektId nastavený
- [ ] Apple Developer Account ($99/rok)
- [ ] Google Play Developer Account ($25 jednorázově)
- [ ] App Store screenshots připravené
- [ ] Privacy policy URL v store listingu
