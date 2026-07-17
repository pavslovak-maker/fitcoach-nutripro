#!/bin/sh
set -e

echo "🚀 Starting FitCoach..."
echo "DATABASE_URL: $DATABASE_URL"
echo "JWT_SECRET: $JWT_SECRET"

echo "📦 Running migrations..."
npx prisma migrate deploy

echo "🎯 Starting server..."
npx tsx src/server.ts
