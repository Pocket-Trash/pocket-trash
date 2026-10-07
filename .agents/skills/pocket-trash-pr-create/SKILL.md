---
name: pocket-trash-pr-create
description: Create a Pocket Trash GitHub pull request.
---

# PR Create

Create a GitHub pull request for the current branch using `gh`. Base the title
and body on the commits that are present on the branch and not on the base
branch.

## Required Guard

Run this check first, before any fetch, status inspection, push, or PR lookup:

```bash
git branch --show-current
```

If the current branch is exactly `main`, stop immediately with an error. Do not
suggest a branch, create a branch, push, fetch, or create a PR from `main`.

## Workflow

1. Confirm the current branch is not `main`.
2. Determine the PR base branch. Default to `main` unless the user specifies a
   different base.
3. Fetch the selected base with `git fetch origin <base>` so stacked and remote
   bases are current before inspecting branch history.
4. Check whether a PR already exists for the branch:
   `gh pr list --head <branch> --json url,title,state`. If one exists, do not
   publish more work or create a duplicate; return its URL and use
   `$pocket-trash-pr-update` for later changes.
5. Inspect branch state:
   - `git status --short --branch`
   - `git log --oneline origin/<base>..HEAD`
6. Read `./docs/changesets.md` when it exists and
   `./.github/pull_request_template.md`.
7. If there are no commits on the branch relative to the base branch, stop and
   report that there is nothing to open a PR for.
8. Create or update branch Changeset files before final validation:
   - Inspect changed `.changeset/*.md` files relative to `origin/<base>`.
   - If none exists, create one under `.changeset/`.
   - If one exists and no longer matches the branch, update it.
   - Use the affected package name from `package.json`. In a single-package
     repo, use the root `package.json` name.
   - Choose `patch`, `minor`, or `major` from the branch impact. Use `patch` for
     docs, tests, internal tooling, chores, and compatible fixes. Use `minor`
     for new compatible behavior. Use `major` for breaking API, database, or
     mobile compatibility changes.
   - If the selected impact is `major`, double-confirm with the user before
     creating or updating the Changeset:
     1. Ask the user to confirm the `major` release impact.
     2. After the user confirms, ask a second time before writing the Changeset.
     3. If either confirmation is missing, stop and report that explicit double
        confirmation is required.
   - Keep the Changeset description succinct, terse, human friendly, and
     changelog-ready.
9. Commit the complete branch state before final validation:
   - Generate or refresh every artifact the repository expects in the PR.
   - Include the current Changeset and generated artifacts in logical commits
     using `$pocket-trash-commit`.
   - Require `git status --porcelain` to be empty. Do not validate or publish a
     partially committed state. If unrelated user changes prevent a clean state,
     stop and preserve them.
10. Run the repository's final validation on the exact clean commit that will be
    pushed. This workflow is identical in Codex and Claude Code:

- When the root `package.json` exposes `validate:pr`, run
  `pnpm validate:pr -- origin/<base>`.
- Otherwise, read the repository's `AGENTS.md` and run its documented
  repository-specific validation. The skills, CLI, and localizations
  repositories keep their own required validation suites; do not require them to
  expose Pocket Trash's `validate:pr` command.
- If validation writes or regenerates a tracked file, commit it and rerun the
  complete selected validation until the worktree is clean.
- If validation fails, stop. Do not run `git push` or create or edit PR
  metadata. Preserve the commits and working tree for correction.

11. Immediately after successful validation and its final clean-worktree check,
    push the branch when it has no upstream or the remote is behind:
    `git push -u origin <branch>`.
12. Create the PR only after the push succeeds:
    `gh pr create --base <base> --head <branch> --title "<title>" --body "<body>"`.
13. Return the PR URL and a concise summary of the created PR.

## Title And Body

Write the PR title from the commit subjects and changed files using the same
conventional commit subject format as `$pocket-trash-commit`:

```text
<type>(<scope>): <short summary>
```

- Use the single commit subject when the branch has one commit and it already
  follows the conventional commit format.
- If the single commit subject is clear but not conventional, rewrite it into
  the conventional commit format for the PR title.
- For multiple commits, write a concise conventional commit title that
  summarizes the branch.
- Use imperative mood, lowercase, no period, and keep the title at or under 72
  characters.
- If `./docs/commit-lint.md` exists, read it before choosing a type or scope. It
  is the source of truth for allowed conventional commit types and repository
  scopes. Otherwise read `./commitlint.config.cjs`; if it sets `scope-empty` to
  `always`, omit the scope.
- Omit the scope only for truly cross-cutting changes.
- Do not include AI co-authorship or generated-by lines.

If the user asks this skill to create, amend, or suggest commits while preparing
the PR, use the same `$pocket-trash-commit` body format:

```text
<type>(<scope>): <short summary>

- point form detail
- point form detail
```

Do not add `Co-Authored-By` lines. Keep each commit to one logical change, use
point-form body details, and stage specific files by name.

Write the PR body by starting from `./.github/pull_request_template.md` and
replacing only the content between these markers:

```markdown
<!-- AI SECTION START -->
<!-- AI SECTION END -->
```

Use this AI section format:

```markdown
<!-- AI SECTION START -->

## AI Summary

- point form summary
- point form summary

## AI Testing and Validation

- command run, or "Not run (reason)"

<!-- AI SECTION END -->
```

Leave the Human section before the AI section and blank by default. Do not
remove or edit the Human section markers.

Keep the body factual. Prefer commit messages, diffs, and test output over
guessing. If the user asks for a draft PR, pass `--draft`.

## Changeset

Each PR needs one release-impact marker:

```markdown
---
"<package-name>": patch
---

Add release automation.
```

Use the smallest accurate bump. Keep the description one short sentence when
possible. Prefer concrete human wording such as `Add release automation.` or
`Fix mobile update prompts.` Avoid long implementation detail, issue IDs, and
robotic phrasing.

If AI tooling selects `major`, it must receive two explicit user confirmations
before creating or updating the Changeset. Do not treat the user's original
feature request as either confirmation. If either confirmation is missing, stop
before writing the `major` Changeset.

## Error Cases

- On `main`: error immediately and do nothing else.
- Missing `gh`: report that the GitHub CLI is required.
- No branch commits: report that the branch has no commits relative to the base.
- Existing PR: do not create a duplicate; return the existing PR URL.
