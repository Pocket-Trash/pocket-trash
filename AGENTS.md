
# System Instructions
- Pocket Trash repo skills come from `https://github.com/Pocket-Trash/skills` as the single source of truth for Codex and Claude Code. New worktrees install them automatically. Do not edit local skill copies directly; update the shared repo instead.
- Do not add or modify hard-coded user-visible text in UI, components, web flows, API responses, or user-displayed errors. Use localization for any text a user can see, and use `$pocket-trash localize` to track required `@pocket-trash/localizations` keys.
- Before modifying or creating any frontend layout or UI code, you MUST inject the design guidelines explicitly detailed inside `/docs/design-system.md`.
- Translate all requested specs using these components directly.
- Add complete JSDoc to stable named JavaScript and TypeScript declarations you
  add or modify. Follow `/docs/jsdoc.md`. `pnpm lint:jsdoc` checks every eligible
  declaration in tracked, hand-authored source, including untouched declarations;
  staging and Git base refs do not restrict coverage.

## Documentation placement

- Keep `docs/` for current instructions and how-to guides for developing,
  operating, or contributing to this repository.
- Store research, investigations, measurements, comparisons, and findings in a
  Linear document. Attach the document to the issue when it supports one issue,
  to the project when it supports several project issues, or to the Engineering
  team when it applies across projects. Link related issues, projects, pull
  requests, and source material from the document.
- When research leads to a durable engineering decision, summarize the accepted
  decision in `decisions/<bucket>/` and link the Linear research document. Keep
  evidence and exploratory notes in Linear instead of copying them into the
  decision record.
- Use one of these decision buckets:

  | Bucket | Decisions about |
  | --- | --- |
  | `architecture` | System boundaries, interfaces, and design patterns |
  | `data` | Data models, storage, retention, caching, and migrations |
  | `delivery` | CI, validation, releases, and deployment |
  | `developer-experience` | Tooling and contributor workflows |
  | `platform` | Hosting, infrastructure, and managed service providers |
  | `product` | Durable user-facing behavior and product policy |
  | `security` | Authentication, authorization, privacy, and secrets |
  | `operations` | Reliability, observability, backups, and incident handling |

- Store architecture decision records in `decisions/architecture/`; an ADR is an
  architecture-specific engineering decision record.
- Do not create empty bucket directories. Create `decisions/` and the selected
  bucket when adding its first record.
- Prefix every decision-record filename with the lowercase Linear issue or
  project identifier, followed by a lowercase kebab-case title. For example:
  `decisions/delivery/eng-298-ci-validation-strategy.md`.
- Put scripts, fixtures, or data required to reproduce a finding beside the code
  they exercise, then link them from the Linear document and decision record.

- After implementing features or code changes, always run:
  - Use `$pocket-trash logger` to audit logger usage, centralized logger messages/values,
    and forbidden `console.*` calls before validation.
  - `pnpm format`
  - `pnpm test`
  - `pnpm lint`
  - `pnpm typecheck`
- Run these additional checks only when the change can affect the covered surface:
  - For components, stories, or Storybook configuration, run
    `pnpm --filter @app/web test-storybook`. When stories or Storybook
    configuration change, also run `pnpm --filter @app/web build-storybook`.
    Use `pnpm storybook` only for manual visual inspection. See
    [`docs/storybook.md`](docs/storybook.md).
  - After the preview deploys, run `E2E_BASE_URL=<preview-url> pnpm e2e` for
    changes to routes,
    authentication, web/API contracts, Playwright configuration, or important
    user-visible workflows. Skip it for documentation-only changes and code
    that cannot affect a browser workflow. The command excludes mutation tests;
    run those only through CI against an isolated `preview-pr-*` environment.
    Add the `test:e2e` PR label when you need to force CI. If preview access or
    credentials are unavailable, report the skipped local check and verify the
    E2E CI result. See [`docs/e2e-testing.md`](docs/e2e-testing.md).
  - For database schema or migration changes, run
    `pnpm --filter @package/database db:check`.
  - When adding, updating, or removing dependencies or changing the lockfile,
    run `pnpm security:audit`.
- If code changes touch `packages/logger/**`, also run `pnpm test:logger:axiom`
  when Infisical and Axiom credentials are available. If they are not available,
  report that the live logger test was skipped.
- For changes that do not include code, such as documentation-only updates, run only `pnpm format`.
- If `pnpm lint` or `pnpm format` fail, determine whether the failure was caused by changes made during the current session. If so, fix those issues before finishing.
