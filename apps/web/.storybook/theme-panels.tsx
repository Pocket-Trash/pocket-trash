import type { Decorator } from "@storybook/tanstack-react";

export const withThemePanels: Decorator = (Story) => (
  <div className="grid min-w-80 overflow-hidden rounded-md border border-border bg-border md:grid-cols-2">
    <div className="bg-background p-6 text-foreground">
      <Story />
    </div>
    <div className="dark bg-background p-6 text-foreground">
      <Story />
    </div>
  </div>
);
