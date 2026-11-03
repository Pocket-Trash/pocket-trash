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

## Coding standards

Follow [testing and Storybook](coding-standards-references/testing.md), [UI design](coding-standards-references/ui-design.md), [accessibility](coding-standards-references/accessibility.md) and [localization](coding-standards-references/localization.md) standards.
