# PR Update

Update the title and body of an existing GitHub pull request for the current
branch using `gh`. Base the proposed title and description on committed branch
changes, not on uncommitted work.

## Required Guard

Run this check first, before any fetch, status inspection, push, or PR lookup:

```bash
git branch --show-current
```

If the current branch is exactly `main`, stop immediately with an error. Do not
suggest a branch, create a branch, push, fetch, or update a PR from `main`.

## Workflow

1. Confirm the current branch is not `main`.
2. Inspect branch state:
   - `git status --short --branch`
3. Look up the existing PR for the current branch:
   - `gh pr list --head <branch> --json number,url,title,body,state,baseRefName`
4. If no PR exists for the branch, stop and tell the user to create one first.
5. Read `./.github/pull_request_template.md`.
6. If the existing PR body is empty, use a blank copy of
   `./.github/pull_request_template.md` as the starting body.
7. If the existing PR body is not empty and does not contain both AI section
   markers, stop and ask before editing the PR title or body. Do not call
   `gh pr edit`.
8. Determine the base branch from `baseRefName`; default to `main` only if the
   PR lookup does not return a base.
9. Fetch the base branch if needed:
   - `git fetch origin <base>`
10. Inspect committed branch changes:

- `git log --oneline origin/<base>..HEAD`
- `git diff --stat origin/<base>...HEAD`
- `git diff --name-only origin/<base>...HEAD`

11. Read `./docs/changesets.md` when it exists.
12. If there are no commits relative to the base branch, stop and report that
    there is nothing to summarize.
13. Create or update branch Changeset files:
    - Inspect changed `.changeset/*.md` files relative to the base.
    - If none exists, create one under `.changeset/`.
    - If one exists and no longer matches the branch, update it.
    - If multiple changed Changeset files exist, choose the PR release-impact
      label from the highest bump present: `major` wins over `minor`, and
      `minor` wins over `patch`.
    - Use the affected package name from `package.json`. In a single-package
      repo, use the root `package.json` name.
    - Choose `patch`, `minor`, or `major` from the branch impact. Use `patch`
      for docs, tests, internal tooling, chores, and compatible fixes. Use
      `minor` for new compatible behavior. Use `major` for breaking API,
      database, or mobile compatibility changes.
    - If the selected impact is `major`, double-confirm with the user before
      creating or updating the Changeset:
      1. Ask the user to confirm the `major` release impact.
      2. After the user confirms, ask a second time before writing the
         Changeset.
      3. If either confirmation is missing, stop and report that explicit double
         confirmation is required.
    - Keep the Changeset description succinct, terse, human friendly, and
      changelog-ready.
14. Generate a proposed title and body from the commits, changed files, and any
    relevant test output already available in the conversation or shell history.
15. Compare the proposed title and body with the current PR values.
16. Apply exactly one release-impact label that matches the highest branch
    Changeset bump to the PR. Remove the other release-impact labels in the same
    edit so downgraded or upgraded PRs do not keep contradictory labels:
    - `gh pr edit <number-or-url> --remove-label minor --remove-label major --add-label patch`
      for a `patch` Changeset.
    - `gh pr edit <number-or-url> --remove-label patch --remove-label major --add-label minor`
      for a `minor` Changeset.
    - `gh pr edit <number-or-url> --remove-label patch --remove-label minor --add-label major`
      for a `major` Changeset.
17. If neither title nor body needs a meaningful update after the label edit,
    report that the PR title and body are already current.
18. If one or both values should change, update only those fields:
    - `gh pr edit <number-or-url> --title "<title>"`
    - `gh pr edit <number-or-url> --body "<body>"`
19. Return the PR URL and a concise summary of what changed.

## Title

Write the PR title using the same conventional commit subject format as
`$pocket-trash commit` and `$pocket-trash pr-create`:

```text
<type>(<scope>): <short summary>
```

- Use the current PR title unchanged if it already follows the format and still
  accurately summarizes the branch.
- For a branch with one conventional commit, use that commit subject when it is
  still accurate.
- If the current title or single commit subject is clear but not conventional,
  rewrite it into the conventional commit format.
- For multiple commits, write a concise conventional commit title that
  summarizes the whole branch.
- Use imperative mood, lowercase, no period, and keep the title at or under 72
  characters.
- If `./docs/commit-lint.md` exists, read it before choosing a type or scope. It
  is the source of truth for allowed conventional commit types and repository
  scopes. Otherwise read `./commitlint.config.cjs`; if it sets `scope-empty` to
  `always`, omit the scope.
- Omit the scope only for truly cross-cutting changes.
- Do not include AI co-authorship or generated-by lines.

## Body

Write the PR body by replacing only the content between these markers:

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

Keep the body factual. Prefer commit messages, diffs, changed file paths, and
test output over guessing.

When updating an existing body:

- Replace an empty body with a blank copy of
  `./.github/pull_request_template.md` plus generated AI section content.
- Replace only the AI section when the existing body contains both AI section
  markers.
- Stop and ask before editing anything when a non-empty body does not contain
  both AI section markers.
- Preserve all content outside the AI section markers exactly.
- Do not include uncommitted changes as completed work; mention them separately
  in the final response.
- Do not include AI co-authorship or generated-by lines.

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

Apply exactly one release-impact label that matches the highest PR Changeset
bump to the GitHub PR when updating it: `patch`, `minor`, or `major`. If
multiple changed Changeset files exist, `major` wins over `minor`, and `minor`
wins over `patch`. Remove the other release-impact labels before adding the
matching label. Apply the matching label even when the title and body are
already current.

## Error Cases

- On `main`: error immediately and do nothing else.
- Missing `gh`: report that the GitHub CLI is required.
- No existing PR: report that there is no PR for the current branch.
- No branch commits: report that the branch has no commits relative to the base.
- Closed PR: report the state and ask for direction before editing.
