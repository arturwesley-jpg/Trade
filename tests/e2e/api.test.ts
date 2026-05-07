/**
 * E2E API Tests
 * Tests complete API flows with real database and services
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const API_URL = process.env.API_URL || "http://localhost:3001";

describe("E2E API Tests", () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Wait for API to be ready
    await waitForAPI();
  });

  describe("Authentication Flow", () => {
    it("should register a new user", async () => {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `test-${Date.now()}@example.com`,
          password: "Test123!@#",
          name: "Test User"
        })
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.user).toBeDefined();
      expect(data.data.accessToken).toBeDefined();
      
      authToken = data.data.accessToken;
      userId = data.data.user.id;
    });

    it("should login with credentials", async () => {
      const email = `test-login-${Date.now()}@example.com`;
      
      // Register first
      await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: "Test123!@#",
          name: "Login Test"
        })
      });

      // Then login
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: "Test123!@#"
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.accessToken).toBeDefined();
      expect(data.data.refreshToken).toBeDefined();
    });

    it("should get current user info", async () => {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.id).toBe(userId);
    });
  });

  describe("Market Data Flow", () => {
    it("should fetch market ticker", async () => {
      const response = await fetch(`${API_URL}/api/market/ticker/BTC-USDT`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.symbol).toBe("BTC-USDT");
      expect(data.data.price).toBeGreaterThan(0);
    });

    it("should fetch multiple tickers", async () => {
      const response = await fetch(`${API_URL}/api/market/tickers?symbols=BTC-USDT,ETH-USDT`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
    });
  });

  describe("Paper Trading Flow", () => {
    it("should create a paper order", async () => {
      const response = await fetch(`${API_URL}/api/orders/paper`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          symbol: "BTC-USDT",
          side: "buy",
          amount: 0.001,
          price: 50000
        })
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.id).toBeDefined();
      expect(data.data.status).toBe("filled");
    });

    it("should get paper positions", async () => {
      const response = await fetch(`${API_URL}/api/orders/paper/positions`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should get paper trades", async () => {
      const response = await fetch(`${API_URL}/api/orders/paper`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe("Backtesting Flow", () => {
    it("should create a backtest", async () => {
      const response = await fetch(`${API_URL}/api/backtest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          symbol: "BTC-USDT",
          interval: "1h",
          startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
          endTime: Date.now(),
          strategy: "sma_crossover",
          parameters: { fastPeriod: 20, slowPeriod: 50 }
        })
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.id).toBeDefined();
    });

    it("should list backtests", async () => {
      const response = await fetch(`${API_URL}/api/backtest`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe("Metrics Flow", () => {
    it("should get performance metrics", async () => {
      const response = await fetch(`${API_URL}/api/metrics/performance`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toBeDefined();
    });

    it("should get risk metrics", async () => {
      const response = await fetch(`${API_URL}/api/metrics/risk`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toBeDefined();
    });
  });

  describe("Health Checks", () => {
    it("should return healthy status", async () => {
      const response = await fetch(`${API_URL}/health`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe("healthy");
    });

    it("should return liveness probe", async () => {
      const response = await fetch(`${API_URL}/health/live`);

      expect(response.status).toBe(200);
    });

    it("should return readiness probe", async () => {
      const response = await fetch(`${API_URL}/health/ready`);

      expect(response.status).toBe(200);
    });
  });
});

async function waitForAPI(maxAttempts = 30, delayMs = 1000): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) return;
    } catch (error) {
      // API not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error("API did not become ready in time");
}
