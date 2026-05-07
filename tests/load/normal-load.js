import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users over 2 minutes
    { duration: '5m', target: 100 }, // Stay at 100 users for 5 minutes
    { duration: '2m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],   // Error rate should be less than 1%
    errors: ['rate<0.1'],              // Custom error rate should be less than 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Test data
const testUsers = [
  { email: 'test1@example.com', password: 'password123' },
  { email: 'test2@example.com', password: 'password123' },
  { email: 'test3@example.com', password: 'password123' },
];

export function setup() {
  // Setup phase - create test users if needed
  console.log('Setting up load test...');
  return { baseUrl: BASE_URL };
}

export default function (data) {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];

  // 1. Login
  let loginRes = http.post(`${data.baseUrl}/api/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const loginSuccess = check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login has token': (r) => r.json('token') !== undefined,
  });

  errorRate.add(!loginSuccess);

  if (!loginSuccess) {
    console.error(`Login failed for ${user.email}: ${loginRes.status}`);
    return;
  }

  const token = loginRes.json('token');
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  sleep(1);

  // 2. Get user profile
  let profileRes = http.get(`${data.baseUrl}/api/auth/me`, { headers });
  check(profileRes, {
    'profile status is 200': (r) => r.status === 200,
  });

  sleep(1);

  // 3. Get market data
  let marketRes = http.get(`${data.baseUrl}/api/market/BTCUSDT`, { headers });
  check(marketRes, {
    'market data status is 200': (r) => r.status === 200,
  });

  sleep(1);

  // 4. Get backtests
  let backtestsRes = http.get(`${data.baseUrl}/api/backtests`, { headers });
  check(backtestsRes, {
    'backtests status is 200': (r) => r.status === 200,
  });

  sleep(2);

  // 5. Create a backtest
  let createBacktestRes = http.post(`${data.baseUrl}/api/backtests`, JSON.stringify({
    name: `Load Test Backtest ${Date.now()}`,
    symbol: 'BTCUSDT',
    interval: '1h',
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    initialCapital: 10000,
    strategy: {
      type: 'sma_crossover',
      params: { fastPeriod: 10, slowPeriod: 20 }
    }
  }), { headers });

  check(createBacktestRes, {
    'create backtest status is 201': (r) => r.status === 201,
  });

  sleep(2);

  // 6. Get strategies
  let strategiesRes = http.get(`${data.baseUrl}/api/strategies`, { headers });
  check(strategiesRes, {
    'strategies status is 200': (r) => r.status === 200,
  });

  sleep(1);
}

export function teardown(data) {
  console.log('Load test completed');
}
