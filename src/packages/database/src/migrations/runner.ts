import * as fs from 'fs';
import * as path from 'path';
import { DatabaseClient } from '../client';

interface Migration {
  id: number;
  name: string;
  filename: string;
  sql: string;
}

export class MigrationRunner {
  private migrationsDir: string;

  constructor(
    private db: DatabaseClient,
    migrationsDir?: string
  ) {
    this.migrationsDir = migrationsDir || path.join(__dirname, '../../migrations');
  }

  async initialize(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  }

  async up(): Promise<void> {
    await this.initialize();

    const migrations = this.loadMigrations();
    const executed = await this.getExecutedMigrations();

    for (const migration of migrations) {
      if (!executed.includes(migration.name)) {
        console.log(`Running migration: ${migration.name}`);

        await this.db.transaction(async (client) => {
          await client.query(migration.sql);
          await client.query(
            'INSERT INTO migrations (name) VALUES ($1)',
            [migration.name]
          );
        });

        console.log(`✓ Migration ${migration.name} completed`);
      }
    }

    console.log('All migrations completed');
  }

  async down(): Promise<void> {
    await this.initialize();

    const migrations = this.loadMigrations().reverse();
    const executed = await this.getExecutedMigrations();

    if (executed.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    const lastExecuted = executed[executed.length - 1];
    const migration = migrations.find(m => m.name === lastExecuted);

    if (!migration) {
      console.error(`Migration ${lastExecuted} not found`);
      return;
    }

    console.log(`Rolling back migration: ${migration.name}`);

    // Note: This is a simplified rollback. In production, you'd want separate down migrations
    await this.db.transaction(async (client) => {
      await client.query('DELETE FROM migrations WHERE name = $1', [migration.name]);
    });

    console.log(`✓ Migration ${migration.name} rolled back`);
  }

  async status(): Promise<void> {
    await this.initialize();

    const migrations = this.loadMigrations();
    const executed = await this.getExecutedMigrations();

    console.log('\nMigration Status:');
    console.log('─'.repeat(60));

    for (const migration of migrations) {
      const status = executed.includes(migration.name) ? '✓' : '✗';
      console.log(`${status} ${migration.name}`);
    }

    console.log('─'.repeat(60));
    console.log(`Total: ${migrations.length} | Executed: ${executed.length} | Pending: ${migrations.length - executed.length}`);
  }

  private loadMigrations(): Migration[] {
    if (!fs.existsSync(this.migrationsDir)) {
      console.warn(`Migrations directory not found: ${this.migrationsDir}`);
      return [];
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    return files.map((filename, index) => {
      const filePath = path.join(this.migrationsDir, filename);
      const sql = fs.readFileSync(filePath, 'utf-8');
      const name = filename.replace('.sql', '');

      return {
        id: index + 1,
        name,
        filename,
        sql
      };
    });
  }

  private async getExecutedMigrations(): Promise<string[]> {
    const result = await this.db.query<{ name: string }>(
      'SELECT name FROM migrations ORDER BY id ASC'
    );
    return result.rows.map(row => row.name);
  }
}

// CLI runner
if (require.main === module) {
  const command = process.argv[2];

  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'trading_bot',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };

  const db = DatabaseClient.getInstance(config);
  const runner = new MigrationRunner(db);

  (async () => {
    try {
      switch (command) {
        case 'up':
          await runner.up();
          break;
        case 'down':
          await runner.down();
          break;
        case 'status':
          await runner.status();
          break;
        default:
          console.log('Usage: node runner.js [up|down|status]');
          process.exit(1);
      }
      await db.close();
      process.exit(0);
    } catch (error) {
      console.error('Migration error:', error);
      await db.close();
      process.exit(1);
    }
  })();
}
