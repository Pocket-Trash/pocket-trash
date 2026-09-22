import type { Preview } from "@storybook/tanstack-react";
import { sb } from "storybook/test";
import { applyTheme } from "../src/lib/theme";
import "../src/styles.css";

sb.mock(import("@clerk/tanstack-react-start"));
sb.mock(import("../src/lib/locale-api.ts"));

const preview: Preview = {
  decorators: [
    (Story, context) => {
      applyTheme(context.globals.theme === "dark" ? "dark" : "light");
      return Story();
    },
  ],
  globalTypes: {
    theme: {
      toolbar: {
        dynamicTitle: true,
        icon: "circlehollow",
        items: ["light", "dark"],
        title: "Theme",
      },
    },
  },
  initialGlobals: { theme: "light" },
  parameters: {
    a11y: { test: "error" },
    layout: "centered",
  },
};

export default preview;
