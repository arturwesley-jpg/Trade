import { runPostgresMigrations } from "@trade/trading-core";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required to run migrations.");
  process.exit(1);
}

await runPostgresMigrations(databaseUrl);
console.log("Postgres migrations applied.");
