# API Documentation

**Version:** 1.0.0  
**Base URL:** `https://api.trading.example.com`  
**Protocol:** REST + WebSocket

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [REST API](#rest-api)
3. [WebSocket API](#websocket-api)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Examples](#examples)

---

## 🔐 Authentication

### Register

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

### Refresh Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

### Logout

```http
POST /api/auth/logout
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

---

## 🔌 REST API

### Backtests

#### List Backtests

```http
GET /api/backtests
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Pagination offset (default: 0)
- `status` (optional): Filter by status (pending, running, completed, failed)

**Response:**
```json
{
  "backtests": [
    {
      "id": "uuid",
      "name": "MA Crossover Strategy",
      "status": "completed",
      "symbol": "BTCUSDT",
      "timeframe": "1h",
      "startDate": "2024-01-01T00:00:00Z",
      "endDate": "2024-12-31T23:59:59Z",
      "metrics": {
        "totalReturn": 45.2,
        "sharpeRatio": 1.8,
        "maxDrawdown": -12.5,
        "winRate": 62.5
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

#### Get Backtest

```http
GET /api/backtests/:id
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "MA Crossover Strategy",
  "status": "completed",
  "symbol": "BTCUSDT",
  "timeframe": "1h",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z",
  "strategy": {
    "type": "ma_crossover",
    "parameters": {
      "fastPeriod": 10,
      "slowPeriod": 20
    }
  },
  "metrics": {
    "totalReturn": 45.2,
    "sharpeRatio": 1.8,
    "maxDrawdown": -12.5,
    "winRate": 62.5,
    "totalTrades": 150,
    "profitFactor": 2.1
  },
  "trades": [
    {
      "timestamp": "2024-01-05T14:30:00Z",
      "type": "buy",
      "price": 42000,
      "quantity": 0.1,
      "pnl": 0
    }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:35:00Z"
}
```

#### Create Backtest

```http
POST /api/backtests
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "MA Crossover Strategy",
  "symbol": "BTCUSDT",
  "timeframe": "1h",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z",
  "strategy": {
    "type": "ma_crossover",
    "parameters": {
      "fastPeriod": 10,
      "slowPeriod": 20
    }
  },
  "initialCapital": 10000
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "MA Crossover Strategy",
  "status": "pending",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

#### Delete Backtest

```http
DELETE /api/backtests/:id
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "message": "Backtest deleted successfully"
}
```

---

### Strategies

#### List Strategies

```http
GET /api/strategies
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Pagination offset (default: 0)
- `category` (optional): Filter by category
- `public` (optional): Filter public strategies (true/false)

**Response:**
```json
{
  "strategies": [
    {
      "id": "uuid",
      "name": "MA Crossover",
      "description": "Moving average crossover strategy",
      "category": "trend_following",
      "public": true,
      "author": "John Doe",
      "rating": 4.5,
      "backtests": 150,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 50,
  "limit": 20,
  "offset": 0
}
```

#### Get Strategy

```http
GET /api/strategies/:id
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "MA Crossover",
  "description": "Moving average crossover strategy",
  "category": "trend_following",
  "public": true,
  "author": "John Doe",
  "version": "1.0.0",
  "config": {
    "type": "ma_crossover",
    "parameters": {
      "fastPeriod": {
        "type": "number",
        "default": 10,
        "min": 5,
        "max": 50
      },
      "slowPeriod": {
        "type": "number",
        "default": 20,
        "min": 10,
        "max": 200
      }
    }
  },
  "performance": {
    "avgReturn": 35.2,
    "avgSharpe": 1.6,
    "avgDrawdown": -15.3
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

#### Create Strategy

```http
POST /api/strategies
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "Custom MA Strategy",
  "description": "My custom moving average strategy",
  "category": "trend_following",
  "public": false,
  "config": {
    "type": "ma_crossover",
    "parameters": {
      "fastPeriod": {
        "type": "number",
        "default": 10,
        "min": 5,
        "max": 50
      },
      "slowPeriod": {
        "type": "number",
        "default": 20,
        "min": 10,
        "max": 200
      }
    }
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Custom MA Strategy",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

#### Update Strategy

```http
PUT /api/strategies/:id
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "Updated Strategy Name",
  "description": "Updated description",
  "public": true
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Updated Strategy Name",
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

#### Delete Strategy

```http
DELETE /api/strategies/:id
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "message": "Strategy deleted successfully"
}
```

---

### Risk Management

#### Get Portfolio Risk

```http
GET /api/risk/portfolio
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "portfolioValue": 50000,
  "totalRisk": 2500,
  "riskPercentage": 5.0,
  "var95": 1500,
  "cvar95": 2000,
  "positions": [
    {
      "symbol": "BTCUSDT",
      "value": 25000,
      "risk": 1250,
      "riskPercentage": 5.0
    }
  ],
  "correlations": {
    "BTCUSDT-ETHUSDT": 0.85
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Calculate Position Size

```http
POST /api/risk/position-size
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "symbol": "BTCUSDT",
  "entryPrice": 42000,
  "stopLoss": 40000,
  "riskPercentage": 2.0,
  "method": "fixed_fractional"
}
```

**Response:**
```json
{
  "positionSize": 0.5,
  "positionValue": 21000,
  "riskAmount": 1000,
  "riskPercentage": 2.0,
  "stopLossDistance": 2000,
  "stopLossPercentage": 4.76
}
```

#### Check Risk Limits

```http
GET /api/risk/limits
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "dailyLossLimit": 5000,
  "dailyLossUsed": 1200,
  "dailyLossRemaining": 3800,
  "maxPositionSize": 10000,
  "maxLeverage": 3,
  "portfolioHeat": 45.5,
  "maxPortfolioHeat": 100,
  "canTrade": true,
  "warnings": []
}
```

---

### Alerts

#### List Alerts

```http
GET /api/alerts
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "alerts": [
    {
      "id": "uuid",
      "type": "price",
      "symbol": "BTCUSDT",
      "condition": "above",
      "value": 45000,
      "active": true,
      "triggered": false,
      "channels": ["email", "telegram"],
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 10
}
```

#### Create Alert

```http
POST /api/alerts
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "type": "price",
  "symbol": "BTCUSDT",
  "condition": "above",
  "value": 45000,
  "channels": ["email", "telegram"],
  "message": "BTC above $45k!"
}
```

**Response:**
```json
{
  "id": "uuid",
  "type": "price",
  "symbol": "BTCUSDT",
  "active": true,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

#### Delete Alert

```http
DELETE /api/alerts/:id
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "message": "Alert deleted successfully"
}
```

---

### Metrics

#### Get Performance Metrics

```http
GET /api/metrics
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `period` (optional): Time period (1d, 7d, 30d, 90d, 1y, all)

**Response:**
```json
{
  "period": "30d",
  "totalReturn": 12.5,
  "sharpeRatio": 1.8,
  "maxDrawdown": -8.2,
  "winRate": 65.5,
  "totalTrades": 45,
  "profitFactor": 2.3,
  "avgWin": 250,
  "avgLoss": -120,
  "largestWin": 1500,
  "largestLoss": -800,
  "dailyReturns": [
    {
      "date": "2024-01-15",
      "return": 2.5
    }
  ]
}
```

---

## 🔌 WebSocket API

### Connection

```javascript
const ws = new WebSocket('wss://api.trading.example.com/ws?token=ACCESS_TOKEN');

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Message:', data);
};

ws.onerror = (error) => {
  console.error('Error:', error);
};

ws.onclose = () => {
  console.log('Disconnected');
};
```

### Subscribe to Market Data

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'market',
  symbols: ['BTCUSDT', 'ETHUSDT']
}));
```

**Response:**
```json
{
  "type": "market",
  "symbol": "BTCUSDT",
  "price": 42000,
  "volume": 1500,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Subscribe to Backtest Updates

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'backtest',
  backtestId: 'uuid'
}));
```

**Response:**
```json
{
  "type": "backtest_update",
  "backtestId": "uuid",
  "status": "running",
  "progress": 45.5,
  "currentDate": "2024-06-15T00:00:00Z"
}
```

### Subscribe to Alerts

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'alerts'
}));
```

**Response:**
```json
{
  "type": "alert_triggered",
  "alertId": "uuid",
  "symbol": "BTCUSDT",
  "message": "BTC above $45k!",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Unsubscribe

```javascript
ws.send(JSON.stringify({
  type: 'unsubscribe',
  channel: 'market',
  symbols: ['BTCUSDT']
}));
```

---

## ⚠️ Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## 🚦 Rate Limiting

**Limits:**
- **Authenticated**: 100 requests per 15 minutes
- **Unauthenticated**: 20 requests per 15 minutes
- **WebSocket**: 1000 messages per minute

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642252800
```

**Rate Limit Exceeded Response:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retryAfter": 900
  }
}
```

---

## 📝 Examples

### Complete Backtest Flow

```javascript
// 1. Login
const loginResponse = await fetch('https://api.trading.example.com/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!'
  })
});
const { accessToken } = await loginResponse.json();

// 2. Create backtest
const backtestResponse = await fetch('https://api.trading.example.com/api/backtests', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    name: 'MA Crossover Strategy',
    symbol: 'BTCUSDT',
    timeframe: '1h',
    startDate: '2024-01-01T00:00:00Z',
    endDate: '2024-12-31T23:59:59Z',
    strategy: {
      type: 'ma_crossover',
      parameters: { fastPeriod: 10, slowPeriod: 20 }
    },
    initialCapital: 10000
  })
});
const { id: backtestId } = await backtestResponse.json();

// 3. Subscribe to updates via WebSocket
const ws = new WebSocket(`wss://api.trading.example.com/ws?token=${accessToken}`);
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'backtest',
    backtestId
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'backtest_update') {
    console.log(`Progress: ${data.progress}%`);
  }
  if (data.status === 'completed') {
    // 4. Get results
    fetch(`https://api.trading.example.com/api/backtests/${backtestId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    .then(res => res.json())
    .then(backtest => {
      console.log('Results:', backtest.metrics);
    });
  }
};
```

---

**Last Updated:** 2026-05-03
