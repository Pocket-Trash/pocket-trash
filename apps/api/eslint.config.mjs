import baseConfig from "@package/eslint/base";

export default [
  {
    ignores: [".wrangler/**", "src/worker-configuration.d.ts"],
  },
  ...baseConfig,
  {
    files: ["vitest.config.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
  },
];
