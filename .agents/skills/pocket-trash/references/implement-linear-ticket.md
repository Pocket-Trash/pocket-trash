# Implement Linear Ticket

Use the Linear MCP server as the source of truth for ticket content and branch
metadata before changing files.

## Required Inputs

- Linear issue id, such as `ENG-17`.
- Whether the user wants a git worktree.
- If using worktrees, the parent directory for new worktrees.

If the issue id is missing, ask for it. If the user has not already answered the
worktree questions, ask them before creating a branch or worktree.

## Read The Ticket

1. Read the issue through the Linear MCP server. Include the description,
   attachments, relations, customer needs, releases, and `gitBranchName` when
   available.
2. If the Linear MCP server is unavailable, stop and tell the user to configure
   it. Point them to `docs/linear-mcp-setup.md` when this repo is present.
3. Use the Linear `gitBranchName` exactly as the git branch name. If the issue
   does not have a branch name, stop and ask the user what branch name to use.
4. Read the ticket carefully and ask clarifying questions before implementation
   when requirements, target files, validation scope, or user-facing behavior
   are ambiguous.

## Prepare Git

Run these checks from the repository the user wants changed:

```sh
git branch --show-current
git status --short --branch
```

If the current branch is not `main`:

- If there are unstaged, staged, or uncommitted changes, stop and tell the user
  to commit or otherwise resolve those changes before proceeding.
- If the tree is clean and the user is **not** using worktrees, check out
  `main`. If the user **is** using worktrees, do **not** switch the current
  worktree — that fails if `main` is already checked out in another worktree.
  Instead run `git fetch origin` and branch the new worktree from `origin/main`
  in "Create The Branch Or Worktree" below.

Once on `main`, run:

```sh
git pull
```

If `git pull` fails because credentials or network access are unavailable, ask
for the access needed to continue.

## Create The Branch Or Worktree

Ask whether the user is using git worktrees. If they are:

1. Ask the user to confirm the worktree parent directory, even when they already
   provided one or when a likely default such as `../worktrees` exists.
2. Derive the worktree directory name by removing the leading alias segment and
   slash from the Linear branch name. For `ra/eng-17-example`, use
   `eng-17-example`. If the branch has no slash, use the full branch name.
3. Create the worktree at `<parent>/<derived-name>` with the Linear branch name:

```sh
git worktree add <parent>/<derived-name> -b <linear-branch-name> origin/main
```

4. Complete all remaining work inside the new worktree directory.

If the user is not using worktrees, create and check out the Linear branch in
the current repository:

```sh
git checkout -b <linear-branch-name>
```

## Install And Implement

After creating the branch or worktree, run:

```sh
pnpm install
```

Then implement the ticket in the active branch or worktree. Follow `AGENTS.md`
and any more specific repo instructions. Keep changes scoped to the Linear
ticket and any clarifications the user gave.

## Validation

Follow the repository validation instructions. In Pocket Trash app repos,
`AGENTS.md` usually requires:

```sh
pnpm format
pnpm test
pnpm lint
pnpm typecheck
```

For documentation-only changes, run only `pnpm format`. If validation cannot be
run, report the reason clearly.
