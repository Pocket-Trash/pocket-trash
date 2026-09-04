
# System Instructions
- Pocket Trash repo skills come from `https://github.com/Pocket-Trash/skills` as the single source of truth for Codex and Claude Code. Run `pnpm agent-skills:check` at repo session start. If it warns, run `pnpm agent-skills:update`. Do not edit local skill copies in this repo; update the shared repo instead.
- Before modifying or creating any frontend layout or UI code, you MUST inject the design guidelines explicitly detailed inside `/docs/design-system.md`.
- Translate all requested specs using these components directly.
- After implementing features or code changes, always run:
  - Use `$pocket-trash logger` to audit logger usage, centralized logger messages/values,
    and forbidden `console.*` calls before validation.
  - `pnpm format`
  - `pnpm test`
  - `pnpm lint`
  - `pnpm typecheck`
- If code changes touch `packages/logger/**`, also run `pnpm test:logger:axiom`
  when Infisical and Axiom credentials are available. If they are not available,
  report that the live logger test was skipped.
- For changes that do not include code, such as documentation-only updates, run only `pnpm format`.
- If `pnpm lint` or `pnpm format` fail, determine whether the failure was caused by changes made during the current session. If so, fix those issues before finishing.
