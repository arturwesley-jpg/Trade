# Deployment Guide

Complete deployment guide for the Crypto Trading Bot Pro platform.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Health Checks](#health-checks)
- [Monitoring Setup](#monitoring-setup)

---

## Prerequisites

### Required Software

- **Node.js**: v18.x or higher
- **PostgreSQL**: v16.x or higher
- **Redis**: v7.x or higher
- **Docker**: v24.x or higher
- **Docker Compose**: v2.x or higher
- **kubectl**: v1.28.x or higher (for Kubernetes)
- **Helm**: v3.x or higher (optional, for Kubernetes)

### System Requirements

**Development Environment:**
- CPU: 2+ cores
- RAM: 4GB minimum, 8GB recommended
- Disk: 10GB free space

**Production Environment:**
- CPU: 4+ cores
- RAM: 8GB minimum, 16GB recommended
- Disk: 50GB+ free space
- Network: Stable internet connection for exchange APIs

---

## Environment Variables

### Core Configuration

Create a `.env` file in the root directory. Use `.env.example` as a template:

```bash
cp .env.example .env
```

### Required Variables

#### Application Settings
```bash
APP_ENV=production                    # Environment: development, staging, production
APP_MODE=paper                        # Trading mode: paper, demo, live
SAFE_MODE=true                        # Enable safety checks
PAPER_TRADING_ONLY=true              # Restrict to paper trading only
FEATURE_REAL_TRADING=false           # Enable real trading (use with caution)
```

#### API Configuration
```bash
API_HOST=0.0.0.0                     # API server host
API_PORT=4000                        # API server port
WEB_ORIGIN=https://yourdomain.com    # CORS origin for web frontend
```

#### Database Configuration
```bash
DATABASE_URL=postgresql://trade_user:STRONG_PASSWORD@localhost:5432/trade_db
POSTGRES_USER=trade_user
POSTGRES_PASSWORD=STRONG_PASSWORD    # Change this!
POSTGRES_DB=trade_db
POSTGRES_PORT=5432
```

#### Redis Configuration
```bash
REDIS_URL=redis://:REDIS_PASSWORD@localhost:6379
REDIS_PASSWORD=STRONG_REDIS_PASSWORD # Change this!
REDIS_PORT=6379
```

#### Authentication & Security
```bash
JWT_ACCESS_SECRET=GENERATE_RANDOM_64_CHAR_STRING   # openssl rand -hex 32
JWT_REFRESH_SECRET=GENERATE_RANDOM_64_CHAR_STRING  # openssl rand -hex 32
ADMIN_API_TOKEN=GENERATE_RANDOM_32_CHAR_STRING     # openssl rand -hex 16
```

#### Exchange API Keys
```bash
# Binance
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret

# Bybit
BYBIT_API_KEY=your_bybit_api_key
BYBIT_API_SECRET=your_bybit_api_secret

# OKX
OKX_API_KEY=your_okx_api_key
OKX_API_SECRET=your_okx_api_secret

# Kraken
KRAKEN_API_KEY=your_kraken_api_key
KRAKEN_API_SECRET=your_kraken_api_secret
```

#### Market Data Configuration
```bash
MARKET_PROVIDER_PRIMARY=binance
MARKET_PROVIDER_FALLBACK_1=bybit
MARKET_PROVIDER_FALLBACK_2=okx
MARKET_PROVIDER_FALLBACK_3=kraken
MARKET_SYMBOLS=BTC-USDT,ETH-USDT
USE_SIMULATED_MARKET=false           # Use real market data
MARKET_POLL_INTERVAL_MS=1000
MAX_MARKET_TICKS=1000
PROVIDER_STALE_AFTER_MS=10000
```

#### Trading Configuration
```bash
# Paper trading fees (percentages)
PAPER_MAKER_FEE_PCT=0.075
PAPER_TAKER_FEE_PCT=0.075
PAPER_SLIPPAGE_PCT=0.05

# Risk limits
MAX_POSITIONS=5
MAX_MARGIN_PER_POSITION=100
TOTAL_MARGIN_LIMIT=500
POSITION_MONITOR_ENABLED=true
```

#### Telegram Bot
```bash
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321
TELEGRAM_ADMIN_IDS=123456789
TELEGRAM_RATE_LIMIT_MAX=20
TELEGRAM_RATE_LIMIT_WINDOW_MS=60000
```

#### Logging & Monitoring
```bash
LOG_LEVEL=info                       # debug, info, warn, error
DATA_DIR=/app/data
TRADE_STORE_PATH=/app/data/trade-store.json
```

### Generating Secrets

Generate secure random secrets:

```bash
# JWT secrets (64 characters)
openssl rand -hex 32

# Admin API token (32 characters)
openssl rand -hex 16

# Redis password
openssl rand -base64 32
```

---

## Database Setup

### Local PostgreSQL Setup

1. **Install PostgreSQL 16:**

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-16 postgresql-contrib

# macOS
brew install postgresql@16
```

2. **Create Database and User:**

```bash
sudo -u postgres psql

CREATE USER trade_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE trade_db OWNER trade_user;
GRANT ALL PRIVILEGES ON DATABASE trade_db TO trade_user;
\q
```

3. **Run Migrations:**

```bash
npm run migrate
```

### Redis Setup

1. **Install Redis:**

```bash
# Ubuntu/Debian
sudo apt install redis-server

# macOS
brew install redis
```

2. **Configure Redis:**

Edit `/etc/redis/redis.conf`:

```conf
requirepass your_redis_password
maxmemory 512mb
maxmemory-policy allkeys-lru
appendonly yes
```

3. **Start Redis:**

```bash
sudo systemctl start redis
sudo systemctl enable redis
```

---

## Docker Deployment

### Development Environment

1. **Start all services:**

```bash
docker-compose -f docker-compose.dev.yml up -d
```

2. **View logs:**

```bash
docker-compose -f docker-compose.dev.yml logs -f
```

3. **Stop services:**

```bash
docker-compose -f docker-compose.dev.yml down
```

### Production Environment

1. **Build images:**

```bash
# Build all images
docker-compose -f docker-compose.prod.yml build

# Or build individually
docker build -t trade-api:latest -f apps/api/Dockerfile .
docker build -t trade-web:latest -f apps/web/Dockerfile .
docker build -t trade-worker:latest -f apps/worker/Dockerfile .
docker build -t trade-telegram-bot:latest -f apps/telegram-bot/Dockerfile .
```

2. **Configure environment:**

Create `.env.production`:

```bash
cp .env.example .env.production
# Edit .env.production with production values
```

3. **Deploy:**

```bash
# Start all services
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f api
```

4. **Run database migrations:**

```bash
docker-compose -f docker-compose.prod.yml exec api npm run migrate
```

5. **Health check:**

```bash
curl http://localhost:4000/health
```

### Docker Compose Services

The production stack includes:

- **postgres**: PostgreSQL 16 database
- **redis**: Redis 7 cache
- **api**: Fastify REST API server
- **worker**: Market data worker
- **telegram-bot**: Telegram bot interface
- **web**: React frontend (Nginx)

### Resource Limits

Default resource limits in `docker-compose.prod.yml`:

| Service | CPU Limit | Memory Limit | CPU Reserved | Memory Reserved |
|---------|-----------|--------------|--------------|-----------------|
| API | 1 core | 1GB | 0.5 core | 512MB |
| Worker | 1 core | 1GB | 0.5 core | 512MB |
| Telegram | 0.5 core | 512MB | 0.25 core | 256MB |
| Web | 0.5 core | 256MB | 0.25 core | 128MB |
| PostgreSQL | 1 core | 1GB | 0.5 core | 512MB |
| Redis | 0.5 core | 512MB | 0.25 core | 256MB |

---

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (v1.28+)
- kubectl configured
- Container registry (e.g., Docker Hub, GHCR, ECR)

### 1. Build and Push Images

```bash
# Set registry
export REGISTRY=ghcr.io/your-org
export IMAGE_TAG=v1.0.0

# Build and push
docker build -t $REGISTRY/trade-api:$IMAGE_TAG -f apps/api/Dockerfile .
docker push $REGISTRY/trade-api:$IMAGE_TAG

docker build -t $REGISTRY/trade-web:$IMAGE_TAG -f apps/web/Dockerfile .
docker push $REGISTRY/trade-web:$IMAGE_TAG

docker build -t $REGISTRY/trade-worker:$IMAGE_TAG -f apps/worker/Dockerfile .
docker push $REGISTRY/trade-worker:$IMAGE_TAG

docker build -t $REGISTRY/trade-telegram-bot:$IMAGE_TAG -f apps/telegram-bot/Dockerfile .
docker push $REGISTRY/trade-telegram-bot:$IMAGE_TAG
```

### 2. Create Namespace

```bash
kubectl create namespace trading-bot
kubectl config set-context --current --namespace=trading-bot
```

### 3. Create Secrets

```bash
# Create secrets from .env file
kubectl create secret generic trade-secrets \
  --from-literal=database-url="postgresql://user:pass@postgres:5432/trade_db" \
  --from-literal=redis-url="redis://:password@redis:6379" \
  --from-literal=jwt-access-secret="$(openssl rand -hex 32)" \
  --from-literal=jwt-refresh-secret="$(openssl rand -hex 32)" \
  --from-literal=admin-api-token="$(openssl rand -hex 16)" \
  --from-literal=binance-api-key="your_key" \
  --from-literal=binance-api-secret="your_secret" \
  -n trading-bot
```

### 4. Create ConfigMap

```bash
kubectl create configmap trade-config \
  --from-literal=APP_ENV=production \
  --from-literal=APP_MODE=paper \
  --from-literal=SAFE_MODE=true \
  --from-literal=LOG_LEVEL=info \
  -n trading-bot
```

### 5. Deploy Infrastructure

```bash
# Apply namespace
kubectl apply -f infrastructure/k8s/namespace.yaml

# Deploy API
kubectl apply -f infrastructure/k8s/api-deployment.yaml

# Deploy Worker
kubectl apply -f infrastructure/k8s/worker-deployment.yaml

# Deploy HPA (Horizontal Pod Autoscaler)
kubectl apply -f infrastructure/k8s/api-hpa.yaml
kubectl apply -f infrastructure/k8s/worker-hpa.yaml
```

### 6. Verify Deployment

```bash
# Check pods
kubectl get pods -n trading-bot

# Check services
kubectl get svc -n trading-bot

# Check HPA
kubectl get hpa -n trading-bot

# View logs
kubectl logs -f deployment/trade-api -n trading-bot
```

### 7. Expose Services

```bash
# Port forward for testing
kubectl port-forward svc/trade-api 4000:4000 -n trading-bot

# Or create Ingress (example)
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: trade-ingress
  namespace: trading-bot
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.yourdomain.com
    secretName: trade-tls
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: trade-api
            port:
              number: 4000
EOF
```

### Auto-Scaling Configuration

The platform uses Horizontal Pod Autoscaler (HPA) for automatic scaling:

**API Service:**
- Min replicas: 2
- Max replicas: 10
- Target CPU: 70%
- Target Memory: 80%

**Worker Service:**
- Min replicas: 1
- Max replicas: 5
- Target CPU: 75%
- Target Memory: 85%

### Rolling Updates

```bash
# Update image
kubectl set image deployment/trade-api \
  api=$REGISTRY/trade-api:$NEW_TAG \
  -n trading-bot

# Check rollout status
kubectl rollout status deployment/trade-api -n trading-bot

# Rollback if needed
kubectl rollout undo deployment/trade-api -n trading-bot
```

---

## CI/CD Pipeline

### GitHub Actions

The project includes a CI/CD pipeline at `.github/workflows/ci-parallel.yml`.

#### Pipeline Stages

1. **Build & Test** (parallel)
   - Lint code
   - Type check
   - Run unit tests
   - Run integration tests
   - Generate coverage reports

2. **Build Docker Images** (parallel)
   - Build API image
   - Build Web image
   - Build Worker image
   - Build Telegram Bot image

3. **Push to Registry**
   - Tag images with commit SHA and version
   - Push to container registry

4. **Deploy to Staging**
   - Deploy to staging environment
   - Run smoke tests
   - Run E2E tests

5. **Deploy to Production** (manual approval)
   - Deploy to production
   - Run smoke tests
   - Monitor metrics

#### Setup Instructions

1. **Configure GitHub Secrets:**

Go to repository Settings → Secrets and add:

```
DOCKER_REGISTRY_URL=ghcr.io
DOCKER_REGISTRY_USERNAME=your_username
DOCKER_REGISTRY_TOKEN=your_token
KUBE_CONFIG_STAGING=base64_encoded_kubeconfig
KUBE_CONFIG_PRODUCTION=base64_encoded_kubeconfig
DATABASE_URL_STAGING=postgresql://...
DATABASE_URL_PRODUCTION=postgresql://...
```

2. **Trigger Deployment:**

```bash
# Push to main branch triggers staging deployment
git push origin main

# Create release tag for production
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

### Manual Deployment Script

Use the deployment script for manual deployments:

```bash
# Deploy to staging
./scripts/deploy.sh staging v1.0.0

# Deploy to production (requires confirmation)
./scripts/deploy.sh production v1.0.0

# Check deployment status
./scripts/deploy.sh status production

# Rollback if needed
./scripts/rollback.sh production
```

---

## Health Checks

### Health Check Endpoints

The API provides multiple health check endpoints:

#### 1. Basic Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-05-05T12:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

#### 2. Liveness Probe
```bash
GET /health/liveness
```

Returns 200 if the application is running.

#### 3. Readiness Probe
```bash
GET /health/readiness
```

Returns 200 if the application is ready to accept traffic. Checks:
- Database connection
- Redis connection
- Critical services status

#### 4. Detailed Health Check
```bash
GET /api/monitoring/health
```

Response:
```json
{
  "status": "healthy",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 5
    },
    "redis": {
      "status": "healthy",
      "responseTime": 2
    },
    "marketData": {
      "status": "healthy",
      "providers": ["binance", "bybit"]
    }
  }
}
```

### Kubernetes Health Probes

Configured in deployment manifests:

```yaml
livenessProbe:
  httpGet:
    path: /health/liveness
    port: 4000
  initialDelaySeconds: 60
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/readiness
    port: 4000
  initialDelaySeconds: 30
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3

startupProbe:
  httpGet:
    path: /health/liveness
    port: 4000
  initialDelaySeconds: 0
  periodSeconds: 5
  failureThreshold: 12
```

### Health Check Script

```bash
#!/bin/bash
# scripts/health-check.sh

API_URL=${1:-http://localhost:4000}

echo "Checking API health at $API_URL..."

# Basic health check
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/health)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ Health check passed"
  exit 0
else
  echo "✗ Health check failed (HTTP $HTTP_CODE)"
  exit 1
fi
```

---

## Monitoring Setup

### Prometheus

1. **Deploy Prometheus:**

```bash
docker-compose -f infrastructure/monitoring/docker-compose.yml up -d prometheus
```

2. **Access Prometheus UI:**

```
http://localhost:9090
```

3. **Key Metrics:**

- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request latency
- `process_cpu_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Memory usage
- `trade_execution_duration_seconds` - Trade execution time
- `websocket_connections_active` - Active WebSocket connections

### Grafana

1. **Deploy Grafana:**

```bash
docker-compose -f infrastructure/monitoring/docker-compose.yml up -d grafana
```

2. **Access Grafana:**

```
http://localhost:3001
Default credentials: admin/admin
```

3. **Import Dashboards:**

Pre-configured dashboards are available in `infrastructure/monitoring/grafana/dashboards/`:
- Trading Bot Overview
- API Performance
- System Resources
- Trading Metrics

### Alertmanager

1. **Configure Alerts:**

Edit `infrastructure/monitoring/alertmanager/alertmanager.yml`:

```yaml
route:
  receiver: 'telegram'
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h

receivers:
  - name: 'telegram'
    telegram_configs:
      - bot_token: 'YOUR_BOT_TOKEN'
        chat_id: YOUR_CHAT_ID
        parse_mode: 'HTML'
```

2. **Deploy Alertmanager:**

```bash
docker-compose -f infrastructure/monitoring/docker-compose.yml up -d alertmanager
```

### Logging with Loki

1. **Deploy Loki Stack:**

```bash
docker-compose -f infrastructure/monitoring/docker-compose.logging.yml up -d
```

2. **View Logs in Grafana:**

- Add Loki as data source in Grafana
- Use LogQL to query logs:

```logql
{app="trade-api"} |= "error"
{app="trade-api"} | json | level="error"
```

### Distributed Tracing

1. **Deploy Jaeger:**

```bash
docker-compose -f infrastructure/monitoring/docker-compose.tracing.yml up -d
```

2. **Access Jaeger UI:**

```
http://localhost:16686
```

### Quick Monitoring Setup

Deploy complete monitoring stack:

```bash
# Start all monitoring services
docker-compose \
  -f infrastructure/monitoring/docker-compose.yml \
  -f infrastructure/monitoring/docker-compose.logging.yml \
  -f infrastructure/monitoring/docker-compose.tracing.yml \
  up -d

# Verify services
docker-compose -f infrastructure/monitoring/docker-compose.yml ps
```

Access points:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001
- Alertmanager: http://localhost:9093
- Jaeger: http://localhost:16686

---

## Backup and Recovery

### Database Backup

```bash
# Manual backup
./scripts/backup.sh

# Automated daily backups (cron)
0 2 * * * /path/to/scripts/backup.sh
```

### Restore from Backup

```bash
./scripts/restore.sh /path/to/backup.sql
```

---

## Troubleshooting

### Common Issues

**1. Database Connection Failed**
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check connection
psql $DATABASE_URL -c "SELECT 1"
```

**2. Redis Connection Failed**
```bash
# Check Redis is running
docker-compose ps redis

# Test connection
redis-cli -a $REDIS_PASSWORD ping
```

**3. API Not Starting**
```bash
# Check logs
docker-compose logs -f api

# Check environment variables
docker-compose exec api env | grep DATABASE_URL
```

**4. High Memory Usage**
```bash
# Check container stats
docker stats

# Restart service
docker-compose restart api
```

### Support

For issues and questions:
- GitHub Issues: https://github.com/your-org/trade/issues
- Documentation: See `docs/` directory
- Logs: Check application logs in `/var/log/trade/`

---

## Security Checklist

Before deploying to production:

- [ ] Change all default passwords
- [ ] Generate new JWT secrets
- [ ] Configure firewall rules
- [ ] Enable SSL/TLS certificates
- [ ] Set up rate limiting
- [ ] Configure CORS properly
- [ ] Enable audit logging
- [ ] Set up backup automation
- [ ] Configure monitoring alerts
- [ ] Review security headers
- [ ] Enable WAF (Web Application Firewall)
- [ ] Restrict database access
- [ ] Use secrets management (e.g., Vault)
- [ ] Enable 2FA for admin accounts

---

## Next Steps

After deployment:

1. Review [OPERATIONS.md](docs/professional/OPERATIONS.md) for operational procedures
2. Check [API_DOCUMENTATION.md](docs/professional/API_DOCUMENTATION.md) for API reference
3. Read [SECURITY.md](docs/professional/SECURITY.md) for security best practices
4. See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines