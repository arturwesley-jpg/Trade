# Multi-stage Dockerfile for Worker service
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Dependencies stage
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/trading-core/package.json ./packages/trading-core/
COPY packages/exchange/package.json ./packages/exchange/
COPY apps/worker/package.json ./apps/worker/
RUN npm ci --omit=dev --legacy-peer-deps

# Builder stage
FROM base AS builder
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/worker/ ./apps/worker/
RUN npm ci --legacy-peer-deps
RUN npm run build -w packages/shared -- --force && npm run build -w packages/trading-core -- --force && npm run build -w packages/exchange -- --force
RUN npm run build -w apps/worker -- --force

# Runner stage
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 workeruser

COPY --from=deps --chown=workeruser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=workeruser:nodejs /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder --chown=workeruser:nodejs /app/packages ./packages

USER workeruser

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "process.exit(0)"

CMD ["node", "apps/worker/dist/index.js"]
