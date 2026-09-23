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

The command:

1. Requires a clean worktree on `main`.
2. Fetches `origin/main` and tags only after local `HEAD` matches it.
3. Runs a frozen install, `pnpm format`, `pnpm test`, `pnpm lint`, and
   `pnpm typecheck`.
4. Reads pending Changesets and chooses the highest bump.
5. Updates the root and every workspace package version.
6. Adds Changeset descriptions to `CHANGELOG.md`.
7. Commits the release metadata, creates the annotated `v*` tag, then pushes
   `main` and the tag atomically.

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

Vercel production Git deployment gating is documented in
[vercel.md](./vercel.md).

Railway production GitHub auto-deploy is disabled in the Railway dashboard.
Production Railway scraper deploys are owned by the release workflow and use a
deployment message in this format:

```txt
Production release for v0.2.0
```
