FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY . .
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Build backend
RUN npm run build

EXPOSE 3001

ENV NODE_ENV=production

# Start server directly
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/server.ts"]
