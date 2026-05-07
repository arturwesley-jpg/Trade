# Crypto Intelligence Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the current paper-first crypto MVP into a safe, auditable foundation for market data, signals, alerts, risk, Telegram, and future persistence.

**Architecture:** Keep the existing TypeScript monorepo and add modular, testable domain engines before adding live integrations. Use PostgreSQL as the target durable store, keep real trading disabled, and use public/free data providers with explicit failover and data-quality scoring.

**Tech Stack:** Node.js, TypeScript, Fastify, React/Vite, Telegraf, ws, Vitest, PostgreSQL target schema, optional Redis/Upstash for rate limits/cache.

---

### Task 1: Audit And Documentation Baseline

**Files:**
- Create: `docs/PROJECT_AUDIT.md`
- Create: `docs/ARCHITECTURE.md`
- Create: `docs/FREE_SERVICES_MATRIX.md`
- Create: `docs/MARKET_DATA_PROVIDERS.md`
- Create: `docs/ENVIRONMENT_VARIABLES.md`
- Create: remaining required docs listed in the user spec

- [ ] **Step 1: Summarize current repo truth**

Record the actual monorepo layout: `apps/api`, `apps/web`, `apps/worker`, `apps/telegram-bot`, `packages/shared`, `packages/trading-core`, `packages/exchange`.

- [ ] **Step 2: Record gaps without overstating implementation**

Document that persistence, admin auth, provider failover, 10-indicator scoring, news, on-chain, and full Telegram command set are not complete yet.

- [ ] **Step 3: Add service matrix with verified source notes**

Use only services checked from official/current pages where possible. Mark uncertain terms as requiring manual confirmation.

### Task 2: Environment And Safety Defaults

**Files:**
- Modify: `.env.example`
- Modify: `infra/docker-compose.yml`

- [ ] **Step 1: Add safety variables**

Add `SAFE_MODE=true`, `PAPER_TRADING_ONLY=true`, and `FEATURE_REAL_TRADING=false`.

- [ ] **Step 2: Add provider variables**

Add primary/fallback provider env vars plus optional API keys without requiring them for local boot.

- [ ] **Step 3: Add deploy variables**

Document `VITE_API_BASE_URL`, `API_BASE_URL`, `DATABASE_URL`, `REDIS_URL`, and `LOG_LEVEL`.

### Task 3: Core Intelligence Engines

**Files:**
- Create: `packages/trading-core/src/intelligence-engines.ts`
- Create: `packages/trading-core/src/intelligence-engines.test.ts`
- Modify: `packages/trading-core/src/index.ts`

- [ ] **Step 1: Write failing tests**

Cover technical indicators, risk score, final decision, fear/greed, news sentiment, on-chain score, fundamental score, provider quality, and paper metrics.

- [ ] **Step 2: Implement pure functions**

Implement deterministic functions with no network calls and no side effects so they can be used by API, worker, Telegram, and tests.

- [ ] **Step 3: Export contracts**

Export the new engine functions from `packages/trading-core/src/index.ts`.

### Task 4: Existing Risk Guardrails

**Files:**
- Modify: `packages/trading-core/src/risk-engine.test.ts`
- Modify: `packages/trading-core/src/risk-engine.ts`

- [ ] **Step 1: Add failing stop-geometry tests**

LONG stop loss must be below entry. SHORT stop loss must be above entry when shorts become enabled.

- [ ] **Step 2: Enforce geometry**

Reject invalid stop placement before computing risk.

### Task 5: API Contracts And Placeholder Endpoints

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/app.test.ts`

- [ ] **Step 1: Add read-only MVP endpoints**

Expose provider status, fear/greed, alerts, news, on-chain events, and paper metrics from deterministic in-memory/demo data with explicit `source: "simulated"`.

- [ ] **Step 2: Keep admin write endpoints planned**

Do not add real admin mutation endpoints until auth/rate limit/persistence are in place.

### Task 6: Telegram Safety Fixes

**Files:**
- Modify: `apps/telegram-bot/src/bot.ts`

- [ ] **Step 1: Fix API wrapper parsing**

Handle `{ data }` responses consistently.

- [ ] **Step 2: Add minimum commands**

Add `/help`, `/market`, `/signal`, `/feargreed`, `/news`, `/alerts_on`, `/alerts_off`, `/paper_status`, `/paper_trades`, and admin placeholders that refuse non-admin users.

### Task 7: Verification

**Files:**
- All touched source/docs

- [ ] **Step 1: Run focused tests**

Run `npm test -w packages/trading-core`.

- [ ] **Step 2: Run full verification**

Run `npm test`, `npm run typecheck`, and `npm run build`.

- [ ] **Step 3: Report remaining gaps**

List anything designed but not implemented, especially provider integrations requiring API keys or account setup.
