# FigJam

This workflow is only intended for the `Pocket-Trash/pocket-trash` repo. Before
using it, confirm the current repo with `git remote get-url origin`. If that
does not identify `Pocket-Trash/pocket-trash`, inspect the root `package.json`;
treat it as Pocket Trash only when the package name is `pocket-trash.app`.

If the current repo is not Pocket Trash, stop before running commands or making
changes. Tell the user this FigJam workflow is only supposed to be used in the
Pocket Trash repo, name the repo you detected when possible, and ask whether
they truly want to continue even though it might not work.

Use the shared FigJam tooling for all Figma/FigJam access. Do not call the Figma
API ad hoc.

## Files

This repo uses two allowlisted files through Infisical:

- `FIGMA_FIGJAM_FILE_KEY`: primary FigJam board for planning, diagrams,
  implementation handoffs, and agent status updates.
- The second key in `FIGMA_FIGJAM_ALLOWED_FILE_KEYS`: Figma design file for web
  and mobile UI designs.

Both files may be read. Both files may receive generated plugin payloads when
the user explicitly asks an agent to update planning/design content.

## Commands

Run commands through Infisical so the token stays out of shell history and repo
files:

```sh
infisical run --env=dev --path=/local/figma -- pnpm figjam read
infisical run --env=dev --path=/local/figma -- pnpm figjam read <fileKey>
infisical run --env=dev --path=/local/figma -- pnpm figjam write-payload <payload.json>
pnpm figjam serve-outbox
```

This tooling is local-only. Do not run it with preview or production Infisical
environments.

## Read Workflow

1. Read the relevant file through `pnpm figjam read`.
2. Use `.figjam/cache/<file-key>/summary.md` and `nodes.json` as context.
3. Cite the relevant file key, node ids, section names, or comments in your
   response or implementation notes.
4. Treat FigJam/Figma as planning and design context, not automatic permission
   to change code.

## Write Workflow

1. Generate a `figjam-bridge/v1` payload for the target file key.
2. Validate and place it in `.figjam/outbox` with `pnpm figjam write-payload`.
3. Tell the user to run `pnpm figjam serve-outbox`, open the target file, and
   apply the payload with the private plugin.
4. Do not claim that canvas edits are complete until the user or plugin
   acknowledgement confirms the payload was applied.

## App Or Component Updates

Before implementing frontend UI/layout changes from FigJam/Figma:

1. Read `docs/design-system.md` and apply its design guidance directly.
2. Identify whether the input came from the planning board, the design file, or
   both.
3. Update repo code using existing app/component patterns.
4. Run the repo-required validation for code changes.

Never print, persist, or commit `FIGMA_ACCESS_TOKEN`.
