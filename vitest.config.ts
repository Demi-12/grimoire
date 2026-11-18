import { defineConfig } from "vitest/config";

/** Root tests: the repository's own configuration (compose, .env.example, workflows). Each package runs its own suite. */
export default defineConfig({
  test: { include: ["tests/**/*.test.mjs"] },
});
