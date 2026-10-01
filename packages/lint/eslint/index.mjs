import css from "@eslint/css";
import json from "@eslint/json";
import html from "@html-eslint/eslint-plugin";
import { defineConfig } from "eslint/config";
import { tailwind4 } from "tailwind-csstree";

import appsConfig from "./apps.mjs";
import reactConfig from "./react.mjs";

export default defineConfig([
  ...reactConfig,
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
  appsConfig,
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
