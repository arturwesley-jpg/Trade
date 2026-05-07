# Rollback Procedures

**Version:** 1.0  
**Last Updated:** 2026-05-04  
**Owner:** DevOps Team

---

## 🎯 Overview

This document provides step-by-step procedures for rolling back deployments when issues are detected in production. Quick and safe rollback is critical for maintaining system availability and data integrity.

---

## 🚨 When to Rollback

Rollback should be initiated when:

- **Critical bugs** affecting trading functionality
- **Performance degradation** (>50% slower than baseline)
- **Data corruption** or integrity issues
- **Security vulnerabilities** introduced
- **High error rates** (>5% of requests failing)
- **Service unavailability** (>1 minute downtime)

---

## ⚡ Quick Rollback Commands

### Docker Compose Deployment

```bash
# Rollback to previous version
cd /home/geen/Área\ de\ trabalho/Trade
git log --oneline -5  # Find previous commit
git checkout <previous-commit-hash>
docker-compose down
docker-compose up -d --build

# Verify rollback
docker-compose ps
curl http://localhost:3001/health
```

### Kubernetes Deployment

```bash
# Rollback deployment
kubectl rollout undo deployment/api -n trading-bot
kubectl rollout undo deployment/web -n trading-bot
kubectl rollout undo deployment/telegram-bot -n trading-bot

# Check rollback status
kubectl rollout status deployment/api -n trading-bot

# Verify pods are running
kubectl get pods -n trading-bot
```

### Database Migration Rollback

```bash
# Rollback last migration
npm run migrate:rollback

# Rollback to specific version
npm run migrate:rollback -- --to=20260501000000

# Verify database state
psql -h localhost -U postgres -d trading_bot -c "\dt"
```

---

## 📋 Detailed Rollback Procedures

### Procedure 1: Application Code Rollback

**Estimated Time:** 5-10 minutes  
**Risk Level:** Low

#### Prerequisites
- Access to production server
- Git repository access
- Docker/Kubernetes access

#### Steps

1. **Identify the issue** (1 minute)
   ```bash
   # Check application logs
   docker-compose logs --tail=100 api
   kubectl logs -n trading-bot deployment/api --tail=100
   
   # Check error rates
   curl http://localhost:3001/metrics | grep error_rate
   ```

2. **Determine rollback target** (1 minute)
   ```bash
   # List recent deployments
   git log --oneline -10
   
   # For Kubernetes, check rollout history
   kubectl rollout history deployment/api -n trading-bot
   ```

3. **Notify team** (1 minute)
   ```bash
   # Send notification (if automated)
   ./scripts/notify.sh "🔄 Initiating rollback to previous version"
   ```

4. **Execute rollback** (3 minutes)

   **Docker Compose:**
   ```bash
   # Stop current services
   docker-compose down
   
   # Checkout previous version
   git checkout <previous-commit-hash>
   
   # Rebuild and start
   docker-compose up -d --build
   
   # Wait for services to be healthy
   sleep 30
   ```

   **Kubernetes:**
   ```bash
   # Rollback to previous revision
   kubectl rollout undo deployment/api -n trading-bot
   kubectl rollout undo deployment/web -n trading-bot
   kubectl rollout undo deployment/telegram-bot -n trading-bot
   
   # Wait for rollout to complete
   kubectl rollout status deployment/api -n trading-bot
   ```

5. **Verify rollback** (3 minutes)
   ```bash
   # Check service health
   curl http://localhost:3001/health
   
   # Verify version
   curl http://localhost:3001/version
   
   # Check error rates
   curl http://localhost:3001/metrics | grep error_rate
   
   # Test critical functionality
   # - Login
   # - View dashboard
   # - Execute test trade (paper mode)
   ```

6. **Monitor for 15 minutes** (15 minutes)
   - Watch error rates in Grafana
   - Monitor response times
   - Check for any anomalies
   - Verify trading operations

7. **Document incident** (5 minutes)
   - Record what went wrong
   - Document rollback actions
   - Create post-mortem ticket

---

### Procedure 2: Database Migration Rollback

**Estimated Time:** 10-20 minutes  
**Risk Level:** High ⚠️

#### Prerequisites
- Database backup verified
- Application services stopped
- Database access

#### Steps

1. **Stop application services** (2 minutes)
   ```bash
   # Stop services that write to database
   docker-compose stop api telegram-bot
   kubectl scale deployment/api --replicas=0 -n trading-bot
   kubectl scale deployment/telegram-bot --replicas=0 -n trading-bot
   ```

2. **Backup current database state** (3 minutes)
   ```bash
   # Create emergency backup
   ./scripts/backup.sh
   
   # Verify backup
   ls -lh /var/backups/trading-bot/backup_*.tar.gz | tail -1
   ```

3. **Check migration status** (1 minute)
   ```bash
   # List applied migrations
   npm run migrate:status
   
   # Identify migration to rollback
   psql -h localhost -U postgres -d trading_bot -c "
   SELECT * FROM migrations ORDER BY id DESC LIMIT 5;
   "
   ```

4. **Execute migration rollback** (5 minutes)
   ```bash
   # Rollback last migration
   npm run migrate:rollback
   
   # Or rollback to specific version
   npm run migrate:rollback -- --to=20260501000000
   ```

5. **Verify database state** (3 minutes)
   ```bash
   # Check tables
   psql -h localhost -U postgres -d trading_bot -c "\dt"
   
   # Verify data integrity
   psql -h localhost -U postgres -d trading_bot -f scripts/validate-data.sql
   
   # Check row counts
   psql -h localhost -U postgres -d trading_bot -c "
   SELECT 
     'users' as table_name, COUNT(*) as count FROM users
   UNION ALL
   SELECT 'trades', COUNT(*) FROM trades
   UNION ALL
   SELECT 'positions', COUNT(*) FROM positions;
   "
   ```

6. **Rollback application code** (5 minutes)
   ```bash
   # Checkout code version compatible with database
   git checkout <compatible-commit-hash>
   
   # Rebuild services
   docker-compose up -d --build
   ```

7. **Restart services** (2 minutes)
   ```bash
   docker-compose up -d
   kubectl scale deployment/api --replicas=3 -n trading-bot
   kubectl scale deployment/telegram-bot --replicas=1 -n trading-bot
   ```

8. **Verify system** (5 minutes)
   ```bash
   # Check health
   curl http://localhost:3001/health
   
   # Test database queries
   curl http://localhost:3001/api/trades?limit=10
   
   # Verify trading functionality
   ```

---

### Procedure 3: Configuration Rollback

**Estimated Time:** 5 minutes  
**Risk Level:** Low

#### Steps

1. **Identify configuration issue** (1 minute)
   ```bash
   # Check current configuration
   docker-compose config
   kubectl get configmap -n trading-bot
   ```

2. **Restore previous configuration** (2 minutes)
   ```bash
   # Git-tracked configuration
   git checkout HEAD~1 -- docker-compose.yml
   git checkout HEAD~1 -- infrastructure/k8s/
   
   # Apply changes
   docker-compose up -d
   kubectl apply -f infrastructure/k8s/
   ```

3. **Restart affected services** (2 minutes)
   ```bash
   docker-compose restart
   kubectl rollout restart deployment/api -n trading-bot
   ```

---

### Procedure 4: Infrastructure Rollback

**Estimated Time:** 15-30 minutes  
**Risk Level:** High ⚠️

#### Steps

1. **Assess infrastructure change** (2 minutes)
   ```bash
   # Check Terraform state
   cd infrastructure/terraform
   terraform show
   
   # Review recent changes
   git log --oneline infrastructure/
   ```

2. **Backup current state** (3 minutes)
   ```bash
   # Backup Terraform state
   cp terraform.tfstate terraform.tfstate.backup.$(date +%Y%m%d_%H%M%S)
   
   # Export Kubernetes resources
   kubectl get all -n trading-bot -o yaml > k8s-backup.yaml
   ```

3. **Rollback infrastructure code** (5 minutes)
   ```bash
   # Checkout previous version
   git checkout HEAD~1 -- infrastructure/
   
   # Review changes
   terraform plan
   ```

4. **Apply rollback** (10 minutes)
   ```bash
   # Apply Terraform changes
   terraform apply
   
   # Or rollback Kubernetes changes
   kubectl apply -f k8s-backup.yaml
   ```

5. **Verify infrastructure** (5 minutes)
   ```bash
   # Check resources
   terraform show
   kubectl get all -n trading-bot
   
   # Verify connectivity
   curl http://localhost:3001/health
   ```

---

## 🔍 Rollback Verification Checklist

After any rollback, verify:

- [ ] All services are running
- [ ] Health checks passing
- [ ] Error rates normal (<1%)
- [ ] Response times acceptable (<500ms p95)
- [ ] Database queries working
- [ ] WebSocket connections stable
- [ ] Trading functionality operational
- [ ] Monitoring/alerting working
- [ ] Logs being collected
- [ ] No data loss detected

---

## 📊 Rollback Decision Matrix

| Issue Severity | Response Time | Action |
|----------------|---------------|--------|
| **Critical** - Trading stopped | Immediate | Rollback immediately |
| **High** - Major functionality broken | <5 minutes | Rollback after quick investigation |
| **Medium** - Minor features broken | <15 minutes | Attempt hotfix, rollback if fails |
| **Low** - UI issues, non-critical bugs | <1 hour | Schedule fix for next deployment |

---

## 🚫 Rollback Risks and Mitigations

### Risk 1: Data Loss
**Mitigation:**
- Always backup before rollback
- Use database transactions
- Verify data integrity after rollback

### Risk 2: Incompatible Database Schema
**Mitigation:**
- Maintain backward-compatible migrations
- Test rollback procedures in staging
- Keep migration rollback scripts updated

### Risk 3: Configuration Drift
**Mitigation:**
- Version control all configuration
- Use Infrastructure as Code
- Document manual changes

### Risk 4: Service Dependencies
**Mitigation:**
- Rollback in reverse dependency order
- Test service compatibility
- Use feature flags for gradual rollout

---

## 📝 Post-Rollback Actions

1. **Incident Report**
   - Document what went wrong
   - Timeline of events
   - Root cause analysis
   - Actions taken

2. **Team Communication**
   - Notify stakeholders
   - Update status page
   - Post-mortem meeting

3. **Prevention**
   - Add tests to prevent recurrence
   - Update deployment checklist
   - Improve monitoring/alerting

4. **Fix Forward**
   - Create fix in development
   - Test thoroughly
   - Deploy with extra caution

---

## 🔗 Related Documents

- [Disaster Recovery Plan](./DISASTER_RECOVERY.md)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
- [Incident Response Runbook](./INCIDENT_RESPONSE_RUNBOOK.md)
- [Backup Script](../scripts/backup.sh)
- [Restore Script](../scripts/restore.sh)

---

## 📞 Emergency Contacts

| Role | Contact | Phone |
|------|---------|-------|
| DevOps Lead | TBD | +XX XXX XXX XXXX |
| Backend Lead | TBD | +XX XXX XXX XXXX |
| On-Call Engineer | Rotation | +XX XXX XXX XXXX |

---

**Last Updated:** 2026-05-04  
**Last Tested:** TBD  
**Next Test:** TBD
