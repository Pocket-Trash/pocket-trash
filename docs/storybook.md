# Storybook

Storybook for Pocket Trash lives in `apps/web`.

Run it from the repo root:

```sh
pnpm storybook
```

The root command starts Storybook without opening a browser. Open
`http://localhost:6006` in whichever browser you want to use.

Or run the app package directly:

```sh
pnpm --filter @app/web storybook
```

The app package command uses Storybook's default browser behavior.

Build and test the Storybook project with:

```sh
pnpm --filter @app/web build-storybook
pnpm --filter @app/web test-storybook
```

Install the browser once per machine if `test-storybook` needs it:

```sh
pnpm --filter @app/web exec playwright install chromium
```

## Add Stories

Put stories beside the component they cover with a `.stories.tsx` suffix.
Current examples:

- `apps/web/src/components/ui/button.stories.tsx`
- `apps/web/src/components/user-menu.stories.tsx`

Use the current top-level sidebar categories:

- `UI/<ComponentName>` for primitives and reusable UI building blocks.
- `Components/<ComponentName>` for app/domain components.

Do not add new top-level categories unless the requested work needs one.
Storybook renders these titles as category and component entries. For example,
`UI/Button` creates the `UI` category, the `Button` component entry, and story
items such as `Default`, `Icon`, and `Disabled`.

Use the existing story shape:

```tsx
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";
import { ComponentName } from "./component-name";

const meta = {
  component: ComponentName,
  title: "Components/ComponentName",
} satisfies Meta<typeof ComponentName>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
```

Add only the story machinery the component actually needs:

- Use `args` and `argTypes` for meaningful component inputs.
- Use `decorators` for required providers or layout wrappers.
- Use `beforeEach` for per-story mocks.
- Use `play` for behavior a user can trigger or observe.
- Use `storybook/test` for `expect`, `fn`, `mocked`, `within`, and `waitFor`.

Use `withThemePanels` from `apps/web/.storybook/theme-panels.tsx` for visual
stories that should render light and dark modes side by side. Keep interaction
stories and portaled UI stories single-theme unless the interaction itself is
theme-specific.

## Interactive Tests

Use `play` functions for interaction coverage that belongs with the story:

- Click buttons, links, menu triggers, tabs, and form controls through
  `userEvent`.
- Query by role, label, or accessible name instead of DOM selectors.
- Assert visible results with `expect`.
- Use `within(canvasElement.ownerDocument.body)` for portals such as dropdowns
  and dialogs.
- Keep each `play` function focused on one useful behavior.

The project uses `@storybook/addon-a11y` with `a11y.test` set to `error`, so
accessibility violations fail when stories are tested with the Vitest addon.
Use per-story `parameters.a11y` only for a real exception; prefer fixing the
component or story.

## Repo Rules

Before changing UI or layout code, read `docs/design-system.md`.

Do not add hard-coded user-visible text to components, flows, API responses, or
user-displayed errors. Add or track localization keys with
`$pocket-trash localize` when UI text changes.

Prefer existing providers, fixtures, mocks, and nearby story patterns before
adding Storybook configuration. Add addons or global setup only when repeated
stories prove they need it.
