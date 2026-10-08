# pocket-trash.app

Monorepo for the pocket-trash.app apps and shared packages.

## Setup

### Prerequisites

- Node.js 24.21.0 or newer within Node 24
- Corepack, enabled with `corepack enable`
- pnpm 10.33.2, provided by the repo `packageManager` setting
- Infisical CLI access to the `Pocket Trash` project (`pocket-trash` slug)

### Install and configure Infisical

This repo uses the Infisical project `Pocket Trash` (`pocket-trash` slug) for
local development secrets. Production and preview host secrets are synced from
Infisical into the hosting platform where possible.

1. Install the official Infisical CLI for your OS:
   <https://infisical.com/docs/cli/overview>
2. Authenticate with `infisical login`.
3. Verify local access:

   ```sh
   infisical run --env=dev --path=/local/smoke -- node -e "console.log(process.env.TEST)"
   ```

   The command should print `Infisical working`.
4. Confirm the app secret folders you need exist:
   - `/apps/web` in `dev`, `preview`, and `prod`
   - `/apps/scraper` in `dev`
   - `/tools/logger-axiom-test` in `dev`, when running the live Axiom logger test

See [Environment Variables](docs/environment-variables.md) for secret paths,
runtime ownership, and links to the authoritative source schemas.

### Install the repository

```sh
corepack enable
pnpm install
pnpm agent-skills:update
pnpm infisical:check
```

`pnpm agent-skills:update` installs the shared Pocket Trash agent skills in a
Git clone. Worktrees created by the Pocket Trash CLI install them automatically.

| Command | What it does |
| --- | --- |
| `pnpm agent-skills:update` | Installs or updates the shared Pocket Trash agent skills. |
| `pnpm infisical:check` | Verifies local Infisical CLI authentication. |

### Test localizations with yalc

Install yalc once with `pnpm add -g yalc`, then build and publish the sibling
`localizations` repo:

```sh
cd ../localizations
pnpm install
pnpm build
yalc publish
```

Link it into Pocket Trash:

```sh
cd ../pocket-trash
yalc add @pocket-trash/localizations --link
pnpm install
```

After localization changes, run `pnpm build && yalc push` from the
`localizations` repo. See
[Localizations Local Dev With yalc](docs/localizations-yalc-local-dev.md) for
details.

## Development

Local development commands load development secrets from Infisical.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Starts the web app, API, and logger watcher. |
| `pnpm dev:all` | Starts every app, including the scraper, plus the logger watcher. |
| `pnpm dev:verbose` | Starts the web app, API, and logger watcher with Infisical provider information. |
| `pnpm dev:webhooks` | Reconciles Clerk users, starts `pnpm dev`, opens Clerk and Cloudflare relays, and registers the temporary webhook targets. |
| `pnpm storybook` | Starts the web Storybook server without opening a browser. |

Set `INFISICAL_RUNNER_VERBOSE=1` when running `pnpm dev:all` if provider details
are needed. Webhook setup and relay requirements are documented in
[Development Webhook Forwarding](docs/clerk-webhooks.md).

## Build and validation

| Command | What it does |
| --- | --- |
| `pnpm build` | Builds all apps and packages through Turborepo. |
| `pnpm build:ci` | Builds all apps and packages with CI-provided environment variables. |
| `pnpm format` | Formats files and organizes imports with Biome. |
| `pnpm lint` | Runs repository ESLint and the complete JSDoc check. |
| `pnpm lint:jsdoc` | Checks JSDoc on eligible tracked JavaScript and TypeScript declarations. |
| `pnpm typecheck` | Typechecks all apps and packages through Turborepo. |

## Tests

Local `pnpm test` requires `infisical login`. Use `pnpm test:ci` for the CI-style
suite without the Infisical authentication check.

| Command | What it does |
| --- | --- |
| `pnpm test` | Runs repository checks and all app and package tests with local secrets where required. |
| `pnpm test:ci` | Runs repository checks and CI test tasks without local Infisical authentication. |
| `pnpm test:jsdoc` | Tests the repository JSDoc checker. |
| `pnpm test:logger:axiom` | Runs the live Axiom logger integration test. |
| `pnpm test:watch` | Starts supported tests in watch mode with development secrets. |
| `pnpm test:watch:no-infisical` | Starts supported tests in watch mode without Infisical. |
| `pnpm test:workflows` | Tests repository workflow and command contracts. |

## Deployment and database

| Command | What it does |
| --- | --- |
| `pnpm changeset` | Creates release metadata for a change. |
| `pnpm db:generate` | Generates a database migration from schema changes. |
| `pnpm db:migrate` | Applies database migrations. |
| `pnpm db:resolve-conflicts` | Resolves Drizzle migration history conflicts. |
| `pnpm db:seed` | Seeds the selected database. |
| `pnpm db:validate:chain` | Applies the repository migration chain to disposable PGlite. |
| `pnpm db:validate:personal` | Read-only comparison of the selected personal Neon migration history. |
| `pnpm db:studio` | Opens Drizzle Studio for the selected local database. |
| `pnpm deploy` | Deploys the production API Worker. |
| `pnpm deploy:development` | Deploys the development API Worker. |
| `pnpm deploy:preview` | Deploys the preview API Worker. |
| `pnpm release` | Applies pending Changesets and runs the repository release workflow. |

## Scraper

Root scraper commands start or reuse local Docker/OrbStack Redis and inject the
scraper secrets from Infisical.

| Command | What it does |
| --- | --- |
| `pnpm dev:scraper` | Starts the scraper in watch mode. |
| `pnpm scraper:cron` | Runs one local scraper cron cycle and exits. |
| `pnpm scraper:process:dead-letter` | Processes the scraper dead-letter queue. |
| `pnpm scraper:process:queue` | Processes the scraper work queue. |
| `pnpm scraper:scrape -- <source>` | Scrapes one source, such as `autmog` or `grimsmo-saga`. |
| `pnpm start` | Starts the built scraper cron service. |

See [Railway](docs/railway.md) for deployment behavior and all supported source
keys.

## Operations

| Command | What it does |
| --- | --- |
| `pnpm bunny:audit` | Audits configured Bunny services, billing, and usage. |
| `pnpm diagram:infra` | Regenerates the infrastructure diagram and metadata. |
| `pnpm diagram:database` | Regenerates the interactive diagram from the checked-out Drizzle schema. |
| `pnpm logger:axiom:map-fields` | Configures the Axiom field mapping used by the logger. |
| `pnpm resources:reconcile-storage` | Reconciles database resource records with object storage. |
| `pnpm users:reconcile` | Reconciles Clerk users into the application database. |

## AI commands

| Task | Claude | Codex | What it does |
| --- | --- | --- | --- |
| List workflows | `/pocket-trash` | `$pocket-trash` | Lists Pocket Trash workflow subcommands. |
| Commit | `/pocket-trash commit` | `$pocket-trash commit` | Writes conventional commits for this monorepo. |
| Create PR | `/pocket-trash pr-create` | `$pocket-trash pr-create` | Creates a GitHub PR from the current branch and commits. |
| Grill me | `/pocket-trash grill-me` | `$pocket-trash grill-me` | Stress-tests a plan or design with focused questions. |
| Update PR | `/pocket-trash pr-update` | `$pocket-trash pr-update` | Refreshes an existing PR title and description. |
| Review PR | `/pocket-trash pr-review` | `$pocket-trash pr-review` | Runs repository checks and reviews a PR diff for defects. |
