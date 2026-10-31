import type { Preview } from "@storybook/tanstack-react";
import { mocked, sb } from "storybook/test";
import { applyTheme } from "../src/lib/theme";
import { getCurrentUserSettingsState } from "../src/lib/user-settings";
import { mockStoryAuth, storySettings } from "./story-fixtures";
import "../src/styles.css";

sb.mock(import("@clerk/tanstack-react-start"));
sb.mock(import("../src/lib/resources.ts"));
sb.mock(import("../src/lib/feedback.ts"), { spy: true });
sb.mock(import("../src/lib/account-erasure.ts"), { spy: true });
sb.mock(import("../src/lib/catalog-api.ts"), { spy: true });
sb.mock(import("../src/lib/search.ts"), { spy: true });
sb.mock(import("../src/lib/user-settings.ts"), { spy: true });
sb.mock(import("sonner"), { spy: true });
sb.mock(import("../src/components/markdown-visual-editor.tsx"), { spy: true });

/** Global decorators, theme control, accessibility checks, and story ordering. */
const preview: Preview = {
  /** Restores the anonymous auth and current-session settings fixtures. */
  beforeEach: () => {
    mockStoryAuth();
    mocked(getCurrentUserSettingsState).mockResolvedValue(storySettings);
  },
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
    options: {
      storySort: {
        method: "alphabetical",
        order: ["Components", "Pages", "UI"],
      },
    },
  },
};

export default preview;
