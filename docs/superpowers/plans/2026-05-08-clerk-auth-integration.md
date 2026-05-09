# Clerk Auth Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom JWT auth system with Clerk, adding social logins (Google, GitHub) and passwordless auth (magic link/email code), with webhook-based user sync to PostgreSQL.

**Architecture:** Frontend uses `@clerk/clerk-react` (SPA SDK) wrapping the Vite+React app. Backend receives Clerk JWTs and verifies them via JWKS. Webhooks sync user data to PostgreSQL on create/update/delete events.

**Tech Stack:** `@clerk/clerk-react`, `jose` (JWT verification), `svix` (webhook verification), Fastify, PostgreSQL

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/apps/api/src/auth/clerk-middleware.ts` | Clerk JWT verification middleware for Fastify |
| `src/apps/api/src/auth/clerk-middleware.test.ts` | Tests for Clerk middleware |
| `src/apps/api/src/routes/webhooks.ts` | Clerk webhook endpoint handler |
| `src/apps/api/src/routes/webhooks.test.ts` | Tests for webhook handler |

### Modified Files
| File | Changes |
|------|---------|
| `src/apps/web/src/main.tsx` | Replace `AuthProvider` with `ClerkProvider` |
| `src/apps/web/src/components/LoginPage.tsx` | Replace custom form with `<SignIn />` |
| `src/apps/web/src/App.tsx` | Replace `useAuth()` with Clerk hooks |
| `src/apps/web/src/api.ts` | Use `getToken()` from Clerk |
| `src/apps/web/.env.example` | Add `VITE_CLERK_PUBLISHABLE_KEY` |
| `src/apps/api/src/app.ts` | Register webhook routes, add Clerk middleware option |
| `src/apps/api/.env.example` | Add Clerk env vars |
| Database migration | Add `clerk_user_id`, `avatar_url` columns |

### Deleted Files
| File | Reason |
|------|--------|
| `src/apps/web/src/contexts/AuthContext.tsx` | Replaced by Clerk hooks |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `src/apps/web/package.json`
- Modify: `src/apps/api/package.json`

- [ ] **Step 1: Install Clerk React SDK in web app**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
npm install @clerk/clerk-react --workspace=web
```

- [ ] **Step 2: Install svix and jose in API**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
npm install svix jose --workspace=api
```

- [ ] **Step 3: Verify installations**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
grep -q "@clerk/clerk-react" src/apps/web/package.json && echo "✅ Clerk React installed"
grep -q "svix" src/apps/api/package.json && echo "✅ svix installed"
grep -q "jose" src/apps/api/package.json && echo "✅ jose installed"
```

- [ ] **Step 4: Commit**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
git add src/apps/web/package.json src/apps/api/package.json package-lock.json
git commit -m "deps: add @clerk/clerk-react, svix, jose for Clerk integration"
```

---

## Task 2: Database Migration

**Files:**
- Create: `src/apps/api/migrations/00X_add_clerk_columns.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Migration: Add Clerk-specific columns to users table
-- This allows Clerk users to be synced to the local database

-- Add clerk_user_id for linking to Clerk
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR(255) UNIQUE;

-- Add avatar_url from Clerk profile
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add deleted_at for soft deletes from Clerk webhook
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add clerk_metadata for storing Clerk-specific data
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_metadata JSONB DEFAULT '{}';

-- Index for fast clerk_user_id lookups
CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);

-- Index for filtering active users
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;
```

- [ ] **Step 2: Run migration**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
# Adjust connection string as needed
psql "$DATABASE_URL" -f src/apps/api/migrations/00X_add_clerk_columns.sql
```

- [ ] **Step 3: Verify columns exist**

```bash
psql "$DATABASE_URL" -c "\d users" | grep -E "clerk_user_id|avatar_url|deleted_at|clerk_metadata"
```

- [ ] **Step 4: Commit**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
git add src/apps/api/migrations/
git commit -m "db: add Clerk columns to users table (clerk_user_id, avatar_url, deleted_at)"
```

---

## Task 3: Backend — Clerk JWT Middleware

**Files:**
- Create: `src/apps/api/src/auth/clerk-middleware.ts`
- Create: `src/apps/api/src/auth/clerk-middleware.test.ts`

- [ ] **Step 1: Write failing test for Clerk middleware**

```typescript
// src/apps/api/src/auth/clerk-middleware.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createClerkAuthMiddleware, createOptionalClerkAuthMiddleware } from "./clerk-middleware.js";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { Client } from "pg";

// Mock jose
vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => "mock-jwks"),
  jwtVerify: vi.fn()
}));

import { jwtVerify } from "jose";

function createMockRequest(authHeader?: string): FastifyRequest {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    id: "test-request-id"
  } as unknown as FastifyRequest;
}

function createMockReply() {
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis()
  };
  return reply as unknown as FastifyReply;
}

function createMockPgClient(rows: any[] = []) {
  return {
    query: vi.fn().mockResolvedValue({ rows })
  } as unknown as Client;
}

describe("createClerkAuthMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no authorization header", async () => {
    const middleware = createClerkAuthMiddleware(createMockPgClient(), "https://clerk.test/.well-known/jwks.json");
    const req = createMockRequest();
    const reply = createMockReply();

    await middleware(req, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: "UNAUTHORIZED" })
    }));
  });

  it("returns 401 when token is invalid", async () => {
    vi.mocked(jwtVerify).mockRejectedValue(new Error("Invalid token"));
    const middleware = createClerkAuthMiddleware(createMockPgClient(), "https://clerk.test/.well-known/jwks.json");
    const req = createMockRequest("Bearer invalid-token");
    const reply = createMockReply();

    await middleware(req, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it("attaches clerkUser and localUser when token is valid", async () => {
    const mockUser = { id: "local-1", clerk_user_id: "clerk-1", email: "test@test.com" };
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { sub: "clerk-1", email: "test@test.com" },
      protectedHeader: { alg: "RS256" }
    } as any);

    const pgClient = createMockPgClient([mockUser]);
    const middleware = createClerkAuthMiddleware(pgClient, "https://clerk.test/.well-known/jwks.json");
    const req = createMockRequest("Bearer valid-token");
    const reply = createMockReply();

    await middleware(req, reply);

    expect((req as any).clerkUser).toEqual({ userId: "clerk-1", email: "test@test.com" });
    expect((req as any).localUser).toEqual(mockUser);
    expect(pgClient.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT"),
      ["clerk-1"]
    );
  });

  it("sets localUser to null when user not in database", async () => {
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { sub: "clerk-new", email: "new@test.com" },
      protectedHeader: { alg: "RS256" }
    } as any);

    const pgClient = createMockPgClient([]); // No user found
    const middleware = createClerkAuthMiddleware(pgClient, "https://clerk.test/.well-known/jwks.json");
    const req = createMockRequest("Bearer valid-token");
    const reply = createMockReply();

    await middleware(req, reply);

    expect((req as any).localUser).toBeNull();
  });
});

describe("createOptionalClerkAuthMiddleware", () => {
  it("continues without user when no auth header", async () => {
    const middleware = createOptionalClerkAuthMiddleware(createMockPgClient(), "https://clerk.test/.well-known/jwks.json");
    const req = createMockRequest();
    const reply = createMockReply();

    await middleware(req, reply);

    expect(reply.status).not.toHaveBeenCalled();
    expect((req as any).clerkUser).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
npx vitest run src/apps/api/src/auth/clerk-middleware.test.ts
```
Expected: FAIL — module `./clerk-middleware.js` not found

- [ ] **Step 3: Implement Clerk middleware**

```typescript
// src/apps/api/src/auth/clerk-middleware.ts
import type { FastifyRequest, FastifyReply } from "fastify";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Client } from "pg";

export interface ClerkUser {
  userId: string;
  email?: string;
}

export interface LocalUser {
  id: string;
  clerk_user_id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at: Date;
}

declare module "fastify" {
  interface FastifyRequest {
    clerkUser?: ClerkUser;
    localUser?: LocalUser | null;
  }
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJWKS(jwksUrl: string) {
  if (!jwksCache.has(jwksUrl)) {
    jwksCache.set(jwksUrl, createRemoteJWKSet(new URL(jwksUrl)));
  }
  return jwksCache.get(jwksUrl)!;
}

export function createClerkAuthMiddleware(pgClient: Client, jwksUrl: string) {
  const JWKS = getJWKS(jwksUrl);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Missing authorization header",
          correlationId: request.id
        }
      });
    }

    const token = authHeader.slice(7);

    try {
      const { payload } = await jwtVerify(token, JWKS);

      request.clerkUser = {
        userId: payload.sub!,
        email: payload.email as string | undefined
      };

      // Lookup local user
      const result = await pgClient.query(
        "SELECT * FROM users WHERE clerk_user_id = $1 AND deleted_at IS NULL",
        [payload.sub]
      );
      request.localUser = result.rows[0] || null;
    } catch (error) {
      return reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: error instanceof Error ? error.message : "Invalid or expired token",
          correlationId: request.id
        }
      });
    }
  };
}

export function createOptionalClerkAuthMiddleware(pgClient: Client, jwksUrl: string) {
  const JWKS = getJWKS(jwksUrl);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return; // No auth, continue without user
    }

    const token = authHeader.slice(7);

    try {
      const { payload } = await jwtVerify(token, JWKS);

      request.clerkUser = {
        userId: payload.sub!,
        email: payload.email as string | undefined
      };

      const result = await pgClient.query(
        "SELECT * FROM users WHERE clerk_user_id = $1 AND deleted_at IS NULL",
        [payload.sub]
      );
      request.localUser = result.rows[0] || null;
    } catch {
      // Token invalid, continue without user
      return;
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
npx vitest run src/apps/api/src/auth/clerk-middleware.test.ts
```
Expected: PASS — all tests green

- [ ] **Step 5: Export from auth index**

Add to `src/apps/api/src/auth/index.ts`:
```typescript
export { createClerkAuthMiddleware, createOptionalClerkAuthMiddleware } from "./clerk-middleware.js";
export type { ClerkUser, LocalUser } from "./clerk-middleware.js";
```

- [ ] **Step 6: Commit**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
git add src/apps/api/src/auth/clerk-middleware.ts src/apps/api/src/auth/clerk-middleware.test.ts src/apps/api/src/auth/index.ts
git commit -m "feat(api): add Clerk JWT verification middleware with tests"
```

---

## Task 4: Backend — Webhook Handler

**Files:**
- Create: `src/apps/api/src/routes/webhooks.ts`
- Create: `src/apps/api/src/routes/webhooks.test.ts`

- [ ] **Step 1: Write failing test for webhook handler**

```typescript
// src/apps/api/src/routes/webhooks.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { registerWebhookRoutes } from "./webhooks.js";
import type { FastifyInstance } from "fastify";
import type { Client } from "pg";

// Mock svix
vi.mock("svix", () => ({
  Webhook: vi.fn().mockImplementation(() => ({
    verify: vi.fn()
  }))
}));

import { Webhook } from "svix";

function createMockApp() {
  const routes = new Map<string, Function>();
  const app = {
    post: vi.fn((path: string, handler: Function) => {
      routes.set(path, handler);
    }),
    log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
    _routes: routes
  };
  return app as unknown as FastifyInstance & { _routes: Map<string, Function> };
}

function createMockPgClient(rows: any[] = []) {
  return {
    query: vi.fn().mockResolvedValue({ rows })
  } as unknown as Client;
}

function createMockRequest(body: any, headers: Record<string, string> = {}) {
  return {
    body,
    headers: {
      "svix-id": "msg_test123",
      "svix-timestamp": "1234567890",
      "svix-signature": "v1,test-sig",
      ...headers
    }
  };
}

function createMockReply() {
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis()
  };
  return reply;
}

describe("Webhook Routes", () => {
  let app: ReturnType<typeof createMockApp>;
  let pgClient: ReturnType<typeof createMockPgClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createMockApp();
    pgClient = createMockPgClient();
  });

  it("warns and skips registration when CLERK_WEBHOOK_SECRET is missing", async () => {
    const originalEnv = process.env.CLERK_WEBHOOK_SECRET;
    delete process.env.CLERK_WEBHOOK_SECRET;

    await registerWebhookRoutes(app as any, pgClient);

    expect(app.log.warn).toHaveBeenCalledWith(expect.stringContaining("CLERK_WEBHOOK_SECRET"));
    expect(app.post).not.toHaveBeenCalled();

    process.env.CLERK_WEBHOOK_SECRET = originalEnv;
  });

  it("registers POST /webhooks/clerk when secret is set", async () => {
    process.env.CLERK_WEBHOOK_SECRET = "whsec_test123";

    await registerWebhookRoutes(app as any, pgClient);

    expect(app.post).toHaveBeenCalledWith("/webhooks/clerk", expect.any(Function));
  });

  it("returns 400 when svix headers are missing", async () => {
    process.env.CLERK_WEBHOOK_SECRET = "whsec_test123";
    await registerWebhookRoutes(app as any, pgClient);

    const handler = app._routes.get("/webhooks/clerk")!;
    const req = createMockRequest({}, { "svix-id": "", "svix-timestamp": "", "svix-signature": "" });
    const reply = createMockReply();

    await handler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
  });

  it("handles user.created event and inserts into database", async () => {
    process.env.CLERK_WEBHOOK_SECRET = "whsec_test123";

    const mockVerify = vi.fn().mockReturnValue({
      type: "user.created",
      data: {
        id: "clerk_user_123",
        email_addresses: [{ email_address: "test@example.com", id: "email_1" }],
        first_name: "Test",
        last_name: "User",
        image_url: "https://example.com/avatar.jpg",
        created_at: 1234567890,
        updated_at: 1234567890
      }
    });

    vi.mocked(Webhook).mockImplementation(() => ({ verify: mockVerify }) as any);

    await registerWebhookRoutes(app as any, pgClient);
    const handler = app._routes.get("/webhooks/clerk")!;
    const req = createMockRequest({ type: "user.created", data: {} });
    const reply = createMockReply();

    await handler(req, reply);

    expect(pgClient.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO users"),
      ["clerk_user_123", "test@example.com", "Test User", "https://example.com/avatar.jpg"]
    );
    expect(reply.send).toHaveBeenCalledWith({ received: true });
  });

  it("handles user.deleted event with soft delete", async () => {
    process.env.CLERK_WEBHOOK_SECRET = "whsec_test123";

    const mockVerify = vi.fn().mockReturnValue({
      type: "user.deleted",
      data: { id: "clerk_user_123", email_addresses: [], first_name: null, last_name: null, image_url: null, created_at: 0, updated_at: 0 }
    });

    vi.mocked(Webhook).mockImplementation(() => ({ verify: mockVerify }) as any);

    await registerWebhookRoutes(app as any, pgClient);
    const handler = app._routes.get("/webhooks/clerk")!;
    const req = createMockRequest({ type: "user.deleted", data: {} });
    const reply = createMockReply();

    await handler(req, reply);

    expect(pgClient.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE users SET deleted_at"),
      ["clerk_user_123"]
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
npx vitest run src/apps/api/src/routes/webhooks.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement webhook handler**

```typescript
// src/apps/api/src/routes/webhooks.ts
import { Webhook } from "svix";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Client } from "pg";

interface ClerkWebhookEvent {
  type: "user.created" | "user.updated" | "user.deleted";
  data: {
    id: string;
    email_addresses: Array<{ email_address: string; id: string }>;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    created_at: number;
    updated_at: number;
  };
}

export async function registerWebhookRoutes(app: FastifyInstance, pgClient: Client) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    app.log.warn("CLERK_WEBHOOK_SECRET not set — webhook endpoint disabled");
    return;
  }

  app.post("/webhooks/clerk", async (req: FastifyRequest, reply: FastifyReply) => {
    const svixId = req.headers["svix-id"] as string;
    const svixTimestamp = req.headers["svix-timestamp"] as string;
    const svixSignature = req.headers["svix-signature"] as string;

    if (!svixId || !svixTimestamp || !svixSignature) {
      return reply.status(400).send({ error: "Missing svix headers" });
    }

    const wh = new Webhook(webhookSecret);
    let evt: ClerkWebhookEvent;

    try {
      evt = wh.verify(JSON.stringify(req.body), {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature
      }) as ClerkWebhookEvent;
    } catch (err) {
      app.log.error({ err }, "Webhook verification failed");
      return reply.status(400).send({ error: "Invalid signature" });
    }

    const { type, data } = evt;

    switch (type) {
      case "user.created":
      case "user.updated": {
        const email = data.email_addresses[0]?.email_address;
        const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;

        await pgClient.query(
          `INSERT INTO users (clerk_user_id, email, name, avatar_url, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (clerk_user_id) DO UPDATE SET
             email = EXCLUDED.email,
             name = EXCLUDED.name,
             avatar_url = EXCLUDED.avatar_url,
             updated_at = NOW()`,
          [data.id, email, name, data.image_url]
        );

        app.log.info({ clerkUserId: data.id, type }, "User synced from Clerk");
        break;
      }

      case "user.deleted": {
        await pgClient.query(
          "UPDATE users SET deleted_at = NOW() WHERE clerk_user_id = $1",
          [data.id]
        );

        app.log.info({ clerkUserId: data.id }, "User soft-deleted from Clerk");
        break;
      }
    }

    return reply.send({ received: true });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
npx vitest run src/apps/api/src/routes/webhooks.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
git add src/apps/api/src/routes/webhooks.ts src/apps/api/src/routes/webhooks.test.ts
git commit -m "feat(api): add Clerk webhook handler for user sync with tests"
```

---

## Task 5: Backend — Wire Up Clerk in app.ts

**Files:**
- Modify: `src/apps/api/src/app.ts`

- [ ] **Step 1: Add Clerk options to AppOptions interface**

In `src/apps/api/src/app.ts`, add to the `AppOptions` interface (around line 108):

```typescript
export interface AppOptions {
  // ... existing options ...
  clerkJwksUrl?: string;
}
```

- [ ] **Step 2: Import and register webhook routes**

After the existing route registrations (around line 66), add import:

```typescript
import { registerWebhookRoutes } from "./routes/webhooks.js";
```

After `registerSentimentRoutes` and `registerWhaleRoutes` calls, add:

```typescript
// Register Clerk webhook routes
if (options.pgClient) {
  await registerWebhookRoutes(app, options.pgClient);
}
```

- [ ] **Step 3: Add Clerk middleware alternative**

After the existing auth middleware setup (around line 174), add Clerk middleware option:

```typescript
// Clerk auth middleware (alternative to custom JWT)
let clerkAuthMiddleware: ReturnType<typeof createClerkAuthMiddleware> | undefined;
let clerkOptionalAuthMiddleware: ReturnType<typeof createOptionalClerkAuthMiddleware> | undefined;

if (options.pgClient && options.clerkJwksUrl) {
  clerkAuthMiddleware = createClerkAuthMiddleware(options.pgClient, options.clerkJwksUrl);
  clerkOptionalAuthMiddleware = createOptionalClerkAuthMiddleware(options.pgClient, options.clerkJwksUrl);
}
```

Add to imports at top:
```typescript
import { createClerkAuthMiddleware, createOptionalClerkAuthMiddleware } from "./auth/index.js";
```

- [ ] **Step 4: Commit**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
git add src/apps/api/src/app.ts
git commit -m "feat(api): wire Clerk webhook routes and middleware in app builder"
```

---

## Task 6: Frontend — Replace AuthContext with ClerkProvider

**Files:**
- Modify: `src/apps/web/src/main.tsx`

- [ ] **Step 1: Update main.tsx to use ClerkProvider**

Replace the entire content of `src/apps/web/src/main.tsx`:

```typescript
import { ClerkProvider } from "@clerk/clerk-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { TradingProvider } from "./contexts/TradingContext";
import "./styles.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <TradingProvider>
        <App />
      </TradingProvider>
    </ClerkProvider>
  </StrictMode>
);
```

- [ ] **Step 2: Verify build compiles**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
npx vite build --config src/apps/web/vite.config.ts 2>&1 | tail -5
```
Expected: Build succeeds (may have unused import warnings for AuthContext)

- [ ] **Step 3: Commit**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
git add src/apps/web/src/main.tsx
git commit -m "feat(web): replace AuthProvider with ClerkProvider"
```

---

## Task 7: Frontend — Replace LoginPage with Clerk SignIn

**Files:**
- Modify: `src/apps/web/src/components/LoginPage.tsx`

- [ ] **Step 1: Rewrite LoginPage.tsx**

Replace the entire content of `src/apps/web/src/components/LoginPage.tsx`:

```tsx
import { SignIn } from "@clerk/clerk-react";

export function LoginPage() {
  return (
    <main className="login-shell">
      <div className="login-background" aria-hidden="true">
        <span className="orbital one" />
        <span className="orbital two" />
      </div>
      <div className="login-container">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true" />
          <h1>Crypto Sentinel</h1>
          <p>Central de inteligência para trading cripto</p>
        </div>
        <SignIn
          routing="hash"
          signUpUrl="/#sign-up"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-transparent shadow-none border-0",
              headerTitle: "text-white",
              headerSubtitle: "text-gray-400",
              socialButtonsBlockButton: "border-gray-600 text-white hover:bg-gray-800",
              formFieldInput: "bg-gray-800 border-gray-600 text-white",
              formButtonPrimary: "bg-purple-700 hover:bg-purple-600",
              footerActionLink: "text-purple-400 hover:text-purple-300"
            }
          }}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify build compiles**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
npx vite build --config src/apps/web/vite.config.ts 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
git add src/apps/web/src/components/LoginPage.tsx
git commit -m "feat(web): replace custom login form with Clerk SignIn component"
```

---

## Task 8: Frontend — Update App.tsx to Use Clerk Hooks

**Files:**
- Modify: `src/apps/web/src/App.tsx`

- [ ] **Step 1: Replace auth imports and hooks**

In `src/apps/web/src/App.tsx`, replace the import block (lines 20-26):

```tsx
// OLD:
// import { AuthProvider, useAuth } from "./contexts/AuthContext";
// import { LoginPage } from "./components/LoginPage";

// NEW:
import { useAuth, useUser, SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { LoginPage } from "./components/LoginPage";
```

- [ ] **Step 2: Update the App function**

Replace the auth hook usage inside the `App` function (around line 42):

```tsx
export function App() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  // ... rest of state declarations stay the same ...

  // Replace: const { user, isAuthenticated, isLoading } = useAuth();
  // With:
  const isAuthenticated = isSignedIn ?? false;
  const isLoading = !isLoaded;
  const user = clerkUser ? {
    id: clerkUser.id,
    email: clerkUser.primaryEmailAddress?.emailAddress ?? "",
    name: clerkUser.fullName ?? undefined,
    createdAt: clerkUser.createdAt ?? undefined
  } : null;
```

- [ ] **Step 3: Replace login button in header**

In the header section, replace the old login button (around line 1100):

```tsx
// OLD: <button onClick={() => setShowLogin(true)} ...>Entrar</button>

// NEW:
<SignedOut>
  <button
    onClick={() => setShowLogin(true)}
    className="btn-header-login"
    aria-label="Abrir login"
  >
    Entrar
  </button>
</SignedOut>
<SignedIn>
  <UserButton afterSignOutUrl="/" />
</SignedIn>
```

- [ ] **Step 4: Update API calls to use getToken**

For API calls in `App.tsx` that need auth, pass `getToken`:

```tsx
// Example: In fetchMarketData or any data fetch that needs auth
const token = await getToken();
const data = await requestJson("/api/market/overview", {
  headers: { Authorization: `Bearer ${token}` }
});
```

- [ ] **Step 5: Remove AuthProvider import**

Remove the old import:
```tsx
// DELETE: import { AuthProvider, useAuth } from "./contexts/AuthContext";
```

- [ ] **Step 6: Verify build compiles**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
npx vite build --config src/apps/web/vite.config.ts 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
git add src/apps/web/src/App.tsx
git commit -m "feat(web): replace useAuth with Clerk hooks in App.tsx"
```

---

## Task 9: Frontend — Update API Client for Clerk Tokens

**Files:**
- Modify: `src/apps/web/src/api.ts`

- [ ] **Step 1: Update requestJson to accept getToken**

Replace the `requestJson` function in `src/apps/api/src/api.ts`:

```typescript
export async function requestJson<T = unknown>(
  path: string,
  options: RequestInit & { getToken?: () => Promise<string | null> } = {}
): Promise<T> {
  const { getToken, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((fetchOptions.headers as Record<string, string>) || {})
  };

  // Use Clerk token if provided, otherwise fall back to stored token
  if (getToken) {
    const token = await getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  } else {
    const storedToken = localStorage.getItem("accessToken");
    if (storedToken) {
      headers["Authorization"] = `Bearer ${storedToken}`;
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ApiError(response.status, errorBody);
  }

  return response.json();
}
```

- [ ] **Step 2: Verify build compiles**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
npx vite build --config src/apps/web/vite.config.ts 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
git add src/apps/web/src/api.ts
git commit -m "feat(web): update api.ts to accept Clerk getToken function"
```

---

## Task 10: Frontend — Delete Old AuthContext

**Files:**
- Delete: `src/apps/web/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Verify no remaining imports of AuthContext**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
grep -r "AuthContext" src/apps/web/src/ --include="*.tsx" --include="*.ts"
```
Expected: No results (all imports already removed in Task 8)

- [ ] **Step 2: Delete the file**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
rm src/apps/web/src/contexts/AuthContext.tsx
```

- [ ] **Step 3: Verify build still compiles**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
npx vite build --config src/apps/web/vite.config.ts 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
git add -u src/apps/web/src/contexts/AuthContext.tsx
git commit -m "refactor(web): remove old AuthContext (replaced by Clerk)"
```

---

## Task 11: Environment Variables

**Files:**
- Modify: `src/apps/web/.env.example`
- Modify: `src/apps/api/.env.example`

- [ ] **Step 1: Update web .env.example**

Append to `src/apps/web/.env.example`:

```env
# Clerk Authentication
# Get from: https://dashboard.clerk.com → API Keys
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

- [ ] **Step 2: Update api .env.example**

Append to `src/apps/api/.env.example`:

```env
# Clerk Authentication
# Get from: https://dashboard.clerk.com → API Keys
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
CLERK_JWKS_URL=https://clerk.accounts.dev/.well-known/jwks.json
```

- [ ] **Step 3: Create/update web .env for local development**

```bash
echo 'VITE_CLERK_PUBLISHABLE_KEY=pk_test_cHJvZm91bmQtcmVpbmRlZXItMzIuY2xlcmsuYWNjb3VudHMuZGV2JA' >> src/apps/web/.env
```

- [ ] **Step 4: Commit**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
git add src/apps/web/.env.example src/apps/api/.env.example
git commit -m "config: add Clerk environment variables to .env.example files"
```

---

## Task 12: Integration Test — Full Auth Flow

**Files:**
- Create: `src/apps/web/src/__tests__/clerk-integration.test.tsx`

- [ ] **Step 1: Write integration test**

```typescript
// src/apps/web/src/__tests__/clerk-integration.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClerkProvider } from "@clerk/clerk-react";
import { LoginPage } from "../components/LoginPage";

// Mock Clerk
vi.mock("@clerk/clerk-react", async () => {
  const actual = await vi.importActual("@clerk/clerk-react");
  return {
    ...actual,
    ClerkProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SignIn: () => <div data-testid="clerk-sign-in">Clerk SignIn Component</div>,
    useAuth: () => ({ isSignedIn: false, isLoaded: true, getToken: vi.fn() }),
    useUser: () => ({ user: null }),
    SignedIn: ({ children }: { children: React.ReactNode }) => null,
    SignedOut: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    UserButton: () => <div>UserButton</div>
  };
});

describe("Clerk Integration", () => {
  it("renders Clerk SignIn on LoginPage", () => {
    render(
      <ClerkProvider publishableKey="pk_test_fake">
        <LoginPage />
      </ClerkProvider>
    );

    expect(screen.getByTestId("clerk-sign-in")).toBeDefined();
    expect(screen.getByText("Crypto Sentinel")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run integration test**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
npx vitest run src/apps/web/src/__tests__/clerk-integration.test.tsx
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
git add src/apps/web/src/__tests__/clerk-integration.test.tsx
git commit -m "test(web): add Clerk integration test for LoginPage"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Run all backend tests**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
npx vitest run src/apps/api/src/auth/clerk-middleware.test.ts src/apps/api/src/routes/webhooks.test.ts
```
Expected: All PASS

- [ ] **Step 2: Run all frontend tests**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
npx vitest run src/apps/web/src/__tests__/clerk-integration.test.tsx
```
Expected: PASS

- [ ] **Step 3: Build web app**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
npx vite build --config src/apps/web/vite.config.ts
```
Expected: Build succeeds

- [ ] **Step 4: Type check**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
npx tsc --noEmit -p src/apps/web/tsconfig.json 2>&1 | tail -10
```
Expected: No errors related to Clerk

- [ ] **Step 5: Run full test suite**

```bash
cd /home/geen/Área\ de\ trabalho/Trade
npm test 2>&1 | tail -20
```
Expected: All tests pass

---

## Summary

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | Install dependencies | package.json (web + api) |
| 2 | Database migration | New migration file |
| 3 | Clerk JWT middleware | New: clerk-middleware.ts + test |
| 4 | Webhook handler | New: webhooks.ts + test |
| 5 | Wire up in app.ts | Modify: app.ts |
| 6 | ClerkProvider in main.tsx | Modify: main.tsx |
| 7 | Clerk SignIn component | Modify: LoginPage.tsx |
| 8 | Clerk hooks in App.tsx | Modify: App.tsx |
| 9 | API client getToken | Modify: api.ts |
| 10 | Delete old AuthContext | Delete: AuthContext.tsx |
| 11 | Environment variables | Modify: .env.example files |
| 12 | Integration test | New: clerk-integration.test.tsx |
| 13 | Final verification | Run all tests + build |
