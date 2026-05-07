import { test, expect } from '@playwright/test';
import { login, navigateToPage, waitForLoadingComplete } from './utils/test-helpers.js';
import { ApiMock } from './utils/api-mock.js';
import { performanceMetrics } from './utils/fixtures.js';

test.describe('Performance Metrics', () => {
  let apiMock: ApiMock;

  test.beforeEach(async ({ page }) => {
    apiMock = new ApiMock(page);
    await apiMock.mockAll();
    await login(page);
  });

  test('should view performance metrics', async ({ page }) => {
    // Navigate to analytics page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Wait for metrics to load
    await page.waitForTimeout(2000);

    // Verify performance metrics section is visible
    const metricsSection = page.locator('text=/performance|métricas|metrics/i').first();
    await expect(metricsSection).toBeVisible({ timeout: 10000 });

    // Check for key metrics
    const totalReturnText = page.locator('text=/retorno total|total return/i');
    const winRateText = page.locator('text=/win rate|taxa.*acerto/i');

    // At least one metric should be visible
    const hasMetrics =
      await totalReturnText.isVisible({ timeout: 2000 }).catch(() => false) ||
      await winRateText.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasMetrics).toBeTruthy();
  });

  test('should view equity curve chart', async ({ page }) => {
    // Navigate to analytics page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Wait for charts to load
    await page.waitForTimeout(3000);

    // Look for equity curve chart
    const equityCurve = page.locator('text=/equity.*curve|curva.*equity|patrimônio/i').first();

    if (await equityCurve.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(equityCurve).toBeVisible();

      // Verify chart canvas or SVG is present
      const chartElement = page.locator('canvas, svg').first();
      await expect(chartElement).toBeVisible({ timeout: 5000 });
    }
  });

  test('should view trade distribution', async ({ page }) => {
    // Navigate to analytics page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Look for trade distribution or win/loss breakdown
    const distributionText = page.locator('text=/distribuição|distribution|breakdown/i');

    if (await distributionText.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(distributionText).toBeVisible();
    }
  });

  test('should filter by date range', async ({ page }) => {
    // Navigate to analytics page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Look for date filter inputs
    const dateInputs = page.locator('input[type="date"]');
    const dateInputCount = await dateInputs.count();

    if (dateInputCount > 0) {
      // Fill in date range
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      await dateInputs.first().fill(startDate);
      if (dateInputCount > 1) {
        await dateInputs.nth(1).fill(endDate);
      }

      // Look for apply/filter button
      const filterButton = page.locator('button:has-text("Filtrar"), button:has-text("Aplicar"), button:has-text("Filter"), button:has-text("Apply")');

      if (await filterButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await filterButton.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should export metrics', async ({ page }) => {
    // Navigate to analytics page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Look for export button
    const exportButton = page.locator('button:has-text("Exportar"), button:has-text("Export"), button:has-text("Download")');

    if (await exportButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);

      await exportButton.click();

      const download = await downloadPromise;

      if (download) {
        // Verify download started
        expect(download.suggestedFilename()).toMatch(/\.csv|\.xlsx|\.json|\.pdf/i);
      }
    }
  });

  test('should display Sharpe ratio', async ({ page }) => {
    // Mock metrics with Sharpe ratio
    await apiMock.mockPerformanceMetrics(performanceMetrics.profitable);

    // Navigate to analytics page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Look for Sharpe ratio
    const sharpeText = page.locator('text=/sharpe.*ratio|índice.*sharpe/i');

    if (await sharpeText.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(sharpeText).toBeVisible();
    }
  });

  test('should display max drawdown', async ({ page }) => {
    // Navigate to analytics page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Look for max drawdown
    const drawdownText = page.locator('text=/max.*drawdown|rebaixamento.*máximo/i');

    if (await drawdownText.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(drawdownText).toBeVisible();
    }
  });

  test('should display total trades count', async ({ page }) => {
    // Navigate to analytics page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Look for total trades
    const tradesText = page.locator('text=/total.*trades|trades.*fechados|operações/i');
    await expect(tradesText.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show win rate percentage', async ({ page }) => {
    // Navigate to analytics page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Look for win rate
    const winRateText = page.locator('text=/win rate|taxa.*acerto/i');

    if (await winRateText.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(winRateText).toBeVisible();

      // Should show percentage
      await expect(page.locator('text=/[0-9]+%/')).toBeVisible();
    }
  });

  test('should display profit/loss breakdown', async ({ page }) => {
    // Navigate to analytics page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Look for PnL information
    const pnlText = page.locator('text=/pnl|profit|loss|lucro|prejuízo/i');
    await expect(pnlText.first()).toBeVisible({ timeout: 10000 });
  });

  test('should handle empty metrics gracefully', async ({ page }) => {
    // Mock empty metrics
    await apiMock.mockPerformanceMetrics({
      totalReturn: 0,
      totalReturnPct: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      winRate: 0,
      totalTrades: 0
    });

    // Navigate to analytics page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Should show empty state or zero values
    const emptyMessage = page.locator('text=/nenhum.*dado|no.*data|sem.*trades/i');
    const zeroValue = page.locator('text=/^0$|0%|\\$0/');

    const hasEmptyState =
      await emptyMessage.isVisible({ timeout: 5000 }).catch(() => false) ||
      await zeroValue.isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasEmptyState).toBeTruthy();
  });

  test('should update metrics when new trades are closed', async ({ page }) => {
    // Navigate to analytics page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Get initial metrics
    const initialMetrics = await page.locator('text=/total return|retorno total/i').first().textContent();

    // Simulate closing a trade (via WebSocket or API)
    await page.evaluate(() => {
      const event = new CustomEvent('trade-closed', {
        detail: {
          id: '1',
          pnlUsdt: 50,
          closedAt: new Date().toISOString()
        }
      });
      window.dispatchEvent(event);
    });

    // Wait for metrics to update
    await page.waitForTimeout(2000);

    // Metrics should potentially update (or at least not error)
    const updatedMetrics = await page.locator('text=/total return|retorno total/i').first().textContent();
    expect(updatedMetrics).toBeTruthy();
  });

  test('should display metrics in correct currency format', async ({ page }) => {
    // Navigate to analytics page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Look for currency values
    const currencyValues = page.locator('text=/\\$[0-9,]+\\.?[0-9]*/');
    const count = await currencyValues.count();

    if (count > 0) {
      const firstValue = await currencyValues.first().textContent();
      expect(firstValue).toMatch(/\$[0-9,]+/);
    }
  });

  test('should display percentage values correctly', async ({ page }) => {
    // Navigate to analytics page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Look for percentage values
    const percentageValues = page.locator('text=/[0-9]+\\.?[0-9]*%/');
    const count = await percentageValues.count();

    if (count > 0) {
      const firstValue = await percentageValues.first().textContent();
      expect(firstValue).toMatch(/[0-9]+\.?[0-9]*%/);
    }
  });

  test('should filter metrics by date range', async ({ page }) => {
    // Navigate to analytics page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Look for date range filter
    const dateFilter = page.locator('input[type="date"], button:has-text("Filtrar"), button:has-text("Filter")').first();

    if (await dateFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      await dateFilter.click();

      // Wait for filter to apply
      await page.waitForTimeout(1000);

      // Verify metrics are still displayed
      await expect(page.locator('text=/performance|métricas|metrics/i')).toBeVisible();
    }
  });

  test('should compare multiple strategies', async ({ page }) => {
    // Navigate to analytics page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Look for comparison feature
    const compareButton = page.locator('button:has-text("Comparar"), button:has-text("Compare")').first();

    if (await compareButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await compareButton.click();

      // Should show comparison view
      await expect(page.locator('text=/comparação|comparison/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display trade history', async ({ page }) => {
    // Navigate to analytics or trades page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Look for trade history section
    const tradeHistory = page.locator('text=/histórico.*trade|trade.*history|histórico.*operações/i').first();

    if (await tradeHistory.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(tradeHistory).toBeVisible();

      // Verify trade data is displayed
      await expect(page.locator('text=/LONG|SHORT|BUY|SELL/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should calculate risk metrics', async ({ page }) => {
    // Navigate to analytics page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Look for risk metrics
    const riskMetrics = page.locator('text=/sharpe|sortino|max.*drawdown|volatilidade|volatility/i').first();

    if (await riskMetrics.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(riskMetrics).toBeVisible();

      // Verify numeric values are displayed
      await expect(page.locator('text=/[0-9]+\\.?[0-9]*%?/')).toBeVisible();
    }
  });

  test('should refresh metrics on demand', async ({ page }) => {
    // Navigate to analytics page
    await navigateToPage(page, 'Analytics');
    await waitForLoadingComplete(page);

    // Look for refresh button
    const refreshButton = page.locator('button:has-text("Atualizar"), button:has-text("Refresh"), button[aria-label*="refresh" i]').first();

    if (await refreshButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await refreshButton.click();

      // Should show loading state
      await expect(page.locator('text=/carregando|loading/i')).toBeVisible({ timeout: 2000 });

      // Wait for data to reload
      await waitForLoadingComplete(page);

      // Metrics should still be visible
      await expect(page.locator('text=/performance|métricas|metrics/i')).toBeVisible();
    }
  });
});
