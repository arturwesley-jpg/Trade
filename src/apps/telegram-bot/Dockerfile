# Multi-stage Dockerfile for Telegram Bot
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Dependencies stage
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/telegram-bot/package.json ./apps/telegram-bot/
RUN npm ci --omit=dev --legacy-peer-deps

# Builder stage
FROM base AS builder
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/telegram-bot/ ./apps/telegram-bot/
RUN npm ci --legacy-peer-deps
RUN npm run build -w packages/shared -- --force
RUN npm run build -w apps/telegram-bot -- --force

# Runner stage
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 botuser

COPY --from=deps --chown=botuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=botuser:nodejs /app/apps/telegram-bot/dist ./apps/telegram-bot/dist
COPY --from=builder --chown=botuser:nodejs /app/packages ./packages

USER botuser

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "process.exit(0)"

CMD ["node", "apps/telegram-bot/dist/index.js"]
