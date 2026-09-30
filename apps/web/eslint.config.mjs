import appStorageBoundary from "@package/eslint/apps";
import reactConfig from "@package/eslint/react";

export default [
  ...reactConfig,
  { ignores: ["storybook-static/**"] },
  appStorageBoundary,
];
