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

Roy must approve each vulnerability exception. Record its GHSA, owner,
follow-up issue, approval time and expiry within seven days in
`security-audit-exceptions.json`. The `scripts/security-audit.mjs` validator
checks metadata and scope before auditing dependencies.

Track exception reviews and follow-up work in
[Dependency policy and exception cleanup](https://linear.app/pocket-trash/project/dependency-policy-and-exception-cleanup-8585f316e087).

### Temporary Picomatch mitigation

The local patches for Picomatch 2.3.2 and 4.0.7 adapt
[upstream PR 254](https://github.com/micromatch/picomatch/pull/254) at
`c63a5bf4e61dbdb81bc41e97dc2616c30acce337`. They remove the nested repetition
in ordinary single-branch wildcard extglobs reported by
[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).
This is an unmerged mitigation, not an official fixed release. Multi-branch
patterns such as `+(*a|b)` remain vulnerable, and the explicit
`maxExtglobRecursion: false` option still disables the guard.
Outer captures remain the full match; the inner wildcard capture covers the
flattened body instead of the last repetition.
Local compatibility guards leave escaped bodies and branches whose character
classes admit path separators on their existing handling; those complex
single-branch patterns are not covered by the mitigation.

The version-based audit continues to report both releases. Any temporary
exception requires Roy's approval in `security-audit-exceptions.json` and expires
within seven days. Roy approved the current exception on November 17, 2026,
through November 20 at 20:52 UTC. The scoped audit additionally verifies the exact lockfile,
both patch files and their workspace configuration; dependency or patch changes
fail closed. It does not add the advisory to pnpm's global ignore list. Track
replacement with an official fix and removal of the exception in
[ENG-686](https://linear.app/pocket-trash/issue/ENG-686/resolve-picomatch-advisory-blocking-dependency-audits).

Vercel production Git deployment gating is documented in
[vercel.md](./vercel.md).

Railway production GitHub auto-deploy is disabled in the Railway dashboard.
Production Railway scraper deploys are owned by the release workflow and use a
deployment message in this format:

```txt
Production release for v0.2.0
```
