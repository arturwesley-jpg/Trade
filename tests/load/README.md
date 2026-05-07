# Load Testing with k6

## Overview

This directory contains k6 load test scripts for the Trading Bot API.

## Prerequisites

Install k6:

```bash
# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# macOS
brew install k6

# Docker
docker pull grafana/k6
```

## Test Scenarios

### 1. Normal Load Test (`normal-load.js`)
Simulates typical user behavior with authentication flows.

**Profile:**
- 50-100 concurrent users
- 16 minutes duration
- Mix of authenticated and public endpoints

**Run:**
```bash
k6 run normal-load.js
```

### 2. Stress Test (`stress-test.js`)
Tests system behavior under heavy load.

**Profile:**
- Ramps up to 400 concurrent users
- 19 minutes duration
- High request rate

**Run:**
```bash
k6 run stress-test.js
```

### 3. Spike Test (`spike-test.js`)
Tests system response to sudden traffic spikes.

**Profile:**
- Sudden spike from 50 to 500 users
- 6 minutes duration
- Tests auto-scaling and recovery

**Run:**
```bash
k6 run spike-test.js
```

### 4. Endurance Test (`endurance-test.js`)
Tests system stability over extended periods.

**Profile:**
- 100 concurrent users
- 40 minutes duration
- Detects memory leaks and degradation

**Run:**
```bash
k6 run endurance-test.js
```

## Configuration

Set the base URL via environment variable:

```bash
BASE_URL=http://localhost:3000 k6 run normal-load.js
```

## Thresholds

Each test defines thresholds for:
- **Response time**: p95 < 500ms (normal), < 1000ms (stress), < 2000ms (spike)
- **Error rate**: < 1% (normal/endurance), < 5% (stress/spike)

## Interpreting Results

### Key Metrics

- **http_req_duration**: Request duration (p50, p95, p99)
- **http_reqs**: Total requests and requests/second
- **errors**: Error rate
- **vus**: Virtual users (concurrent)

### Success Criteria

✅ **Pass**: All thresholds met
❌ **Fail**: One or more thresholds exceeded

### Example Output

```
✓ status is 200
✓ response time < 500ms

checks.........................: 100.00% ✓ 12000 ✗ 0
data_received..................: 24 MB   40 kB/s
data_sent......................: 1.2 MB  2.0 kB/s
http_req_duration..............: avg=245ms min=120ms med=230ms max=480ms p(95)=420ms p(99)=460ms
http_reqs......................: 12000   20/s
vus............................: 100     min=0 max=100
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/load-test.yml
- name: Run load tests
  run: |
    k6 run --out json=results.json tests/load/normal-load.js
    
- name: Check thresholds
  run: |
    if grep -q '"thresholds":{.*"failed":true' results.json; then
      echo "Load test thresholds failed"
      exit 1
    fi
```

## Monitoring During Tests

While tests run, monitor:
- Prometheus metrics: http://localhost:9090
- Grafana dashboards: http://localhost:3001
- Application logs: `docker-compose logs -f api`

## Troubleshooting

### High Error Rates
- Check application logs
- Verify database connections
- Check resource limits (CPU, memory)

### Slow Response Times
- Check database query performance
- Review API endpoint implementations
- Check external API latency

### Connection Errors
- Verify service is running
- Check network connectivity
- Increase connection pool size

## Best Practices

1. **Run tests in staging** before production
2. **Monitor resources** during tests
3. **Baseline first** - establish normal performance
4. **Incremental load** - don't jump to max load
5. **Analyze failures** - investigate threshold violations
6. **Regular testing** - run weekly or before releases
