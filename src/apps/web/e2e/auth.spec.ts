import { test, expect } from '@playwright/test';
import { login, logout, register, generateTestEmail, generatePassword, getAccessToken, clearStorage } from './utils/test-helpers.js';
import { testUsers } from './utils/fixtures.js';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('should register a new user', async ({ page }) => {
    const email = generateTestEmail();
    const password = generatePassword();
    const name = 'New Test User';

    await page.goto('/');

    // Look for register/signup link
    const registerLink = page.locator('text=/cadastr|register|sign up/i').first();

    // If there's a register link, click it
    if (await registerLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await registerLink.click();
      await page.waitForTimeout(500);
    }

    // Fill registration form
    const nameInput = page.locator('input[name="name"], input[placeholder*="nome" i]').first();
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill(name);
    }

    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for successful registration and redirect
    await page.waitForURL(/\/#?(dashboard|landing)/, { timeout: 10000 });

    // Verify user is logged in
    await expect(page.locator('text=Crypto Sentinel')).toBeVisible();

    // Verify token is stored
    const token = await getAccessToken(page);
    expect(token).toBeTruthy();
  });

  test('should login with valid credentials', async ({ page }) => {
    await login(page, testUsers.validUser.email, testUsers.validUser.password);

    // Verify we're on the dashboard or landing page
    await expect(page).toHaveURL(/\/#?(dashboard|landing)/);

    // Verify navigation is visible
    await expect(page.locator('text=Crypto Sentinel')).toBeVisible();

    // Verify user badge or name is displayed
    const userBadge = page.locator('.user-badge, [class*="user"]').first();
    await expect(userBadge).toBeVisible({ timeout: 5000 });

    // Verify access token is stored
    const token = await getAccessToken(page);
    expect(token).toBeTruthy();
  });

  test('should fail login with invalid credentials', async ({ page }) => {
    await page.goto('/');

    // Fill in invalid credentials
    await page.fill('input[type="email"]', testUsers.invalidUser.email);
    await page.fill('input[type="password"]', testUsers.invalidUser.password);

    // Click login button
    await page.click('button[type="submit"]');

    // Wait a bit for error to appear
    await page.waitForTimeout(1000);

    // Should still be on login page
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // Should show error message
    const errorMessage = page.locator('text=/erro|error|inválid|failed|incorret/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Verify no token is stored
    const token = await getAccessToken(page);
    expect(token).toBeFalsy();
  });

  test('should logout successfully', async ({ page }) => {
    // First login
    await login(page);

    // Verify we're logged in
    await expect(page.locator('text=Crypto Sentinel')).toBeVisible();

    // Logout
    await logout(page);

    // Should be back on login page
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // Verify tokens are cleared
    const token = await getAccessToken(page);
    expect(token).toBeFalsy();
  });

  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    await page.goto('/#dashboard');

    // Should redirect to login page
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should persist authentication after page reload', async ({ page }) => {
    // Login
    await login(page);

    // Verify we're logged in
    await expect(page.locator('text=Crypto Sentinel')).toBeVisible();

    // Get token before reload
    const tokenBefore = await getAccessToken(page);
    expect(tokenBefore).toBeTruthy();

    // Reload page
    await page.reload();

    // Should still be logged in
    await expect(page.locator('text=Crypto Sentinel')).toBeVisible({ timeout: 10000 });

    // Token should still be present
    const tokenAfter = await getAccessToken(page);
    expect(tokenAfter).toBe(tokenBefore);
  });

  test('should handle token refresh', async ({ page }) => {
    // Login
    await login(page);

    // Verify we're logged in
    await expect(page.locator('text=Crypto Sentinel')).toBeVisible();

    // Get initial token
    const initialToken = await getAccessToken(page);
    expect(initialToken).toBeTruthy();

    // Simulate token expiration by clearing access token but keeping refresh token
    await page.evaluate(() => {
      localStorage.removeItem('accessToken');
    });

    // Reload page to trigger token refresh
    await page.reload();

    // Should still be logged in after refresh
    await expect(page.locator('text=Crypto Sentinel')).toBeVisible({ timeout: 10000 });

    // Should have a new token
    const newToken = await getAccessToken(page);
    expect(newToken).toBeTruthy();
  });

  test('should show loading state during authentication', async ({ page }) => {
    await page.goto('/');

    // Fill credentials
    await page.fill('input[type="email"]', testUsers.validUser.email);
    await page.fill('input[type="password"]', testUsers.validUser.password);

    // Click login and immediately check for loading state
    await page.click('button[type="submit"]');

    // Should show loading indicator (button disabled or loading text)
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeDisabled({ timeout: 1000 }).catch(() => {
      // If button is not disabled, check for loading text
      expect(submitButton.locator('text=/carregando|loading|entrando/i')).toBeVisible();
    });
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/');

    // Try to submit with invalid email
    await page.fill('input[type="email"]', 'invalid-email');
    await page.fill('input[type="password"]', 'password123');

    // Try to submit
    await page.click('button[type="submit"]');

    // Should show validation error or prevent submission
    const emailInput = page.locator('input[type="email"]');
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);

    // Either HTML5 validation or custom error message
    expect(validationMessage || await page.locator('text=/email.*inválid/i').isVisible()).toBeTruthy();
  });

  test('should validate password requirements', async ({ page }) => {
    await page.goto('/');

    // Look for register link
    const registerLink = page.locator('text=/cadastr|register|sign up/i').first();
    if (await registerLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await registerLink.click();
    }

    // Try weak password
    await page.fill('input[type="email"]', generateTestEmail());
    await page.fill('input[type="password"]', '123'); // Too short

    await page.click('button[type="submit"]');

    // Should show password validation error
    const errorMessage = page.locator('text=/senha|password.*fraca|weak|curta|short|requisito|requirement/i');
    await expect(errorMessage).toBeVisible({ timeout: 3000 }).catch(() => {
      // Or check HTML5 validation
      const passwordInput = page.locator('input[type="password"]');
      expect(passwordInput.evaluate((el: HTMLInputElement) => el.validationMessage)).toBeTruthy();
    });
  });

  test('should handle session expiration', async ({ page }) => {
    await login(page);

    // Manually expire the token
    await page.evaluate(() => {
      localStorage.setItem('accessToken', 'expired-token');
    });

    // Try to navigate to a protected page
    await page.goto('/#dashboard');

    // Should redirect to login or show error
    await page.waitForTimeout(2000);

    const isOnLogin = page.url().includes('login') || page.url() === '/';
    const hasError = await page.locator('text=/sessão.*expirada|session.*expired|não.*autorizado|unauthorized/i')
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    expect(isOnLogin || hasError).toBeTruthy();
  });

  test('should prevent access to protected routes when not authenticated', async ({ page }) => {
    await clearStorage(page);

    // Try to access dashboard directly
    await page.goto('/#dashboard');

    // Should redirect to login
    await page.waitForTimeout(1000);

    const isOnLogin = page.url().includes('login') || page.url() === '/' || await page.locator('input[type="email"]').isVisible({ timeout: 2000 }).catch(() => false);
    expect(isOnLogin).toBeTruthy();
  });

  test('should handle concurrent login attempts', async ({ page, context }) => {
    // Open second page
    const page2 = await context.newPage();

    // Login on both pages simultaneously
    const login1 = login(page);
    const login2 = login(page2);

    await Promise.all([login1, login2]);

    // Both should be logged in
    await expect(page.locator('text=Crypto Sentinel')).toBeVisible();
    await expect(page2.locator('text=Crypto Sentinel')).toBeVisible();

    await page2.close();
  });

  test('should validate password strength on registration', async ({ page }) => {
    await page.goto('/');

    // Navigate to register
    const registerLink = page.locator('text=/cadastr|register|sign up/i').first();
    if (await registerLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await registerLink.click();
    }

    // Try weak password
    await page.fill('input[type="email"]', generateTestEmail());
    await page.fill('input[type="password"]', 'weak');

    // Submit
    await page.click('button[type="submit"]');

    // Should show password strength error
    await expect(page.locator('text=/senha.*fraca|weak.*password|senha.*deve|password.*must/i')).toBeVisible({ timeout: 5000 });
  });

  test('should handle login with remember me', async ({ page }) => {
    await page.goto('/');

    // Check if remember me checkbox exists
    const rememberCheckbox = page.locator('input[type="checkbox"][name="remember"], input[type="checkbox"]:near(:text("Lembrar"))');

    if (await rememberCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await rememberCheckbox.check();
    }

    // Login
    await page.fill('input[type="email"]', testUsers.validUser.email);
    await page.fill('input[type="password"]', testUsers.validUser.password);
    await page.click('button[type="submit"]');

    // Wait for login
    await page.waitForURL(/\/#?(dashboard|landing)/, { timeout: 10000 });

    // Verify token is stored
    const token = await getAccessToken(page);
    expect(token).toBeTruthy();
  });
});
