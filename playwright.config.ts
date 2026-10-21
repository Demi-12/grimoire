import { defineConfig } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    // Set PLAYWRIGHT_CHROMIUM_PATH to use a preinstalled Chromium instead of the one `playwright install` downloads.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  // Serves the production build (run `pnpm build` first). All API calls are mocked in the tests, so no database is needed.
  webServer: {
    command: `pnpm start --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      BETTER_AUTH_SECRET: "e2e-placeholder-not-a-secret-0123456789",
      BETTER_AUTH_URL: `http://localhost:${port}`,
    },
  },
});
