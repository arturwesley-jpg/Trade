import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@trade/shared": path.join(root, "packages/shared/src/index.ts"),
      "@trade/trading-core": path.join(root, "packages/trading-core/src/index.ts"),
      "@trade/exchange": path.join(root, "packages/exchange/src/index.ts")
    }
  },
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    globals: true,
    setupFiles: [
      "packages/trading-core/src/notifications/__tests__/vitest.setup.ts"
    ]
  }
});
