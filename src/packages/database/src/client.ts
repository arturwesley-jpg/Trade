import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';

export interface DatabaseConfig extends PoolConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export class DatabaseClient {
  private pool: Pool;
  private static instance: DatabaseClient;

  private constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      ...config,
      max: config.max || 20,
      min: config.min || 5,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
      // Enable statement timeout (30 seconds)
      statement_timeout: 30000,
      // Enable query timeout
      query_timeout: 30000,
      // Enable keep-alive
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected database error:', err);
    });

    this.pool.on('connect', (client) => {
      // Set session-level optimizations
      client.query('SET work_mem = "64MB"').catch(console.error);
      client.query('SET maintenance_work_mem = "256MB"').catch(console.error);
    });
  }

  static getInstance(config?: DatabaseConfig): DatabaseClient {
    if (!DatabaseClient.instance) {
      if (!config) {
        throw new Error('Database config required for first initialization');
      }
      DatabaseClient.instance = new DatabaseClient(config);
    }
    return DatabaseClient.instance;
  }

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: result.rowCount });
      return result;
    } catch (error) {
      console.error('Query error:', { text, error });
      throw error;
    }
  }

  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  getPool(): Pool {
    return this.pool;
  }
}

export function createDatabaseClient(config: DatabaseConfig): DatabaseClient {
  return DatabaseClient.getInstance(config);
}
