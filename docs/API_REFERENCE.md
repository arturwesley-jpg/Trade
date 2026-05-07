# API Reference

Complete API documentation for the Crypto Trading Bot.

## Base URL

```
http://localhost:3001
```

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Endpoints

### Authentication

#### POST /auth/register
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user"
  },
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token"
}
```

#### POST /auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user"
  },
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token"
}
```

#### POST /auth/refresh
Refresh access token.

**Request:**
```json
{
  "refreshToken": "refresh-token"
}
```

**Response:**
```json
{
  "accessToken": "new-jwt-token",
  "refreshToken": "new-refresh-token"
}
```

#### POST /auth/logout
Logout and invalidate refresh token.

**Request:**
```json
{
  "refreshToken": "refresh-token"
}
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

#### GET /auth/me
Get current user info.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "user"
}
```

---

### Market Data

#### GET /market/ticker/:symbol
Get current ticker for a symbol.

**Parameters:**
- `symbol` (path): Trading pair (e.g., BTC-USDT)

**Response:**
```json
{
  "symbol": "BTC-USDT",
  "price": 68500.5,
  "change24hPct": 2.24,
  "volume24h": 12345.67,
  "timestamp": 1714761600000,
  "source": "binance"
}
```

#### GET /market/tickers
Get tickers for multiple symbols.

**Query Parameters:**
- `symbols` (optional): Comma-separated list of symbols (default: BTC-USDT,ETH-USDT)

**Response:**
```json
[
  {
    "symbol": "BTC-USDT",
    "price": 68500.5,
    "change24hPct": 2.24,
    "volume24h": 12345.67,
    "timestamp": 1714761600000,
    "source": "binance"
  },
  {
    "symbol": "ETH-USDT",
    "price": 3200.0,
    "change24hPct": 1.5,
    "volume24h": 8900.0,
    "timestamp": 1714761600000,
    "source": "binance"
  }
]
```

---

### Orders (Paper Trading)

**All endpoints require authentication (user role)**

#### POST /orders/paper
Create a paper trading order.

**Request:**
```json
{
  "symbol": "BTC-USDT",
  "side": "long",
  "quantity": 0.1,
  "price": 68500.0
}
```

**Response:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "symbol": "BTC-USDT",
  "side": "long",
  "quantity": 0.1,
  "price": 68500.0,
  "status": "filled",
  "createdAt": "2026-05-03T17:00:00Z"
}
```

#### GET /orders/paper
List user's paper orders.

**Response:**
```json
[
  {
    "id": "uuid",
    "symbol": "BTC-USDT",
    "side": "long",
    "quantity": 0.1,
    "price": 68500.0,
    "status": "filled",
    "createdAt": "2026-05-03T17:00:00Z"
  }
]
```

#### GET /orders/paper/positions
Get user's open positions.

**Response:**
```json
[
  {
    "id": "uuid",
    "symbol": "BTC-USDT",
    "side": "long",
    "quantity": 0.1,
    "entryPrice": 68500.0,
    "currentPrice": 69000.0,
    "pnl": 50.0,
    "pnlPct": 0.73,
    "openedAt": "2026-05-03T17:00:00Z"
  }
]
```

#### POST /orders/paper/close/:positionId
Close a paper position.

**Response:**
```json
{
  "id": "uuid",
  "closedAt": "2026-05-03T18:00:00Z",
  "exitPrice": 69000.0,
  "pnl": 50.0,
  "pnlPct": 0.73
}
```

---

### Backtesting

**All endpoints require authentication (user role)**

#### POST /backtest
Create a new backtest.

**Request:**
```json
{
  "symbol": "BTC-USDT",
  "startDate": "2026-01-01",
  "endDate": "2026-03-01",
  "strategy": "momentum",
  "parameters": {
    "rsiPeriod": 14,
    "rsiOverbought": 70,
    "rsiOversold": 30
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "running",
  "createdAt": "2026-05-03T17:00:00Z"
}
```

#### GET /backtest
List user's backtests.

**Response:**
```json
[
  {
    "id": "uuid",
    "symbol": "BTC-USDT",
    "strategy": "momentum",
    "status": "completed",
    "totalReturn": 15.5,
    "sharpeRatio": 1.8,
    "maxDrawdown": -8.2,
    "createdAt": "2026-05-03T17:00:00Z"
  }
]
```

#### GET /backtest/:id
Get backtest details.

**Response:**
```json
{
  "id": "uuid",
  "symbol": "BTC-USDT",
  "strategy": "momentum",
  "parameters": {
    "rsiPeriod": 14
  },
  "results": {
    "totalReturn": 15.5,
    "sharpeRatio": 1.8,
    "maxDrawdown": -8.2,
    "winRate": 0.65,
    "profitFactor": 2.1,
    "totalTrades": 45
  },
  "status": "completed"
}
```

#### GET /backtest/:id/trades
Get backtest trades.

**Response:**
```json
[
  {
    "id": "uuid",
    "symbol": "BTC-USDT",
    "side": "long",
    "entryPrice": 65000.0,
    "exitPrice": 67000.0,
    "quantity": 0.1,
    "pnl": 200.0,
    "pnlPct": 3.08,
    "entryTime": "2026-01-15T10:00:00Z",
    "exitTime": "2026-01-16T14:00:00Z"
  }
]
```

---

### Metrics

**All endpoints require authentication (user role)**

#### GET /metrics/performance
Get performance metrics.

**Response:**
```json
{
  "totalReturn": 12.5,
  "sharpeRatio": 1.6,
  "sortinoRatio": 2.1,
  "maxDrawdown": -7.5,
  "winRate": 0.62,
  "profitFactor": 1.9,
  "totalTrades": 120,
  "avgWin": 150.0,
  "avgLoss": -80.0
}
```

#### GET /metrics/risk
Get risk metrics.

**Response:**
```json
{
  "var95": -500.0,
  "cvar95": -650.0,
  "volatility": 0.15,
  "beta": 1.2,
  "correlation": 0.85
}
```

#### GET /metrics/equity-curve
Get equity curve data.

**Response:**
```json
[
  {
    "timestamp": "2026-01-01T00:00:00Z",
    "equity": 10000.0
  },
  {
    "timestamp": "2026-01-02T00:00:00Z",
    "equity": 10150.0
  }
]
```

#### GET /metrics/trades-analysis
Get trades analysis.

**Response:**
```json
{
  "bySymbol": {
    "BTC-USDT": {
      "trades": 50,
      "winRate": 0.64,
      "avgPnl": 120.0
    },
    "ETH-USDT": {
      "trades": 70,
      "winRate": 0.60,
      "avgPnl": 80.0
    }
  },
  "byHour": {
    "0": { "trades": 5, "winRate": 0.6 },
    "1": { "trades": 3, "winRate": 0.67 }
  },
  "byDayOfWeek": {
    "Monday": { "trades": 20, "winRate": 0.65 },
    "Tuesday": { "trades": 18, "winRate": 0.61 }
  }
}
```

---

### Admin

**All endpoints require authentication (admin role)**

#### GET /admin/audit-logs
Get audit logs.

**Query Parameters:**
- `limit` (optional): Number of logs to return (default: 100)
- `offset` (optional): Offset for pagination (default: 0)
- `userId` (optional): Filter by user ID
- `action` (optional): Filter by action type

**Response:**
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "action": "ORDER_CREATED",
    "details": {
      "symbol": "BTC-USDT",
      "side": "long"
    },
    "ipAddress": "192.168.1.1",
    "timestamp": "2026-05-03T17:00:00Z"
  }
]
```

#### GET /admin/performance
Get system performance metrics.

**Response:**
```json
{
  "uptime": 86400,
  "memory": {
    "rss": 123456789,
    "heapTotal": 98765432,
    "heapUsed": 87654321
  },
  "cpu": {
    "user": 1234567,
    "system": 234567
  },
  "timestamp": 1714761600000
}
```

#### GET /admin/health
System health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": 1714761600000,
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "api": "healthy"
  }
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

API endpoints are rate limited to prevent abuse:
- Authenticated endpoints: 100 requests per minute
- Public endpoints: 30 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1714761660
```
