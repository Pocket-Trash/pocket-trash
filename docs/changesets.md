# Changesets

Every PR must include one Changeset that marks the release impact as `major`,
`minor`, or `patch`.

Create one with:

```sh
pnpm changeset
```

Use this shape:

```md
---
"@app/web": patch
---

Add release automation.
```

Guidelines:

- Use `patch` for fixes, docs, tests, internal tooling, and compatible chores.
- Use `minor` for new compatible user-facing behavior or workflows.
- Use `major` for breaking API, database, or mobile compatibility changes.
- Select the real apps and packages affected by root-level tooling changes.
- Keep the description terse, human friendly, and changelog-ready.
- Write what changed, not why the PR exists.

AI tooling must double-confirm before creating or updating a Changeset with a
`major` bump:

1. Ask the user to confirm the `major` release impact.
2. After the user confirms, ask a second time before writing the Changeset.

If either confirmation is missing, do not create or update the Changeset as
`major`. Stop and report that explicit double confirmation is required.

When creating or updating a GitHub PR, apply the release-impact label that
matches the PR Changeset: `patch`, `minor`, or `major`.
