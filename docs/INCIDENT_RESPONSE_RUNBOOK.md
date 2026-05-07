# Incident Response Runbook

**Version:** 1.0  
**Last Updated:** 2026-05-04  
**Owner:** DevOps Team

---

## 🎯 Overview

This runbook provides step-by-step procedures for responding to production incidents in the Crypto Trading Bot system. It covers detection, triage, resolution, and post-incident activities.

---

## 🚨 Incident Severity Levels

### SEV-1: Critical
**Impact:** Complete service outage or data loss  
**Response Time:** Immediate  
**Examples:**
- Trading system completely down
- Database unavailable
- Security breach
- Data corruption

**Actions:**
- Page on-call engineer immediately
- Notify leadership
- All hands on deck
- Hourly status updates

### SEV-2: High
**Impact:** Major functionality degraded  
**Response Time:** <15 minutes  
**Examples:**
- API error rate >10%
- Telegram bot unresponsive
- WebSocket disconnections
- Slow response times (>2s)

**Actions:**
- Notify on-call engineer
- Investigate and resolve
- 30-minute status updates

### SEV-3: Medium
**Impact:** Minor functionality affected  
**Response Time:** <1 hour  
**Examples:**
- Non-critical features broken
- UI display issues
- Monitoring gaps
- Performance degradation <50%

**Actions:**
- Create ticket
- Fix in next deployment
- Daily status updates

### SEV-4: Low
**Impact:** Minimal user impact  
**Response Time:** <24 hours  
**Examples:**
- Cosmetic issues
- Documentation errors
- Minor bugs
- Feature requests

**Actions:**
- Add to backlog
- Fix when convenient

---

## 📋 Incident Response Process

### Phase 1: Detection (0-2 minutes)

**How incidents are detected:**
- Automated monitoring alerts (Prometheus/Grafana)
- User reports (Telegram/Email)
- Error tracking (Sentry)
- Health check failures
- Manual observation

**Initial Actions:**
1. Acknowledge alert
2. Assess severity
3. Create incident ticket
4. Notify team

```bash
# Check system status
curl http://localhost:3001/health
docker-compose ps
kubectl get pods -n trading-bot

# Check monitoring
open http://localhost:3000  # Grafana
```

---

### Phase 2: Triage (2-5 minutes)

**Determine:**
- What is broken?
- How many users affected?
- Is data at risk?
- What is the business impact?

**Triage Checklist:**
- [ ] Identify affected services
- [ ] Check error logs
- [ ] Review recent deployments
- [ ] Assess data integrity
- [ ] Determine severity level

```bash
# Check recent deployments
git log --oneline -5
kubectl rollout history deployment/api -n trading-bot

# Check error logs
docker-compose logs --tail=100 api | grep ERROR
kubectl logs -n trading-bot deployment/api --tail=100 | grep ERROR

# Check metrics
curl http://localhost:3001/metrics | grep -E "(error_rate|response_time)"
```

---

### Phase 3: Communication (Ongoing)

**Initial Notification (within 5 minutes):**
```
🚨 INCIDENT ALERT

Severity: [SEV-1/2/3/4]
Status: Investigating
Impact: [Brief description]
Started: [Timestamp]
ETA: [Estimate or "Unknown"]

Updates will be provided every [15/30/60] minutes.
```

**Status Updates:**
- SEV-1: Every 15 minutes
- SEV-2: Every 30 minutes
- SEV-3: Every hour
- SEV-4: Daily

**Channels:**
- Internal: Slack #incidents
- External: Status page
- Critical: Email/SMS

---

### Phase 4: Investigation (5-30 minutes)

**Investigation Steps:**

1. **Check Service Health**
   ```bash
   # Docker
   docker-compose ps
   docker-compose logs --tail=200
   
   # Kubernetes
   kubectl get pods -n trading-bot
   kubectl describe pod <pod-name> -n trading-bot
   kubectl logs -n trading-bot <pod-name> --tail=200
   ```

2. **Check Database**
   ```bash
   # Connection test
   psql -h localhost -U postgres -d trading_bot -c "SELECT NOW();"
   
   # Check for locks
   psql -h localhost -U postgres -d trading_bot -c "
   SELECT pid, usename, application_name, state, query
   FROM pg_stat_activity
   WHERE state != 'idle';
   "
   
   # Check database size
   psql -h localhost -U postgres -d trading_bot -c "
   SELECT pg_size_pretty(pg_database_size('trading_bot'));
   "
   ```

3. **Check Redis**
   ```bash
   # Connection test
   redis-cli -h localhost ping
   
   # Check memory usage
   redis-cli -h localhost INFO memory
   
   # Check connected clients
   redis-cli -h localhost CLIENT LIST
   ```

4. **Check Network**
   ```bash
   # Check port availability
   netstat -tulpn | grep -E "(3000|3001|5432|6379)"
   
   # Check DNS
   nslookup api.trading-bot.com
   
   # Check external APIs
   curl -I https://api.bingx.com/health
   ```

5. **Check Resources**
   ```bash
   # CPU and Memory
   top -bn1 | head -20
   free -h
   
   # Disk space
   df -h
   
   # Docker resources
   docker stats --no-stream
   ```

6. **Check Recent Changes**
   ```bash
   # Recent commits
   git log --oneline --since="1 hour ago"
   
   # Recent deployments
   kubectl rollout history deployment/api -n trading-bot
   
   # Configuration changes
   git diff HEAD~1 docker-compose.yml
   ```

---

### Phase 5: Resolution (Variable)

**Common Resolution Paths:**

#### Path A: Service Restart
```bash
# Docker
docker-compose restart api
docker-compose restart telegram-bot

# Kubernetes
kubectl rollout restart deployment/api -n trading-bot
kubectl rollout restart deployment/telegram-bot -n trading-bot

# Wait and verify
sleep 30
curl http://localhost:3001/health
```

#### Path B: Rollback
```bash
# See ROLLBACK_PROCEDURES.md for detailed steps

# Quick rollback (Kubernetes)
kubectl rollout undo deployment/api -n trading-bot

# Quick rollback (Docker)
git checkout HEAD~1
docker-compose up -d --build
```

#### Path C: Database Recovery
```bash
# See DISASTER_RECOVERY.md for detailed steps

# Quick database restart
docker-compose restart postgres

# Check database logs
docker-compose logs postgres --tail=100
```

#### Path D: Scale Resources
```bash
# Scale up replicas
kubectl scale deployment/api --replicas=5 -n trading-bot

# Increase resource limits
kubectl set resources deployment/api -n trading-bot \
  --limits=cpu=2000m,memory=2Gi \
  --requests=cpu=1000m,memory=1Gi
```

#### Path E: Emergency Maintenance Mode
```bash
# Enable maintenance mode
kubectl set env deployment/api -n trading-bot MAINTENANCE_MODE=true

# Update status page
curl -X POST https://status.trading-bot.com/api/incidents \
  -H "Authorization: Bearer $STATUS_PAGE_TOKEN" \
  -d '{"status": "maintenance", "message": "Emergency maintenance in progress"}'
```

---

### Phase 6: Verification (5-15 minutes)

**Verification Checklist:**
- [ ] All services running
- [ ] Health checks passing
- [ ] Error rates normal
- [ ] Response times acceptable
- [ ] Database queries working
- [ ] WebSocket connections stable
- [ ] Trading functionality operational
- [ ] No data loss detected
- [ ] Monitoring/alerting working

```bash
# Automated verification script
./scripts/verify-system.sh

# Manual checks
curl http://localhost:3001/health
curl http://localhost:3001/api/trades?limit=1
curl http://localhost:3001/metrics | grep error_rate

# Check Grafana dashboards
open http://localhost:3000/d/trading-bot-overview
```

---

### Phase 7: Post-Incident (After resolution)

**Immediate Actions:**
1. Send resolution notification
2. Monitor for 30 minutes
3. Document timeline
4. Create post-mortem ticket

**Resolution Notification:**
```
✅ INCIDENT RESOLVED

Severity: [SEV-1/2/3/4]
Status: Resolved
Duration: [X minutes/hours]
Root Cause: [Brief description]

A detailed post-mortem will be published within 48 hours.
```

**Post-Mortem (within 48 hours):**
- Timeline of events
- Root cause analysis
- Impact assessment
- Resolution steps
- Lessons learned
- Action items to prevent recurrence

---

## 🔧 Common Incident Scenarios

### Scenario 1: High Error Rate

**Symptoms:**
- Error rate >5%
- 500 errors in logs
- Failed API requests

**Investigation:**
```bash
# Check error logs
docker-compose logs api --tail=200 | grep ERROR

# Check error metrics
curl http://localhost:3001/metrics | grep error_rate

# Check recent deployments
git log --oneline -5
```

**Resolution:**
1. Identify error pattern
2. Check if related to recent deployment
3. Rollback if necessary
4. Fix bug and redeploy

---

### Scenario 2: Database Connection Issues

**Symptoms:**
- "Connection refused" errors
- Timeout errors
- Slow queries

**Investigation:**
```bash
# Check database status
docker-compose ps postgres
kubectl get pods -n trading-bot | grep postgres

# Check connections
psql -h localhost -U postgres -d trading_bot -c "
SELECT count(*) FROM pg_stat_activity;
"

# Check for long-running queries
psql -h localhost -U postgres -d trading_bot -c "
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '1 minute';
"
```

**Resolution:**
1. Restart database if crashed
2. Kill long-running queries
3. Increase connection pool size
4. Optimize slow queries

---

### Scenario 3: Memory Leak

**Symptoms:**
- Increasing memory usage
- OOM kills
- Slow performance

**Investigation:**
```bash
# Check memory usage
docker stats --no-stream
kubectl top pods -n trading-bot

# Check for memory leaks
docker-compose logs api | grep "out of memory"

# Check heap usage (Node.js)
curl http://localhost:3001/metrics | grep heap
```

**Resolution:**
1. Restart affected service
2. Increase memory limits temporarily
3. Investigate and fix memory leak
4. Deploy fix

---

### Scenario 4: External API Failure

**Symptoms:**
- BingX API errors
- Timeout errors
- Rate limiting

**Investigation:**
```bash
# Check external API status
curl -I https://api.bingx.com/health

# Check rate limits
curl http://localhost:3001/metrics | grep rate_limit

# Check API logs
docker-compose logs api | grep "BingX"
```

**Resolution:**
1. Verify external API status
2. Implement retry logic
3. Use fallback data sources
4. Contact API provider if needed

---

### Scenario 5: WebSocket Disconnections

**Symptoms:**
- Clients disconnecting
- Real-time updates not working
- Connection errors

**Investigation:**
```bash
# Check WebSocket connections
curl http://localhost:3001/metrics | grep websocket

# Check logs
docker-compose logs api | grep WebSocket

# Check network
netstat -an | grep 3001 | grep ESTABLISHED
```

**Resolution:**
1. Restart WebSocket server
2. Check load balancer configuration
3. Increase connection limits
4. Implement reconnection logic

---

## 📊 Incident Metrics

Track these metrics for each incident:

- **MTTD** (Mean Time To Detect): Time from incident start to detection
- **MTTR** (Mean Time To Resolve): Time from detection to resolution
- **MTBF** (Mean Time Between Failures): Time between incidents
- **Impact**: Number of users affected, revenue lost

**Target Metrics:**
- MTTD: <5 minutes
- MTTR: <30 minutes (SEV-1), <1 hour (SEV-2)
- MTBF: >30 days
- Availability: 99.9%

---

## 🔗 Quick Links

### Monitoring
- Grafana: http://localhost:3000
- Prometheus: http://localhost:9090
- Metrics: http://localhost:3001/metrics

### Documentation
- [Disaster Recovery](./DISASTER_RECOVERY.md)
- [Rollback Procedures](./ROLLBACK_PROCEDURES.md)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)

### External Services
- BingX Status: https://www.bingx.com/en-us/support/
- AWS Status: https://status.aws.amazon.com/
- GitHub Status: https://www.githubstatus.com/

---

## 📞 Escalation Path

1. **On-Call Engineer** (Primary responder)
2. **DevOps Lead** (If unresolved after 30 minutes)
3. **Backend Lead** (For application issues)
4. **CTO** (For SEV-1 incidents)

---

## 📝 Incident Template

```markdown
# Incident Report: [Brief Title]

**Incident ID:** INC-YYYYMMDD-XXX
**Severity:** SEV-X
**Status:** [Investigating/Resolved]
**Started:** YYYY-MM-DD HH:MM UTC
**Resolved:** YYYY-MM-DD HH:MM UTC
**Duration:** X minutes

## Impact
- Users affected: X
- Services affected: [List]
- Data loss: [Yes/No]

## Timeline
- HH:MM - Incident detected
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix applied
- HH:MM - Incident resolved

## Root Cause
[Detailed explanation]

## Resolution
[Steps taken to resolve]

## Action Items
- [ ] Fix deployed
- [ ] Tests added
- [ ] Documentation updated
- [ ] Post-mortem completed
```

---

**Last Updated:** 2026-05-04  
**Last Reviewed:** 2026-05-04  
**Next Review:** 2026-06-04
