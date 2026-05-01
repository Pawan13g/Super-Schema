import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Stub Next's server-only marker so module-level imports don't blow
      // up under vitest's client-by-default loader.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
