---
name: pocket-trash-storybook
description: Add or update Pocket Trash Storybook stories and tests.
---

# Storybook

Add or update Pocket Trash Storybook setup, stories, interaction tests, and
accessibility coverage for `apps/web`.

This workflow is only intended for the `Pocket-Trash/pocket-trash` repo. Before
using it, confirm the current repo with `git remote get-url origin`. If that
does not identify `Pocket-Trash/pocket-trash`, inspect the root `package.json`;
treat it as Pocket Trash only when the package name is `pocket-trash.app`.

If the current repo is not Pocket Trash, stop before running commands or making
changes. Name the repo you detected when possible and ask whether the user wants
to continue even though the workflow might not work.

## Setup

Prefer the repo's existing setup before adding config:

- App: `apps/web`
- Framework: `@storybook/tanstack-react`
- Story files: `apps/web/src/**/*.stories.@(ts|tsx)`
- Test helpers: `storybook/test`
- Addons already in use: `@storybook/addon-a11y` and `@storybook/addon-vitest`

Do not add Storybook config, builders, addons, dependencies, or visual test
tooling unless the user explicitly asks or the requested behavior cannot be
handled by the current setup.

## Story Workflow

1. Before changing UI or layout code, read `docs/design-system.md`.
2. Do not add hard-coded user-visible UI text. Use the repo localization
   workflow when text changes.
3. Find the component and nearby stories before writing a new pattern:
   - `apps/web/src/components/ui/button.stories.tsx`
   - `apps/web/src/components/user-menu.stories.tsx`
4. Import story types from `@storybook/tanstack-react`.
5. Use typed CSF metadata with `satisfies Meta<typeof Component>` and
   `StoryObj<typeof meta>`.
6. Use `args` for simple prop states and `render` only for composition that
   cannot be expressed as props.
7. Create an exhaustive prop matrix unless the user asks for just limited props.
8. Keep story data small and local unless an existing shared fixture already
   fits.
9. Use decorators only for providers or layout wrappers the component actually
   needs.
10. Use `beforeEach` for per-story mocks.

<!-- Credit: adapted checklist ideas from DaleStudy/skills storybook, Mindrally/skills storybook, TheBushidoCollective/han storybook-story-writing, and pedronauck/skills storybook-stories. -->

## Sidebar Categories

Use only the current top-level Storybook categories:

- `UI/<ComponentName>` for primitives and reusable UI building blocks.
- `Components/<ComponentName>` for app/domain components.

Do not add new top-level Storybook categories unless the user explicitly asks.
Storybook renders these titles as category and component entries. For example,
`UI/Button` creates the `UI` category, the `Button` component entry, and story
items such as `Default`, `Icon`, and `Disabled`.

## Interaction And Accessibility Tests

Add `play` functions for behavior a user can trigger or observe:

- Use `userEvent` for realistic clicks, typing, keyboard input, and selection.
- Query by role, label, or accessible name. Avoid DOM selectors except when
  checking cleanup for implementation-owned artifacts.
- Scope normal queries to `canvas`.
- Use `within(canvasElement.ownerDocument.body)` for portaled UI such as
  dropdowns and dialogs.
- Assert visible outcomes with `expect`.
- Use `waitFor` for async cleanup or delayed state changes.
- Cover keyboard behavior when it is part of the component contract.

The repo enables Storybook accessibility checks with `a11y.test: "error"` in
`apps/web/.storybook/preview.ts`. Prefer fixing the component or story over
suppressing a rule. Use per-story `parameters.a11y` only for a real exception,
and leave a short comment explaining why.

<!-- Credit: interaction guidance adapted from TheBushidoCollective/han storybook-play-functions and Storybook's official accessibility testing docs. -->

## Browser Behavior

`pnpm storybook` opens the system default browser. Storybook 10.6 does not
provide a repo-supported flag for choosing Firefox, Chrome, or another browser.
Use this when someone wants manual browser choice:

```sh
pnpm storybook -- --no-open
```

Then open `http://localhost:6006` in the desired browser.

## Commands

Run Storybook from the Pocket Trash repo root:

```sh
pnpm storybook
```

App-local commands:

```sh
pnpm --filter @app/web storybook
pnpm --filter @app/web build-storybook
pnpm --filter @app/web test-storybook
```

After changing stories or Storybook config, run the repo-required checks,
including `$pocket-trash-logger`, `pnpm format`, `pnpm test`, `pnpm lint`, and
`pnpm typecheck`. Also run `pnpm --filter @app/web test-storybook` and
`pnpm --filter @app/web build-storybook` when Storybook stories or config
change.
