# Testing and Storybook

- Put `.stories.tsx` beside components; retain `UI/` and `Components/` categories unless scope needs another. Reuse nearby patterns/providers/fixtures/mocks; add global setup/addons only when repeated stories prove the need. Use args/argTypes for inputs, decorators for required wrappers, beforeEach for mocks, play for visible behavior and `storybook/test` utilities.
- Use `withThemePanels` for light/dark visual stories; keep interaction/portal stories single-theme unless testing themes.
- Keep play tests focused on one user-observable behavior. Use `userEvent`, accessible role/label/name queries, visible assertions and document-body queries for portals. Follow [accessibility](accessibility.md); violations fail tests.
- Run focused checks while iterating. Before publishing, include a Changeset, commit generated artifacts, require a clean worktree and run `pnpm validate:pr` against the PR base.
- Follow [Storybook setup](../storybook.md) and [E2E operations](../e2e-testing.md). Preview smoke tests exclude mutations; mutation E2E is CI-only against guarded, isolated `preview-pr-*` resources. Preserve all identity checks and cleanup.
