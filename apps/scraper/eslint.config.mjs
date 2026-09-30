import appStorageBoundary from "@package/eslint/apps";
import baseConfig from "@package/eslint/base";

export default [
  ...baseConfig,
  {
    files: ["vitest.config.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
  },
  appStorageBoundary,
];
