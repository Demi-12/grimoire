import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path("./src"),
      // `server-only` throws outside the Next.js server build; tests may import server modules.
      "server-only": path("./tests/stubs/server-only.ts"),
    },
  },
  // Playwright specs in e2e/ run with `pnpm test:e2e`, not vitest.
  test: { exclude: ["e2e/**", "node_modules/**", ".next/**"] },
});
