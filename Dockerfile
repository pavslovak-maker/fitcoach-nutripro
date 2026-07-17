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

# Build backend (if needed)
# RUN npm run build

EXPOSE 3001

# Run migrations and start
CMD npx prisma migrate deploy && npm run dev
