# Update Scopes

Keep conventional commit scopes aligned with the repository without duplicating
the source of truth.

## Workflow

1. Read `./docs/commit-lint.md` and extract the current scopes from its
   `## Scopes` table. If that file is absent, read `./commitlint.config.cjs`; if
   it requires `scope-empty`, stop and report that the repo intentionally has no
   commit scopes.
2. Inspect repository structure with `rg --files`, package manifests, top-level
   config files, app directories, package directories, docs, and skill folders.
3. Compare the discovered ownership boundaries to the documented scopes.
   Identify likely additions, removals, renames, and coverage clarifications.
4. Present the proposed scope changes to the user first. Include the reason for
   each change and the paths it would cover.
5. Wait for explicit user acceptance before editing files.
6. After acceptance, update `./docs/commit-lint.md`. Update workflows only when
   they contain hard-coded type or scope lists, or when their commitlint doc
   reference needs to change.
7. Run focused validation after edits:
   - `pnpm exec commitlint` with one valid sample using an affected scope
   - `pnpm lint` when Markdown, workflow, hook, or config changes should be
     linted

## Rules

- Treat `./docs/commit-lint.md` as the only source of truth for allowed
  conventional commit types and scopes when it exists.
- Do not repeat the current scope list inside this skill.
- Prefer stable ownership boundaries over one-off folders.
- Keep scope names short, lowercase, and hyphenated when needed.
- Do not remove an existing scope unless no current path, package, workflow, or
  skill still needs it.
