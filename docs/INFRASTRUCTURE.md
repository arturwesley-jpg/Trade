# Infrastructure Documentation

Architecture and infrastructure details for the Trade crypto trading bot.

## Table of Contents

- [System Architecture](#system-architecture)
- [Service Diagram](#service-diagram)
- [Components](#components)
- [Data Flow](#data-flow)
- [Scaling Considerations](#scaling-considerations)
- [Backup Strategy](#backup-strategy)
- [Disaster Recovery](#disaster-recovery)
- [Security](#security)
- [Monitoring](#monitoring)

## System Architecture

The Trade platform is a microservices-based architecture with the following components:

```
┌─────────────┐
│   Users     │
└──────┬──────┘
       │
       ├──────────────┬──────────────┬──────────────┐
       │              │              │              │
┌──────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐ ┌────▼─────┐
│  Web App    │ │ Telegram │ │  WebSocket  │ │   API    │
│  (React)    │ │   Bot    │ │   Client    │ │  Client  │
└──────┬──────┘ └────┬─────┘ └──────┬──────┘ └────┬─────┘
       │              │              │              │
       └──────────────┴──────────────┴──────────────┘
                      │
               ┌──────▼──────┐
               │  API Server │
               │  (Fastify)  │
               └──────┬──────┘
                      │
       ┌──────────────┼──────────────┐
       │              │              │
┌──────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
│  PostgreSQL │ │  Redis   │ │   Worker    │
│  Database   │ │  Cache   │ │ (Market Data)│
└─────────────┘ └──────────┘ └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │  Exchanges  │
                              │ (Binance,   │
                              │  Bybit, etc)│
                              └─────────────┘
```

## Service Diagram

### Production Environment

```
┌─────────────────────────────────────────────────────────┐
│                    Load Balancer                        │
│                   (Platform CDN)                        │
└────────────┬────────────────────────────┬───────────────┘
             │                            │
    ┌────────▼────────┐          ┌────────▼────────┐
    │   Web Service   │          │   API Service   │
    │   (Nginx)       │          │   (Node.js)     │
    │   Port: 80      │          │   Port: 4000    │
    └─────────────────┘          └────────┬────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
           ┌────────▼────────┐   ┌────────▼────────┐  ┌────────▼────────┐
           │  Worker Service │   │ Telegram Service│  │  PostgreSQL DB  │
           │  (Market Data)  │   │   (Bot)         │  │                 │
           └────────┬────────┘   └─────────────────┘  └────────┬────────┘
                    │                                           │
                    │                                           │
                    └───────────────┬───────────────────────────┘
                                    │
                           ┌────────▼────────┐
                           │   Redis Cache   │
                           │                 │
                           └─────────────────┘
```

## Components

### 1. API Server

**Technology**: Fastify (Node.js)
**Port**: 4000
**Responsibilities**:
- REST API endpoints
- WebSocket server
- Authentication
- Position management
- Order execution (paper trading)

**Resources**:
- CPU: 1 vCPU
- Memory: 256-512 MB
- Storage: Minimal (logs only)

**Scaling**: Horizontal (multiple instances behind load balancer)

### 2. Worker Service

**Technology**: Node.js
**Responsibilities**:
- Market data collection
- Price feed aggregation
- Exchange API polling
- Data normalization

**Resources**:
- CPU: 1 vCPU
- Memory: 256 MB
- Storage: Minimal

**Scaling**: Vertical (increase resources) or partition by symbol

### 3. Telegram Bot

**Technology**: Telegraf (Node.js)
**Responsibilities**:
- User commands
- Notifications
- Position updates
- Alert delivery

**Resources**:
- CPU: 0.5 vCPU
- Memory: 128 MB
- Storage: Minimal

**Scaling**: Single instance (Telegram bot token limitation)

### 4. Web Frontend

**Technology**: React + Vite, served by Nginx
**Port**: 80/443
**Responsibilities**:
- User interface
- Real-time charts
- Position dashboard
- Trade execution UI

**Resources**:
- CPU: 0.5 vCPU
- Memory: 128 MB
- Storage: Static assets (~50 MB)

**Scaling**: CDN distribution

### 5. PostgreSQL Database

**Version**: 16
**Responsibilities**:
- User data
- Position history
- Trade records
- Configuration

**Resources**:
- CPU: 1 vCPU
- Memory: 512 MB - 1 GB
- Storage: 1-10 GB

**Scaling**: Vertical (increase resources), read replicas for analytics

### 6. Redis Cache

**Version**: 7
**Responsibilities**:
- Market data cache
- Session storage
- Rate limiting
- Real-time price feeds

**Resources**:
- Memory: 256 MB
- Storage: In-memory only

**Scaling**: Redis Cluster for high availability

## Data Flow

### Market Data Flow

```
Exchange APIs → Worker → Redis → API Server → WebSocket → Clients
                    ↓
                PostgreSQL (historical)
```

### Trade Execution Flow

```
User → Web/Telegram → API Server → Trading Core → PostgreSQL
                                         ↓
                                    Paper Trading Engine
```

### Real-time Updates Flow

```
Worker → Redis Pub/Sub → API Server → WebSocket → Connected Clients
```

## Scaling Considerations

### Horizontal Scaling

**API Server**:
- Add more instances behind load balancer
- Use sticky sessions for WebSocket
- Share state via Redis

**Worker**:
- Partition by symbol groups
- Each worker handles subset of markets
- Coordinate via Redis

### Vertical Scaling

**Database**:
- Increase CPU/memory for complex queries
- Add indexes for performance
- Consider read replicas

**Redis**:
- Increase memory for more cache
- Enable persistence for durability

### Auto-scaling Triggers

- CPU > 70% for 5 minutes
- Memory > 80% for 5 minutes
- Request latency > 1s for 2 minutes

### Performance Targets

- API response time: < 200ms (p95)
- WebSocket latency: < 100ms
- Market data freshness: < 2s
- Database query time: < 50ms (p95)

## Backup Strategy

### Database Backups

**Frequency**:
- Full backup: Daily at 02:00 UTC
- Incremental: Every 6 hours
- Point-in-time recovery: Enabled

**Retention**:
- Daily backups: 7 days
- Weekly backups: 4 weeks
- Monthly backups: 12 months

**Storage**:
- Platform-managed backups
- Off-site backup to S3 (optional)

**Verification**:
- Weekly restore test
- Automated integrity checks

### Redis Backups

**Frequency**:
- AOF (Append-Only File): Continuous
- RDB snapshot: Every 6 hours

**Retention**:
- Last 3 snapshots

### Application Data

**Trade Store**:
- Backed up with database
- Exported to JSON daily
- Stored in persistent volume

### Backup Restoration

```bash
# Database restore
pg_restore -d trade_db backup.dump

# Redis restore
redis-cli --rdb dump.rdb

# Application data
cp backup/trade-store.json data/trade-store.json
```

## Disaster Recovery

### Recovery Time Objective (RTO)

- Critical services: < 1 hour
- Non-critical services: < 4 hours
- Full system: < 8 hours

### Recovery Point Objective (RPO)

- Database: < 1 hour (point-in-time recovery)
- Redis: < 6 hours (last snapshot)
- Application state: < 24 hours

### Disaster Scenarios

#### 1. Database Failure

**Detection**: Health check fails, connection errors
**Response**:
1. Switch to read replica (if available)
2. Restore from latest backup
3. Replay transaction logs
4. Verify data integrity

**Time**: 30-60 minutes

#### 2. Service Crash

**Detection**: Health check fails, no response
**Response**:
1. Auto-restart (platform handles)
2. Check logs for root cause
3. Rollback if recent deployment
4. Scale horizontally if load issue

**Time**: 5-15 minutes

#### 3. Data Corruption

**Detection**: Integrity check fails, user reports
**Response**:
1. Identify corruption scope
2. Restore affected data from backup
3. Verify with checksums
4. Investigate root cause

**Time**: 1-4 hours

#### 4. Complete Platform Outage

**Detection**: All services down
**Response**:
1. Deploy to alternative platform
2. Restore database from backup
3. Update DNS records
4. Verify all services

**Time**: 4-8 hours

### Disaster Recovery Checklist

- [ ] Identify incident severity
- [ ] Notify team and users
- [ ] Activate backup systems
- [ ] Restore from backups
- [ ] Verify data integrity
- [ ] Test critical functionality
- [ ] Monitor for issues
- [ ] Post-mortem analysis

## Security

### Network Security

- HTTPS/TLS for all external traffic
- Internal service communication encrypted
- Firewall rules: whitelist only
- DDoS protection via CDN

### Application Security

- API authentication via tokens
- Rate limiting on all endpoints
- Input validation and sanitization
- SQL injection prevention (parameterized queries)
- XSS protection (CSP headers)

### Data Security

- Database encryption at rest
- Secrets stored in platform vault
- API keys never in code
- Regular security audits

### Access Control

- Principle of least privilege
- Role-based access control (RBAC)
- Multi-factor authentication for admin
- Audit logs for all actions

## Monitoring

### Metrics

**Application**:
- Request rate and latency
- Error rate
- Active WebSocket connections
- Trade execution time

**Infrastructure**:
- CPU and memory usage
- Disk I/O
- Network throughput
- Database connections

**Business**:
- Active users
- Open positions
- Trade volume
- P&L metrics

### Alerting

**Critical** (immediate response):
- Service down
- Database connection failed
- Error rate > 5%

**Warning** (investigate within 1 hour):
- High latency (> 1s)
- Memory usage > 80%
- Disk space < 20%

**Info** (review daily):
- Deployment completed
- Backup completed
- Unusual traffic patterns

### Logging

**Levels**:
- ERROR: Application errors
- WARN: Potential issues
- INFO: Important events
- DEBUG: Detailed diagnostics

**Retention**:
- ERROR/WARN: 30 days
- INFO: 7 days
- DEBUG: 1 day (staging only)

**Centralization**:
- Platform-provided logging
- Optional: External service (Datadog, New Relic)

### Health Checks

**Endpoints**:
- `/health` - Basic health
- `/health/db` - Database connectivity
- `/health/redis` - Redis connectivity

**Frequency**:
- Internal: Every 10s
- External: Every 30s

**Timeout**: 5s

## Cost Optimization

### Free Tier Limits

**Render**:
- 750 hours/month per service
- Sleep after 15 min inactivity

**Railway**:
- $5 credit/month
- ~500 hours runtime

**Fly.io**:
- 3 VMs free
- 3GB storage

### Cost Reduction Strategies

1. Use auto-sleep for non-critical services
2. Optimize Docker images (smaller = faster deploys)
3. Cache aggressively in Redis
4. Compress static assets
5. Use CDN for frontend
6. Monitor and eliminate waste

### Estimated Monthly Costs

**Free Tier**: $0
**Paid Tier** (after scaling):
- Database: $7-15
- Redis: $5-10
- Compute: $10-25
- Total: $22-50/month
