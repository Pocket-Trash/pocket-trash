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

Use Node 22.20.0 or newer within Node 22 and pnpm 11.27.1. Installs reject
external package releases younger than seven days, missing publication times,
and lockfiles that do not satisfy the current policy. Run the blocking audit
before building or deploying:

```sh
pnpm security:audit
```

For an urgent security release, add only the reviewed exact package version to
`minimumReleaseAgeExclude` in `pnpm-workspace.yaml`. Include a YAML comment with
the Linear issue, reason, and UTC maturity/removal time, then remove the entry
after it matures. Never lower `minimumReleaseAge` or add a scope wildcard.

There are no vulnerability exceptions. Do not add one without Roy's explicit
approval for the specific GHSA, an owner, a follow-up Linear issue, and a UTC
expiry within seven days. The first such exception also requires an expiry
validator so incomplete or expired entries fail every security gate.

Vercel production Git deployment gating is documented in
[vercel.md](./vercel.md).

Railway production GitHub auto-deploy is disabled in the Railway dashboard.
Production Railway scraper deploys are owned by the release workflow and use a
deployment message in this format:

```txt
Production release for v0.2.0
```
