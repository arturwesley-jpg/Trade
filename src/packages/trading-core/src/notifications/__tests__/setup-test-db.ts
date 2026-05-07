import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Test Database Setup
 *
 * This module provides utilities for setting up and tearing down
 * the test database for notification system integration tests.
 */

export interface TestDbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

const DEFAULT_TEST_CONFIG: TestDbConfig = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432'),
  database: process.env.TEST_DB_NAME || 'trading_test',
  user: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'postgres',
};

let testPool: Pool | null = null;

/**
 * Get or create test database connection pool
 */
export function getTestPool(config: Partial<TestDbConfig> = {}): Pool {
  if (!testPool) {
    const finalConfig = { ...DEFAULT_TEST_CONFIG, ...config };
    testPool = new Pool(finalConfig);
  }
  return testPool;
}

/**
 * Close test database connection pool
 */
export async function closeTestPool(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

/**
 * Setup test database schema
 */
export async function setupTestDatabase(config: Partial<TestDbConfig> = {}): Promise<void> {
  const pool = getTestPool(config);

  try {
    // Read schema file
    const schemaPath = join(__dirname, '..', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Execute schema
    await pool.query(schema);

    console.log('Test database schema created successfully');
  } catch (error) {
    console.error('Failed to setup test database:', error);
    throw error;
  }
}

/**
 * Clean test database (drop all tables)
 */
export async function cleanTestDatabase(): Promise<void> {
  const pool = getTestPool();

  try {
    await pool.query(`
      DROP TABLE IF EXISTS notification_delivery_log CASCADE;
      DROP TABLE IF EXISTS alert_rules CASCADE;
      DROP TABLE IF EXISTS alert_events CASCADE;
      DROP TABLE IF EXISTS alerts CASCADE;
      DROP TABLE IF EXISTS notification_templates CASCADE;
      DROP TABLE IF EXISTS notification_preferences CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP VIEW IF EXISTS notification_stats_by_user CASCADE;
      DROP VIEW IF EXISTS alert_stats_by_user CASCADE;
      DROP VIEW IF EXISTS recent_alert_events CASCADE;
      DROP FUNCTION IF EXISTS cleanup_old_notifications CASCADE;
      DROP FUNCTION IF EXISTS cleanup_old_alert_events CASCADE;
      DROP FUNCTION IF EXISTS get_notification_delivery_rate CASCADE;
      DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
    `);

    console.log('Test database cleaned successfully');
  } catch (error) {
    console.error('Failed to clean test database:', error);
    throw error;
  }
}

/**
 * Reset test database (clean + setup)
 */
export async function resetTestDatabase(config: Partial<TestDbConfig> = {}): Promise<void> {
  await cleanTestDatabase();
  await setupTestDatabase(config);
}

/**
 * Insert test fixtures
 */
export async function insertTestFixtures(): Promise<void> {
  const pool = getTestPool();

  try {
    // Insert test user preferences
    await pool.query(`
      INSERT INTO notification_preferences (user_id, channels, updated_at)
      VALUES
        ('test-user-1', '{"email": {"enabled": true}, "sms": {"enabled": false}}', NOW()),
        ('test-user-2', '{"email": {"enabled": true}, "telegram": {"enabled": true}}', NOW())
      ON CONFLICT (user_id) DO NOTHING
    `);

    // Insert test templates
    await pool.query(`
      INSERT INTO notification_templates (id, name, description, channel, subject, body, variables, created_at, updated_at)
      VALUES
        ('template-1', 'Price Alert', 'Price alert template', 'email', 'Price Alert: {{symbol}}', 'Price of {{symbol}} reached {{price}}', '["symbol", "price"]', NOW(), NOW()),
        ('template-2', 'Trade Executed', 'Trade execution template', 'telegram', NULL, 'Trade executed: {{side}} {{quantity}} {{symbol}} at {{price}}', '["side", "quantity", "symbol", "price"]', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    console.log('Test fixtures inserted successfully');
  } catch (error) {
    console.error('Failed to insert test fixtures:', error);
    throw error;
  }
}

/**
 * Check if database is available
 */
export async function isDatabaseAvailable(config: Partial<TestDbConfig> = {}): Promise<boolean> {
  const finalConfig = { ...DEFAULT_TEST_CONFIG, ...config };
  const pool = new Pool(finalConfig);

  try {
    await pool.query('SELECT 1');
    await pool.end();
    return true;
  } catch (error) {
    await pool.end();
    return false;
  }
}

/**
 * Wait for database to be available
 */
export async function waitForDatabase(
  config: Partial<TestDbConfig> = {},
  maxAttempts: number = 10,
  delayMs: number = 1000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isDatabaseAvailable(config)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return false;
}
