import { Page, expect } from '@playwright/test';

export const TEST_USER = {
  email: 'test@example.com',
  password: 'Test123!@#',
  name: 'Test User'
};

export const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Authentication state storage key
 */
const AUTH_STORAGE_KEY = 'auth_token';

/**
 * Clear all storage (localStorage, sessionStorage, cookies)
 */
export async function clearStorage(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Get access token from storage
 */
export async function getAccessToken(page: Page): Promise<string | null> {
  return await page.evaluate((key) => {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  }, AUTH_STORAGE_KEY);
}

/**
 * Set access token in storage
 */
export async function setAccessToken(page: Page, token: string) {
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, value);
  }, { key: AUTH_STORAGE_KEY, value: token });
}

/**
 * Login helper function
 */
export async function login(page: Page, email: string = TEST_USER.email, password: string = TEST_USER.password) {
  await page.goto('/');

  // Wait for login page to load
  await expect(page.locator('input[type="email"]')).toBeVisible();

  // Fill in credentials
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  // Click login button
  await page.click('button[type="submit"]');

  // Wait for navigation to dashboard
  await page.waitForURL(/\/#?(dashboard|landing)/);

  // Verify authentication
  await expect(page.locator('text=Crypto Sentinel')).toBeVisible();
}

/**
 * Register a new user
 */
export async function register(page: Page, email: string, password: string, name?: string) {
  await page.goto('/');

  // Click register/signup link
  const registerLink = page.locator('text=/cadastr|register|sign up/i').first();
  if (await registerLink.isVisible()) {
    await registerLink.click();
  }

  // Fill registration form
  if (name) {
    const nameInput = page.locator('input[name="name"], input[placeholder*="nome" i]');
    if (await nameInput.isVisible()) {
      await nameInput.fill(name);
    }
  }

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for successful registration
  await page.waitForURL(/\/#?(dashboard|landing)/);
}

/**
 * Logout helper
 */
export async function logout(page: Page) {
  const logoutButton = page.locator('button:has-text("Sair"), button:has-text("Logout")');
  await logoutButton.click();

  // Wait for redirect to login page
  await page.waitForURL('/');
  await expect(page.locator('input[type="email"]')).toBeVisible();
}

/**
 * Navigate to a specific page
 */
export async function navigateToPage(page: Page, pageName: string) {
  const navButton = page.locator(`button:has-text("${pageName}")`).first();
  await navButton.click();
  await page.waitForTimeout(500); // Wait for navigation animation
}

/**
 * Create a paper order
 */
export async function createPaperOrder(page: Page, symbol: string = 'BTCUSDT', side: 'LONG' | 'SHORT' = 'LONG') {
  // Find the market tile for the symbol
  const marketTile = page.locator(`article:has-text("${symbol}")`).first();
  await expect(marketTile).toBeVisible();

  // Click the simulate button
  const simulateButton = marketTile.locator('button:has-text("Simular")').first();
  await simulateButton.click();

  // Wait for order confirmation
  await page.waitForTimeout(1000);

  // Check for success message
  const successMessage = page.locator('text=/posição|position|simulada|simulated/i');
  await expect(successMessage).toBeVisible({ timeout: 5000 });
}

/**
 * Wait for element with custom timeout
 */
export async function waitForElement(page: Page, selector: string, timeout: number = 10000) {
  await page.waitForSelector(selector, { timeout, state: 'visible' });
}

/**
 * Wait for API response
 */
export async function waitForApiResponse(page: Page, endpoint: string, timeout: number = 10000) {
  return page.waitForResponse(
    response => response.url().includes(endpoint) && response.status() === 200,
    { timeout }
  );
}

/**
 * Wait for WebSocket connection
 */
export async function waitForWebSocketConnection(page: Page, timeout: number = 10000) {
  await page.waitForFunction(
    () => {
      const wsState = document.querySelector('.ws-state');
      return wsState?.textContent?.includes('conectado') || wsState?.textContent?.includes('connected');
    },
    { timeout }
  );
}

/**
 * Check if element exists without throwing
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 2000, state: 'visible' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get table data as array of objects
 */
export async function getTableData(page: Page, tableSelector: string = 'table') {
  return page.evaluate((selector) => {
    const table = document.querySelector(selector);
    if (!table) return [];

    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent?.trim() || '');
    const rows = Array.from(table.querySelectorAll('tbody tr'));

    return rows.map(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      const rowData: Record<string, string> = {};

      cells.forEach((cell, index) => {
        rowData[headers[index]] = cell.textContent?.trim() || '';
      });

      return rowData;
    });
  }, tableSelector);
}

/**
 * Take screenshot with timestamp
 */
export async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ path: `screenshots/${name}-${timestamp}.png`, fullPage: true });
}

/**
 * Wait for loading to complete
 */
export async function waitForLoadingComplete(page: Page) {
  // Wait for any loading spinners to disappear
  await page.waitForSelector('text=/carregando|loading/i', { state: 'hidden', timeout: 10000 }).catch(() => {});

  // Wait for skeleton loaders to disappear
  await page.waitForSelector('.skeleton', { state: 'hidden', timeout: 10000 }).catch(() => {});
}

/**
 * Fill form fields
 */
export async function fillForm(page: Page, fields: Record<string, string>) {
  for (const [name, value] of Object.entries(fields)) {
    const input = page.locator(`input[name="${name}"], input[placeholder*="${name}" i]`).first();
    await input.fill(value);
  }
}

/**
 * Generate unique email for testing
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  return `test-${timestamp}@example.com`;
}

/**
 * Generate random password
 */
export function generatePassword(): string {
  return `Test${Math.random().toString(36).slice(2)}!@#`;
}
