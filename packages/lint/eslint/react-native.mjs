import { defineConfig } from "eslint/config";

import baseConfig from "./base.mjs";

export default defineConfig([
  ...baseConfig,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        __DEV__: "readonly",
        fetch: "readonly",
      },
    },
  },
]);
