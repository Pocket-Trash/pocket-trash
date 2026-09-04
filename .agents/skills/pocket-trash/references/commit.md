# Git Commit

Write conventional commits for this repository. Never include AI co-authorship
lines.

## Format

```
<type>(<scope>): <short summary>

- point form detail
- point form detail
```

## Types And Scopes

If `./docs/commit-lint.md` exists, read it before choosing a type or scope. It
is the source of truth for allowed conventional commit types and repository
scopes.

If `./docs/commit-lint.md` does not exist, read `./commitlint.config.cjs`:

- If it sets `scope-empty` to `always`, omit the scope.
- Otherwise follow Conventional Commits and use a scope only when the repo
  config or nearby history makes the allowed scope clear.

## Rules

- Never create a commit on `main`. If the current branch is `main` then prompt
  the user with a suggestion for a new branch and on approval create and
  checkout the new branch.
- When suggesting a branch from `main`, prefix it with the user's initials from
  `git config --get user.initials`, for example `roy/setup-monorepo`. Do not use
  the conventional commit type as the branch prefix.
- If `user.initials` is unset, tell the user they can set it with
  `git config --global user.initials <initials>` or for this repository only
  with `git config user.initials <initials>`.
- **No `Co-Authored-By` lines** — commits are from the user only
- **Summary line**: imperative mood, lowercase, no period, max 72 chars
- **Body**: point-form list of changes, keep each point succinct
- **One commit per logical change** — don't bundle unrelated work
- Stage specific files by name — avoid `git add -A` or `git add .`
