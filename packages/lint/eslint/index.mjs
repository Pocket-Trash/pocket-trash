import css from "@eslint/css";
import js from "@eslint/js";
import json from "@eslint/json";
import html from "@html-eslint/eslint-plugin";
import { defineConfig } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y-x";
import reactHooks from "eslint-plugin-react-hooks";
import reactX from "eslint-plugin-react-x";
import globals from "globals";
import { tailwind4 } from "tailwind-csstree";
import tseslint from "typescript-eslint";

/** JavaScript source patterns handled by ESLint's native parser. */
const javascriptFiles = ["**/*.{js,mjs,cjs}"];
/** TypeScript source patterns handled by typescript-eslint. */
const typescriptFiles = ["**/*.{ts,tsx,mts,cts}"];
/** JSX-bearing source patterns that receive React and accessibility rules. */
const reactFiles = ["**/*.{jsx,tsx}"];

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
    files: javascriptFiles,
    languageOptions: {
      globals: globals.node,
    },
  },
  ...tseslint.configs.recommended,
  {
    files: typescriptFiles,
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
    files: reactFiles,
    ...reactX.configs["recommended-typescript"],
    rules: {
      ...reactX.configs["recommended-typescript"].rules,
      "react-x/exhaustive-deps": "off",
      "react-x/no-context-provider": "off",
      "react-x/no-forward-ref": "off",
      "react-x/no-use-context": "off",
      "react-x/rules-of-hooks": "off",
      "react-x/set-state-in-effect": "off",
      "react-x/use-state": "off",
    },
  },
  {
    files: reactFiles,
    ...jsxA11y.configs.recommended,
    rules: {
      ...jsxA11y.configs.recommended.rules,
      "jsx-a11y-x/anchor-has-content": "off",
    },
  },
  {
    files: reactFiles,
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "warn",
    },
  },
  {
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["apps/web/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ["tools/figjam-plugin/code.js"],
    languageOptions: {
      globals: {
        __html__: "readonly",
        figma: "readonly",
      },
    },
  },
  {
    files: ["packages/infisical-runner/src/env-alias.mjs"],
    rules: {
      "no-redeclare": "off",
    },
  },
  {
    files: [
      "apps/web/src/**/*.{js,jsx,ts,tsx}",
      "packages/database/src/**/*.{js,jsx,ts,tsx}",
      "packages/services/src/**/*.{js,jsx,ts,tsx}",
    ],
    rules: {
      "no-console": "error",
    },
  },
  {
    files: ["apps/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@package/storage", "@package/storage/*"],
              message: "Apps must use storage through @package/services.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/database/src/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              message:
                "Keep packages/database storage-only. Log database behavior from packages/services instead.",
              name: "@package/logger",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.json"],
    extends: ["json/recommended"],
    language: "json/json",
    plugins: { json },
  },
  {
    files: ["**/*.jsonc"],
    extends: ["json/recommended"],
    language: "json/jsonc",
    languageOptions: {
      allowTrailingCommas: true,
    },
    plugins: { json },
  },
  {
    files: ["**/*.css"],
    extends: ["css/recommended"],
    language: "css/css",
    languageOptions: {
      customSyntax: tailwind4,
    },
    plugins: { css },
    rules: {
      "css/no-invalid-at-rules": "off",
      "css/use-baseline": "off",
    },
  },
  {
    files: ["**/*.html"],
    languageOptions: html.configs["flat/recommended"].languageOptions,
    plugins: html.configs["flat/recommended"].plugins,
    rules: {
      "@html-eslint/no-accesskey-attrs": "error",
      "@html-eslint/no-aria-hidden-on-focusable": "error",
      "@html-eslint/no-duplicate-attrs": "error",
      "@html-eslint/no-duplicate-id": "error",
      "@html-eslint/no-invalid-role": "error",
      "@html-eslint/no-positive-tabindex": "error",
      "@html-eslint/no-redundant-role": "error",
      "@html-eslint/no-target-blank": "error",
      "@html-eslint/require-button-type": "error",
      "@html-eslint/require-frame-title": "error",
      "@html-eslint/require-img-alt": "error",
      "@html-eslint/require-input-label": "error",
      "@html-eslint/require-lang": "error",
    },
  },
]);
