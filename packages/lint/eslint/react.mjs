import { defineConfig } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y-x";
import reactHooks from "eslint-plugin-react-hooks";
import reactX from "eslint-plugin-react-x";
import globals from "globals";

import baseConfig from "./base.mjs";

export default defineConfig([
  ...baseConfig,
  {
    files: ["**/*.{jsx,tsx}"],
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
    files: ["**/*.{jsx,tsx}"],
    ...jsxA11y.configs.recommended,
    rules: {
      ...jsxA11y.configs.recommended.rules,
      "jsx-a11y-x/anchor-has-content": "off",
    },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "warn",
    },
  },
  {
    files: ["apps/web/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
  },
]);
