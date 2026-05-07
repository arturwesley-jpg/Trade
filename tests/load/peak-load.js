import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Peak load test configuration - 1000 concurrent users
export const options = {
  stages: [
    { duration: '5m', target: 1000 },  // Ramp up to 1000 users over 5 minutes
    { duration: '10m', target: 1000 }, // Stay at 1000 users for 10 minutes
    { duration: '5m', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests should be below 1s
    http_req_failed: ['rate<0.05'],    // Error rate should be less than 5%
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export default function () {
  // Simulate various user behaviors
  const scenario = Math.random();

  if (scenario < 0.3) {
    // 30% - Read-only users (viewing data)
    readOnlyUser();
  } else if (scenario < 0.6) {
    // 30% - Active traders (creating backtests)
    activeTrader();
  } else if (scenario < 0.9) {
    // 30% - Dashboard users (monitoring)
    dashboardUser();
  } else {
    // 10% - Admin users
    adminUser();
  }
}

function readOnlyUser() {
  const res = http.get(`${BASE_URL}/api/market/BTCUSDT`);
  check(res, { 'market data loaded': (r) => r.status === 200 });
  sleep(Math.random() * 3 + 2); // 2-5 seconds
}

function activeTrader() {
  // Login
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: `trader${Math.floor(Math.random() * 100)}@example.com`,
    password: 'password123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status !== 200) {
    errorRate.add(1);
    return;
  }

  const token = loginRes.json('token');
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Get backtests
  http.get(`${BASE_URL}/api/backtests`, { headers });
  sleep(1);

  // Create backtest
  http.post(`${BASE_URL}/api/backtests`, JSON.stringify({
    name: `Peak Load Test ${Date.now()}`,
    symbol: 'BTCUSDT',
    interval: '1h',
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    initialCapital: 10000,
  }), { headers });

  sleep(Math.random() * 2 + 1);
}

function dashboardUser() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: `user${Math.floor(Math.random() * 100)}@example.com`,
    password: 'password123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status !== 200) {
    errorRate.add(1);
    return;
  }

  const token = loginRes.json('token');
  const headers = { 'Authorization': `Bearer ${token}` };

  // Simulate dashboard polling
  for (let i = 0; i < 5; i++) {
    http.get(`${BASE_URL}/api/metrics`, { headers });
    sleep(2);
  }
}

function adminUser() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'admin@example.com',
    password: 'admin123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status !== 200) {
    errorRate.add(1);
    return;
  }

  const token = loginRes.json('token');
  const headers = { 'Authorization': `Bearer ${token}` };

  // Admin operations
  http.get(`${BASE_URL}/api/admin/users`, { headers });
  sleep(1);
  http.get(`${BASE_URL}/api/admin/stats`, { headers });
  sleep(2);
}
