# Disaster Recovery Plan

**Version:** 1.0  
**Last Updated:** 2026-05-04  
**Owner:** DevOps Team

---

## 🎯 Overview

This document outlines the disaster recovery (DR) procedures for the Crypto Trading Bot production system. It defines Recovery Time Objective (RTO), Recovery Point Objective (RPO), backup procedures, and step-by-step recovery processes.

---

## 📊 Recovery Objectives

### RTO (Recovery Time Objective)
**Target: < 1 hour**

Maximum acceptable downtime for the trading system.

| Component | RTO Target | Priority |
|-----------|------------|----------|
| Database (PostgreSQL) | 30 minutes | Critical |
| API Backend | 15 minutes | Critical |
| Web Frontend | 10 minutes | High |
| Redis Cache | 5 minutes | Medium |
| Monitoring | 20 minutes | Medium |

### RPO (Recovery Point Objective)
**Target: < 15 minutes**

Maximum acceptable data loss measured in time.

| Data Type | RPO Target | Backup Frequency |
|-----------|------------|------------------|
| Trade data | 5 minutes | Continuous replication |
| User data | 15 minutes | Every 15 minutes |
| Configuration | 1 hour | Hourly |
| Logs | 1 hour | Hourly |

---

## 🔄 Backup Strategy

### Automated Backups

#### 1. Database Backups (PostgreSQL)

**Frequency:** Every 15 minutes (incremental), Daily (full)

**Script:** `scripts/backup.sh`

**Storage:**
- Local: `/var/backups/trading-bot/`
- Remote: S3 bucket `s3://trading-bot-backups/`
- Retention: 7 days local, 30 days S3

**Verification:** Automated integrity check after each backup

```bash
# Manual backup
./scripts/backup.sh

# Verify backup
tar -tzf /var/backups/trading-bot/backup_YYYYMMDD_HHMMSS.tar.gz
```

#### 2. Redis Backups

**Frequency:** Every hour

**Method:** BGSAVE + RDB file copy

**Storage:** Included in main backup archive

#### 3. Configuration Backups

**Frequency:** On every deployment

**Includes:**
- Docker Compose files
- Kubernetes manifests
- Grafana dashboards
- Prometheus rules
- Nginx configuration

#### 4. Code Repository

**Method:** Git repository (GitHub)

**Branches:**
- `main` - Production code
- `develop` - Development code
- Tags for each release

---

## 🚨 Disaster Scenarios

### Scenario 1: Database Failure

**Symptoms:**
- Database connection errors
- API returning 500 errors
- Unable to execute trades

**Recovery Steps:**

1. **Assess the situation** (2 minutes)
   ```bash
   # Check database status
   docker ps | grep postgres
   kubectl get pods -n trading-bot | grep postgres
   
   # Check logs
   docker logs trading-bot-postgres
   kubectl logs -n trading-bot postgres-0
   ```

2. **Attempt service restart** (3 minutes)
   ```bash
   # Docker
   docker restart trading-bot-postgres
   
   # Kubernetes
   kubectl rollout restart statefulset/postgres -n trading-bot
   ```

3. **If restart fails, restore from backup** (25 minutes)
   ```bash
   # Stop application services
   docker-compose stop api telegram-bot
   
   # Restore database
   ./scripts/restore.sh latest
   
   # Verify restoration
   psql -h localhost -U postgres -d trading_bot -c "SELECT COUNT(*) FROM trades;"
   
   # Restart services
   docker-compose up -d
   ```

**RTO:** 30 minutes  
**RPO:** 15 minutes

---

### Scenario 2: Complete Server Failure

**Symptoms:**
- Server unreachable
- All services down
- Hardware failure

**Recovery Steps:**

1. **Provision new server** (10 minutes)
   - Use Infrastructure as Code (Terraform)
   - Deploy to cloud provider (AWS/GCP/Azure)

2. **Restore from backup** (30 minutes)
   ```bash
   # Clone repository
   git clone https://github.com/user/trading-bot.git
   cd trading-bot
   
   # Download latest backup from S3
   aws s3 cp s3://trading-bot-backups/latest.tar.gz /tmp/
   
   # Extract and restore
   export BACKUP_DIR=/tmp
   ./scripts/restore.sh latest
   
   # Deploy services
   docker-compose up -d
   ```

3. **Verify system health** (10 minutes)
   ```bash
   # Check all services
   docker-compose ps
   
   # Verify API
   curl http://localhost:3001/health
   
   # Check database
   psql -h localhost -U postgres -d trading_bot -c "SELECT NOW();"
   
   # Verify trading functionality
   # (Manual test via Telegram bot)
   ```

4. **Update DNS** (10 minutes)
   - Point domain to new server IP
   - Wait for DNS propagation

**RTO:** 60 minutes  
**RPO:** 15 minutes

---

### Scenario 3: Data Corruption

**Symptoms:**
- Inconsistent trade data
- Database integrity errors
- Application crashes

**Recovery Steps:**

1. **Identify corruption scope** (5 minutes)
   ```bash
   # Check database integrity
   psql -h localhost -U postgres -d trading_bot -c "
   SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
   FROM pg_tables WHERE schemaname = 'public';
   "
   
   # Check for corrupted indexes
   REINDEX DATABASE trading_bot;
   ```

2. **Stop write operations** (2 minutes)
   ```bash
   # Stop trading services
   docker-compose stop telegram-bot
   
   # Set API to read-only mode
   kubectl set env deployment/api -n trading-bot READ_ONLY=true
   ```

3. **Restore from point-in-time backup** (20 minutes)
   ```bash
   # List available backups
   ls -lh /var/backups/trading-bot/
   
   # Restore from specific backup
   ./scripts/restore.sh backup_20260504_120000
   ```

4. **Verify data integrity** (10 minutes)
   ```bash
   # Run data validation queries
   psql -h localhost -U postgres -d trading_bot -f scripts/validate-data.sql
   
   # Check trade balance
   # Check user accounts
   # Verify recent transactions
   ```

5. **Resume operations** (3 minutes)
   ```bash
   docker-compose up -d
   kubectl set env deployment/api -n trading-bot READ_ONLY=false
   ```

**RTO:** 40 minutes  
**RPO:** 15 minutes

---

### Scenario 4: Security Breach

**Symptoms:**
- Unauthorized access detected
- Suspicious API calls
- Compromised credentials

**Recovery Steps:**

1. **Immediate containment** (5 minutes)
   ```bash
   # Shut down all external access
   kubectl scale deployment/api --replicas=0 -n trading-bot
   
   # Block all incoming traffic
   iptables -A INPUT -j DROP
   
   # Revoke all API keys
   psql -h localhost -U postgres -d trading_bot -c "
   UPDATE api_keys SET revoked = true, revoked_at = NOW();
   "
   ```

2. **Assess damage** (15 minutes)
   - Review audit logs
   - Check for unauthorized trades
   - Identify compromised accounts
   - Determine attack vector

3. **Restore from clean backup** (30 minutes)
   ```bash
   # Restore from backup before breach
   ./scripts/restore.sh backup_YYYYMMDD_HHMMSS
   ```

4. **Security hardening** (30 minutes)
   - Rotate all credentials
   - Update firewall rules
   - Patch vulnerabilities
   - Enable additional monitoring

5. **Gradual service restoration** (20 minutes)
   ```bash
   # Restore services one by one
   # Monitor for suspicious activity
   # Verify security measures
   ```

**RTO:** 100 minutes  
**RPO:** Varies (restore to pre-breach state)

---

## 🧪 DR Testing Schedule

### Monthly Tests
- [ ] Backup restoration test (non-production)
- [ ] Database failover test
- [ ] Service restart procedures

### Quarterly Tests
- [ ] Full disaster recovery simulation
- [ ] Complete server rebuild
- [ ] Security breach response drill

### Annual Tests
- [ ] Multi-region failover
- [ ] Complete infrastructure rebuild
- [ ] Third-party DR audit

---

## 📋 Pre-Disaster Checklist

Ensure these are always up to date:

- [ ] Automated backups running successfully
- [ ] Backup integrity verified daily
- [ ] S3 backups accessible
- [ ] Recovery scripts tested monthly
- [ ] Contact list current
- [ ] Documentation updated
- [ ] Monitoring alerts configured
- [ ] Runbooks accessible offline

---

## 📞 Emergency Contacts

### Internal Team

| Role | Name | Phone | Email |
|------|------|-------|-------|
| DevOps Lead | TBD | +XX XXX XXX XXXX | devops@company.com |
| Backend Lead | TBD | +XX XXX XXX XXXX | backend@company.com |
| Security Lead | TBD | +XX XXX XXX XXXX | security@company.com |
| On-Call Engineer | Rotation | +XX XXX XXX XXXX | oncall@company.com |

### External Vendors

| Service | Contact | Phone | Support URL |
|---------|---------|-------|-------------|
| AWS Support | - | - | https://console.aws.amazon.com/support |
| Database Vendor | - | - | - |
| Security Vendor | - | - | - |

---

## 🔍 Post-Incident Review

After any disaster recovery event:

1. **Document the incident**
   - Timeline of events
   - Root cause analysis
   - Actions taken
   - Actual RTO/RPO achieved

2. **Update procedures**
   - Identify gaps in DR plan
   - Update runbooks
   - Improve automation

3. **Team debrief**
   - What went well
   - What could be improved
   - Action items

4. **Communicate**
   - Notify stakeholders
   - Update status page
   - Post-mortem report

---

## 📚 Related Documents

- [Backup Script](../scripts/backup.sh)
- [Restore Script](../scripts/restore.sh)
- [Incident Response Runbook](./INCIDENT_RESPONSE_RUNBOOK.md)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
- [Rollback Procedures](./ROLLBACK_PROCEDURES.md)

---

**Last Tested:** TBD  
**Next Test:** TBD  
**Test Results:** TBD
