# pocket-trash.app

Monorepo for the pocket-trash.app apps and shared packages.

## Getting started

### Prerequisites

- Node.js 22
- Corepack, enabled with `corepack enable`
- pnpm 10.33.2, provided by the repo `packageManager` setting
- Infisical CLI access to the `Pocket Trash` project (`pocket-trash` slug)

### Installing and configuring Infisical

This repo uses the Infisical project `Pocket Trash` (`pocket-trash` slug) for local Development secrets.
Production and preview host secrets are synced from Infisical into the hosting
platform where possible.

See [Environment Variables](docs/environment-variables.md) for app-specific
runtime variables.

1. Install the official Infisical CLI for your OS:
   <https://infisical.com/docs/cli/overview>

2. Confirm the CLI is available:

   ```sh
   infisical --version
   ```

3. Authenticate with Infisical:

   ```sh
   infisical login
   ```

4. Test local Infisical access:

   ```sh
   infisical run --env=dev --path=/local/smoke -- node -e "console.log(process.env.TEST)"
   ```

   You should see:

   ```txt
   Infisical working
   ```

5. For app-specific environment variables and secret paths, see
   [Environment Variables](docs/environment-variables.md).

6. Confirm the app secret folders you need exist in Infisical:

   - `/apps/web` in `dev`, `preview`, and `prod`
   - `/apps/scraper` in `dev`
   - `/tools/logger-axiom-test` in `dev`, if running the live Axiom logger test

### Install deps and set up the repo after Infisical

After cloning the repo and confirming Infisical access, install dependencies from
the repo root:

```sh
corepack enable
pnpm install
```

Install the shared Pocket Trash agent skills from GitHub:

```sh
pnpm agent-skills:update
```

Run the baseline checks before starting app work:

```sh
pnpm format
pnpm lint
pnpm typecheck
```

### Developing the web app

Run the TanStack Start web app from the repo root:

```sh
pnpm dev:web
```

### Testing localizations locally with yalc

Install yalc once:

```sh
pnpm add -g yalc
```

Build and publish the sibling `localizations` repo:

```sh
cd ../localizations
pnpm install
pnpm build
yalc publish
```

Add it in Pocket Trash:

```sh
cd ../pocket-trash
yalc add @pocket-trash/localizations --link
pnpm install
```

After localization changes:

```sh
cd ../localizations
pnpm build
yalc push
```

For further information, see
[Localizations Local Dev With yalc](docs/localizations-yalc-local-dev.md).

## AI commands

| Task | Claude | Codex | What it does |
| --- | --- | --- | --- |
| List workflows | `/pocket-trash` | `$pocket-trash` | Lists Pocket Trash workflow subcommands. |
| Commit | `/pocket-trash commit` | `$pocket-trash commit` | Uses the shared `pocket-trash` router to write conventional commits for this monorepo. |
| Create PR | `/pocket-trash pr-create` | `$pocket-trash pr-create` | Uses the shared `pocket-trash` router to create a GitHub PR from the current branch and commits. |
| FigJam | `/pocket-trash figjam` | `$pocket-trash figjam` | Uses shared FigJam tooling to read allowed FigJam/Figma files, generate plugin payloads, and update planning/design boards through the private plugin bridge. |
| Grill me | `/pocket-trash grill-me` | `$pocket-trash grill-me` | Uses the shared `pocket-trash` router to stress-test a plan or design by walking through decision-tree questions one at a time. |
| Update PR | `/pocket-trash pr-update` | `$pocket-trash pr-update` | Uses the shared `pocket-trash` router to refresh an existing PR title and description from branch commits and changes. |
| Review PR | `/pocket-trash pr-review` | `$pocket-trash pr-review` | Uses the shared `pocket-trash` router to review a PR: run the repo checks, review the diff for real defects, and report findings scoped to that PR. |

## Running apps

Local app dev commands use Infisical to load Development secrets. Configure the repo first before running them.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Starts app dev servers through Turborepo. |
| `pnpm dev:web` | Starts the TanStack Start web app. |
| `pnpm dev:scraper` | Runs scraper development commands. |


## Running tools

Local `pnpm test` requires `infisical login` because it checks Infisical CLI auth
before running app tests. Use `pnpm test:ci` for the CI-style test run without
Infisical.

| Command | What it does |
| --- | --- |
| `pnpm build` | Builds all apps and packages through Turborepo. |
| `pnpm build:ci` | Builds all apps and packages through Turborepo with environment variables already provided. |
| `pnpm figjam read` | Reads the configured FigJam/Figma file into `.figjam/cache`; run through `infisical run --env=dev --path=/local/figma -- pnpm figjam read`. |
| `pnpm figjam serve-outbox` | Serves validated `.figjam/outbox` payloads to the private local FigJam plugin bridge. |
| `pnpm lint` | Runs Biome linting project-wide, then package-level lint tasks. |
| `pnpm format` | Formats supported files with Biome. |
| `pnpm check` | Runs Biome format/lint/import checks with fixes, then package-level checks. |
| `pnpm typecheck` | Runs TypeScript typechecking across packages and apps. |
| `pnpm test` | Checks local Infisical CLI auth, then runs app tests with Infisical Development secrets and package tests without secrets. |
| `pnpm test:ci` | Runs local/unit tests without Infisical for CI. |
| `pnpm test:watch` | Runs watch-mode app tests with Infisical Development secrets and package tests without secrets. |
| `pnpm test:watch:no-infisical` | Runs watch-mode tests without Infisical where supported. |
