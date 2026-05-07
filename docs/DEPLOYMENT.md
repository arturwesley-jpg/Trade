# Deployment Guide

Complete guide for deploying the Crypto Trading Bot to production.

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)
- Git

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/crypto-trading-bot.git
cd crypto-trading-bot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/trading_bot
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# API
API_PORT=3001
API_HOST=0.0.0.0
NODE_ENV=production

# Frontend
VITE_API_URL=http://localhost:3001

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=http://localhost:5173,https://yourdomain.com

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### 4. Database Setup

Create database and run migrations:

```bash
# Create database
createdb trading_bot

# Run migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed
```

## Deployment Methods

### Method 1: Docker Compose (Recommended)

#### 1. Build Images

```bash
docker-compose build
```

#### 2. Start Services

```bash
docker-compose up -d
```

#### 3. Check Status

```bash
docker-compose ps
docker-compose logs -f
```

#### 4. Stop Services

```bash
docker-compose down
```

### Method 2: Manual Deployment

#### 1. Build Application

```bash
npm run build
```

#### 2. Start Services

```bash
# Start API
npm run start:api

# Start Worker (in another terminal)
npm run start:worker

# Start Telegram Bot (in another terminal)
npm run start:telegram

# Serve Frontend (using nginx or similar)
# Frontend build is in apps/web/dist
```

#### 3. Process Management with PM2

```bash
# Install PM2
npm install -g pm2

# Start services
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs

# Restart services
pm2 restart all

# Stop services
pm2 stop all
```

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'trading-api',
      script: 'apps/api/dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'trading-worker',
      script: 'apps/worker/dist/index.js',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'telegram-bot',
      script: 'apps/telegram-bot/dist/index.js',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

### Method 3: Cloud Deployment

#### AWS Deployment

**Using ECS (Elastic Container Service):**

1. Push Docker images to ECR
2. Create ECS cluster
3. Define task definitions
4. Create services
5. Configure load balancer
6. Set up RDS for PostgreSQL
7. Set up ElastiCache for Redis

**Using EC2:**

1. Launch EC2 instance (t3.medium or larger)
2. Install dependencies
3. Clone repository
4. Follow manual deployment steps
5. Configure nginx as reverse proxy
6. Set up SSL with Let's Encrypt

#### DigitalOcean Deployment

**Using App Platform:**

1. Connect GitHub repository
2. Configure build settings
3. Set environment variables
4. Deploy

**Using Droplets:**

1. Create droplet (4GB RAM minimum)
2. SSH into droplet
3. Install dependencies
4. Follow manual deployment steps
5. Configure nginx
6. Set up SSL

#### Heroku Deployment

```bash
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Add PostgreSQL
heroku addons:create heroku-postgresql:standard-0

# Add Redis
heroku addons:create heroku-redis:premium-0

# Set environment variables
heroku config:set JWT_SECRET=your-secret
heroku config:set NODE_ENV=production

# Deploy
git push heroku main

# Run migrations
heroku run npm run db:migrate

# Check logs
heroku logs --tail
```

## Nginx Configuration

Create `/etc/nginx/sites-available/trading-bot`:

```nginx
upstream api {
    server localhost:3001;
}

server {
    listen 80;
    server_name yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Frontend
    location / {
        root /var/www/trading-bot/apps/web/dist;
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/trading-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is configured automatically
# Test renewal
sudo certbot renew --dry-run
```

## Database Backup

### Automated Backups

Create backup script `/usr/local/bin/backup-db.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/trading-bot"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="trading_bot_$DATE.sql.gz"

mkdir -p $BACKUP_DIR

pg_dump trading_bot | gzip > "$BACKUP_DIR/$FILENAME"

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $FILENAME"
```

Make executable:

```bash
sudo chmod +x /usr/local/bin/backup-db.sh
```

Add to crontab (daily at 2 AM):

```bash
crontab -e
# Add line:
0 2 * * * /usr/local/bin/backup-db.sh
```

### Manual Backup

```bash
# Backup
pg_dump trading_bot > backup.sql

# Restore
psql trading_bot < backup.sql
```

## Monitoring

### Health Checks

```bash
# API health
curl http://localhost:3001/health

# Database connection
psql -U user -d trading_bot -c "SELECT 1"

# Redis connection
redis-cli ping
```

### Log Monitoring

```bash
# PM2 logs
pm2 logs

# Docker logs
docker-compose logs -f

# System logs
journalctl -u trading-bot -f
```

### Metrics

Access Prometheus metrics:

```bash
curl http://localhost:3001/metrics
```

## Troubleshooting

### API Not Starting

1. Check logs: `pm2 logs trading-api`
2. Verify environment variables
3. Check database connection
4. Check port availability: `lsof -i :3001`

### Database Connection Issues

1. Verify PostgreSQL is running: `systemctl status postgresql`
2. Check connection string in `.env`
3. Verify user permissions
4. Check firewall rules

### High Memory Usage

1. Check running processes: `pm2 status`
2. Restart services: `pm2 restart all`
3. Increase server resources
4. Optimize database queries

### Slow Performance

1. Check database indexes
2. Enable Redis caching
3. Optimize API queries
4. Scale horizontally (add more instances)

## Security Checklist

- [ ] Change default JWT secret
- [ ] Use strong database passwords
- [ ] Enable SSL/TLS
- [ ] Configure firewall (ufw/iptables)
- [ ] Set up fail2ban
- [ ] Enable rate limiting
- [ ] Regular security updates
- [ ] Backup encryption
- [ ] Environment variable security
- [ ] API key rotation

## Maintenance

### Regular Tasks

**Daily:**
- Check logs for errors
- Monitor system resources
- Verify backups

**Weekly:**
- Review performance metrics
- Check disk space
- Update dependencies (if needed)

**Monthly:**
- Security audit
- Database optimization
- Review and rotate API keys

### Updates

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Run migrations
npm run db:migrate

# Restart services
pm2 restart all
```

## Rollback Procedure

If deployment fails:

```bash
# Revert to previous version
git checkout <previous-commit>

# Rebuild
npm run build

# Restart
pm2 restart all

# If database migration issue
npm run db:rollback
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourusername/crypto-trading-bot/issues
- Documentation: https://docs.yourdomain.com
- Email: support@yourdomain.com
