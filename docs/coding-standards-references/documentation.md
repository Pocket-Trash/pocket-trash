# Documentation placement

- Store current repository development, operations and contribution guides in `docs/`. Link implementation contracts at their source rather than restating them.
- Store research/investigations/measurements/comparisons/findings in Linear documents: attach to the supporting issue, project for several project issues, or Engineering team for cross-project work. Link related issues/projects/PRs/sources.
- Record accepted durable engineering decisions in `decisions/<bucket>/`, linking the Linear research; leave evidence/exploration in Linear. Buckets: architecture (boundaries/interfaces/patterns), data (models/storage/retention/cache/migrations), delivery (CI/validation/releases/deployment), developer-experience (tooling/workflows), platform (hosting/infrastructure/providers), product (durable behavior/policy), security (auth/privacy/secrets), operations (reliability/observability/backups/incidents). ADRs use architecture.
- Create buckets only with their first record. Prefix filenames with the lowercase Linear issue/project identifier and a lowercase kebab-case title.
- Put reproducing scripts/fixtures/data beside exercised code; link them from the Linear document and decision record.

## Shared agent skills

- Pocket Trash repo skills come from `https://github.com/Pocket-Trash/skills` as the single source of truth for Codex and Claude Code. New worktrees install them automatically. Do not edit local skill copies directly; update the shared repo instead.
