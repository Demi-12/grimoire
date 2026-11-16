import { defineConfig } from "vitest/config";

/**
 * Unit tests sit next to the code (src/**\/*.test.ts). The integration tests in test/ talk to a real
 * PostgreSQL and skip themselves unless TEST_DATABASE_URL is set (see docs/database-migrations.md).
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // Integration files share one database: run them one after another.
    fileParallelism: false,
  },
});
