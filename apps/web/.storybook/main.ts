import type { StorybookConfig } from "@storybook/tanstack-react";

const config: StorybookConfig = {
  addons: ["@storybook/addon-a11y", "@storybook/addon-vitest"],
  core: {
    builder: {
      name: "@storybook/builder-vite",
      options: { viteConfigPath: ".storybook/vite.config.ts" },
    },
  },
  framework: "@storybook/tanstack-react",
  stories: ["../src/**/*.stories.@(ts|tsx)"],
};

export default config;
