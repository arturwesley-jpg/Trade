# Trading Bot - Deployment Guide

**Version**: Phase 7  
**Date**: 2026-05-05  
**Status**: Production Ready

---

## Prerequisites

### System Requirements
- Docker 20.10+
- Kubernetes 1.24+
- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### Required Credentials

#### GitHub
- Username: `arturwesley-jpg`
- SSH Key: `YOUR_GITHUB_TOKEN`

#### Render
- API Key: `YOUR_RENDER_API_KEY`

#### Vercel
- Token: `YOUR_VERCEL_TOKEN`

#### Telegram Bot
- Token: `YOUR_TELEGRAM_BOT_TOKEN`
- Allowed User ID: `274321499`
- API Base URL: `https://tradeb-5l5q.onrender.com`

---

## Step 1: Fix Disk Space Issue

Before deploying, resolve the disk space issue:

```bash
# Check disk usage
df -h /tmp

# Option 1: Clean temporary files
sudo rm -rf /tmp/claude-*
sudo rm -rf /tmp/*.tmp

# Option 2: Increase /tmp size
sudo mount -o remount,size=4G /tmp

# Option 3: Use different temp directory
export TMPDIR=/home/geen/tmp
mkdir -p $TMPDIR
```

---

## Step 2: Commit Changes to Git

```bash
cd /home/geen/Área\ de\ trabalho/Trade

# Verify changes
git status

# Stage all changes
git add -A

# Create commit
git commit -m "feat(phase-7): implement security hardening and advanced features

Comprehensive Phase 7 implementation including enterprise-grade security,
advanced deployment strategies, performance optimizations, automation
infrastructure, and testing frameworks.

Security Hardening:
- ModSecurity WAF with 19 custom rules (SQL injection, XSS, command injection)
- Security headers configuration (CSP, HSTS, X-Frame-Options)
- OWASP ZAP automated penetration testing
- Rate limiting and brute force protection
- Comprehensive security documentation

Advanced Deployment:
- Blue-green deployment automation with zero-downtime
- Canary releases with Flagger integration
- Progressive traffic shifting (5% → 50%)
- Feature flags system with rollout strategies
- Automatic rollback on failure

Performance Optimizations:
- Multi-layer caching (L1 in-memory + L2 Redis)
- 30+ database indexes and materialized views
- Frontend bundle optimization (Gzip + Brotli)
- CDN integration (CloudFlare + AWS CloudFront)
- Cache warming automation
- Grafana performance dashboard

Automation & Self-Healing:
- Kubernetes HPA with custom metrics
- Auto-scaling based on CPU, memory, request rate
- Liveness, readiness, and startup probes
- Chaos engineering with Chaos Mesh
- Automated chaos testing suite

Testing & Quality Assurance:
- k6 load testing (baseline, spike, stress, soak)
- Lighthouse performance auditing
- Core Web Vitals monitoring
- Automated quality gates

Files: 26 created/modified
Lines: ~5,000+
Status: Production Ready

Co-Authored-By: Claude Opus 4.6 <noreply@openclaude.dev>"

# Push to remote
git push origin main
```

---

## Step 3: Build Docker Images

```bash
# Build API image
docker build -f apps/api/Dockerfile -t trading-bot-api:latest .

# Build Web image
docker build -f apps/web/Dockerfile -t trading-bot-web:latest .

# Tag images for registry
docker tag trading-bot-api:latest registry.render.com/trading-bot-api:latest
docker tag trading-bot-web:latest registry.vercel.com/trading-bot-web:latest
```

---

## Step 4: Deploy to Render (API)

### Option A: Using Render CLI

```bash
# Install Render CLI
npm install -g @render/cli

# Login
render login --api-key YOUR_RENDER_API_KEY

# Deploy API
render deploy --service trading-bot-api
```

### Option B: Using Render Dashboard

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect GitHub repository: `arturwesley-jpg/Trade`
4. Configure:
   - Name: `trading-bot-api`
   - Environment: `Docker`
   - Dockerfile Path: `apps/api/Dockerfile`
   - Instance Type: `Standard`
5. Add Environment Variables:
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/trading_bot
   REDIS_URL=redis://host:6379
   JWT_SECRET=your-secret-key
   NODE_ENV=production
   PORT=3000
   ```
6. Click "Create Web Service"

---

## Step 5: Deploy to Vercel (Web)

### Option A: Using Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login --token YOUR_VERCEL_TOKEN

# Deploy
cd apps/web
vercel --prod
```

### Option B: Using Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Import Git Repository: `arturwesley-jpg/Trade`
4. Configure:
   - Framework Preset: `Vite`
   - Root Directory: `apps/web`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Add Environment Variables:
   ```
   VITE_API_URL=https://tradeb-5l5q.onrender.com
   VITE_WS_URL=wss://tradeb-5l5q.onrender.com
   ```
6. Click "Deploy"

---

## Step 6: Configure Telegram Bot

### Set Environment Variables on Render

Add these to your Render service:

```bash
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
TELEGRAM_ALLOWED_USER_IDS=274321499
API_BASE_URL=https://tradeb-5l5q.onrender.com
```

### Test Telegram Bot

```bash
# Send test message
curl -X POST "https://api.telegram.org/botYOUR_TELEGRAM_BOT_TOKEN/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "274321499",
    "text": "Trading Bot deployed successfully! 🚀"
  }'
```

---

## Step 7: Database Setup

### Run Migrations

```bash
# Connect to production database
psql $DATABASE_URL

# Run schema migration
\i packages/database/schema.sql

# Run optimization migration
\i packages/database/migrations/optimize_database.sql

# Verify tables
\dt

# Verify indexes
\di

# Verify materialized views
\dm
```

### Seed Initial Data (Optional)

```bash
# Run seed script
npm run db:seed
```

---

## Step 8: Configure CDN

### CloudFlare Setup

1. Go to https://dash.cloudflare.com
2. Add your domain
3. Update nameservers
4. Apply configuration from `infrastructure/cdn/cloudflare-config.yaml`
5. Configure:
   - SSL/TLS: Full (strict)
   - Cache Rules: Static assets (1 year), API (1 minute)
   - WAF: Enable with OWASP rules
   - Rate Limiting: 100 req/min (API), 10 req/min (auth)

### AWS CloudFront Setup (Alternative)

```bash
# Deploy CloudFormation stack
aws cloudformation create-stack \
  --stack-name trading-bot-cdn \
  --template-body file://infrastructure/cdn/aws-cloudfront-config.yaml \
  --parameters \
    ParameterKey=DomainName,ParameterValue=trade-bot.com \
    ParameterKey=OriginDomain,ParameterValue=tradeb-5l5q.onrender.com \
    ParameterKey=ACMCertificateArn,ParameterValue=arn:aws:acm:us-east-1:xxx:certificate/xxx

# Wait for completion
aws cloudformation wait stack-create-complete \
  --stack-name trading-bot-cdn

# Get CloudFront distribution URL
aws cloudformation describe-stacks \
  --stack-name trading-bot-cdn \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
  --output text
```

---

## Step 9: Deploy Kubernetes Resources (Optional)

If using Kubernetes cluster:

```bash
# Create namespace
kubectl create namespace trading-bot

# Apply HPA
kubectl apply -f infrastructure/k8s/hpa/api-hpa.yaml
kubectl apply -f infrastructure/k8s/hpa/web-hpa.yaml

# Apply probes
kubectl apply -f infrastructure/k8s/probes/liveness-probes.yaml

# Apply chaos experiments (optional)
kubectl apply -f infrastructure/k8s/chaos/chaos-monkey-config.yaml

# Verify deployments
kubectl get pods -n trading-bot
kubectl get hpa -n trading-bot
```

---

## Step 10: Verify Deployment

### Health Checks

```bash
# API health
curl https://tradeb-5l5q.onrender.com/api/health

# Expected response:
# {"status":"ok","timestamp":"2026-05-05T01:00:00.000Z"}

# Web health
curl https://your-vercel-app.vercel.app/

# Expected: 200 OK with HTML
```

### Performance Tests

```bash
# Run load test
cd scripts/testing
./load-test.sh

# Run Lighthouse audit
./lighthouse-audit.sh
```

### Security Scan

```bash
# Run OWASP ZAP scan
cd infrastructure/security/scanning
./scan.sh
```

---

## Step 11: Monitoring Setup

### Grafana Dashboard

1. Import dashboard from `infrastructure/monitoring/grafana/performance-dashboard.json`
2. Configure Prometheus data source
3. Verify metrics are flowing

### Alerts Configuration

Set up alerts for:
- Error rate > 5%
- Response time p95 > 500ms
- CPU usage > 80%
- Memory usage > 85%
- Cache hit rate < 80%

---

## Step 12: Cache Warming

```bash
# Run cache warming script
cd scripts/performance
./cache-warming.sh

# Schedule periodic warming (cron)
crontab -e

# Add:
# 0 */6 * * * /path/to/cache-warming.sh
```

---

## Rollback Procedure

### Blue-Green Rollback

```bash
cd infrastructure/deployment/blue-green
./switch-traffic.sh blue  # or green
```

### Canary Rollback

```bash
# Flagger will automatically rollback on failure
# Or manually:
kubectl delete canary trading-bot-api -n trading-bot
```

### Git Rollback

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard <commit-hash>
git push --force origin main
```

---

## Troubleshooting

### Issue: Deployment Fails

```bash
# Check logs
render logs --service trading-bot-api --tail 100

# Or on Kubernetes
kubectl logs -f deployment/trading-bot-api -n trading-bot
```

### Issue: Database Connection Error

```bash
# Verify DATABASE_URL
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check connection pool
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity"
```

### Issue: Redis Connection Error

```bash
# Verify REDIS_URL
echo $REDIS_URL

# Test connection
redis-cli -u $REDIS_URL ping

# Check Redis info
redis-cli -u $REDIS_URL info
```

### Issue: High Error Rate

```bash
# Check error logs
kubectl logs -f deployment/trading-bot-api -n trading-bot | grep ERROR

# Check metrics
curl https://tradeb-5l5q.onrender.com/metrics

# Run chaos test to identify issues
cd scripts/automation
./chaos-test.sh
```

---

## Post-Deployment Checklist

- [ ] All services are healthy
- [ ] Database migrations completed
- [ ] Redis cache is working
- [ ] CDN is configured
- [ ] SSL certificates are valid
- [ ] Monitoring dashboards are active
- [ ] Alerts are configured
- [ ] Load tests pass
- [ ] Security scans pass
- [ ] Telegram bot responds
- [ ] Cache warming is scheduled
- [ ] Backup strategy is in place
- [ ] Documentation is updated

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/arturwesley-jpg/Trade/issues
- Documentation: `/docs` directory
- Security: See `docs/SECURITY_HARDENING.md`

---

**Deployment Guide Version**: 1.0  
**Last Updated**: 2026-05-05  
**Status**: Production Ready ✅
