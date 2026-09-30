import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "dist",
    "src-tauri",
    "test-results",
    "playwright-report",
    "node_modules",
  ]),
  {
    files: ["**/*.{ts,tsx,js}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
  {
    // Lazy-loaded PDF renderer: exports a factory, never hot-reloaded as UI.
    files: ["src/ResumeDocument.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    files: ["e2e/**/*.ts", "*.config.{ts,js}"],
    languageOptions: { globals: globals.node },
  },
  // Formatting is Prettier's job; disable any stylistic rules that conflict.
  prettier,
]);
