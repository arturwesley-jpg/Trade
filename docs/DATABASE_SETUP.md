# Database Setup Guide

## PostgreSQL Configuration

This project uses PostgreSQL as the default database for persistent storage of trading data, positions, and audit logs.

## Quick Start

### 1. Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**macOS (Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Windows:**
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

### 2. Create Database and User

```bash
# Access PostgreSQL as superuser
sudo -u postgres psql

# Create database and user
CREATE DATABASE trade_db;
CREATE USER trade_user WITH PASSWORD 'trade_password';
GRANT ALL PRIVILEGES ON DATABASE trade_db TO trade_user;

# Exit psql
\q
```

### 3. Configure Environment

Copy `.env.example` to `.env` and update the `DATABASE_URL`:

```bash
DATABASE_URL=postgresql://trade_user:trade_password@localhost:5432/trade_db
```

### 4. Run the Application

Migrations run automatically on server startup:

```bash
pnpm dev
```

You should see:
```
[server] Running PostgreSQL migrations...
[server] Migrations completed successfully
[server] Using PostgreSQL repository
```

## Manual Migration

If you need to run migrations manually:

```typescript
import { runPostgresMigrations } from "@trade/trading-core";

await runPostgresMigrations(process.env.DATABASE_URL);
```

## Database Schema

The following tables are created automatically:

- `order_intents` - Order requests and their validation status
- `positions` - Open and closed trading positions
- `trades` - Completed trade history
- `audit_events` - System audit log
- `market_ticks` - Market price data
- `schema_migrations` - Migration tracking

## Fallback Behavior

If `DATABASE_URL` is not set:
- The system falls back to `InMemoryTradingRepository`
- A warning is logged on startup
- Data will NOT persist between restarts

## Production Recommendations

### Connection Pooling

For production, use connection pooling:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db?pool_max=20
```

### Backup Strategy

```bash
# Daily backup
pg_dump -U trade_user trade_db > backup_$(date +%Y%m%d).sql

# Restore
psql -U trade_user trade_db < backup_20260502.sql
```

### Security

1. Use strong passwords
2. Restrict network access in `pg_hba.conf`
3. Enable SSL connections for remote access
4. Regularly update PostgreSQL

### Monitoring

Check database size:
```sql
SELECT pg_size_pretty(pg_database_size('trade_db'));
```

Check table sizes:
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Troubleshooting

### Connection Refused

Check if PostgreSQL is running:
```bash
sudo systemctl status postgresql
```

Start if needed:
```bash
sudo systemctl start postgresql
```

### Authentication Failed

Verify credentials in `.env` match the database user.

### Migration Errors

Migrations are idempotent and use transactions. If a migration fails:
1. Check the error message
2. Fix the underlying issue
3. Restart the server (migrations will retry)

### Reset Database

To start fresh:
```bash
sudo -u postgres psql
DROP DATABASE trade_db;
CREATE DATABASE trade_db;
GRANT ALL PRIVILEGES ON DATABASE trade_db TO trade_user;
\q
```

Restart the server to re-run migrations.

## Docker Setup (Optional)

Run PostgreSQL in Docker:

```bash
docker run -d \
  --name trade-postgres \
  -e POSTGRES_DB=trade_db \
  -e POSTGRES_USER=trade_user \
  -e POSTGRES_PASSWORD=trade_password \
  -p 5432:5432 \
  postgres:15-alpine
```

Then use:
```bash
DATABASE_URL=postgresql://trade_user:trade_password@localhost:5432/trade_db
```
