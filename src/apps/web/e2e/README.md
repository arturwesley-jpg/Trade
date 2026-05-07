# E2E Testing with Playwright

This directory contains end-to-end tests for the Trade web application using Playwright.

## Setup

### Prerequisites

- Node.js 18+ installed
- Backend API running on `http://localhost:3000` (or set `VITE_API_URL`)
- Frontend dev server will be started automatically by Playwright

### Installation

Browsers are installed automatically when running tests for the first time. To manually install:

```bash
cd apps/web
npx playwright install chromium
```

## Running Tests

### Run all tests (headless)
```bash
npm run test:e2e
```

### Run tests with UI mode (recommended for development)
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Debug tests
```bash
npm run test:e2e:debug
```

### View test report
```bash
npm run test:e2e:report
```

### Run specific test file
```bash
npx playwright test e2e/auth.spec.ts
```

### Run specific test by name
```bash
npx playwright test -g "should login with valid credentials"
```

## Test Structure

```
e2e/
├── auth.spec.ts           # Authentication tests
├── trading.spec.ts        # Trading operations tests
├── metrics.spec.ts        # Performance metrics tests
└── utils/
    ├── fixtures.ts        # Test data fixtures
    ├── api-mock.ts        # API mocking utilities
    └── test-helpers.ts    # Helper functions
```

## Configuration

Configuration is in `playwright.config.ts`:

- **Base URL**: `http://localhost:5173` (Vite dev server)
- **Timeout**: 30 seconds per test
- **Retries**: 2 retries in CI, 0 locally
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Screenshots**: Captured on failure
- **Videos**: Retained on failure
- **Traces**: Captured on first retry

### Environment Variables

- `PLAYWRIGHT_BASE_URL`: Override frontend URL (default: `http://localhost:5173`)
- `VITE_API_URL`: Backend API URL (default: `http://localhost:3000`)
- `CI`: Set to enable CI mode (more retries, single worker)

## Test Utilities

### Fixtures (`utils/fixtures.ts`)

Pre-defined test data for:
- **auth**: User credentials (validUser, adminUser, invalidUser)
- **paperOrders**: Paper trading orders (longBTC, shortETH, highLeverage)
- **backtests**: Backtest configurations (simple, macd, complex)
- **marketTicks**: Market ticker data (btc, eth, bnb)
- **tradingSignals**: Trading signals (longBTC, shortETH)
- **positions**: Position data (openLong, openShort, closedProfit)
- **alerts**: Alert configurations
- **sentimentSnapshots**: Market sentiment data
- **whaleEvents**: Whale activity events
- **performanceMetrics**: Performance statistics

### API Mocking (`utils/api-mock.ts`)

The `ApiMock` class provides methods to mock backend API responses:

```typescript
import { ApiMock } from './utils/api-mock';

test('example', async ({ page }) => {
  const apiMock = new ApiMock(page);
  
  // Mock all endpoints with default data
  await apiMock.mockAll();
  
  // Or mock specific endpoints
  await apiMock.mockHealth('healthy');
  await apiMock.mockMarketTickers();
  await apiMock.mockSignals();
  await apiMock.mockPositions();
});
```

Available mock methods:
- `mockAll()`: Mock all endpoints with default data
- `mockHealth(status)`: Mock health check
- `mockMarketTickers(tickers)`: Mock market data
- `mockSignals(signals)`: Mock trading signals
- `mockPositions(positions)`: Mock positions
- `mockAlerts(alerts)`: Mock alerts
- `mockSentiment(snapshots)`: Mock sentiment data
- `mockWhaleEvents(events)`: Mock whale events
- `mockPerformanceMetrics(metrics)`: Mock performance data
- `mockCreatePaperOrder(success)`: Mock paper order creation
- `mockBacktests(backtests)`: Mock backtest list
- `mockBacktestResults(results)`: Mock backtest results

### Test Helpers (`utils/test-helpers.ts`)

Common helper functions:

#### Authentication
```typescript
// Login with credentials
await login(page, 'user@example.com', 'password');

// Register new user
await register(page, 'new@example.com', 'password', 'Name');

// Logout
await logout(page);

// Clear storage
await clearStorage(page);

// Get/set access token
const token = await getAccessToken(page);
await setAccessToken(page, 'token-value');
```

#### Navigation
```typescript
// Navigate to page by name
await navigateToPage(page, 'Dashboard');
await navigateToPage(page, 'Mercado');
await navigateToPage(page, 'Sinais');

// Wait for loading to complete
await waitForLoadingComplete(page);
```

#### Trading Operations
```typescript
// Create paper order
await createPaperOrder(page, {
  symbol: 'BTCUSDT',
  side: 'LONG',
  entryPrice: 50000,
  marginUsdt: 100,
  leverage: 2,
  stopLossPct: 2,
  takeProfitPct: 5
});

// Close position
await closePosition(page, 'BTCUSDT');
```

#### Data Utilities
```typescript
// Get table data
const data = await getTableData(page, 'table-selector');

// Generate test data
const email = generateTestEmail();
const password = generatePassword();
```

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { login, navigateToPage } from './utils/test-helpers';
import { ApiMock } from './utils/api-mock';

test.describe('Feature Name', () => {
  let apiMock: ApiMock;

  test.beforeEach(async ({ page }) => {
    // Setup API mocks
    apiMock = new ApiMock(page);
    await apiMock.mockAll();
    
    // Login
    await login(page);
  });

  test('should do something', async ({ page }) => {
    // Navigate
    await navigateToPage(page, 'Page Name');
    
    // Interact
    await page.click('button');
    
    // Assert
    await expect(page.locator('text=Success')).toBeVisible();
  });
});
```

### Best Practices

1. **Use API mocks**: Mock backend responses for isolated, fast tests
2. **Clear storage**: Always clear storage in `beforeEach` for authentication tests
3. **Wait for loading**: Use `waitForLoadingComplete()` after navigation
4. **Use fixtures**: Leverage pre-defined test data from `fixtures.ts`
5. **Descriptive selectors**: Use text content or ARIA labels over CSS selectors
6. **Assertions**: Use Playwright's built-in `expect` with proper timeouts
7. **Cleanup**: Tests should be independent and not rely on execution order

### Debugging Tips

1. **UI Mode**: Best for development - `npm run test:e2e:ui`
2. **Debug Mode**: Step through tests - `npm run test:e2e:debug`
3. **Headed Mode**: See browser actions - `npm run test:e2e:headed`
4. **Screenshots**: Automatically captured on failure in `test-results/`
5. **Traces**: View in Playwright trace viewer after failures
6. **Console logs**: Check browser console in test output

## CI/CD Integration

Tests run automatically in CI with:
- 2 retries on failure
- Single worker (sequential execution)
- Screenshots and videos on failure
- HTML and JSON reports

### GitHub Actions Example

```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium

- name: Run E2E tests
  run: npm run test:e2e
  env:
    CI: true
    VITE_API_URL: http://localhost:3000

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: apps/web/playwright-report/
```

## Troubleshooting

### Tests timing out
- Increase timeout in `playwright.config.ts`
- Check if backend API is running
- Verify network requests in browser DevTools

### Flaky tests
- Add explicit waits: `await page.waitForSelector()`
- Use `waitForLoadingComplete()` after navigation
- Check for race conditions in async operations

### Browser not found
- Run `npx playwright install chromium`
- Check Playwright version matches in `package.json`

### Authentication issues
- Verify backend API is accessible
- Check token storage in browser DevTools
- Clear storage before tests: `await clearStorage(page)`

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
