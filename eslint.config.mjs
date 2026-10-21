import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // `const { [id]: _drop, ...rest } = obj` is the idiom for omitting a key.
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }],
      // The React Compiler rules below (new in eslint-plugin-react-hooks 7) flag patterns that are
      // used throughout the existing components: loading data / reading localStorage inside effects,
      // and resetting state when a prop changes. Fixing them means restructuring product code, which
      // is out of scope for adding the linter, so they are off until those components are reworked.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "node_modules/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);
