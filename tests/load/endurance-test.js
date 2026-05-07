import http from 'k6/http';
import { check, sleep } from 'k6';

// Endurance test configuration - 24 hour sustained load
export const options = {
  stages: [
    { duration: '5m', target: 200 },    // Ramp up to 200 users
    { duration: '23h50m', target: 200 }, // Stay at 200 users for ~24 hours
    { duration: '5m', target: 0 },      // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export default function () {
  // Simulate realistic user behavior over long period
  const scenario = Math.random();

  if (scenario < 0.5) {
    // 50% - Market data viewing
    const res = http.get(`${BASE_URL}/api/market/BTCUSDT`);
    check(res, { 'market data ok': (r) => r.status === 200 });
    sleep(Math.random() * 10 + 5); // 5-15 seconds between requests
  } else {
    // 50% - Authenticated operations
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      email: `user${Math.floor(Math.random() * 50)}@example.com`,
      password: 'password123',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (loginRes.status === 200) {
      const token = loginRes.json('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      http.get(`${BASE_URL}/api/backtests`, { headers });
      sleep(Math.random() * 20 + 10); // 10-30 seconds
    }
  }
}
