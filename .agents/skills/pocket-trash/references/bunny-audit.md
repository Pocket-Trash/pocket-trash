# Bunny Audit

This workflow is only intended for the `Pocket-Trash/pocket-trash` repo. Before
using it, confirm the current repo with `git remote get-url origin`. If that
does not identify `Pocket-Trash/pocket-trash`, inspect the root `package.json`;
treat it as Pocket Trash only when the package name is `pocket-trash.app`.

If the current repo is not Pocket Trash, stop before running commands or making
changes. Tell the user this Bunny audit workflow is only supposed to be used in
the Pocket Trash repo, name the repo you detected when possible, and ask whether
they truly want to continue even though it might not work.

Use the repo script instead of manually guessing service endpoints.

## Command

Run from the monorepo root:

```bash
pnpm bunny:audit
```

The command injects `BUNNY_API_KEY` from Infisical `dev` at `/local/bunny`.

## Output

The script writes raw JSON and a Markdown report under:

```text
bunny-audit/
```

Read `bunny-audit/report.md` and summarize:

- services with resources in use
- any nonzero usage or monthly cost fields
- disabled or empty services
- failed endpoint checks

Do not print secrets from raw JSON. Storage zone passwords and API keys can
appear in Bunny responses.
