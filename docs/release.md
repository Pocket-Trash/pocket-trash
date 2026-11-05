# Release Process

The repo release version starts at `0.0.1`. Production deploys are triggered by
annotated `v*` tags, not by merging to `main`.

## PR Requirements

Every pull request must include a Changeset:

```sh
pnpm changeset
```

Mark the PR as `major`, `minor`, or `patch`. See
[changesets.md](./changesets.md) for the short authoring guide. CI runs
`scripts/check-pr-changeset.mjs` on pull requests and fails when no Changeset is
present.

## Release Command

Run releases from `main`:

```sh
pnpm release
```

The command requires an authenticated GitHub CLI (`gh`).

The command:

1. Requires a clean worktree on `main`.
2. Fetches `origin/main` and tags only after local `HEAD` matches it.
3. Runs a frozen install, the all-scope high/critical audit, `pnpm format`,
   `pnpm test`, `pnpm lint`, and `pnpm typecheck`.
4. Reads pending Changesets and chooses the highest bump.
5. Updates the root and every workspace package version.
6. Adds Changeset descriptions to `CHANGELOG.md`.
7. Commits the release metadata, creates the annotated `v*` tag, then pushes
   `main` and the tag atomically.
8. Waits for the tag's deployment workflow and verifies the GitHub Release was
   published.

If all pending Changesets are `patch`, the release bumps only the patch version.

## Initial Release

After this release automation lands on `main`, create the initial repo release:

```sh
pnpm release --initial
```

That creates `v0.0.1` and the matching GitHub Release from the baseline commit.

## Deployment

The pushed `v*` tag triggers `Deploy`, which runs production migrations, deploys
the production API, Railway scraper, and Vercel web app, and smoke-tests the
deployments. The workflow creates the GitHub Release only after every production
deployment succeeds.

## Dependency Security

Use the Node and pnpm versions declared in [package.json](../package.json). Follow [dependency coding standards](coding-standards-references/dependencies-secrets.md) for release-age policy, approved exact-version exceptions and security audits.

Roy must approve each vulnerability exception. Every exception requires a GHSA,
an owner, a follow-up Linear issue, and a UTC expiry within seven days.
Record the metadata in `security-audit-exceptions.json`. General advisory
exceptions must match `auditConfig.ignoreGhsas` in `pnpm-workspace.yaml`.
The Vercel Zod exception instead uses exact version, development-only status,
and reviewed dependency-path checks in `scripts/security-audit.mjs`; never add
it to the global advisory ignore list. The validator rejects incomplete,
mismatched, overlong, future-approved, or expired exceptions before auditing.

`GHSA-mrhx-c7xc-m3w5` remains approved only for Zod 3.22.4 on six reviewed
Vercel CLI development-tooling paths. Roy Anger renewed this exception on
`2026-11-05T20:44:03Z`, expiring at `2026-11-12T20:44:03Z`.
[ENG-574](https://linear.app/pocket-trash/issue/ENG-574) tracks removal.
Application Zod 4 remains patched; further renewal requires owner approval.
The withdrawn braces advisory has no active exception.

Vercel production Git deployment gating is documented in
[vercel.md](./vercel.md).

Railway production GitHub auto-deploy is disabled in the Railway dashboard.
Production Railway scraper deploys are owned by the release workflow and use a
deployment message in this format:

```txt
Production release for v0.2.0
```
