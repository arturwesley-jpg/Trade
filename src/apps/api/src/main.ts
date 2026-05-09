import { buildApp } from "./app.js";

const host = process.env.API_HOST ?? "0.0.0.0";
const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);

const app = await buildApp({
  liveTradingEnabled: process.env.ENABLE_LIVE_TRADING === "true",
  adminToken: process.env.ADMIN_API_TOKEN,
  coingeckoApiKey: process.env.COINGECKO_API_KEY,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-in-production",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-in-production"
});

await app.listen({ host, port });
console.log(`API listening on ${host}:${port}`);

const shutdown = async () => {
  try {
    await app.close();
  } finally {
    process.exit(0);
  }
};

process.on("SIGTERM", () => {
  void shutdown();
});

process.on("SIGINT", () => {
  void shutdown();
});
