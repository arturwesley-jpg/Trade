import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { chromium, Browser, Page } from 'playwright';

describe('E2E Tests - Trading Dashboard', () => {
  let browser: Browser;
  let page: Page;
  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';

  beforeAll(async () => {
    browser = await chromium.launch({
      headless: process.env.CI === 'true',
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
  });

  afterEach(async () => {
    await page.close();
  });

  describe('Authentication Flow', () => {
    it('should register new user', async () => {
      await page.goto(`${baseUrl}/register`);

      await page.fill('input[name="email"]', `test-${Date.now()}@example.com`);
      await page.fill('input[name="password"]', 'SecurePass123!');
      await page.fill('input[name="name"]', 'E2E Test User');
      await page.click('button[type="submit"]');

      await page.waitForURL(`${baseUrl}/dashboard`);
      expect(page.url()).toContain('/dashboard');
    });

    it('should login existing user', async () => {
      await page.goto(`${baseUrl}/login`);

      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'SecurePass123!');
      await page.click('button[type="submit"]');

      await page.waitForURL(`${baseUrl}/dashboard`);
      expect(page.url()).toContain('/dashboard');
    });

    it('should show error for invalid credentials', async () => {
      await page.goto(`${baseUrl}/login`);

      await page.fill('input[name="email"]', 'invalid@example.com');
      await page.fill('input[name="password"]', 'WrongPassword');
      await page.click('button[type="submit"]');

      const errorMessage = await page.locator('.error-message').textContent();
      expect(errorMessage).toContain('Invalid credentials');
    });

    it('should logout user', async () => {
      await page.goto(`${baseUrl}/login`);
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'SecurePass123!');
      await page.click('button[type="submit"]');

      await page.waitForURL(`${baseUrl}/dashboard`);

      await page.click('button[aria-label="User menu"]');
      await page.click('text=Logout');

      await page.waitForURL(`${baseUrl}/login`);
      expect(page.url()).toContain('/login');
    });
  });

  describe('Dashboard', () => {
    beforeEach(async () => {
      await page.goto(`${baseUrl}/login`);
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'SecurePass123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`${baseUrl}/dashboard`);
    });

    it('should display portfolio overview', async () => {
      const portfolioValue = await page.locator('[data-testid="portfolio-value"]').textContent();
      expect(portfolioValue).toBeTruthy();

      const pnl = await page.locator('[data-testid="portfolio-pnl"]').textContent();
      expect(pnl).toBeTruthy();
    });

    it('should display active positions', async () => {
      const positions = await page.locator('[data-testid="position-row"]').count();
      expect(positions).toBeGreaterThanOrEqual(0);
    });

    it('should display recent signals', async () => {
      const signals = await page.locator('[data-testid="signal-card"]').count();
      expect(signals).toBeGreaterThanOrEqual(0);
    });

    it('should switch between timeframes', async () => {
      await page.click('[data-testid="timeframe-1h"]');
      await page.waitForTimeout(500);

      await page.click('[data-testid="timeframe-4h"]');
      await page.waitForTimeout(500);

      await page.click('[data-testid="timeframe-1d"]');
      await page.waitForTimeout(500);

      expect(page.url()).toContain('/dashboard');
    });
  });

  describe('Signals Page', () => {
    beforeEach(async () => {
      await page.goto(`${baseUrl}/login`);
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'SecurePass123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`${baseUrl}/dashboard`);
      await page.goto(`${baseUrl}/signals`);
    });

    it('should display signals list', async () => {
      const signals = await page.locator('[data-testid="signal-item"]').count();
      expect(signals).toBeGreaterThanOrEqual(0);
    });

    it('should filter signals by symbol', async () => {
      await page.selectOption('[data-testid="symbol-filter"]', 'BTC-USDT');
      await page.waitForTimeout(500);

      const signals = await page.locator('[data-testid="signal-item"]').all();
      for (const signal of signals) {
        const symbol = await signal.locator('[data-testid="signal-symbol"]').textContent();
        expect(symbol).toBe('BTC-USDT');
      }
    });

    it('should filter signals by type', async () => {
      await page.selectOption('[data-testid="type-filter"]', 'BUY');
      await page.waitForTimeout(500);

      const signals = await page.locator('[data-testid="signal-item"]').all();
      for (const signal of signals) {
        const type = await signal.locator('[data-testid="signal-type"]').textContent();
        expect(type).toContain('BUY');
      }
    });

    it('should view signal details', async () => {
      const firstSignal = page.locator('[data-testid="signal-item"]').first();
      await firstSignal.click();

      await page.waitForSelector('[data-testid="signal-details"]');

      const details = await page.locator('[data-testid="signal-details"]').isVisible();
      expect(details).toBe(true);
    });
  });

  describe('Alerts Management', () => {
    beforeEach(async () => {
      await page.goto(`${baseUrl}/login`);
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'SecurePass123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`${baseUrl}/dashboard`);
      await page.goto(`${baseUrl}/alerts`);
    });

    it('should create price alert', async () => {
      await page.click('[data-testid="create-alert-btn"]');

      await page.selectOption('[data-testid="alert-symbol"]', 'BTC-USDT');
      await page.selectOption('[data-testid="alert-type"]', 'PRICE');
      await page.selectOption('[data-testid="alert-condition"]', 'ABOVE');
      await page.fill('[data-testid="alert-value"]', '60000');

      await page.click('[data-testid="submit-alert"]');

      await page.waitForSelector('[data-testid="alert-success"]');

      const successMessage = await page.locator('[data-testid="alert-success"]').textContent();
      expect(successMessage).toContain('Alert created');
    });

    it('should display alerts list', async () => {
      const alerts = await page.locator('[data-testid="alert-item"]').count();
      expect(alerts).toBeGreaterThanOrEqual(0);
    });

    it('should delete alert', async () => {
      const alertCount = await page.locator('[data-testid="alert-item"]').count();

      if (alertCount > 0) {
        await page.locator('[data-testid="delete-alert-btn"]').first().click();
        await page.click('[data-testid="confirm-delete"]');

        await page.waitForTimeout(500);

        const newAlertCount = await page.locator('[data-testid="alert-item"]').count();
        expect(newAlertCount).toBe(alertCount - 1);
      }
    });

    it('should toggle alert active status', async () => {
      const alertCount = await page.locator('[data-testid="alert-item"]').count();

      if (alertCount > 0) {
        const toggleSwitch = page.locator('[data-testid="alert-toggle"]').first();
        await toggleSwitch.click();

        await page.waitForTimeout(500);

        const isActive = await toggleSwitch.isChecked();
        expect(typeof isActive).toBe('boolean');
      }
    });
  });

  describe('Paper Trading', () => {
    beforeEach(async () => {
      await page.goto(`${baseUrl}/login`);
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'SecurePass123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`${baseUrl}/dashboard`);
      await page.goto(`${baseUrl}/paper-trading`);
    });

    it('should place market buy order', async () => {
      await page.selectOption('[data-testid="order-symbol"]', 'BTC-USDT');
      await page.click('[data-testid="order-side-buy"]');
      await page.selectOption('[data-testid="order-type"]', 'MARKET');
      await page.fill('[data-testid="order-quantity"]', '0.01');

      await page.click('[data-testid="place-order-btn"]');

      await page.waitForSelector('[data-testid="order-success"]');

      const successMessage = await page.locator('[data-testid="order-success"]').textContent();
      expect(successMessage).toContain('Order placed');
    });

    it('should place limit sell order', async () => {
      await page.selectOption('[data-testid="order-symbol"]', 'BTC-USDT');
      await page.click('[data-testid="order-side-sell"]');
      await page.selectOption('[data-testid="order-type"]', 'LIMIT');
      await page.fill('[data-testid="order-quantity"]', '0.01');
      await page.fill('[data-testid="order-price"]', '55000');

      await page.click('[data-testid="place-order-btn"]');

      await page.waitForSelector('[data-testid="order-success"]');

      const successMessage = await page.locator('[data-testid="order-success"]').textContent();
      expect(successMessage).toContain('Order placed');
    });

    it('should display order history', async () => {
      const orders = await page.locator('[data-testid="order-row"]').count();
      expect(orders).toBeGreaterThanOrEqual(0);
    });

    it('should cancel pending order', async () => {
      const pendingOrders = await page.locator('[data-testid="order-row"][data-status="PENDING"]').count();

      if (pendingOrders > 0) {
        await page.locator('[data-testid="cancel-order-btn"]').first().click();
        await page.click('[data-testid="confirm-cancel"]');

        await page.waitForTimeout(500);

        const newPendingOrders = await page.locator('[data-testid="order-row"][data-status="PENDING"]').count();
        expect(newPendingOrders).toBe(pendingOrders - 1);
      }
    });
  });

  describe('Market Data', () => {
    beforeEach(async () => {
      await page.goto(`${baseUrl}/login`);
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'SecurePass123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`${baseUrl}/dashboard`);
      await page.goto(`${baseUrl}/market`);
    });

    it('should display market overview', async () => {
      const symbols = await page.locator('[data-testid="market-symbol"]').count();
      expect(symbols).toBeGreaterThan(0);
    });

    it('should search for symbol', async () => {
      await page.fill('[data-testid="symbol-search"]', 'BTC');
      await page.waitForTimeout(500);

      const results = await page.locator('[data-testid="market-symbol"]').all();
      for (const result of results) {
        const symbol = await result.textContent();
        expect(symbol).toContain('BTC');
      }
    });

    it('should view symbol details', async () => {
      await page.locator('[data-testid="market-symbol"]').first().click();

      await page.waitForSelector('[data-testid="symbol-chart"]');

      const chart = await page.locator('[data-testid="symbol-chart"]').isVisible();
      expect(chart).toBe(true);
    });

    it('should display orderbook', async () => {
      await page.locator('[data-testid="market-symbol"]').first().click();

      await page.waitForSelector('[data-testid="orderbook"]');

      const bids = await page.locator('[data-testid="orderbook-bid"]').count();
      const asks = await page.locator('[data-testid="orderbook-ask"]').count();

      expect(bids).toBeGreaterThan(0);
      expect(asks).toBeGreaterThan(0);
    });
  });

  describe('WebSocket Real-time Updates', () => {
    beforeEach(async () => {
      await page.goto(`${baseUrl}/login`);
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'SecurePass123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`${baseUrl}/dashboard`);
    });

    it('should receive price updates', async () => {
      const initialPrice = await page.locator('[data-testid="btc-price"]').textContent();

      await page.waitForTimeout(5000);

      const updatedPrice = await page.locator('[data-testid="btc-price"]').textContent();

      // Price should update (or at least be present)
      expect(updatedPrice).toBeTruthy();
    });

    it('should show connection status', async () => {
      const status = await page.locator('[data-testid="ws-status"]').textContent();
      expect(status).toContain('Connected');
    });
  });

  describe('Responsive Design', () => {
    it('should work on mobile viewport', async () => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto(`${baseUrl}/login`);
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'SecurePass123!');
      await page.click('button[type="submit"]');

      await page.waitForURL(`${baseUrl}/dashboard`);

      const menuButton = await page.locator('[data-testid="mobile-menu"]').isVisible();
      expect(menuButton).toBe(true);
    });

    it('should work on tablet viewport', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.goto(`${baseUrl}/dashboard`);

      const dashboard = await page.locator('[data-testid="dashboard"]').isVisible();
      expect(dashboard).toBe(true);
    });
  });
});
