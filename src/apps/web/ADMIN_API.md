# Admin Panel API Endpoints

This document describes the API endpoints needed for the admin panel to function properly.

## Provider Status

### GET /admin/providers
Returns the status of all market data providers.

**Response:**
```json
{
  "data": {
    "providers": [
      {
        "provider": "binance",
        "status": "healthy",
        "latencyMs": 120,
        "lastUpdate": "2026-05-03T17:00:00Z",
        "dataQuality": 98.5,
        "priceUsd": 45500.00,
        "errorCount": 0
      }
    ],
    "consensus": [
      {
        "symbol": "BTC/USDT",
        "consensusPrice": 45500.00,
        "priceRange": { "min": 45450.00, "max": 45550.00 },
        "disagreementPct": 0.22,
        "providers": [
          { "name": "binance", "price": 45500.00 }
        ]
      }
    ]
  }
}
```

## Paper Trading Metrics

### GET /admin/paper-metrics
Returns comprehensive paper trading performance metrics.

**Response:**
```json
{
  "data": {
    "metrics": {
      "winRate": 65.5,
      "profitFactor": 2.1,
      "sharpeRatio": 1.85,
      "totalTrades": 50,
      "winningTrades": 32,
      "losingTrades": 18,
      "totalPnl": 1250.75,
      "maxDrawdown": -320.50,
      "maxDrawdownPct": -8.2,
      "avgWin": 85.50,
      "avgLoss": -42.30,
      "largestWin": 245.80,
      "largestLoss": -125.30,
      "equityCurve": [
        { "timestamp": "2026-05-01T00:00:00Z", "equity": 10000 }
      ],
      "tradesBySymbol": {
        "BTC/USDT": 30,
        "ETH/USDT": 15
      }
    },
    "recentTrades": []
  }
}
```

## Alert Management

### POST /admin/alerts/:id/acknowledge
Acknowledges an alert.

**Response:**
```json
{
  "data": {
    "id": "alert-123",
    "status": "ACKED"
  }
}
```

### POST /admin/alerts/:id/resolve
Resolves an alert.

**Response:**
```json
{
  "data": {
    "id": "alert-123",
    "status": "RESOLVED",
    "resolvedAt": "2026-05-03T17:00:00Z"
  }
}
```

### POST /admin/alerts
Creates a new alert rule.

**Request:**
```json
{
  "type": "TECHNICAL",
  "title": "High volatility detected",
  "message": "BTC volatility exceeded threshold",
  "severity": "medium"
}
```

## Audit Logs

### GET /admin/audit-logs
Returns audit log entries.

**Query Parameters:**
- `limit` (optional): Number of logs to return (default: 100)
- `offset` (optional): Pagination offset
- `eventType` (optional): Filter by event type
- `startDate` (optional): Filter by start date
- `endDate` (optional): Filter by end date

**Response:**
```json
{
  "data": [
    {
      "id": "log-123",
      "timestamp": "2026-05-03T17:00:00Z",
      "eventType": "USER_LOGIN",
      "userId": "user-456",
      "userName": "admin@trade.com",
      "action": "User logged in",
      "resource": "/api/auth/login",
      "details": "Successful login from IP 192.168.1.100",
      "ipAddress": "192.168.1.100",
      "success": true
    }
  ]
}
```

## System Health

### GET /admin/health
Returns comprehensive system health information.

**Response:**
```json
{
  "data": {
    "api": {
      "status": "healthy",
      "responseTime": 45,
      "uptime": 604800
    },
    "database": {
      "status": "connected",
      "connectionPool": {
        "active": 5,
        "idle": 10,
        "total": 20
      },
      "queryTime": 12
    },
    "redis": {
      "status": "connected",
      "memoryUsed": 268435456,
      "memoryTotal": 536870912,
      "hitRate": 97.5
    },
    "worker": {
      "status": "running",
      "jobsProcessed": 1250,
      "jobsFailed": 12,
      "queueSize": 5
    },
    "system": {
      "memoryUsage": 2684354560,
      "memoryTotal": 8589934592,
      "cpuUsage": 35.5,
      "uptime": 1209600
    }
  }
}
```

## Authentication

All admin endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## Error Responses

All endpoints return errors in the following format:

```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

Common error codes:
- `UNAUTHORIZED`: Missing or invalid authentication token
- `FORBIDDEN`: User does not have admin privileges
- `NOT_FOUND`: Resource not found
- `INTERNAL_ERROR`: Server error
