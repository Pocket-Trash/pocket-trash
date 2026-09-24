import reactConfig from "@package/eslint/react";

export default [
  ...reactConfig,
  { ignores: ["storybook-static/**"] },
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
