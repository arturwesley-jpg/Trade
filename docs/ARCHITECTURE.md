# Architecture Documentation

## System Overview

The Crypto Trading Bot is a full-stack application for automated cryptocurrency trading with paper trading, backtesting, and analytics capabilities.

## Technology Stack

### Backend
- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **ORM**: Drizzle ORM
- **Authentication**: JWT (jsonwebtoken)
- **Testing**: Vitest

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **Charts**: Recharts
- **State Management**: React Context + Hooks
- **HTTP Client**: Fetch API

### Infrastructure
- **Monorepo**: Turborepo
- **Package Manager**: npm
- **CI/CD**: GitHub Actions
- **Containerization**: Docker
- **Orchestration**: Docker Compose

## Project Structure

```
Trade/
├── apps/
│   ├── api/              # REST API server
│   ├── web/              # React frontend
│   ├── telegram-bot/     # Telegram bot
│   └── worker/           # Background jobs
├── packages/
│   ├── exchange/         # Exchange integrations
│   ├── shared/           # Shared utilities
│   └── trading-core/     # Trading logic
├── docs/                 # Documentation
└── scripts/              # Build/deploy scripts
```

## Core Components

### 1. API Server (`apps/api`)

**Responsibilities:**
- Handle HTTP requests
- Authentication & authorization
- Route requests to services
- WebSocket connections
- Rate limiting

**Key Files:**
- `src/app.ts` - Express app setup
- `src/routes/` - Modular route handlers
- `src/services/` - Business logic
- `src/middleware/` - Request middleware

### 2. Frontend (`apps/web`)

**Responsibilities:**
- User interface
- Real-time data visualization
- Trading controls
- Analytics dashboards

**Key Files:**
- `src/App.tsx` - Main app component
- `src/components/` - React components
- `src/contexts/` - React contexts
- `src/api.ts` - API client

### 3. Exchange Package (`packages/exchange`)

**Responsibilities:**
- Market data fetching
- Exchange API integration
- Data normalization
- Provider failover

**Supported Exchanges:**
- BingX
- Binance
- Bybit
- OKX
- Kraken

**Key Files:**
- `src/market-data-provider.ts` - Provider interface
- `src/*-normalizer.ts` - Exchange-specific normalizers
- `src/provider-supervisor.ts` - Multi-provider management

### 4. Trading Core (`packages/trading-core`)

**Responsibilities:**
- Trading strategies
- Signal generation
- Risk management
- Backtesting engine
- Paper trading

**Key Files:**
- `src/strategies/` - Trading strategies
- `src/backtesting/` - Backtest engine
- `src/risk/` - Risk analysis
- `src/paper-trading/` - Paper trading engine

### 5. Telegram Bot (`apps/telegram-bot`)

**Responsibilities:**
- Telegram notifications
- Command interface
- Alert delivery
- User interaction

### 6. Worker (`apps/worker`)

**Responsibilities:**
- Background jobs
- Scheduled tasks
- Data processing
- Alert monitoring

## Data Flow

### Market Data Flow

```
Exchange APIs
    ↓
Market Data Providers (BingX, Binance, etc.)
    ↓
Provider Supervisor (failover, consensus)
    ↓
Trading Strategies (signal generation)
    ↓
Paper Trading Engine (order execution)
    ↓
Database (persistence)
    ↓
API (REST/WebSocket)
    ↓
Frontend (visualization)
```

### Authentication Flow

```
User → Frontend → API
                   ↓
              Auth Service
                   ↓
              JWT Token
                   ↓
              Database (user, refresh tokens)
```

### Trading Flow

```
Market Data → Strategy → Signal
                           ↓
                    Risk Check
                           ↓
                    Order Creation
                           ↓
                    Paper Engine
                           ↓
                    Position Management
                           ↓
                    Database
```

## Database Schema

### Core Tables

**users**
- id (uuid, PK)
- email (text, unique)
- password_hash (text)
- role (text)
- created_at (timestamp)

**refresh_tokens**
- id (uuid, PK)
- user_id (uuid, FK)
- token (text, unique)
- expires_at (timestamp)

**paper_orders**
- id (uuid, PK)
- user_id (uuid, FK)
- symbol (text)
- side (text)
- quantity (numeric)
- price (numeric)
- status (text)
- created_at (timestamp)

**paper_positions**
- id (uuid, PK)
- user_id (uuid, FK)
- symbol (text)
- side (text)
- quantity (numeric)
- entry_price (numeric)
- current_price (numeric)
- pnl (numeric)
- opened_at (timestamp)
- closed_at (timestamp)

**backtests**
- id (uuid, PK)
- user_id (uuid, FK)
- symbol (text)
- strategy (text)
- parameters (jsonb)
- results (jsonb)
- status (text)
- created_at (timestamp)

**audit_logs**
- id (uuid, PK)
- user_id (uuid, FK)
- action (text)
- details (jsonb)
- ip_address (text)
- timestamp (timestamp)

## Security

### Authentication
- JWT-based authentication
- Access tokens (15 min expiry)
- Refresh tokens (7 day expiry)
- Secure password hashing (bcrypt)

### Authorization
- Role-based access control (RBAC)
- Roles: user, admin, viewer
- Middleware-based permission checks

### API Security
- Rate limiting (100 req/min authenticated, 30 req/min public)
- CORS configuration
- Input validation
- SQL injection prevention (parameterized queries)
- XSS prevention

### Data Security
- Sensitive data encryption
- Secure token storage
- Environment variable management
- Audit logging

## Scalability

### Horizontal Scaling
- Stateless API servers
- Load balancer ready
- Session storage in Redis
- Database connection pooling

### Caching Strategy
- Redis for hot data
- Market data cache (5s TTL)
- Signals cache (10s TTL)
- Metrics cache (1min TTL)

### Performance Optimization
- Database indexing
- Query optimization
- Lazy loading
- Code splitting (frontend)
- Asset compression

## Monitoring & Observability

### Logging
- Structured logging (JSON)
- Log levels: trace, debug, info, warn, error, fatal
- Context injection (requestId, userId)

### Metrics
- Prometheus-compatible metrics
- Request duration
- Error rates
- Active connections
- Memory/CPU usage

### Health Checks
- Liveness probe: `/health/live`
- Readiness probe: `/health/ready`
- Detailed health: `/health`

### Alerting
- Critical error alerts
- High error rate alerts
- Service degradation alerts
- Trading anomaly alerts

## Deployment

### Development
```bash
npm install
npm run dev
```

### Production
```bash
npm run build
npm run start
```

### Docker
```bash
docker-compose up -d
```

### Environment Variables
See `.env.example` for required configuration.

## Testing Strategy

### Unit Tests
- Individual functions
- Business logic
- Data transformations
- Run: `npm test`

### Integration Tests
- API endpoints
- Database operations
- External services
- Run: `npm run test:integration`

### E2E Tests
- User flows
- Critical paths
- Browser automation (Playwright)
- Run: `npm run test:e2e`

## Future Enhancements

1. **Real Trading**
   - Live exchange integration
   - Order execution
   - Position management

2. **Advanced Analytics**
   - Machine learning models
   - Predictive analytics
   - Pattern recognition

3. **Social Trading**
   - Copy trading
   - Signal sharing
   - Leaderboards

4. **Mobile App**
   - React Native
   - Push notifications
   - Mobile-optimized UI

5. **Multi-Exchange Support**
   - More exchanges
   - Cross-exchange arbitrage
   - Unified order routing
