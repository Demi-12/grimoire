import { defineConfig } from "vitest/config";

export default defineConfig({
  // Playwright specs in e2e/ run with `pnpm test:e2e`, not vitest.
  test: { exclude: ["e2e/**", "node_modules/**", ".next/**"] },
});
