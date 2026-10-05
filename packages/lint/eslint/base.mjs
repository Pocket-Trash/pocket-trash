import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: [
      "**/node_modules/**",
      "**/.turbo/**",
      "**/dist/**",
      "**/build/**",
      "**/.output/**",
      "**/.vercel/**",
      "**/.tanstack/**",
      "**/.expo/**",
      "**/coverage/**",
      "**/storybook-static/**",
      "**/routeTree.gen.ts",
      "apps/api/.wrangler/**",
      "apps/api/src/worker-configuration.d.ts",
      "apps/web/src/vite-env.d.ts",
      "packages/database/drizzle/**",
      "packages/database/drizzle.config.ts",
    ],
  },
  {
    ...js.configs.recommended,
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: globals.node,
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/prefer-optional-chain": "warn",
    },
  },
  {
    files: [
      "apps/api/vitest.config.ts",
      "apps/scraper/vitest.config.ts",
      "packages/logger/scripts/**/*.ts",
    ],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      "@typescript-eslint/prefer-optional-chain": "off",
    },
  },
  {
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["packages/infisical-runner/src/env-alias.mjs"],
    rules: {
      "no-redeclare": "off",
    },
  },
]);
