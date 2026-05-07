import { Page, Route } from '@playwright/test';
import type { Health } from '../../src/api.js';
import { marketTicks, tradingSignals, positions, alerts, sentimentSnapshots, whaleEvents, performanceMetrics } from './fixtures.js';

/**
 * Mock API responses for isolated testing
 */
export class ApiMock {
  constructor(private page: Page) {}

  /**
   * Mock health endpoint
   */
  async mockHealth(status: 'healthy' | 'degraded' | 'down' = 'healthy') {
    await this.page.route('**/health', async (route: Route) => {
      const response: Health = {
        status: status === 'healthy' ? 'ok' : status,
        mode: 'paper',
        liveTradingEnabled: false
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: response })
      });
    });
  }

  /**
   * Mock market tickers endpoint
   */
  async mockMarketTickers(tickers = [marketTicks.btc, marketTicks.eth]) {
    await this.page.route('**/market/ticker', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: tickers })
      });
    });
  }

  /**
   * Mock trading signals endpoint
   */
  async mockSignals(signals = [tradingSignals.longBTC, tradingSignals.shortETH]) {
    await this.page.route('**/signals', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: signals })
      });
    });
  }

  /**
   * Mock positions endpoint
   */
  async mockPositions(positionsList = [positions.openLong, positions.openShort]) {
    await this.page.route('**/positions', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: positionsList })
      });
    });
  }

  /**
   * Mock alerts endpoint
   */
  async mockAlerts(alertsList = [alerts.whaleAlert, alerts.priceAlert]) {
    await this.page.route('**/alerts', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: alertsList })
      });
    });
  }

  /**
   * Mock sentiment endpoint
   */
  async mockSentiment(sentiment = sentimentSnapshots.bullish) {
    await this.page.route('**/sentiment/fear-greed', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: sentiment })
      });
    });
  }

  /**
   * Mock whale events endpoint
   */
  async mockWhaleEvents(events = [whaleEvents.largeTransfer, whaleEvents.exchangeInflow]) {
    await this.page.route('**/whales/events', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: events })
      });
    });
  }

  /**
   * Mock paper summary endpoint
   */
  async mockPaperSummary(summary = {
    openPositions: 2,
    closedTrades: 10,
    realizedPnlUsdt: 150,
    winRatePct: 60
  }) {
    await this.page.route('**/paper/summary', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: summary })
      });
    });
  }

  /**
   * Mock paper order creation
   */
  async mockCreatePaperOrder(success = true, errorMessage?: string) {
    await this.page.route('**/orders/paper', async (route: Route) => {
      if (route.request().method() === 'POST') {
        if (success) {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                id: Math.random().toString(36).substr(2, 9),
                status: 'OPEN',
                createdAt: new Date().toISOString()
              }
            })
          });
        } else {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: {
                message: errorMessage || 'Risk check failed',
                code: 'RISK_CHECK_FAILED'
              }
            })
          });
        }
      } else {
        await route.continue();
      }
    });
  }

  /**
   * Mock performance metrics endpoint
   */
  async mockPerformanceMetrics(metrics = performanceMetrics.profitable) {
    await this.page.route('**/metrics/performance', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: metrics })
      });
    });
  }

  /**
   * Mock backtests endpoint
   */
  async mockBacktests(backtests: any[] = []) {
    await this.page.route('**/backtests', async (route: Route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: backtests })
        });
      } else if (route.request().method() === 'POST') {
        const requestBody = route.request().postDataJSON();
        const newBacktest = {
          id: Math.random().toString(36).substr(2, 9),
          ...requestBody,
          status: 'PENDING',
          createdAt: new Date().toISOString()
        };

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ data: newBacktest })
        });
      } else {
        await route.continue();
      }
    });
  }

  /**
   * Mock authentication endpoints
   */
  async mockAuth() {
    // Mock login
    await this.page.route('**/auth/login', async (route: Route) => {
      const body = route.request().postDataJSON();

      if (body.email === 'test@example.com' && body.password === 'Test123!@#') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              user: {
                id: '1',
                email: body.email,
                name: 'Test User',
                role: 'USER'
              },
              accessToken: 'mock-access-token',
              refreshToken: 'mock-refresh-token'
            }
          })
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              message: 'Invalid credentials',
              code: 'INVALID_CREDENTIALS'
            }
          })
        });
      }
    });

    // Mock register
    await this.page.route('**/auth/register', async (route: Route) => {
      const body = route.request().postDataJSON();

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: Math.random().toString(36).substr(2, 9),
            email: body.email,
            name: body.name || 'New User',
            role: 'USER'
          }
        })
      });
    });

    // Mock /auth/me
    await this.page.route('**/auth/me', async (route: Route) => {
      const authHeader = route.request().headers()['authorization'];

      if (authHeader && authHeader.includes('mock-access-token')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: '1',
              email: 'test@example.com',
              name: 'Test User',
              role: 'USER'
            }
          })
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              message: 'Unauthorized',
              code: 'UNAUTHORIZED'
            }
          })
        });
      }
    });

    // Mock refresh token
    await this.page.route('**/auth/refresh', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            accessToken: 'new-mock-access-token',
            refreshToken: 'new-mock-refresh-token'
          }
        })
      });
    });

    // Mock logout
    await this.page.route('**/auth/logout', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { success: true } })
      });
    });
  }

  /**
   * Mock WebSocket connection
   */
  async mockWebSocket() {
    await this.page.addInitScript(() => {
      // Override WebSocket to prevent actual connections in tests
      (window as any).WebSocket = class MockWebSocket {
        readyState = 1; // OPEN
        onopen: any = null;
        onmessage: any = null;
        onerror: any = null;
        onclose: any = null;

        constructor(public url: string) {
          setTimeout(() => {
            if (this.onopen) this.onopen({});
          }, 100);
        }

        send(data: string) {
          // Mock send
        }

        close() {
          if (this.onclose) this.onclose({});
        }
      };
    });
  }

  /**
   * Mock all common endpoints
   */
  async mockAll() {
    await this.mockAuth();
    await this.mockHealth();
    await this.mockMarketTickers();
    await this.mockSignals();
    await this.mockPositions();
    await this.mockAlerts();
    await this.mockSentiment();
    await this.mockWhaleEvents();
    await this.mockPaperSummary();
    await this.mockPerformanceMetrics();
    await this.mockBacktests();
    await this.mockWebSocket();
  }

  /**
   * Clear all mocks
   */
  async clearAll() {
    await this.page.unroute('**/*');
  }
}
