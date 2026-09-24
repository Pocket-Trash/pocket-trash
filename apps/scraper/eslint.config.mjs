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
  {
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
];
