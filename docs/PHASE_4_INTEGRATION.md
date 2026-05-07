# Phase 4: Frontend-Backend Integration

**Status:** 🔄 IN PROGRESS  
**Started:** 2026-05-03  
**Duration:** 3-5 days (estimated)  
**Dependencies:** Phase 3 (Authentication & Persistence) ✅

---

## 📋 Overview

Phase 4 integrates the React frontend with the backend API, replacing all mock data with real endpoints, implementing WebSocket for real-time market data, and adding comprehensive state management.

---

## 🎯 Objectives

1. **Remove Mock Data** - Replace all mock data generators with real API calls
2. **State Management** - Implement TradingContext for global state
3. **API Integration** - Connect frontend to backend endpoints with retry logic
4. **WebSocket Integration** - Real-time market data streaming
5. **Error Handling** - Comprehensive error handling and user feedback
6. **Testing** - Integration and E2E tests for complete flows

---

## 🏗️ Architecture

### State Management Flow

```
User Action → Component → TradingContext → API Client → Backend
                ↓              ↓              ↓
            UI Update ← State Update ← Response
```

### WebSocket Flow

```
Backend WebSocket → MarketDataWebSocket → TradingContext → Components → Chart Update
```

---

## 📦 Components

### 1. TradingContext (`apps/web/src/contexts/TradingContext.tsx`)

Global state management for trading data.

**State:**
```typescript
interface TradingState {
  candles: Candle[];
  metrics: PerformanceMetrics | null;
  backtests: Backtest[];
  isLoading: boolean;
  error: string | null;
}
```

**Actions:**
- `refreshMetrics()` - Fetch latest performance metrics
- `loadBacktests()` - Load backtest history
- `createBacktest(params)` - Create new backtest
- `addCandle(candle)` - Add real-time candle from WebSocket

**Usage:**
```typescript
const { metrics, isLoading, error, refreshMetrics } = useTrading();

useEffect(() => {
  refreshMetrics();
}, []);
```

---

### 2. API Client (`apps/web/src/api.ts`)

HTTP client with retry logic and error handling.

**Features:**
- Exponential backoff (3 retries max)
- Request timeout handling
- Authorization header injection
- Typed responses

**Functions:**
```typescript
getMetrics(): Promise<PerformanceMetrics>
getBacktests(): Promise<Backtest[]>
createBacktest(params: BacktestParams): Promise<Backtest>
```

**Retry Logic:**
```typescript
// Retry delays: 1s, 2s, 4s
const delay = Math.pow(2, attempt) * 1000;
```

---

### 3. WebSocket Service (`apps/web/src/services/websocket.ts`)

Real-time market data streaming.

**Features:**
- Auto-reconnect with exponential backoff
- Connection state management
- Type-safe message handling
- Proper cleanup

**Usage:**
```typescript
const ws = new MarketDataWebSocket('ws://localhost:3000');

ws.onCandle((candle) => {
  addCandle(candle);
});

ws.onError((error) => {
  console.error('WebSocket error:', error);
});

ws.connect();
```

---

## 🔧 Implementation Details

### Component Updates

#### TradingHub
- ✅ Remove mock candle generation
- ✅ Use `useTrading()` hook
- ✅ Display loading spinner
- ✅ Show error messages
- ✅ Real-time chart updates from WebSocket

#### BacktestPanel
- ✅ Remove mock backtest data
- ✅ BacktestForm component
- ✅ BacktestResults component
- ✅ Form validation
- ✅ Loading states
- ✅ Error handling

#### MetricsPanel
- ✅ Remove mock metrics
- ✅ Use real data from context
- ✅ Loading state
- ✅ Refresh button

---

## 🧪 Testing Strategy

### Unit Tests
- TradingContext state updates
- API client retry logic
- WebSocket connection handling
- Component rendering with providers

### Integration Tests
- Frontend-backend communication
- Authentication flow
- Backtest creation flow
- Metrics fetching

### E2E Tests (Playwright)
- Complete user journey: login → create backtest → view results
- Real-time chart updates
- Error scenarios
- Network failures

---

## 📊 Test Coverage Goals

- **Unit Tests:** 80%+ coverage
- **Integration Tests:** All critical paths
- **E2E Tests:** 5+ user flows

---

## 🚀 Deployment Checklist

- [ ] All mock data removed
- [ ] TradingContext implemented
- [ ] API client with retry logic
- [ ] WebSocket service working
- [ ] All components integrated
- [ ] Tests passing (unit + integration + E2E)
- [ ] Error handling complete
- [ ] Loading states implemented
- [ ] Environment variables documented
- [ ] Build successful
- [ ] Performance optimized

---

## 📝 Environment Variables

```bash
# Frontend (.env)
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
NODE_ENV=development
```

---

## 🔍 Verification Steps

1. **Build Check**
   ```bash
   cd apps/web
   npm run build
   ```

2. **Test Check**
   ```bash
   npm run test
   npm run test:coverage
   ```

3. **E2E Check**
   ```bash
   npx playwright test
   ```

4. **Manual Testing**
   - Login with test user
   - Create backtest
   - View metrics
   - Check real-time chart updates
   - Test error scenarios

---

## 📈 Success Metrics

- ✅ Zero mock data in production code
- ✅ All API endpoints integrated
- ✅ WebSocket streaming working
- ✅ 100+ tests passing
- ✅ Build time < 30s
- ✅ No console errors
- ✅ Responsive UI (< 100ms interactions)

---

## 🐛 Known Issues

*To be documented during implementation*

---

## 📚 Related Documentation

- [Phase 3 Completion](../PHASE_3_COMPLETION.md)
- [API Integration Guide](./API_INTEGRATION.md)
- [Testing Guide](./TESTING.md)
- [WebSocket Protocol](./WEBSOCKET_PROTOCOL.md)

---

## 👥 Team

**Implementation:** Multi-agent parallel execution
- Agent 1: State Management Context
- Agent 2: API Client & WebSocket
- Agent 3: UI Integration & Mock Removal

**Verification:** Automated verification agent

---

*Last Updated: 2026-05-03 20:15 GMT*
