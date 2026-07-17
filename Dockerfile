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

# Build backend
RUN npm run build

EXPOSE 3001

# Start with migrations and production server
CMD sh -c "echo 'DATABASE_URL: '$DATABASE_URL && echo 'JWT_SECRET: '$JWT_SECRET && npx prisma migrate deploy && npx tsx src/server.ts"
