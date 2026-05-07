import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

export async function runPostgresMigrations(databaseUrl: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    for (const migration of migrations()) {
      const existing = await client.query("SELECT version FROM schema_migrations WHERE version = $1", [migration.version]);
      if (existing.rowCount) continue;
      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query("INSERT INTO schema_migrations(version) VALUES ($1)", [migration.version]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

function migrations(): Array<{ version: string; sql: string }> {
  const currentDir = dirname(fileURLToPath(import.meta.url));

  const migrationFiles = [
    { version: "001_initial_core", filename: "001_initial_core.sql" },
    { version: "002_auth_and_backtests", filename: "002_auth_and_backtests.sql" }
  ];

  const result: Array<{ version: string; sql: string }> = [];

  for (const { version, filename } of migrationFiles) {
    const candidates = [
      join(currentDir, `../migrations/${filename}`),
      join(currentDir, `../../migrations/${filename}`)
    ];

    const migrationPath = candidates.find((path) => {
      try {
        readFileSync(path, "utf8");
        return true;
      } catch {
        return false;
      }
    });

    if (!migrationPath) throw new Error(`Migration ${filename} not found`);
    result.push({ version, sql: readFileSync(migrationPath, "utf8") });
  }

  return result;
}
