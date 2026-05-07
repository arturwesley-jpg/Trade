import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(root, "../..");

export default defineConfig({
  resolve: {
    alias: {
      "@trade/shared": path.join(projectRoot, "packages/shared/src/index.ts"),
      "@trade/trading-core": path.join(projectRoot, "packages/trading-core/src/index.ts"),
      "@trade/exchange": path.join(projectRoot, "packages/exchange/src/index.ts")
    }
  },
  test: {
    include: ["**/*.e2e.test.ts"],
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    isolate: true,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: false,
        maxForks: 3,
        minForks: 1
      }
    },
    setupFiles: ["./setup.ts"],
    retry: process.env.CI ? 2 : 0,
    bail: process.env.CI ? 0 : 1,
    reporters: process.env.CI
      ? ["verbose", "json", "html"]
      : ["verbose"],
    outputFile: {
      json: "./test-results.json",
      html: "./html/index.html"
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["apps/**/*.ts", "packages/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.e2e.test.ts",
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
        "**/*.config.ts",
        "**/*.d.ts"
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      },
      all: true,
      clean: true
    },
    sequence: {
      shuffle: false,
      concurrent: true
    },
    maxConcurrency: 3,
    minWorkers: 1,
    maxWorkers: 3
  }
});
