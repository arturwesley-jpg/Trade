# Operations Guide

Comprehensive operations guide for the Crypto Trading Bot Pro platform.

## Table of Contents

- [System Monitoring](#system-monitoring)
- [Log Aggregation](#log-aggregation)
- [Backup and Recovery](#backup-and-recovery)
- [Scaling Guidelines](#scaling-guidelines)
- [Troubleshooting](#troubleshooting)
- [Performance Tuning](#performance-tuning)
- [Incident Response](#incident-response)
- [Maintenance Procedures](#maintenance-procedures)

---

## System Monitoring

### Monitoring Stack

The platform uses a comprehensive monitoring stack:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Alertmanager**: Alert routing and notifications
- **Loki**: Log aggregation
- **Jaeger**: Distributed tracing

### Key Metrics to Monitor

#### Application Metrics

**API Performance:**
```promql
# Request rate
rate(http_requests_total{job="trading-bot-api"}[5m])

# Error rate
rate(http_requests_total{job="trading-bot-api",status=~"5.."}[5m])

# Response time (95th percentile)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Active connections
http_connections_active
```

**Trading Metrics:**
```promql
# Trade execution rate
rate(trade_execution_total[5m])

# Trade execution latency
histogram_quantile(0.95, rate(trade_execution_duration_seconds_bucket[5m]))

# Active positions
trading_positions_active

# PnL tracking
trading_pnl_total
```

**WebSocket Metrics:**
```promql
# Active WebSocket connections
websocket_connections_active

# Message rate
rate(websocket_messages_total[5m])

# Disconnection rate
rate(websocket_disconnections_total[5m])
```

#### Infrastructure Metrics

**CPU Usage:**
```promql
# CPU usage percentage
rate(process_cpu_seconds_total[5m]) * 100

# System CPU
100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

**Memory Usage:**
```promql
# Application memory
process_resident_memory_bytes

# Memory usage percentage
(process_resident_memory_bytes / node_memory_MemTotal_bytes) * 100

# Heap usage
nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes * 100
```

**Database Metrics:**
```promql
# Active connections
database_connections_active

# Connection pool usage
database_connections_active / database_connections_max * 100

# Query duration
histogram_quantile(0.95, rate(database_query_duration_seconds_bucket[5m]))

# Slow queries
rate(database_slow_queries_total[5m])
```

**Redis Metrics:**
```promql
# Memory usage
redis_memory_used_bytes / redis_memory_max_bytes * 100

# Hit rate
rate(redis_keyspace_hits_total[5m]) / 
(rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m]))

# Connected clients
redis_connected_clients
```

### Grafana Dashboards

#### 1. Trading Bot Overview Dashboard

Key panels:
- Request rate and error rate
- Response time (p50, p95, p99)
- Active positions and trades
- System resources (CPU, memory, disk)
- Database and Redis health

#### 2. API Performance Dashboard

Key panels:
- Endpoint latency breakdown
- Request volume by endpoint
- Error rate by endpoint
- Rate limiting metrics
- WebSocket connection stats

#### 3. Trading Metrics Dashboard

Key panels:
- Trade execution rate
- Win rate and PnL
- Position distribution
- Risk metrics
- Signal generation rate

#### 4. Infrastructure Dashboard

Key panels:
- CPU and memory usage
- Disk I/O and network
- Container resource usage
- Pod status (Kubernetes)
- Node health

### Setting Up Dashboards

1. **Import pre-configured dashboards:**

```bash
# Copy dashboard JSON files
cp infrastructure/monitoring/grafana/dashboards/*.json /var/lib/grafana/dashboards/

# Or import via Grafana UI
# Dashboards → Import → Upload JSON file
```

2. **Configure data sources:**

```bash
# Prometheus
URL: http://prometheus:9090

# Loki
URL: http://loki:3100

# Jaeger
URL: http://jaeger:16686
```

### Alert Configuration

#### Critical Alerts

**Service Down:**
```yaml
- alert: ServiceDown
  expr: up{job="trading-bot-api"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Service is down"
    description: "{{ $labels.instance }} has been down for more than 1 minute"
```

**High Error Rate:**
```yaml
- alert: HighErrorRate
  expr: |
    rate(http_requests_total{status=~"5.."}[5m]) / 
    rate(http_requests_total[5m]) > 0.05
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "High error rate detected"
    description: "Error rate is {{ $value | humanizePercentage }}"
```

**Database Connection Failure:**
```yaml
- alert: DatabaseConnectionFailure
  expr: rate(database_connection_errors_total[5m]) > 0
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "Database connection failures"
    description: "Error rate: {{ $value }} errors/sec"
```

#### Warning Alerts

**High CPU Usage:**
```yaml
- alert: HighCPUUsage
  expr: rate(process_cpu_seconds_total[5m]) * 100 > 80
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "High CPU usage"
    description: "CPU usage is {{ $value }}%"
```

**High Memory Usage:**
```yaml
- alert: HighMemoryUsage
  expr: |
    (process_resident_memory_bytes / node_memory_MemTotal_bytes) * 100 > 80
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "High memory usage"
    description: "Memory usage is {{ $value }}%"
```

**Slow Response Time:**
```yaml
- alert: SlowResponseTime
  expr: |
    histogram_quantile(0.95, 
      rate(http_request_duration_seconds_bucket[5m])
    ) > 1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Slow API response time"
    description: "95th percentile is {{ $value }}s"
```

### Alert Routing

Configure Alertmanager to route alerts to appropriate channels:

```yaml
# infrastructure/monitoring/alertmanager/alertmanager.yml
route:
  receiver: 'default'
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  
  routes:
    # Critical alerts to PagerDuty and Telegram
    - match:
        severity: critical
      receiver: 'critical-alerts'
      continue: true
    
    # Warning alerts to Telegram only
    - match:
        severity: warning
      receiver: 'warning-alerts'

receivers:
  - name: 'default'
    telegram_configs:
      - bot_token: 'YOUR_BOT_TOKEN'
        chat_id: YOUR_CHAT_ID
        parse_mode: 'HTML'
  
  - name: 'critical-alerts'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_KEY'
    telegram_configs:
      - bot_token: 'YOUR_BOT_TOKEN'
        chat_id: YOUR_CRITICAL_CHAT_ID
        parse_mode: 'HTML'
  
  - name: 'warning-alerts'
    telegram_configs:
      - bot_token: 'YOUR_BOT_TOKEN'
        chat_id: YOUR_WARNING_CHAT_ID
        parse_mode: 'HTML'
```

---

## Log Aggregation

### Logging Architecture

The platform uses structured logging with multiple levels:

- **ERROR**: Critical errors requiring immediate attention
- **WARN**: Warning conditions that should be reviewed
- **INFO**: Informational messages about normal operations
- **DEBUG**: Detailed debugging information

### Log Collection with Loki

#### 1. Deploy Loki Stack

```bash
docker-compose -f infrastructure/monitoring/docker-compose.logging.yml up -d
```

Services:
- **Loki**: Log aggregation server
- **Promtail**: Log shipper
- **Grafana**: Log visualization

#### 2. Configure Promtail

```yaml
# infrastructure/monitoring/promtail-config.yml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.*)'
        target_label: 'container'
      - source_labels: ['__meta_docker_container_log_stream']
        target_label: 'stream'
```

#### 3. Query Logs in Grafana

**LogQL Examples:**

```logql
# All errors from API
{app="trade-api"} |= "error"

# Parse JSON logs and filter by level
{app="trade-api"} | json | level="error"

# Trade execution logs
{app="trade-api"} | json | msg=~"trade.*"

# Slow queries
{app="trade-api"} | json | duration > 1000

# WebSocket disconnections
{app="trade-api"} |= "websocket" |= "disconnect"

# Rate of errors per minute
rate({app="trade-api"} |= "error" [1m])
```

### Application Logging

#### Log Format

All logs use structured JSON format:

```json
{
  "timestamp": "2026-05-05T12:00:00.000Z",
  "level": "info",
  "msg": "Trade executed successfully",
  "tradeId": "trade_123",
  "symbol": "BTC-USDT",
  "side": "LONG",
  "price": 65000,
  "quantity": 0.1,
  "userId": "user_456",
  "duration": 150
}
```

#### Log Retention

- **Production**: 30 days
- **Staging**: 14 days
- **Development**: 7 days

Configure in Loki:

```yaml
# loki-config.yml
limits_config:
  retention_period: 720h  # 30 days

table_manager:
  retention_deletes_enabled: true
  retention_period: 720h
```

### Log Analysis

#### Common Log Queries

**1. Error Analysis:**
```bash
# Top 10 error messages
{app="trade-api"} | json | level="error" | line_format "{{.msg}}" | count by (msg) | sort desc | limit 10

# Errors by endpoint
{app="trade-api"} | json | level="error" | count by (endpoint)
```

**2. Performance Analysis:**
```bash
# Slow requests (>1s)
{app="trade-api"} | json | duration > 1000 | line_format "{{.endpoint}} {{.duration}}ms"

# Average response time by endpoint
avg_over_time({app="trade-api"} | json | unwrap duration [5m]) by (endpoint)
```

**3. User Activity:**
```bash
# Requests by user
{app="trade-api"} | json | count by (userId)

# Failed login attempts
{app="trade-api"} | json | endpoint="/auth/login" | status="401"
```

---

## Backup and Recovery

### Database Backup

#### Automated Backups

```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/trade_db_$TIMESTAMP.sql.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

# Dump database
pg_dump $DATABASE_URL | gzip > $BACKUP_FILE

# Upload to S3 (optional)
aws s3 cp $BACKUP_FILE s3://your-bucket/backups/

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
```

#### Schedule Backups

```bash
# Add to crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * /path/to/scripts/backup.sh

# Hourly backup during trading hours (9 AM - 5 PM)
0 9-17 * * * /path/to/scripts/backup.sh
```

#### Backup Verification

```bash
#!/bin/bash
# scripts/verify-backup.sh

BACKUP_FILE=$1

# Test restore to temporary database
createdb trade_db_test
gunzip -c $BACKUP_FILE | psql trade_db_test

# Verify data
psql trade_db_test -c "SELECT COUNT(*) FROM users;"
psql trade_db_test -c "SELECT COUNT(*) FROM trades;"

# Cleanup
dropdb trade_db_test

echo "Backup verification completed"
```

### Recovery Procedures

#### Full Database Restore

```bash
#!/bin/bash
# scripts/restore.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore.sh <backup_file>"
  exit 1
fi

# Stop services
docker-compose stop api worker telegram-bot

# Drop and recreate database
dropdb trade_db
createdb trade_db

# Restore from backup
gunzip -c $BACKUP_FILE | psql trade_db

# Start services
docker-compose start api worker telegram-bot

echo "Restore completed"
```

#### Point-in-Time Recovery

```bash
# Enable WAL archiving in PostgreSQL
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /backups/wal/%f'

# Restore to specific point in time
pg_restore --target-time='2026-05-05 12:00:00' backup.sql
```

### Redis Backup

#### RDB Snapshots

```bash
# Manual snapshot
redis-cli -a $REDIS_PASSWORD SAVE

# Background snapshot
redis-cli -a $REDIS_PASSWORD BGSAVE

# Configure automatic snapshots
# redis.conf
save 900 1      # After 900 sec if at least 1 key changed
save 300 10     # After 300 sec if at least 10 keys changed
save 60 10000   # After 60 sec if at least 10000 keys changed
```

#### AOF (Append-Only File)

```bash
# Enable AOF
# redis.conf
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec

# Rewrite AOF
redis-cli -a $REDIS_PASSWORD BGREWRITEAOF
```

### Backup Storage

#### Local Storage

```bash
# Backup directory structure
/backups/
├── postgres/
│   ├── trade_db_20260505_020000.sql.gz
│   ├── trade_db_20260504_020000.sql.gz
│   └── ...
├── redis/
│   ├── dump_20260505_020000.rdb
│   └── ...
└── logs/
    ├── backup_20260505.log
    └── ...
```

#### Cloud Storage (S3)

```bash
# Upload to S3
aws s3 sync /backups/ s3://your-bucket/backups/ \
  --storage-class STANDARD_IA \
  --exclude "*" \
  --include "*.sql.gz" \
  --include "*.rdb"

# Lifecycle policy (delete after 90 days)
aws s3api put-bucket-lifecycle-configuration \
  --bucket your-bucket \
  --lifecycle-configuration file://lifecycle.json
```

---

## Scaling Guidelines

### Horizontal Scaling

#### API Service

**When to scale:**
- CPU usage > 70% for 10+ minutes
- Response time p95 > 1s
- Request rate > 1000 req/s per instance

**Scaling strategy:**

```bash
# Docker Compose
docker-compose up -d --scale api=3

# Kubernetes
kubectl scale deployment trade-api --replicas=5 -n trading-bot

# Or use HPA (automatic)
kubectl autoscale deployment trade-api \
  --cpu-percent=70 \
  --min=2 \
  --max=10 \
  -n trading-bot
```

#### Worker Service

**When to scale:**
- Market data lag > 5 seconds
- CPU usage > 75%
- Message queue backlog growing

**Scaling strategy:**

```bash
# Scale workers
docker-compose up -d --scale worker=3

# Kubernetes
kubectl scale deployment trade-worker --replicas=3 -n trading-bot
```

### Vertical Scaling

#### Increase Resources

**Docker Compose:**

```yaml
# docker-compose.prod.yml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'      # Increased from 1
          memory: 2G     # Increased from 1G
        reservations:
          cpus: '1'
          memory: 1G
```

**Kubernetes:**

```yaml
# api-deployment.yaml
resources:
  requests:
    cpu: 1000m        # Increased from 500m
    memory: 1Gi       # Increased from 512Mi
  limits:
    cpu: 2000m        # Increased from 1000m
    memory: 2Gi       # Increased from 1Gi
```

### Database Scaling

#### Read Replicas

```yaml
# docker-compose.prod.yml
services:
  postgres-primary:
    image: postgres:16-alpine
    environment:
      POSTGRES_REPLICATION_MODE: master
  
  postgres-replica:
    image: postgres:16-alpine
    environment:
      POSTGRES_REPLICATION_MODE: slave
      POSTGRES_MASTER_HOST: postgres-primary
```

#### Connection Pooling

```typescript
// Increase pool size
const pool = new Pool({
  max: 50,              // Increased from 20
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
```

### Redis Scaling

#### Redis Cluster

```bash
# Create Redis cluster
redis-cli --cluster create \
  127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 \
  127.0.0.1:7003 127.0.0.1:7004 127.0.0.1:7005 \
  --cluster-replicas 1
```

#### Redis Sentinel (High Availability)

```yaml
# docker-compose.redis-ha.yml
services:
  redis-master:
    image: redis:7-alpine
  
  redis-slave-1:
    image: redis:7-alpine
    command: redis-server --slaveof redis-master 6379
  
  redis-sentinel-1:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
```

### Load Balancing

#### Nginx Load Balancer

```nginx
# nginx.conf
upstream api_backend {
    least_conn;
    server api-1:4000 weight=1 max_fails=3 fail_timeout=30s;
    server api-2:4000 weight=1 max_fails=3 fail_timeout=30s;
    server api-3:4000 weight=1 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    
    location / {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

#### Kubernetes Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: trade-api
  namespace: trading-bot
spec:
  type: LoadBalancer
  selector:
    app: trade-api
  ports:
    - protocol: TCP
      port: 80
      targetPort: 4000
  sessionAffinity: ClientIP
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. High Memory Usage

**Symptoms:**
- Memory usage > 90%
- OOM (Out of Memory) kills
- Slow response times

**Diagnosis:**
```bash
# Check memory usage
docker stats

# Check Node.js heap
curl http://localhost:4000/metrics | grep nodejs_heap

# Analyze memory leaks
node --inspect apps/api/dist/server.js
```

**Solutions:**
```bash
# Increase memory limit
docker-compose up -d --scale api=0
# Edit docker-compose.yml to increase memory
docker-compose up -d --scale api=2

# Enable garbage collection logging
NODE_OPTIONS="--max-old-space-size=2048 --trace-gc" npm start

# Restart service
docker-compose restart api
```

#### 2. Database Connection Pool Exhausted

**Symptoms:**
- "Connection pool exhausted" errors
- Slow database queries
- Timeouts

**Diagnosis:**
```bash
# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check connection pool metrics
curl http://localhost:4000/metrics | grep database_connections
```

**Solutions:**
```bash
# Increase pool size (apps/api/src/db.ts)
max: 50  # Increase from 20

# Kill idle connections
psql $DATABASE_URL -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE state = 'idle' 
  AND state_change < now() - interval '10 minutes';
"

# Restart API
docker-compose restart api
```

#### 3. Redis Connection Issues

**Symptoms:**
- "Redis connection refused" errors
- Cache misses
- Slow performance

**Diagnosis:**
```bash
# Check Redis status
redis-cli -a $REDIS_PASSWORD ping

# Check connections
redis-cli -a $REDIS_PASSWORD CLIENT LIST

# Check memory
redis-cli -a $REDIS_PASSWORD INFO memory
```

**Solutions:**
```bash
# Restart Redis
docker-compose restart redis

# Clear cache if corrupted
redis-cli -a $REDIS_PASSWORD FLUSHALL

# Increase max connections
# redis.conf
maxclients 10000
```

#### 4. WebSocket Disconnections

**Symptoms:**
- Frequent WebSocket disconnects
- "Connection closed" errors
- Missing real-time updates

**Diagnosis:**
```bash
# Check WebSocket metrics
curl http://localhost:4000/ws/stats

# Check logs
docker-compose logs -f api | grep websocket

# Monitor connections
watch -n 1 'curl -s http://localhost:4000/metrics | grep websocket_connections'
```

**Solutions:**
```bash
# Increase timeout
# apps/api/src/websocket.ts
pingInterval: 30000  # Increase from 15000

# Check reverse proxy timeout
# nginx.conf
proxy_read_timeout 300s;

# Restart API
docker-compose restart api
```

#### 5. High API Latency

**Symptoms:**
- Response time > 1s
- Slow page loads
- Timeouts

**Diagnosis:**
```bash
# Check response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:4000/health

# Check slow queries
psql $DATABASE_URL -c "
  SELECT query, mean_exec_time, calls 
  FROM pg_stat_statements 
  ORDER BY mean_exec_time DESC 
  LIMIT 10;
"

# Profile API
curl http://localhost:4000/metrics | grep http_request_duration
```

**Solutions:**
```bash
# Add database indexes
psql $DATABASE_URL -c "CREATE INDEX idx_trades_user_id ON trades(user_id);"

# Enable query caching
# Add Redis caching layer

# Scale API horizontally
docker-compose up -d --scale api=3

# Optimize queries
# Review and optimize slow queries
```

#### 6. Trade Execution Failures

**Symptoms:**
- "Trade execution failed" errors
- Orders not filled
- Position mismatches

**Diagnosis:**
```bash
# Check trade logs
docker-compose logs -f api | grep "trade execution"

# Check exchange connectivity
curl http://localhost:4000/market/providers/status

# Check audit logs
curl http://localhost:4000/audit | jq '.[] | select(.type=="trade_execution_failed")'
```

**Solutions:**
```bash
# Verify API keys
# Check .env file for correct exchange credentials

# Check rate limits
# Reduce trading frequency if hitting limits

# Enable retry logic
# Already implemented in PaperExecutor

# Check paper trading mode
# Ensure PAPER_TRADING_ONLY=true for testing
```

#### 7. Disk Space Issues

**Symptoms:**
- "No space left on device" errors
- Database write failures
- Log rotation failures

**Diagnosis:**
```bash
# Check disk usage
df -h

# Check largest directories
du -sh /* | sort -h

# Check Docker disk usage
docker system df
```

**Solutions:**
```bash
# Clean Docker resources
docker system prune -a --volumes

# Rotate logs
docker-compose logs --tail=1000 > /dev/null

# Clean old backups
find /backups -name "*.sql.gz" -mtime +30 -delete

# Increase disk size (cloud provider)
# Or add additional volume
```

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# Set log level to debug
LOG_LEVEL=debug docker-compose up -d

# View debug logs
docker-compose logs -f api | grep DEBUG

# Enable Node.js debugging
NODE_OPTIONS="--inspect=0.0.0.0:9229" npm start

# Connect with Chrome DevTools
chrome://inspect
```

---

## Performance Tuning

### Application Optimization

#### 1. Node.js Performance

```bash
# Increase heap size
NODE_OPTIONS="--max-old-space-size=2048"

# Enable V8 optimizations
NODE_OPTIONS="--optimize-for-size --max-old-space-size=2048"

# Use production mode
NODE_ENV=production

# Enable clustering (apps/api/src/cluster.ts)
CLUSTER_WORKERS=4
```

#### 2. Database Optimization

**Query Optimization:**
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_created_at ON trades(created_at);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_positions_user_id ON positions(user_id);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM trades WHERE user_id = 'user_123';

-- Update statistics
ANALYZE trades;
VACUUM ANALYZE;
```

**Connection Pooling:**
```typescript
// Optimize pool configuration
const pool = new Pool({
  max: 50,
  min: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});
```

**Prepared Statements:**
```typescript
// Use prepared statements for repeated queries
const query = {
  name: 'fetch-user-trades',
  text: 'SELECT * FROM trades WHERE user_id = $1',
  values: [userId],
};
```

#### 3. Redis Optimization

```bash
# Optimize memory usage
redis-cli -a $REDIS_PASSWORD CONFIG SET maxmemory-policy allkeys-lru

# Enable compression
redis-cli -a $REDIS_PASSWORD CONFIG SET list-compress-depth 1

# Optimize persistence
# redis.conf
save 900 1
save 300 10
save 60 10000
appendfsync everysec
```

**Caching Strategy:**
```typescript
// Cache frequently accessed data
const CACHE_TTL = {
  marketData: 1,      // 1 second
  userProfile: 300,   // 5 minutes
  positions: 10,      // 10 seconds
  config: 3600,       // 1 hour
};

// Implement cache-aside pattern
async function getUserProfile(userId: string) {
  const cached = await redis.get(`user:${userId}`);
  if (cached) return JSON.parse(cached);
  
  const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  await redis.setex(`user:${userId}`, CACHE_TTL.userProfile, JSON.stringify(user));
  
  return user;
}
```

#### 4. API Optimization

**Response Compression:**
```typescript
// Enable gzip compression
import compression from '@fastify/compress';

app.register(compression, {
  threshold: 1024,
  encodings: ['gzip', 'deflate'],
});
```

**Rate Limiting:**
```typescript
// Optimize rate limiting
import rateLimit from '@fastify/rate-limit';

app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  cache: 10000,
  redis: redisClient,
});
```

**Pagination:**
```typescript
// Implement cursor-based pagination
app.get('/trades', async (req, res) => {
  const { cursor, limit = 50 } = req.query;
  
  const trades = await db.query(
    'SELECT * FROM trades WHERE id > $1 ORDER BY id LIMIT $2',
    [cursor || 0, limit]
  );
  
  return {
    data: trades,
    nextCursor: trades[trades.length - 1]?.id,
  };
});
```

### Infrastructure Optimization

#### 1. Docker Optimization

**Multi-stage Builds:**
```dockerfile
# Use multi-stage builds to reduce image size
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
USER node
CMD ["node", "dist/server.js"]
```

### Monthly Checks

- [ ] Security audit
- [ ] Performance review
- [ ] Cost optimization
- [ ] Disaster recovery drill

- [ ] Review incident reports
- [ ] Update documentation
- [ ] Team training review

---

## Emergency Contacts

### On-Call Rotation

- **Primary On-Call**: Check PagerDuty schedule
- **Secondary On-Call**: Check PagerDuty schedule
- **Escalation**: Engineering Manager

### External Contacts

- **Cloud Provider Support**: [Support Portal]
- **Database Support**: [Support Email]
- **Security Team**: security@yourdomain.com

---

## Additional Resources

- [DEPLOYMENT.md](../../DEPLOYMENT.md) - Deployment procedures
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - API reference
- [SECURITY.md](SECURITY.md) - Security guidelines
- [Grafana Dashboards](http://grafana.yourdomain.com)
- [Prometheus](http://prometheus.yourdomain.com)
- [Alertmanager](http://alertmanager.yourdomain.com)
