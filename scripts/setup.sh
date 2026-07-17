#!/bin/bash
# ============================================================
# Quick Setup — lokální vývoj za 2 minuty
# Spuštění: chmod +x scripts/setup.sh && ./scripts/setup.sh
# ============================================================

set -e

echo "🚀 FitCoach & NutriPro — Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── 1. Kontrola závislostí ──────────────────────────────
echo ""
echo "📋 Kontroluji závislosti..."

command -v node >/dev/null 2>&1 || { echo "❌ Node.js není nainstalovaný. Potřebuji v20+."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker není nainstalovaný."; exit 1; }

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Node.js verze $(node -v) je příliš stará. Potřebuji v20+."
  exit 1
fi

echo "✓ Node.js $(node -v)"
echo "✓ Docker $(docker --version | cut -d' ' -f3)"

# ─── 2. Environment ─────────────────────────────────────
echo ""
echo "📝 Připravuji .env..."

if [ ! -f .env ]; then
  cp .env.example .env
  # Generuj JWT secret
  JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|CHANGE_ME_IN_PRODUCTION_use_openssl_rand_base64_64|${JWT_SECRET}|" .env
    sed -i '' "s|CHANGE_ME_32_byte_hex_key|${ENCRYPTION_KEY}|" .env
  else
    sed -i "s|CHANGE_ME_IN_PRODUCTION_use_openssl_rand_base64_64|${JWT_SECRET}|" .env
    sed -i "s|CHANGE_ME_32_byte_hex_key|${ENCRYPTION_KEY}|" .env
  fi
  
  echo "✓ .env vytvořen (JWT_SECRET a ENCRYPTION_KEY vygenerovány)"
  echo ""
  echo "⚠️  DŮLEŽITÉ: Nastav ANTHROPIC_API_KEY v .env souboru!"
else
  echo "✓ .env už existuje"
fi

# ─── 3. Docker containers ───────────────────────────────
echo ""
echo "🐳 Startuji PostgreSQL a Redis..."

docker compose up -d postgres redis
echo "⏳ Čekám na zdravé kontejnery..."
sleep 3

# Check health
until docker compose exec -T postgres pg_isready -U fitcoach -d fitcoach_dev > /dev/null 2>&1; do
  echo "  Čekám na PostgreSQL..."
  sleep 2
done
echo "✓ PostgreSQL běží"

until docker compose exec -T redis redis-cli ping > /dev/null 2>&1; do
  echo "  Čekám na Redis..."
  sleep 1
done
echo "✓ Redis běží"

# ─── 4. NPM install ─────────────────────────────────────
echo ""
echo "📦 Instaluji závislosti..."
npm install --silent
echo "✓ npm install"

# ─── 5. Prisma ──────────────────────────────────────────
echo ""
echo "🔧 Prisma setup..."
npx prisma generate
echo "✓ Prisma client vygenerován"

npx prisma migrate deploy
echo "✓ Migrace aplikovány"

npx prisma db seed
echo "✓ Testovací data naplněna"

# ─── 6. Hotovo! ─────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup kompletní!"
echo ""
echo "Spusť server:     npm run dev"
echo "Spusť AI worker:  npm run worker"
echo "Prisma studio:    npm run db:studio"
echo "Testy:            npm test"
echo ""
echo "API běží na:      http://localhost:3001"
echo "Health check:     http://localhost:3001/health"
echo ""
echo "Test user:        tomas@test.cz / Test12345!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
