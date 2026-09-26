export default {
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
};
