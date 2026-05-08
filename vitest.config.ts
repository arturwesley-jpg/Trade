import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: "@trade/shared/websocket-client", replacement: path.join(root, "src/packages/shared/src/websocket-client.ts") },
      { find: "@trade/shared/websocket-protocol", replacement: path.join(root, "src/packages/shared/src/websocket-protocol.ts") },
      { find: "@trade/shared", replacement: path.join(root, "src/packages/shared/src/index.ts") },
      { find: "@trade/trading-core", replacement: path.join(root, "src/packages/trading-core/src/index.ts") },
      { find: "@trade/exchange", replacement: path.join(root, "src/packages/exchange/src/index.ts") }
    ]
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    globals: true,
    environment: "jsdom",
    setupFiles: [
      "src/packages/trading-core/src/notifications/__tests__/vitest.setup.ts"
    ]
  }
});
