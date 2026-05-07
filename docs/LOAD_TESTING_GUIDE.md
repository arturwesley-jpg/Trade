# Load Testing Guide

This guide explains how to perform load testing on the Trading Platform using k6.

---

## Overview

Load testing helps identify performance bottlenecks, capacity limits, and system behavior under various load conditions. We use k6, a modern load testing tool designed for developers.

---

## Installation

### Linux (Debian/Ubuntu)

```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### macOS

```bash
brew install k6
```

### Docker

```bash
docker pull grafana/k6:latest
```

---

## Test Scenarios

### 1. Normal Load Test (100 users)

**Purpose:** Baseline performance under normal operating conditions  
**Duration:** 9 minutes  
**Users:** 100 concurrent users  
**File:** `tests/load/normal-load.js`

**Run:**
```bash
k6 run tests/load/normal-load.js
```

**Expected Results:**
- Response time p95 < 500ms
- Error rate < 1%
- All endpoints responding normally

### 2. Peak Load Test (1000 users)

**Purpose:** Performance during peak traffic periods  
**Duration:** 20 minutes  
**Users:** 1000 concurrent users  
**File:** `tests/load/peak-load.js`

**Run:**
```bash
k6 run tests/load/peak-load.js
```

**Expected Results:**
- Response time p95 < 1000ms
- Error rate < 5%
- System remains stable

### 3. Stress Test (5000 users)

**Purpose:** Find system breaking point  
**Duration:** 22 minutes  
**Users:** Up to 5000 concurrent users  
**File:** `tests/load/stress-test.js`

**Run:**
```bash
k6 run tests/load/stress-test.js
```

**Expected Results:**
- Identify maximum capacity
- Graceful degradation (rate limiting)
- No crashes or data corruption

### 4. Spike Test (2000 users sudden)

**Purpose:** System behavior under sudden traffic surge  
**Duration:** 7.5 minutes  
**Users:** Sudden spike from 100 to 2000  
**File:** `tests/load/spike-test.js`

**Run:**
```bash
k6 run tests/load/spike-test.js
```

**Expected Results:**
- System handles sudden load increase
- Auto-scaling triggers (if configured)
- Recovery to normal performance

### 5. Endurance Test (24 hours)

**Purpose:** Memory leaks and long-term stability  
**Duration:** 24 hours  
**Users:** 200 concurrent users  
**File:** `tests/load/endurance-test.js`

**Run:**
```bash
k6 run tests/load/endurance-test.js
```

**Expected Results:**
- No memory leaks
- Consistent performance over time
- No degradation after 24 hours

---

## Configuration

### Environment Variables

Set the base URL for your environment:

```bash
# Local development
export BASE_URL=http://localhost:3001

# Staging
export BASE_URL=https://staging.trading-platform.com

# Production (use with caution!)
export BASE_URL=https://api.trading-platform.com
```

### Custom Options

Override test options via command line:

```bash
# Run with 500 VUs for 5 minutes
k6 run --vus 500 --duration 5m tests/load/normal-load.js

# Run with custom thresholds
k6 run --threshold http_req_duration=p(95)<200 tests/load/normal-load.js
```

---

## Running Tests

### Local Testing

1. Start the API server:
```bash
npm run dev -w apps/api
```

2. Run a load test:
```bash
k6 run tests/load/normal-load.js
```

### Docker Testing

```bash
docker run --rm -i \
  -e BASE_URL=http://host.docker.internal:3001 \
  grafana/k6:latest run - < tests/load/normal-load.js
```

### CI/CD Integration

Add to `.github/workflows/load-test.yml`:

```yaml
name: Load Tests

on:
  schedule:
    - cron: '0 2 * * 0' # Weekly on Sunday at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Run load tests
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}
        run: |
          k6 run tests/load/normal-load.js
          k6 run tests/load/peak-load.js
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: results/
```

---

## Interpreting Results

### Key Metrics

**http_req_duration**
- Average response time
- p(95): 95th percentile (95% of requests faster than this)
- p(99): 99th percentile

**http_req_failed**
- Percentage of failed requests
- Should be < 1% under normal load

**http_reqs**
- Total number of requests
- Requests per second (RPS)

**vus (Virtual Users)**
- Number of concurrent users
- Active at any given time

### Example Output

```
     ✓ login status is 200
     ✓ market data status is 200

     checks.........................: 100.00% ✓ 2000      ✗ 0
     data_received..................: 4.2 MB  140 kB/s
     data_sent......................: 1.1 MB  37 kB/s
     http_req_blocked...............: avg=1.2ms    min=1µs     med=3µs     max=234ms   p(95)=5µs
     http_req_connecting............: avg=1.1ms    min=0s      med=0s      max=233ms   p(95)=0s
     http_req_duration..............: avg=245ms    min=12ms    med=198ms   max=1.2s    p(95)=456ms
     http_req_failed................: 0.00%   ✓ 0         ✗ 2000
     http_req_receiving.............: avg=1.2ms    min=23µs    med=89µs    max=45ms    p(95)=3.4ms
     http_req_sending...............: avg=45µs     min=7µs     med=23µs    max=2.1ms   p(95)=89µs
     http_req_tls_handshaking.......: avg=0s       min=0s      med=0s      max=0s      p(95)=0s
     http_req_waiting...............: avg=244ms    min=12ms    med=197ms   max=1.2s    p(95)=455ms
     http_reqs......................: 2000    66.666667/s
     iteration_duration.............: avg=1.5s     min=1.01s   med=1.45s   max=2.8s    p(95)=1.89s
     iterations.....................: 1000    33.333333/s
     vus............................: 100     min=100     max=100
     vus_max........................: 100     min=100     max=100
```

### Performance Targets

| Metric | Target | Good | Acceptable | Poor |
|--------|--------|------|------------|------|
| Response Time (p95) | < 200ms | < 500ms | < 1000ms | > 1000ms |
| Error Rate | < 0.1% | < 1% | < 5% | > 5% |
| Throughput | > 1000 RPS | > 500 RPS | > 100 RPS | < 100 RPS |

---

## Monitoring During Tests

### Prometheus Metrics

Monitor these metrics during load tests:

```bash
# Request rate
rate(http_requests_total[1m])

# Response time
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
rate(http_requests_total{status=~"5.."}[1m])

# CPU usage
rate(process_cpu_seconds_total[1m])

# Memory usage
process_resident_memory_bytes
```

### Grafana Dashboard

Import the k6 dashboard:
1. Go to Grafana
2. Import dashboard ID: 2587
3. Select Prometheus data source
4. Monitor real-time metrics

---

## Troubleshooting

### High Error Rates

**Symptoms:** Error rate > 5%

**Possible Causes:**
- Database connection pool exhausted
- Rate limiting triggered
- Memory exhaustion
- Network issues

**Solutions:**
- Increase database connection pool
- Adjust rate limits
- Scale horizontally
- Check network configuration

### Slow Response Times

**Symptoms:** p95 > 1000ms

**Possible Causes:**
- Slow database queries
- Inefficient code
- Insufficient resources
- External API delays

**Solutions:**
- Optimize database queries
- Add caching
- Scale vertically/horizontally
- Implement timeouts

### Memory Leaks

**Symptoms:** Memory usage increases over time

**Detection:**
- Run endurance test
- Monitor memory metrics
- Check for increasing response times

**Solutions:**
- Profile application
- Fix memory leaks
- Implement proper cleanup
- Restart workers periodically

---

## Best Practices

### Before Testing

1. **Backup data** - Load tests can create test data
2. **Notify team** - Avoid surprises during tests
3. **Monitor resources** - Set up monitoring before starting
4. **Start small** - Begin with normal load, then increase

### During Testing

1. **Monitor continuously** - Watch metrics in real-time
2. **Document observations** - Note any anomalies
3. **Be ready to stop** - Kill switch if things go wrong
4. **Check logs** - Look for errors and warnings

### After Testing

1. **Analyze results** - Review all metrics
2. **Compare baselines** - Track performance over time
3. **Document findings** - Create reports
4. **Plan improvements** - Address bottlenecks

---

## Capacity Planning

### Current Capacity (Estimated)

Based on initial testing:

| Scenario | Max Users | RPS | Response Time (p95) |
|----------|-----------|-----|---------------------|
| Normal Load | 100 | 50 | 200ms |
| Peak Load | 1000 | 500 | 500ms |
| Stress Test | 5000 | 2000 | 1000ms |

### Scaling Recommendations

**Horizontal Scaling:**
- Add API server replicas when CPU > 70%
- Add database read replicas when queries > 1000/s
- Use Redis for session storage

**Vertical Scaling:**
- Increase API server memory to 4GB
- Increase database memory to 8GB
- Use faster storage (SSD)

---

## Next Steps

1. **Install k6** on your system
2. **Run normal load test** to establish baseline
3. **Run peak load test** to verify capacity
4. **Document results** in capacity planning doc
5. **Set up monitoring** for production
6. **Schedule regular tests** (weekly/monthly)

---

**Created:** 2026-05-03  
**Last Updated:** 2026-05-03  
**Version:** 1.0
