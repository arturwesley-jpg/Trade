import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Stress test configuration - Push system to breaking point
export const options = {
  stages: [
    { duration: '2m', target: 1000 },  // Ramp up to 1000 users
    { duration: '5m', target: 3000 },  // Ramp up to 3000 users
    { duration: '5m', target: 5000 },  // Ramp up to 5000 users (stress)
    { duration: '5m', target: 5000 },  // Stay at 5000 users
    { duration: '5m', target: 0 },     // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2s
    http_req_failed: ['rate<0.1'],     // Error rate should be less than 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export default function () {
  // High-intensity operations
  const operations = [
    () => http.get(`${BASE_URL}/api/market/BTCUSDT`),
    () => http.get(`${BASE_URL}/api/market/ETHUSDT`),
    () => http.get(`${BASE_URL}/api/market/BNBUSDT`),
  ];

  const operation = operations[Math.floor(Math.random() * operations.length)];
  const res = operation();

  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429, // Accept rate limiting
  });

  errorRate.add(res.status !== 200 && res.status !== 429);

  sleep(Math.random() * 0.5); // Very short sleep - high load
}
