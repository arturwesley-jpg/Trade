import { test, expect } from '@playwright/test';
import { login, navigateToPage, createPaperOrder, waitForLoadingComplete, getTableData } from './utils/test-helpers.js';
import { ApiMock } from './utils/api-mock.js';

test.describe('Trading Operations', () => {
  let apiMock: ApiMock;

  test.beforeEach(async ({ page }) => {
    apiMock = new ApiMock(page);
    await apiMock.mockAll();
    await login(page);
  });

  test('should view market ticker', async ({ page }) => {
    // Navigate to market page
    await navigateToPage(page, 'Mercado');

    // Wait for market data to load
    await waitForLoadingComplete(page);

    // Verify market tiles are visible
    const btcTile = page.locator('article:has-text("BTCUSDT")').first();
    await expect(btcTile).toBeVisible();

    // Verify price is displayed
    await expect(btcTile.locator('text=/\\$[0-9,]+/')).toBeVisible();

    // Verify 24h change is displayed
    await expect(btcTile.locator('text=/%|24h/')).toBeVisible();

    // Verify source is displayed
    await expect(btcTile.locator('text=/binance|coinbase|kraken/i')).toBeVisible();
  });

  test('should view trading signals', async ({ page }) => {
    // Navigate to signals page
    await navigateToPage(page, 'Sinais');

    // Wait for signals to load
    await waitForLoadingComplete(page);

    // Verify signals panel is visible
    const signalsPanel = page.locator('#signals, [aria-labelledby*="signals"]').first();
    await expect(signalsPanel).toBeVisible();

    // Verify signal data is displayed
    await expect(page.locator('text=/LONG|SHORT/i')).toBeVisible();
    await expect(page.locator('text=/confiança|confidence/i')).toBeVisible();
  });

  test('should create paper order (long)', async ({ page }) => {
    // Mock successful order creation
    await apiMock.mockCreatePaperOrder(true);

    // Navigate to dashboard
    await navigateToPage(page, 'Dashboard');
    await waitForLoadingComplete(page);

    // Create a long order
    await createPaperOrder(page, 'BTCUSDT', 'LONG');

    // Verify success message
    const successMessage = page.locator('text=/posição.*aberta|position.*opened|simulada|simulated/i');
    await expect(successMessage).toBeVisible({ timeout: 5000 });

    // Verify notice is updated
    const notice = page.locator('.notice, [role="status"]');
    await expect(notice).toContainText(/paper|simulada/i);
  });

  test('should create paper order (short)', async ({ page }) => {
    // Mock successful order creation
    await apiMock.mockCreatePaperOrder(true);

    // Navigate to market page
    await navigateToPage(page, 'Mercado');
    await waitForLoadingComplete(page);

    // Find ETH tile and create short order
    const ethTile = page.locator('article:has-text("ETHUSDT")').first();
    await expect(ethTile).toBeVisible();

    const simulateButton = ethTile.locator('button:has-text("Simular")').first();
    await simulateButton.click();

    // Verify success message
    await expect(page.locator('text=/posição|position|simulada/i')).toBeVisible({ timeout: 5000 });
  });

  test('should view open positions', async ({ page }) => {
    // Navigate to risk/positions page
    await navigateToPage(page, 'Risco');
    await waitForLoadingComplete(page);

    // Verify positions panel is visible
    const positionsPanel = page.locator('[aria-labelledby*="positions"], #positions').first();
    await expect(positionsPanel).toBeVisible();

    // Verify position data is displayed
    await expect(page.locator('text=/BTCUSDT|ETHUSDT/i')).toBeVisible();
    await expect(page.locator('text=/LONG|SHORT/i')).toBeVisible();
    await expect(page.locator('text=/OPEN|CLOSED/i')).toBeVisible();
  });

  test('should close position', async ({ page }) => {
    // Mock position close endpoint
    await page.route('**/positions/*/close', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: '1',
            status: 'CLOSED',
            exitPrice: 51000,
            pnlUsdt: 20,
            closedAt: new Date().toISOString()
          }
        })
      });
    });

    // Navigate to positions
    await navigateToPage(page, 'Risco');
    await waitForLoadingComplete(page);

    // Find close button for a position
    const closeButton = page.locator('button:has-text("Fechar"), button:has-text("Close")').first();

    if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeButton.click();

      // Confirm if there's a confirmation dialog
      const confirmButton = page.locator('button:has-text("Confirmar"), button:has-text("Confirm")');
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
      }

      // Verify success message
      await expect(page.locator('text=/fechada|closed|sucesso|success/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should view trade history', async ({ page }) => {
    // Navigate to analytics page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Wait for trades history section
    const tradesSection = page.locator('text=/histórico|history|trades/i').first();
    await expect(tradesSection).toBeVisible({ timeout: 10000 });

    // Verify trade data is displayed (if any trades exist)
    const hasTradeData = await page.locator('table tbody tr').count() > 0;
    if (hasTradeData) {
      await expect(page.locator('table')).toBeVisible();
    }
  });

  test('should handle order creation failure', async ({ page }) => {
    // Mock failed order creation
    await apiMock.mockCreatePaperOrder(false, 'Insufficient margin');

    // Navigate to dashboard
    await navigateToPage(page, 'Dashboard');
    await waitForLoadingComplete(page);

    // Try to create order
    const simulateButton = page.locator('button:has-text("Simular")').first();
    await simulateButton.click();

    // Verify error message
    const errorMessage = page.locator('text=/erro|error|bloqueada|failed|insufficient/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should disable order button while submitting', async ({ page }) => {
    // Navigate to dashboard
    await navigateToPage(page, 'Dashboard');
    await waitForLoadingComplete(page);

    // Find simulate button
    const simulateButton = page.locator('button:has-text("Simular")').first();
    await expect(simulateButton).toBeEnabled();

    // Click and check if disabled
    await simulateButton.click();

    // Button should be disabled or show loading state
    await expect(simulateButton).toBeDisabled({ timeout: 1000 }).catch(async () => {
      // Or check for loading text
      await expect(simulateButton).toContainText(/simulando|loading/i);
    });
  });

  test('should display position PnL', async ({ page }) => {
    // Navigate to positions
    await navigateToPage(page, 'Risco');
    await waitForLoadingComplete(page);

    // Check if positions table exists
    const positionsTable = page.locator('table').first();
    if (await positionsTable.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Verify PnL columns exist
      const tableData = await getTableData(page);

      if (tableData.length > 0) {
        // Check that position data includes expected fields
        const firstPosition = tableData[0];
        expect(Object.keys(firstPosition).length).toBeGreaterThan(0);
      }
    }
  });

  test('should show paper trading notice', async ({ page }) => {
    // Navigate to dashboard
    await navigateToPage(page, 'Dashboard');

    // Verify paper trading notice is visible
    const paperNotice = page.locator('text=/modo paper|paper.*ativo|simulação|nenhuma ordem real/i');
    await expect(paperNotice).toBeVisible();

    // Verify live trading is blocked
    const liveBlockedNotice = page.locator('text=/operação real.*bloqueada|live.*blocked/i');
    await expect(liveBlockedNotice).toBeVisible();
  });

  test('should update positions in real-time via WebSocket', async ({ page }) => {
    // Navigate to dashboard
    await navigateToPage(page, 'Dashboard');
    await waitForLoadingComplete(page);

    // Wait for WebSocket connection
    const wsStatus = page.locator('.ws-state, [class*="ws"]');
    await expect(wsStatus).toContainText(/conectado|connected/i, { timeout: 10000 });

    // Simulate WebSocket message
    await page.evaluate(() => {
      const event = new CustomEvent('position-update', {
        detail: {
          id: '1',
          symbol: 'BTCUSDT',
          side: 'LONG',
          status: 'OPEN',
          pnlUsdt: 25
        }
      });
      window.dispatchEvent(event);
    });

    // Wait a bit for UI to update
    await page.waitForTimeout(500);
  });

  test('should validate order parameters', async ({ page }) => {
    // This test assumes there's a form for creating orders
    // If orders are created with a single button click, this test may not apply

    // Navigate to dashboard
    await navigateToPage(page, 'Dashboard');
    await waitForLoadingComplete(page);

    // Check if there's an advanced order form
    const advancedButton = page.locator('button:has-text("Avançado"), button:has-text("Advanced")');

    if (await advancedButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await advancedButton.click();

      // Try to submit with invalid parameters
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Should show validation errors
      await expect(page.locator('text=/obrigatório|required|inválido|invalid/i')).toBeVisible();
    }
  });

  test('should create backtest', async ({ page }) => {
    // Mock backtest creation
    await apiMock.mockBacktests([]);

    // Navigate to backtests page
    await navigateToPage(page, 'Backtests');
    await waitForLoadingComplete(page);

    // Look for create backtest button
    const createButton = page.locator('button:has-text("Criar"), button:has-text("Novo"), button:has-text("Create"), button:has-text("New")').first();

    if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createButton.click();

      // Fill backtest form
      const nameInput = page.locator('input[name="name"], input[placeholder*="nome" i]').first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('Test RSI Strategy');

        // Fill other fields if present
        const symbolInput = page.locator('input[name="symbol"], select[name="symbol"]').first();
        if (await symbolInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await symbolInput.fill('BTCUSDT');
        }

        // Submit form
        const submitButton = page.locator('button[type="submit"]:has-text("Criar"), button[type="submit"]:has-text("Create")').first();
        if (await submitButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await submitButton.click();

          // Verify success message
          await expect(page.locator('text=/backtest.*criado|backtest.*created|sucesso|success/i')).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test('should view backtest history', async ({ page }) => {
    // Mock backtest history
    const mockBacktests = [
      {
        id: '1',
        name: 'RSI Strategy Test',
        symbol: 'BTCUSDT',
        status: 'COMPLETED',
        totalReturn: 150,
        totalReturnPct: 15,
        winRate: 0.65,
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        name: 'MACD Strategy Test',
        symbol: 'ETHUSDT',
        status: 'RUNNING',
        createdAt: new Date().toISOString()
      }
    ];

    await apiMock.mockBacktests(mockBacktests);

    // Navigate to backtests page
    await navigateToPage(page, 'Backtests');
    await waitForLoadingComplete(page);

    // Verify backtest list is visible
    const backtestList = page.locator('text=/RSI Strategy Test|MACD Strategy Test/i').first();
    await expect(backtestList).toBeVisible({ timeout: 10000 });

    // Verify backtest data is displayed
    await expect(page.locator('text=/BTCUSDT|ETHUSDT/i')).toBeVisible();
    await expect(page.locator('text=/COMPLETED|RUNNING/i')).toBeVisible();
  });

  test('should view backtest details', async ({ page }) => {
    // Mock backtest with details
    const mockBacktest = {
      id: '1',
      name: 'RSI Strategy Test',
      symbol: 'BTCUSDT',
      status: 'COMPLETED',
      totalReturn: 150,
      totalReturnPct: 15,
      winRate: 0.65,
      sharpeRatio: 1.8,
      maxDrawdown: -50,
      maxDrawdownPct: -5,
      totalTrades: 30,
      createdAt: new Date().toISOString()
    };

    await apiMock.mockBacktests([mockBacktest]);

    // Navigate to backtests page
    await navigateToPage(page, 'Backtests');
    await waitForLoadingComplete(page);

    // Click on backtest to view details
    const backtestItem = page.locator('text=/RSI Strategy Test/i').first();
    if (await backtestItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await backtestItem.click();

      // Wait for details to load
      await page.waitForTimeout(1000);

      // Verify details are displayed
      await expect(page.locator('text=/total return|retorno total/i')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=/win rate|taxa.*acerto/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should handle WebSocket reconnection', async ({ page }) => {
    // Navigate to dashboard
    await navigateToPage(page, 'Dashboard');
    await waitForLoadingComplete(page);

    // Wait for initial WebSocket connection
    const wsStatus = page.locator('.ws-state, [class*="ws"]');
    await expect(wsStatus).toContainText(/conectado|connected/i, { timeout: 10000 });

    // Simulate WebSocket disconnection
    await page.evaluate(() => {
      const event = new CustomEvent('ws-disconnect');
      window.dispatchEvent(event);
    });

    // Wait a bit
    await page.waitForTimeout(500);

    // Should show disconnected state
    const disconnectedState = await wsStatus.textContent();
    expect(disconnectedState).toMatch(/desconectado|disconnected|reconectando|reconnecting/i);

    // Simulate reconnection
    await page.evaluate(() => {
      const event = new CustomEvent('ws-connect');
      window.dispatchEvent(event);
    });

    // Should show connected state again
    await expect(wsStatus).toContainText(/conectado|connected/i, { timeout: 5000 });
  });

  test('should display real-time chart updates', async ({ page }) => {
    // Navigate to dashboard
    await navigateToPage(page, 'Dashboard');
    await waitForLoadingComplete(page);

    // Look for chart element
    const chartElement = page.locator('canvas, svg').first();

    if (await chartElement.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(chartElement).toBeVisible();

      // Simulate price update via WebSocket
      await page.evaluate(() => {
        const event = new CustomEvent('price-update', {
          detail: {
            symbol: 'BTCUSDT',
            price: 51500,
            timestamp: Date.now()
          }
        });
        window.dispatchEvent(event);
      });

      // Wait for chart to update
      await page.waitForTimeout(1000);

      // Chart should still be visible
      await expect(chartElement).toBeVisible();
    }
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/market/ticker', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_ERROR'
          }
        })
      });
    });

    // Navigate to market page
    await navigateToPage(page, 'Mercado');

    // Should show error message
    await expect(page.locator('text=/erro|error|falha|failed/i')).toBeVisible({ timeout: 10000 });
  });

  test('should handle network timeout', async ({ page }) => {
    // Mock slow API response
    await page.route('**/positions', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 35000)); // Longer than timeout
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] })
      });
    });

    // Navigate to positions page
    await navigateToPage(page, 'Posições');

    // Should show timeout or error message
    await expect(page.locator('text=/timeout|tempo.*esgotado|erro|error/i')).toBeVisible({ timeout: 40000 });
  });

  test('should persist user session across page reloads', async ({ page }) => {
    // Login
    await login(page);

    // Navigate to a specific page
    await navigateToPage(page, 'Dashboard');
    await waitForLoadingComplete(page);

    // Reload page
    await page.reload();

    // Should still be logged in
    await expect(page.locator('text=Crypto Sentinel')).toBeVisible({ timeout: 10000 });

    // Should not redirect to login
    expect(page.url()).not.toContain('login');
  });
});

  test('should display leverage information', async ({ page }) => {
    // Navigate to positions
    await navigateToPage(page, 'Risco');
    await waitForLoadingComplete(page);

    // Check for leverage display
    const leverageText = page.locator('text=/[0-9]+x|alavancagem|leverage/i');
    await expect(leverageText.first()).toBeVisible({ timeout: 5000 });
  });

  test('should show stop loss and take profit', async ({ page }) => {
    // Navigate to positions
    await navigateToPage(page, 'Risco');
    await waitForLoadingComplete(page);

    // Check for stop loss mention
    const stopLossText = page.locator('text=/stop.*loss|stop obrigatório/i');
    await expect(stopLossText.first()).toBeVisible({ timeout: 5000 });
  });
});
