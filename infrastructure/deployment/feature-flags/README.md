# Feature Flags Service

A lightweight feature flag service for the Trading Bot application, enabling progressive rollouts, A/B testing, and feature toggles.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Feature Flag Service                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   API SDK    │  │   Web SDK    │  │  Admin UI    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                  │                  │          │
│         └──────────────────┼──────────────────┘          │
│                            │                             │
│                     ┌──────▼──────┐                      │
│                     │   Service   │                      │
│                     │   Layer     │                      │
│                     └──────┬──────┘                      │
│                            │                             │
│                     ┌──────▼──────┐                      │
│                     │   Storage   │                      │
│                     │  (Redis)    │                      │
│                     └─────────────┘                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Features

- **Feature Toggles**: Enable/disable features without deployment
- **Progressive Rollouts**: Gradually roll out features to users
- **A/B Testing**: Test multiple variants of a feature
- **User Targeting**: Target specific users or segments
- **Percentage Rollouts**: Roll out to X% of users
- **Kill Switches**: Quickly disable problematic features
- **Real-time Updates**: Changes propagate immediately
- **Audit Logging**: Track all flag changes

## Installation

```bash
cd infrastructure/deployment/feature-flags/feature-flag-service
npm install
npm run build
npm start
```

## Configuration

Create `.env` file:

```env
PORT=4000
REDIS_URL=redis://localhost:6379
NODE_ENV=production
JWT_SECRET=your-jwt-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure-password
```

## API Endpoints

### Get All Flags
```http
GET /api/flags
Authorization: Bearer <token>
```

### Get Flag by Key
```http
GET /api/flags/:key
Authorization: Bearer <token>
```

### Create Flag
```http
POST /api/flags
Authorization: Bearer <token>
Content-Type: application/json

{
  "key": "new-trading-ui",
  "name": "New Trading UI",
  "description": "Redesigned trading interface",
  "enabled": false,
  "rolloutPercentage": 0,
  "targeting": {
    "userIds": [],
    "segments": []
  }
}
```

### Update Flag
```http
PUT /api/flags/:key
Authorization: Bearer <token>
Content-Type: application/json

{
  "enabled": true,
  "rolloutPercentage": 25
}
```

### Delete Flag
```http
DELETE /api/flags/:key
Authorization: Bearer <token>
```

### Evaluate Flag (Client)
```http
POST /api/evaluate
Content-Type: application/json

{
  "flagKey": "new-trading-ui",
  "userId": "user-123",
  "context": {
    "email": "user@example.com",
    "plan": "premium"
  }
}
```

## SDK Usage

### Backend (Node.js)

```typescript
import { FeatureFlagClient } from '@trading-bot/feature-flags';

const client = new FeatureFlagClient({
  apiUrl: 'http://localhost:4000',
  apiKey: 'your-api-key'
});

// Check if feature is enabled
const isEnabled = await client.isEnabled('new-trading-ui', {
  userId: 'user-123',
  context: { plan: 'premium' }
});

if (isEnabled) {
  // Use new trading UI
} else {
  // Use old trading UI
}

// Get flag value with default
const maxPositions = await client.getValue('max-positions', 10, {
  userId: 'user-123'
});

// Track flag evaluation
client.track('new-trading-ui', 'user-123', true);
```

### Frontend (React)

```typescript
import { FeatureFlagProvider, useFeatureFlag } from '@trading-bot/feature-flags-react';

// Wrap app with provider
function App() {
  return (
    <FeatureFlagProvider apiUrl="http://localhost:4000">
      <TradingDashboard />
    </FeatureFlagProvider>
  );
}

// Use in components
function TradingDashboard() {
  const { isEnabled, loading } = useFeatureFlag('new-trading-ui');
  
  if (loading) return <Spinner />;
  
  return isEnabled ? <NewTradingUI /> : <OldTradingUI />;
}
```

## Flag Configuration

### Simple Toggle

```json
{
  "key": "maintenance-mode",
  "name": "Maintenance Mode",
  "enabled": false,
  "type": "boolean"
}
```

### Percentage Rollout

```json
{
  "key": "new-chart-library",
  "name": "New Chart Library",
  "enabled": true,
  "rolloutPercentage": 25,
  "type": "boolean"
}
```

### User Targeting

```json
{
  "key": "beta-features",
  "name": "Beta Features",
  "enabled": true,
  "targeting": {
    "userIds": ["user-1", "user-2"],
    "segments": ["beta-testers", "premium-users"]
  },
  "type": "boolean"
}
```

### A/B Testing

```json
{
  "key": "checkout-flow",
  "name": "Checkout Flow Variant",
  "enabled": true,
  "type": "variant",
  "variants": [
    { "key": "control", "weight": 50 },
    { "key": "variant-a", "weight": 25 },
    { "key": "variant-b", "weight": 25 }
  ]
}
```

### Configuration Value

```json
{
  "key": "max-positions",
  "name": "Maximum Positions",
  "enabled": true,
  "type": "number",
  "value": 10,
  "targeting": {
    "segments": {
      "premium-users": 50,
      "enterprise-users": 100
    }
  }
}
```

## Rollout Strategies

### 1. Percentage Rollout

Gradually increase percentage:
- Day 1: 5%
- Day 2: 10%
- Day 3: 25%
- Day 4: 50%
- Day 5: 100%

### 2. Ring Deployment

Roll out in stages:
1. Internal users (beta-testers)
2. Premium users
3. All users

### 3. Canary Release

Test with small group first:
1. Enable for 1% of users
2. Monitor metrics for 24 hours
3. If successful, increase to 10%
4. Continue until 100%

### 4. Kill Switch

Quickly disable problematic features:
```bash
curl -X PUT http://localhost:4000/api/flags/problematic-feature \
  -H "Authorization: Bearer <token>" \
  -d '{"enabled": false}'
```

## Best Practices

### 1. Naming Conventions

- Use kebab-case: `new-trading-ui`
- Be descriptive: `enable-websocket-compression`
- Include context: `api-v2-endpoints`

### 2. Flag Lifecycle

1. **Create**: Add flag with `enabled: false`
2. **Test**: Enable for internal users
3. **Rollout**: Gradually increase percentage
4. **Complete**: Remove flag after 100% rollout
5. **Cleanup**: Delete flag and remove code

### 3. Flag Hygiene

- Remove flags after full rollout (within 30 days)
- Document flag purpose and owner
- Set expiration dates
- Regular flag audits

### 4. Monitoring

- Track flag evaluations
- Monitor error rates per flag
- Alert on unexpected flag states
- Dashboard for flag status

### 5. Testing

```typescript
// Mock flags in tests
jest.mock('@trading-bot/feature-flags', () => ({
  isEnabled: jest.fn().mockResolvedValue(true)
}));

test('shows new UI when flag enabled', async () => {
  const { getByText } = render(<TradingDashboard />);
  expect(getByText('New Trading UI')).toBeInTheDocument();
});
```

## Admin UI

Access at: `http://localhost:4000/admin`

Features:
- View all flags
- Create/edit/delete flags
- Toggle flags on/off
- Adjust rollout percentages
- View flag evaluation history
- Audit log

## Monitoring

### Metrics

- `feature_flag_evaluations_total`: Total flag evaluations
- `feature_flag_enabled_count`: Number of enabled flags
- `feature_flag_evaluation_duration`: Evaluation latency

### Grafana Dashboard

Import dashboard from: `infrastructure/monitoring/grafana/dashboards/feature-flags.json`

## Troubleshooting

### Flag not updating

1. Check Redis connection
2. Verify SDK version
3. Clear client cache
4. Check network connectivity

### Inconsistent behavior

1. Verify user ID is consistent
2. Check rollout percentage
3. Review targeting rules
4. Check flag evaluation logs

### Performance issues

1. Enable client-side caching
2. Use bulk evaluation API
3. Reduce evaluation frequency
4. Check Redis performance

## Migration from LaunchDarkly/Unleash

```bash
# Export flags from LaunchDarkly
node scripts/export-launchdarkly.js > flags.json

# Import to feature flag service
node scripts/import-flags.js flags.json
```

## Security

- API authentication required
- Rate limiting enabled
- Audit logging for all changes
- Role-based access control
- Encrypted flag values (optional)

## Backup & Recovery

```bash
# Backup flags
redis-cli --rdb /backup/feature-flags.rdb

# Restore flags
redis-cli --rdb /backup/feature-flags.rdb
```

## Resources

- [Feature Flag Best Practices](https://martinfowler.com/articles/feature-toggles.html)
- [Progressive Delivery](https://www.split.io/glossary/progressive-delivery/)
- [A/B Testing Guide](https://www.optimizely.com/optimization-glossary/ab-testing/)
