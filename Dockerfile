FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Cache bust — forces fresh layers below on every build
ARG RAILWAY_GIT_COMMIT_SHA
RUN echo "Building commit: $RAILWAY_GIT_COMMIT_SHA"

# Copy source
COPY . .

# Build backend
RUN npm run build

EXPOSE 3001

ENV NODE_ENV=production
# Limit Node heap to avoid OOM kill on small containers
ENV NODE_OPTIONS="--max-old-space-size=384"

# Start compiled server (lighter on memory than tsx)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
