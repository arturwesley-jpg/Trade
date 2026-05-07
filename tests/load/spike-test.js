import http from 'k6/http';
import { check, sleep } from 'k6';

// Spike test configuration - Sudden traffic surge
export const options = {
  stages: [
    { duration: '1m', target: 100 },   // Normal load
    { duration: '30s', target: 2000 }, // Sudden spike to 2000 users
    { duration: '3m', target: 2000 },  // Stay at spike level
    { duration: '1m', target: 100 },   // Drop back to normal
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export default function () {
  const res = http.get(`${BASE_URL}/api/market/BTCUSDT`);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
