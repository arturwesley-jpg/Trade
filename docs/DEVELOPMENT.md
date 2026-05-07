# Development Guide

Guide for developers working on the Crypto Trading Bot.

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Git
- VS Code (recommended)

### Initial Setup

1. **Clone Repository**

```bash
git clone https://github.com/yourusername/crypto-trading-bot.git
cd crypto-trading-bot
```

2. **Install Dependencies**

```bash
npm install
```

3. **Setup Environment**

```bash
cp .env.example .env
```

Edit `.env` with your local configuration.

4. **Setup Database**

```bash
# Create database
createdb trading_bot_dev

# Run migrations
npm run db:migrate

# Seed data (optional)
npm run db:seed
```

5. **Start Development Servers**

```bash
# Start all services
npm run dev

# Or start individually:
npm run dev:api      # API server
npm run dev:web      # Frontend
npm run dev:worker   # Background worker
npm run dev:telegram # Telegram bot
```

## Project Structure

```
Trade/
├── apps/
│   ├── api/              # REST API
│   │   ├── src/
│   │   │   ├── routes/   # Route handlers
│   │   │   ├── services/ # Business logic
│   │   │   ├── middleware/ # Express middleware
│   │   │   └── app.ts    # Express app
│   │   └── package.json
│   ├── web/              # React frontend
│   │   ├── src/
│   │   │   ├── components/ # React components
│   │   │   ├── contexts/   # React contexts
│   │   │   ├── pages/      # Page components
│   │   │   └── App.tsx     # Main app
│   │   └── package.json
│   ├── telegram-bot/     # Telegram bot
│   └── worker/           # Background jobs
├── packages/
│   ├── exchange/         # Exchange integrations
│   ├── shared/           # Shared utilities
│   └── trading-core/     # Trading logic
├── docs/                 # Documentation
└── scripts/              # Build scripts
```

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

Follow coding standards (see below).

### 3. Run Tests

```bash
# Run all tests
npm test

# Run specific package tests
npm test -- packages/exchange

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### 4. Lint Code

```bash
# Lint all packages
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Type check
npm run typecheck
```

### 5. Commit Changes

```bash
git add .
git commit -m "feat: add new feature"
```

Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Code style
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Maintenance

### 6. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Create Pull Request on GitHub.

## Coding Standards

### TypeScript

- Use strict mode
- Explicit return types for functions
- Avoid `any` type
- Use interfaces for object shapes
- Use type aliases for unions

**Good:**
```typescript
interface User {
  id: string;
  email: string;
}

function getUser(id: string): Promise<User | null> {
  // ...
}
```

**Bad:**
```typescript
function getUser(id: any): any {
  // ...
}
```

### Naming Conventions

- **Files**: kebab-case (`user-service.ts`)
- **Classes**: PascalCase (`UserService`)
- **Functions**: camelCase (`getUserById`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Interfaces**: PascalCase with `I` prefix optional (`User` or `IUser`)
- **Types**: PascalCase (`UserRole`)

### Code Organization

- One class/interface per file
- Group related functions
- Keep files under 300 lines
- Extract complex logic to separate functions

### Error Handling

Always handle errors explicitly:

```typescript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  if (error instanceof SpecificError) {
    // Handle specific error
  }
  throw new Error(`Operation failed: ${error.message}`);
}
```

### Async/Await

Prefer async/await over promises:

```typescript
// Good
async function fetchData() {
  const data = await api.get('/data');
  return data;
}

// Avoid
function fetchData() {
  return api.get('/data').then(data => data);
}
```

## Testing

### Unit Tests

Test individual functions and classes:

```typescript
import { describe, it, expect } from 'vitest';
import { calculatePnL } from './calculator';

describe('calculatePnL', () => {
  it('should calculate profit correctly', () => {
    const result = calculatePnL({
      entryPrice: 100,
      exitPrice: 110,
      quantity: 1
    });
    expect(result).toBe(10);
  });

  it('should calculate loss correctly', () => {
    const result = calculatePnL({
      entryPrice: 100,
      exitPrice: 90,
      quantity: 1
    });
    expect(result).toBe(-10);
  });
});
```

### Integration Tests

Test API endpoints:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app';

describe('POST /auth/login', () => {
  it('should login with valid credentials', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('accessToken');
  });
});
```

### E2E Tests

Test user flows with Playwright:

```typescript
import { test, expect } from '@playwright/test';

test('user can login and view dashboard', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

## Debugging

### VS Code Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev:api"],
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["test"],
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### Logging

Use structured logging:

```typescript
import { logger } from '@trade/shared';

logger.info('User logged in', { userId: user.id });
logger.error('Failed to fetch data', { error: error.message });
logger.debug('Processing order', { orderId: order.id });
```

### Database Queries

Log slow queries:

```typescript
// In development, log all queries
if (process.env.NODE_ENV === 'development') {
  db.on('query', (query) => {
    console.log('Query:', query.sql);
  });
}
```

## Common Tasks

### Add New API Endpoint

1. Create route handler in `apps/api/src/routes/`
2. Add business logic in `apps/api/src/services/`
3. Add tests
4. Update API documentation

### Add New Exchange Provider

1. Create normalizer in `packages/exchange/src/`
2. Implement `MarketDataProvider` interface
3. Add tests
4. Export from `market-data-provider.ts`

### Add New Trading Strategy

1. Create strategy in `packages/trading-core/src/strategies/`
2. Implement `TradingStrategy` interface
3. Add tests
4. Register in strategy factory

### Add Database Migration

```bash
npm run db:migration:create add_new_table
```

Edit migration file, then:

```bash
npm run db:migrate
```

## Performance Optimization

### Database

- Add indexes for frequently queried columns
- Use connection pooling
- Avoid N+1 queries
- Use pagination for large datasets

### API

- Enable caching with Redis
- Use compression middleware
- Implement rate limiting
- Optimize JSON serialization

### Frontend

- Code splitting
- Lazy loading
- Image optimization
- Memoization

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>
```

### Database Connection Error

1. Check PostgreSQL is running
2. Verify connection string in `.env`
3. Check database exists
4. Verify user permissions

### Module Not Found

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors

```bash
# Rebuild
npm run build

# Clear cache
rm -rf dist tsconfig.tsbuildinfo
```

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [React Documentation](https://react.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)

## Getting Help

- Check existing issues on GitHub
- Read documentation
- Ask in team chat
- Create new issue with reproduction steps
