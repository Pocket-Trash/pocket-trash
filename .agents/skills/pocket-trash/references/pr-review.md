# PR Review

Review a pull request end to end: run this repo's mandated checks, read the diff
for real defects, and report findings scoped to the PR under review. Base every
claim on evidence — command output, the diff, a `file:line` — never speculation.

## Target

1. If the user gives a PR number or URL, review that PR.
2. Otherwise resolve the current branch's PR:
   `gh pr list --head "$(git branch --show-current)" --json number,url,state`.
3. Record the base branch (`gh pr view <n> --json baseRefName`); default diff
   comparisons to `main`.

## Setup (protect the working tree)

1. `git status --short` — if the tree is dirty with unrelated changes, stop and
   report. Do not check out over uncommitted work.
2. `gh pr checkout <n>` to get the branch locally.
3. `pnpm install` to sync dependencies for the branch.

## Run the mandated checks

Run the same suite AGENTS.md requires after changes, and capture the real
results:

```bash
pnpm typecheck
pnpm lint          # Biome carries the $pocket-trash logger console.* audit
pnpm test          # needs `infisical login`; use `pnpm test:ci` for the no-Infisical run
pnpm exec biome check --linter-enabled=false .   # format check without rewriting the PR
```

- If the diff touches `packages/logger/**`, also run `pnpm test:logger:axiom`
  when Infisical and Axiom credentials are available; otherwise report it
  skipped.
- If the diff touches `packages/database/**` or migrations, run
  `pnpm --filter @package/database exec drizzle-kit check`.
- The shell is zsh: `${PIPESTATUS[0]}` does not work. Judge pass/fail from the
  actual command output (`Tasks: N successful`, `problems`, `FAIL`), not a
  wrapper exit code.
- A red check may be a build artifact, not a PR defect. Clean generated output
  before blaming source; stale `packages/*/dist` with old imports can fail a
  downstream build until rebuilt (`pnpm --filter <pkg> build`).

## Review the diff

1. Scope it: `gh pr view <n>`, `git diff <base>...HEAD --stat`, and read the PR
   body's own Testing steps.
2. Report concrete defects only — correctness bugs, security (secret leakage,
   injection), data loss, races, missing error handling — each with a
   `file:line` and a plausible failure scenario, ranked by severity. Skip style
   and naming nits.
3. Verify before reporting. Re-read the actual code for every finding; if you
   used subagents, confirm their claims yourself. Prefer "plausible" over
   asserting a bug you have not traced to a failure path.
4. Separate real PR defects from artifacts of your own testing. If you edited
   code or the schema to exercise the PR and that breaks a build, that is a
   test-procedure gap, not a PR bug — say so.
5. If the PR ships a schema change, confirm a migration was generated;
   `drizzle-kit check` alone does not catch a missing migration.

## Report

- Summarize findings to the user first: checks pass/fail and ranked defects.
- Post a comment only when the user asks. Keep each PR's comment scoped to that
  PR — do not reference other PRs inside it.
- Post a plain comment by default: `gh pr comment <n> --body-file <file>` (write
  the body to a file so backticks and `$` render literally).
- Use `gh pr review <n> --approve` or `--request-changes` only when the user
  explicitly asks for a formal review verdict.
- Do not add AI co-authorship or generated-by lines.

## If you run the PR's own integration test

Some PRs document a test that pushes a branch or opens a throwaway PR to trigger
CI. Those are outward-facing and create real resources — get explicit
confirmation first. Afterward, clean up: close the throwaway PR, delete its
branch, and confirm any CI cleanup (such as a preview database branch) ran.

## Always clean up

Before finishing, leave the environment as you found it:

- Stop any dev servers you started and confirm their ports are free; a
  backgrounded server left running blocks the user's next run.
- Restore the working tree and remove throwaway branches.
- Report exactly what passed, what failed, and what you skipped.

## Error Cases

- No PR for the branch: report it; do not invent one.
- Dirty working tree: stop before checkout.
- Missing `gh` or `infisical`: report that the tool is required.
