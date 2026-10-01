# Commit Lint

Conventional commit types and scopes for this repository are maintained here.
Commitlint, Git hooks, CI, and agent skills should read this document instead of
duplicating the lists.

## Format

```text
<type>(<scope>): <short summary>
```

The scope may be omitted for truly cross-cutting changes.

Local Git hooks lint only the commit message being created. CI lints pull
request titles only, not the individual commits already present on the branch.

## Types

| Type | Covers |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes nor adds a feature |
| `chore` | Tooling, dependencies, and configuration |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `style` | Formatting and lint fixes with no logic change |
| `perf` | Performance improvement |
| `ci` | CI/CD changes |

## Scopes

| Scope | Covers |
|---|---|
| `web` | `apps/web/` |
| `scraper` | `apps/scraper/` |
| `packages` | Multiple packages or the `packages/` root |
| `database` | `packages/database/` |
| `lint` | `packages/lint/` |
| `figjam` | `packages/figjam/` |
| `github-discord-notifier` | `packages/github-discord-notifier/` |
| `infisical-runner` | `packages/infisical-runner/` |
| `json-data` | `packages/json-data/` |
| `logger` | `packages/logger/` |
| `services` | `packages/services/` |
| `tsconfig` | `packages/tsconfig/` |
| `config` | Root config files such as Biome, Turbo, pnpm workspace, and TypeScript config |
| `docs` | `README.md`, `CLAUDE.md`, `AGENTS.md`, and `docs/` |
| `ci` | `.github/workflows/` and `.githooks/` |
| `skills` | `.claude/skills/`, `.agents/skills/`, and `.claude/commands/` |
| `scripts` | `scripts/` directory |

## Rules

- Use the most specific scope when one applies.
- Use no scope only when a change is truly cross-cutting.
- Keep the summary imperative and without a period. Commitlint does not enforce
  summary casing, and uppercase acronyms or product names are allowed.
- Keep the header at or under 72 characters.
- Do not include AI co-authorship or generated-by lines.
