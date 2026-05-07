import { beforeAll, afterAll, beforeEach } from 'vitest';
import {
  isDatabaseAvailable,
  setupTestDatabase,
  cleanTestDatabase,
  insertTestFixtures,
  closeTestPool,
} from './setup-test-db';

/**
 * Vitest setup for notification system integration tests
 *
 * This file runs before all tests to setup the test database.
 * If PostgreSQL is not available, tests will be skipped.
 */

let dbAvailable = false;

beforeAll(async () => {
  // Check if database is available
  dbAvailable = await isDatabaseAvailable();

  if (!dbAvailable) {
    console.warn('⚠️  PostgreSQL not available - notification integration tests will be skipped');
    console.warn('   To run these tests, ensure PostgreSQL is running on localhost:5432');
    console.warn('   Or set TEST_DB_HOST, TEST_DB_PORT, TEST_DB_NAME, TEST_DB_USER, TEST_DB_PASSWORD');
    return;
  }

  try {
    // Setup database schema
    await setupTestDatabase();
    console.log('✓ Test database schema created');

    // Insert test fixtures
    await insertTestFixtures();
    console.log('✓ Test fixtures inserted');
  } catch (error) {
    console.error('Failed to setup test database:', error);
    dbAvailable = false;
  }
}, 30000); // 30 second timeout for setup

beforeEach(async () => {
  if (!dbAvailable) {
    return;
  }

  // Clean notification data between tests (keep schema and fixtures)
  const pool = (await import('./setup-test-db')).getTestPool();
  await pool.query('DELETE FROM notification_delivery_log');
  await pool.query('DELETE FROM alert_events');
  await pool.query('DELETE FROM alerts');
  await pool.query('DELETE FROM notifications');
});

afterAll(async () => {
  if (!dbAvailable) {
    return;
  }

  try {
    // Clean up test database
    await cleanTestDatabase();
    console.log('✓ Test database cleaned');
  } catch (error) {
    console.error('Failed to clean test database:', error);
  } finally {
    // Close connection pool
    await closeTestPool();
  }
});

// Export database availability for tests to check
export function isTestDatabaseAvailable(): boolean {
  return dbAvailable;
}
