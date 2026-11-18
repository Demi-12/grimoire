import { defineConfig } from "vitest/config";
/** The rules' unit tests sit next to each module (src/*.test.ts). */
export default defineConfig({
    test: { include: ["src/**/*.test.ts"] },
});
//# sourceMappingURL=vitest.config.js.map