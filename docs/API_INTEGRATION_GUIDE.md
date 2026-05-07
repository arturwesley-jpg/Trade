# API Integration Guide

**Version:** 1.0  
**Last Updated:** 2026-05-03

---

## 📋 Overview

This guide covers the integration between the React frontend and the Express backend API, including authentication, error handling, and best practices.

---

## 🔗 Base Configuration

### Environment Variables

```bash
# apps/web/.env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
NODE_ENV=development
```

### API Client Setup

```typescript
// apps/web/src/api.ts
const API_URL = import.meta.env.VITE_API_URL;

const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};
```

---

## 🔐 Authentication Flow

### 1. Register

```typescript
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123"
}

Response 201:
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "createdAt": "2026-05-03T20:00:00Z"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "a1b2c3..."
}
```

### 2. Login

```typescript
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123"
}

Response 200:
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "a1b2c3..."
}
```

### 3. Refresh Token

```typescript
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "a1b2c3..."
}

Response 200:
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "d4e5f6..."
}
```

### 4. Logout

```typescript
POST /auth/logout
Authorization: Bearer eyJhbGc...

Response 200:
{
  "message": "Logged out successfully"
}
```

---

## 📊 Trading Endpoints

### Get Performance Metrics

```typescript
GET /metrics
Authorization: Bearer eyJhbGc...

Response 200:
{
  "totalTrades": 150,
  "winRate": 0.65,
  "profitLoss": 12500.50,
  "sharpeRatio": 1.85,
  "maxDrawdown": 0.15,
  "averageWin": 250.00,
  "averageLoss": -180.00,
  "profitFactor": 1.95,
  "updatedAt": "2026-05-03T20:00:00Z"
}
```

### Get Backtests

```typescript
GET /backtests
Authorization: Bearer eyJhbGc...

Response 200:
[
  {
    "id": "uuid",
    "userId": "uuid",
    "strategy": "RSI_MACD",
    "symbol": "BTCUSDT",
    "timeframe": "1h",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z",
    "initialCapital": 10000,
    "finalCapital": 12500,
    "totalTrades": 45,
    "winRate": 0.67,
    "profitLoss": 2500,
    "maxDrawdown": 0.12,
    "sharpeRatio": 1.75,
    "createdAt": "2026-05-03T19:00:00Z"
  }
]
```

### Create Backtest

```typescript
POST /backtests
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "strategy": "RSI_MACD",
  "symbol": "BTCUSDT",
  "timeframe": "1h",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "initialCapital": 10000
}

Response 201:
{
  "id": "uuid",
  "userId": "uuid",
  "strategy": "RSI_MACD",
  "symbol": "BTCUSDT",
  "status": "running",
  "createdAt": "2026-05-03T20:00:00Z"
}
```

---

## 🔄 Retry Logic

### Exponential Backoff Implementation

```typescript
async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```

### Usage Example

```typescript
export async function getMetrics(): Promise<PerformanceMetrics> {
  return fetchWithRetry<PerformanceMetrics>(
    `${API_URL}/metrics`,
    {
      method: 'GET',
      headers: getAuthHeaders()
    }
  );
}
```

---

## ⚠️ Error Handling

### Error Response Format

```typescript
interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}
```

### Common Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Bad Request | Validate input data |
| 401 | Unauthorized | Refresh token or redirect to login |
| 403 | Forbidden | User lacks permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Implement rate limiting |
| 500 | Internal Server Error | Retry or show error message |

### Error Handling Example

```typescript
try {
  const metrics = await getMetrics();
  setMetrics(metrics);
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('401')) {
      // Token expired, try refresh
      await refreshToken();
      // Retry request
      const metrics = await getMetrics();
      setMetrics(metrics);
    } else if (error.message.includes('500')) {
      // Server error, show user-friendly message
      setError('Unable to load metrics. Please try again later.');
    } else {
      // Generic error
      setError(error.message);
    }
  }
}
```

---

## 🎯 Best Practices

### 1. Token Management

```typescript
// Store tokens securely
localStorage.setItem('token', accessToken);
localStorage.setItem('refreshToken', refreshToken);

// Clear on logout
localStorage.removeItem('token');
localStorage.removeItem('refreshToken');
```

### 2. Request Cancellation

```typescript
useEffect(() => {
  const controller = new AbortController();

  async function loadData() {
    try {
      const response = await fetch(`${API_URL}/metrics`, {
        signal: controller.signal,
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Fetch error:', error);
      }
    }
  }

  loadData();

  return () => {
    controller.abort();
  };
}, []);
```

### 3. Loading States

```typescript
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

async function loadMetrics() {
  setIsLoading(true);
  setError(null);
  
  try {
    const data = await getMetrics();
    setMetrics(data);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    setIsLoading(false);
  }
}
```

### 4. Optimistic Updates

```typescript
async function createBacktest(params: BacktestParams) {
  // Optimistic update
  const tempBacktest = {
    id: 'temp-' + Date.now(),
    ...params,
    status: 'running',
    createdAt: new Date().toISOString()
  };
  
  setBacktests(prev => [...prev, tempBacktest]);

  try {
    const backtest = await api.createBacktest(params);
    // Replace temp with real data
    setBacktests(prev => 
      prev.map(b => b.id === tempBacktest.id ? backtest : b)
    );
  } catch (error) {
    // Rollback on error
    setBacktests(prev => 
      prev.filter(b => b.id !== tempBacktest.id)
    );
    throw error;
  }
}
```

---

## 🧪 Testing

### Mock API Responses

```typescript
import { vi } from 'vitest';

vi.mock('@/api', () => ({
  getMetrics: vi.fn().mockResolvedValue({
    totalTrades: 100,
    winRate: 0.65,
    profitLoss: 5000
  }),
  getBacktests: vi.fn().mockResolvedValue([]),
  createBacktest: vi.fn().mockResolvedValue({
    id: 'test-id',
    status: 'running'
  })
}));
```

### Integration Test Example

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { TradingHub } from '@/components/TradingHub';

test('loads and displays metrics', async () => {
  render(<TradingHub />);

  expect(screen.getByText(/loading/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText(/100 trades/i)).toBeInTheDocument();
  });
});
```

---

## 📊 Performance Optimization

### 1. Request Deduplication

```typescript
const requestCache = new Map<string, Promise<any>>();

async function cachedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (requestCache.has(key)) {
    return requestCache.get(key)!;
  }

  const promise = fetcher();
  requestCache.set(key, promise);

  try {
    const result = await promise;
    return result;
  } finally {
    requestCache.delete(key);
  }
}
```

### 2. Response Caching

```typescript
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

async function getCachedMetrics(): Promise<PerformanceMetrics> {
  const cached = cache.get('metrics');
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await getMetrics();
  cache.set('metrics', { data, timestamp: Date.now() });
  
  return data;
}
```

---

## 🔍 Debugging

### Enable Request Logging

```typescript
const originalFetch = window.fetch;

window.fetch = async (...args) => {
  console.log('Fetch:', args[0]);
  const response = await originalFetch(...args);
  console.log('Response:', response.status, response.statusText);
  return response;
};
```

### Chrome DevTools Network Tab

1. Open DevTools → Network
2. Filter by "Fetch/XHR"
3. Click request to see details
4. Check Headers, Payload, Response

---

## 📚 Related Documentation

- [Phase 4 Integration](./PHASE_4_INTEGRATION.md)
- [WebSocket Protocol](./WEBSOCKET_PROTOCOL.md)
- [Backend API Routes](../apps/api/src/routes/README.md)
- [Authentication System](./AUTHENTICATION.md)

---

*Last Updated: 2026-05-03 20:16 GMT*
