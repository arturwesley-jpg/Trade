# Trading Bot - Quick Start Guide

Get the Trading Bot up and running in 5 minutes.

---

## 🚀 Quick Deploy (Recommended)

### 1. Fix Disk Space (if needed)

```bash
# Clean temp files
sudo rm -rf /tmp/claude-*

# Or increase /tmp size
sudo mount -o remount,size=4G /tmp
```

### 2. Commit & Push

```bash
cd /home/geen/Área\ de\ trabalho/Trade
git add -A
git commit -m "feat(phase-7): implement security hardening and advanced features"
git push origin main
```

### 3. Deploy API to Render

```bash
# Using Render CLI
npm install -g @render/cli
render login --api-key YOUR_RENDER_API_KEY
render deploy --service trading-bot-api
```

Or use Render Dashboard:
- URL: https://dashboard.render.com
- Connect repo: `arturwesley-jpg/Trade`
- Dockerfile: `apps/api/Dockerfile`

### 4. Deploy Web to Vercel

```bash
# Using Vercel CLI
npm install -g vercel
vercel login --token YOUR_VERCEL_TOKEN
cd apps/web && vercel --prod
```

Or use Vercel Dashboard:
- URL: https://vercel.com/dashboard
- Import: `arturwesley-jpg/Trade`
- Root: `apps/web`

### 5. Configure Environment Variables

**Render (API)**:
```env
DATABASE_URL=postgresql://user:pass@host:5432/trading_bot
REDIS_URL=redis://host:6379
JWT_SECRET=your-secret-key
NODE_ENV=production
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
TELEGRAM_ALLOWED_USER_IDS=274321499
API_BASE_URL=https://tradeb-5l5q.onrender.com
```

**Vercel (Web)**:
```env
VITE_API_URL=https://tradeb-5l5q.onrender.com
VITE_WS_URL=wss://tradeb-5l5q.onrender.com
```

### 6. Run Database Migrations

```bash
psql $DATABASE_URL < packages/database/schema.sql
psql $DATABASE_URL < packages/database/migrations/optimize_database.sql
```

### 7. Verify Deployment

```bash
# Test API
curl https://tradeb-5l5q.onrender.com/api/health

# Test Telegram Bot
curl -X POST "https://api.telegram.org/botYOUR_TELEGRAM_BOT_TOKEN/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id":"274321499","text":"Bot is live! 🚀"}'
```

---

## 🏃 Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Start Services

```bash
# Start PostgreSQL
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:14

# Start Redis
docker run -d -p 6379:6379 redis:7

# Run migrations
npm run db:migrate

# Start API
npm run dev:api

# Start Web (in another terminal)
npm run dev:web
```

### 4. Access Application

- Web: http://localhost:5173
- API: http://localhost:3000
- API Docs: http://localhost:3000/api/docs

---

## 📊 Monitoring

### Grafana Dashboard

Import `infrastructure/monitoring/grafana/performance-dashboard.json`

### Key Metrics

- Response Time: p95 < 500ms
- Error Rate: < 5%
- Cache Hit Rate: > 90%
- CPU Usage: < 70%

---

## 🧪 Testing

### Load Test

```bash
cd scripts/testing
./load-test.sh
```

### Performance Audit

```bash
./lighthouse-audit.sh
```

### Security Scan

```bash
cd infrastructure/security/scanning
./scan.sh
```

---

## 🔧 Troubleshooting

### API Not Responding

```bash
# Check logs
render logs --service trading-bot-api --tail 100

# Restart service
render restart --service trading-bot-api
```

### Database Connection Error

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check pool
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity"
```

### Redis Connection Error

```bash
# Test connection
redis-cli -u $REDIS_URL ping
```

---

## 📚 Documentation

- Full Deployment Guide: `docs/DEPLOYMENT_GUIDE.md`
- Security Hardening: `docs/SECURITY_HARDENING.md`
- Phase 7 Summary: `docs/PHASE_7_SUMMARY.md`
- API Documentation: http://localhost:3000/api/docs

---

## 🆘 Support

- GitHub: https://github.com/arturwesley-jpg/Trade
- Issues: https://github.com/arturwesley-jpg/Trade/issues

---

**Quick Start Version**: 1.0  
**Last Updated**: 2026-05-05
