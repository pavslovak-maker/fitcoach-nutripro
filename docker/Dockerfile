# ============================================================
# Multi-stage Dockerfile — malý, bezpečný image
# ============================================================

# ─── Build stage ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Závislosti (cache layer)
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

# Prisma generate
RUN npx prisma generate

# Build TypeScript
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# ─── Production stage ────────────────────────────────────
FROM node:20-alpine AS runner

# Bezpečnost: ne-root uživatel
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 fitcoach

WORKDIR /app

# Kopíruj jen produkční závislosti
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

# Kopíruj zkompilovaný kód
COPY --from=builder /app/dist ./dist/

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

USER fitcoach
EXPOSE 3001

# Prisma migrate + start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
