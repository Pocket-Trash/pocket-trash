
# System Instructions
- Pocket Trash repo skills come from `https://github.com/Pocket-Trash/skills` as the single source of truth for Codex and Claude Code. At repo session start, compare the `pocket-trash*` entries and hashes in `skills-lock.json` and `.agents/skills` with the skills currently published from that repo's `skills/*/SKILL.md` files. Keep this check read-only. If the installed skills are missing or stale, ask the user for permission to run `npx skills add pocket-trash/skills --skill '*' --agent codex claude-code -y`. If permission is declined or the command cannot run, tell the user to run that exact command. Do not edit local skill copies directly; update the shared repo instead.
- Do not add or modify hard-coded user-visible text in UI, components, web flows, API responses, or user-displayed errors. Use localization for any text a user can see, and use `$pocket-trash localize` to track required `@pocket-trash/localizations` keys.
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
