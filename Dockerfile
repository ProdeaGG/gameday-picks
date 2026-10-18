# Multi-stage Dockerfile for Next.js Standalone on CasaOS / Linux
# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ="America/New_York"
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create persistent data volume directory for SQLite
RUN mkdir -p /app/data && chmod 777 /app/data
VOLUME ["/app/data"]

# Copy standalone build artifacts, full node_modules (for @libsql native bindings & CLI scripts), and CLI scripts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000

CMD ["sh", "-c", "mkdir -p /app/data && node server.js"]
