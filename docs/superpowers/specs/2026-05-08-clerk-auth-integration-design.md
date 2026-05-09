# Clerk Authentication Integration — Design Spec

**Date:** 2026-05-08
**Project:** Crypto Sentinel (Trade monorepo)
**Status:** Approved

## Summary

Replace the custom JWT-based authentication system in the Crypto Sentinel web app with Clerk, a managed authentication platform. The integration uses the Clerk React SDK (`@clerk/clerk-react`) for the Vite+React SPA frontend, with webhook-based user synchronization to the PostgreSQL backend.

## Motivation

- Current auth is custom-built (JWT + manual login/register forms)
- Need social logins (Google, GitHub) and passwordless auth (magic link / email code)
- Clerk provides managed auth with social logins, MFA, session management out of the box
- Webhooks ensure user data stays synchronized with the local PostgreSQL database

## Architecture

### Stack

| Layer | Technology | Package |
|-------|-----------|---------|
| Frontend | Vite + React SPA | `@clerk/clerk-react` |
| Backend | Fastify (Node.js) | `svix` (webhook verification) |
| Database | PostgreSQL | Existing `users` table (modified) |
| Auth Provider | Clerk Dashboard | App: `app_3Ck4QBMAnj49vew7tPHhUiiEea5` |

### Flow

```
┌─────────┐    ┌───────────┐    ┌─────────────┐    ┌────────────┐
│  User    │───▶│ Clerk UI  │───▶│ Session JWT │───▶│ Frontend   │
│ (Browser)│    │ (SignIn)  │    │             │    │ api.ts     │
└─────────┘    └───────────┘    └─────────────┘    └─────┬──────┘
                                                         │
                    Authorization: Bearer <clerk_token>   │
                                                         ▼
                                                 ┌──────────────┐
                                                 │   Backend    │
                                                 │  (Fastify)   │
                                                 │              │
                                                 │ 1. Verify JWT│
                                                 │ 2. Lookup    │
                                                 │    local user│
                                                 │ 3. Process   │
                                                 │    request   │
                                                 └──────┬──────┘
                                                        │
                    ┌───────────────────────────────────┘
                    │
                    ▼
            ┌──────────────┐         ┌───────────────┐
            │  PostgreSQL  │◀────────│  Clerk        │
            │  users table │ webhook │  Webhooks     │
            └──────────────┘         └───────────────┘
```

---

## Frontend Changes

### 1. Install Dependencies

```bash
# Remove old auth-related code (no packages to uninstall — it's custom)
# Install Clerk React SDK
npm install @clerk/clerk-react
```

### 2. Environment Variable

Add to `.env` (Vite uses `VITE_` prefix):

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_cHJvZm91bmQtcmVpbmRlZXItMzIuY2xlcmsuYWNjb3VudHMuZGV2JA
```

### 3. `src/main.tsx` — Wrap with ClerkProvider

Replace `AuthProvider` with `ClerkProvider`:

```tsx
import { ClerkProvider } from '@clerk/clerk-react';
import { App } from './App';
import { TradingProvider } from './contexts/TradingContext';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById('root')!).render(
  <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
    <TradingProvider>
      <App />
    </TradingProvider>
  </ClerkProvider>
);
```

### 4. `src/components/LoginPage.tsx` — Replace with Clerk SignIn

Replace the custom login form with Clerk's `<SignIn />` component:

```tsx
import { SignIn } from '@clerk/clerk-react';

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
          signUpUrl="#sign-up"
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-transparent shadow-none',
            }
          }}
        />
      </div>
    </main>
  );
}
```

### 5. `src/App.tsx` — Replace useAuth with Clerk hooks

Replace:
```tsx
import { useAuth } from './contexts/AuthContext';
// ...
const { user, isAuthenticated, isLoading } = useAuth();
```

With:
```tsx
import { useAuth, useUser, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
// ...
const { isSignedIn, isLoaded, getToken } = useAuth();
const { user } = useUser();
```

Add `<UserButton />` in the header for logged-in users.

### 6. `src/api.ts` — Use Clerk getToken()

Replace the manual token reading:
```tsx
// OLD: const accessToken = localStorage.getItem('accessToken');
// NEW: Use getToken() passed from calling code or import from Clerk
```

Update `requestJson()` to accept a `getToken` function:
```tsx
export async function requestJson<T>(
  path: string,
  options?: RequestInit & { getToken?: () => Promise<string | null> }
): Promise<T> {
  const token = options?.getToken ? await options.getToken() : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options?.headers as Record<string, string>) || {}),
  };
  // ... rest of implementation
}
```

### 7. Files to Remove/Archive

- `src/contexts/AuthContext.tsx` — replaced by Clerk hooks
- Custom login/register form code in `LoginPage.tsx` — replaced by `<SignIn />`

---

## Backend Changes

### 1. Install Dependencies

```bash
cd src/apps/api
npm install svix
# svix is used to verify Clerk webhook signatures
```

### 2. Database Migration

Add migration to modify `users` table:

```sql
-- Add Clerk-specific columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_metadata JSONB DEFAULT '{}';

-- Create index for fast clerk_user_id lookups
CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);

-- Note: If `deleted_at` column doesn't exist, add it:
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Backfill: existing users keep their data, clerk_user_id will be NULL until synced
```

### 3. New: Webhook Handler (`src/apps/api/src/routes/webhooks.ts`)

```typescript
import { Webhook } from 'svix';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface ClerkWebhookEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted';
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
    app.log.warn('CLERK_WEBHOOK_SECRET not set — webhook endpoint disabled');
    return;
  }

  app.post('/webhooks/clerk', async (req: FastifyRequest, reply: FastifyReply) => {
    // Verify webhook signature using svix
    const svix_id = req.headers['svix-id'] as string;
    const svix_timestamp = req.headers['svix-timestamp'] as string;
    const svix_signature = req.headers['svix-signature'] as string;

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return reply.status(400).send({ error: 'Missing svix headers' });
    }

    const wh = new Webhook(webhookSecret);
    let evt: ClerkWebhookEvent;

    try {
      evt = wh.verify(JSON.stringify(req.body), {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as ClerkWebhookEvent;
    } catch (err) {
      return reply.status(400).send({ error: 'Invalid signature' });
    }

    const { type, data } = evt;

    switch (type) {
      case 'user.created':
      case 'user.updated': {
        const email = data.email_addresses[0]?.email_address;
        const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || null;
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
        break;
      }
      case 'user.deleted': {
        await pgClient.query(
          'UPDATE users SET deleted_at = NOW() WHERE clerk_user_id = $1',
          [data.id]
        );
        break;
      }
    }

    return reply.send({ received: true });
  });
}
```

### 4. New: Clerk Auth Middleware (`src/apps/api/src/auth/clerk-middleware.ts`)

```typescript
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS_URL = process.env.CLERK_JWKS_URL ||
  'https://clerk.accounts.dev/.well-known/jwks.json'; // Replace with your Clerk app's domain

const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

export function createClerkAuthMiddleware(pgClient: Client) {
  return async function clerkAuthMiddleware(req: FastifyRequest, reply: FastifyReply) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing authorization header' });
    }

    const token = authHeader.slice(7);

    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: process.env.CLERK_ISSUER || undefined,
      });

      // Attach Clerk user info to request
      (req as any).clerkUser = {
        userId: payload.sub,
        email: payload.email as string,
      };

      // Lookup local user by clerk_user_id
      const result = await pgClient.query(
        'SELECT * FROM users WHERE clerk_user_id = $1',
        [payload.sub]
      );
      (req as any).localUser = result.rows[0] || null;
    } catch (err) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  };
}
```

### 5. Update `src/apps/api/src/app.ts`

- Replace `createAuthMiddleware` with `createClerkAuthMiddleware` for protected routes
- Register webhook routes: `await registerWebhookRoutes(app, pgClient)`
- Keep `/auth/me` endpoint (now reads from `req.localUser` populated by Clerk middleware)
- Remove/disable `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`

### 6. Update `src/apps/api/src/server.ts`

Pass `pgClient` to webhook registration and middleware initialization.

---

## Environment Variables Summary

### Frontend (`.env` / Vercel)

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_cHJvZm91bmQtcmVpbmRlZXItMzIuY2xlcmsuYWNjb3VudHMuZGV2JA
VITE_API_BASE_URL=http://localhost:4000
```

### Backend (`.env` / Vercel/Server)

```env
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
CLERK_JWKS_URL=https://clerk.accounts.dev/.well-known/jwks.json
CLERK_ISSUER=https://clerk.accounts.dev
```

**Note:** The Clerk secret key and webhook secret must be obtained from the Clerk Dashboard → API Keys page.

---

## Clerk Dashboard Configuration

In the Clerk Dashboard (app_3Ck4QBMAnj49vew7tPHhUiiEea5):

1. **Social Connections** → Enable Google, GitHub
2. **Email, Phone, Username** → Enable Email (magic link/code)
3. **Webhooks** → Add endpoint: `https://<your-deployed-api>/webhooks/clerk` (use ngrok for local dev)
   - Subscribe to: `user.created`, `user.updated`, `user.deleted`
4. **API Keys** → Copy `Secret Key` and `Webhook Signing Secret`

---

## Testing Plan

### Frontend
- [ ] ClerkProvider renders without errors
- [ ] SignIn component shows Google, GitHub, magic link options
- [ ] After login, `useAuth().isSignedIn` returns true
- [ ] `getToken()` returns a valid JWT
- [ ] `UserButton` shows in header when signed in
- [ ] After sign out, redirected to `/`

### Backend
- [ ] Webhook endpoint receives and verifies `user.created` event
- [ ] User created in PostgreSQL with `clerk_user_id`
- [ ] Webhook endpoint handles `user.updated` (sync changes)
- [ ] Webhook endpoint handles `user.deleted` (soft delete)
- [ ] Invalid webhook signature returns 400
- [ ] Clerk JWT middleware validates tokens correctly
- [ ] Protected routes return 401 without valid token
- [ ] `/auth/me` returns local user data from Clerk token

### Integration
- [ ] Full flow: sign up → webhook creates user → API calls work → sign out
- [ ] Social login (Google) → user synced → dashboard loads
- [ ] Magic link → user synced → dashboard loads

---

## File Changes Summary

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `src/apps/web/src/main.tsx` | Replace AuthProvider with ClerkProvider |
| REWRITE | `src/apps/web/src/components/LoginPage.tsx` | Use Clerk SignIn component |
| MODIFY | `src/apps/web/src/App.tsx` | Replace useAuth with Clerk hooks, add UserButton |
| MODIFY | `src/apps/web/src/api.ts` | Use getToken() from Clerk |
| DELETE | `src/apps/web/src/contexts/AuthContext.tsx` | No longer needed |
| CREATE | `src/apps/api/src/routes/webhooks.ts` | Clerk webhook handler |
| CREATE | `src/apps/api/src/auth/clerk-middleware.ts` | Clerk JWT verification |
| MODIFY | `src/apps/api/src/app.ts` | Register webhooks, swap middleware |
| MODIFY | `src/apps/api/src/server.ts` | Pass pgClient to new modules |
| CREATE | Database migration | Add clerk_user_id, avatar_url columns |
| MODIFY | `src/apps/web/.env.example` | Add VITE_CLERK_PUBLISHABLE_KEY |
| MODIFY | `src/apps/api/.env.example` | Add CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Webhook endpoint not reachable in dev | Use ngrok or Clerk's test mode with `svix` replay |
| Existing users lose access | Add migration step to link existing users via email |
| Clerk outage blocks all auth | Clerk has 99.99% SLA; consider cached sessions |
| `@clerk/nextjs` already installed in clerk-nextjs | That's a separate test project, not the Trade monorepo |
