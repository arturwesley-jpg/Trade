import { beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test_user:test_password@localhost:5433/trade_test_db";
process.env.REDIS_URL = "redis://localhost:6380";
process.env.BINGX_WS_URL = "ws://localhost:8080/swap-market";
process.env.USE_SIMULATED_MARKET = "false";
process.env.PAPER_TRADING_ONLY = "true";
process.env.API_PORT = "4001";
process.env.LOG_LEVEL = "error";

let dockerStarted = false;

beforeAll(async () => {
  console.log("Starting E2E test infrastructure...");

  try {
    // Check if Docker Compose is already running
    try {
      execSync('docker compose -f tests/e2e/docker-compose.test.yml ps --services --filter "status=running"', {
        cwd: process.cwd(),
        stdio: "pipe"
      });
      console.log("Docker services already running");
    } catch {
      // Start Docker Compose services
      execSync("docker compose -f tests/e2e/docker-compose.test.yml up -d --build", {
        cwd: process.cwd(),
        stdio: "inherit"
      });
      dockerStarted = true;
      console.log("Docker services started");
    }

    // Wait for services to be healthy
    console.log("Waiting for services to be healthy...");
    await waitForServices();
    console.log("All services are healthy");
  } catch (error) {
    console.error("Failed to start test infrastructure:", error);
    throw error;
  }
}, 60000);

afterAll(async () => {
  if (dockerStarted) {
    console.log("Stopping E2E test infrastructure...");
    try {
      execSync("docker compose -f tests/e2e/docker-compose.test.yml down -v", {
        cwd: process.cwd(),
        stdio: "inherit"
      });
      console.log("Docker services stopped");
    } catch (error) {
      console.error("Failed to stop test infrastructure:", error);
    }
  }
});

async function waitForServices(maxAttempts = 30, delayMs = 1000): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = execSync(
        'docker compose -f tests/e2e/docker-compose.test.yml ps --format json',
        { cwd: process.cwd(), encoding: "utf-8" }
      );

      const services = result
        .trim()
        .split("\n")
        .filter(line => line)
        .map(line => JSON.parse(line));

      const allHealthy = services.every(
        service => service.Health === "healthy" || service.State === "running"
      );

      if (allHealthy && services.length >= 3) {
        return;
      }
    } catch (error) {
      // Continue waiting
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  throw new Error("Services did not become healthy in time");
}
