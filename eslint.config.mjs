import { defineConfig, globalIgnores } from "eslint/config";
import angular from "angular-eslint";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["**/dist/**", "**/.angular/**", "**/node_modules/**", "playwright-report/**", "test-results/**", "coverage/**"]),
  {
    files: ["**/*.ts"],
    extends: [tseslint.configs.recommended],
    rules: {
      // `const { [id]: _drop, ...rest } = obj` is the idiom for omitting a key.
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }],
    },
  },
  {
    files: ["apps/web/src/**/*.ts"],
    extends: [angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      // Pages are routed components named after their route (HomePage, MapPage…), not *Component.
      "@angular-eslint/component-class-suffix": ["error", { suffixes: ["Component", "Page"] }],
      // Off: besides `app-*` elements, components here sit on the element they draw (`svg[appIcon]`,
      // `header[appPageHeader]`, `li[appSpellRow]`) so the DOM and the CSS keep their shape, and the rule can
      // only describe one of the two forms.
      "@angular-eslint/component-selector": "off",
      "@angular-eslint/directive-selector": ["error", { type: "attribute", prefix: "app", style: "camelCase" }],
    },
  },
  {
    files: ["apps/web/src/**/*.html"],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
  },
]);
