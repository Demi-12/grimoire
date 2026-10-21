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
});
