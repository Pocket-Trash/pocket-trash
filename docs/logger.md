# Logger

`@package/logger` is the shared logging package for server and client code. Server
apps send directly to Axiom. Browser and Expo clients send to the API log proxy
so provider credentials are never bundled into client builds.

## Local Ports

Local development uses stable ports:

- Web: `http://localhost:4005`
- API: `http://localhost:4006`
- Client log proxy: derived from `http://localhost:4006`

## Axiom Setup

Use one Axiom dataset per environment:

- Development: `development`
- Preview: `preview`
- Production: `production`

Keep the app name on each event with `app: "api"`, `app: "web"`, or
`app: "expo"`. Scraper events should use a scraper-specific app value once
`apps/scraper` is added. This keeps cross-app flows queryable in one dataset.
Split into per-app datasets only if access, retention, or cost controls need to
differ by app.

Keep stable routing and deployment dimensions as fixed top-level fields:
`app`, `environment`, `deploymentTarget`, `deploymentId`, `level`, `message`,
`timestamp`, `operation`, `outcome`, and `durationMs`.

Keep structured or high-cardinality payloads as top-level Axiom map fields:
`attributes`, `context`, `error`, and `rawPayload`. Configure these map fields
once per dataset before relying on the logger in that dataset. They stay
queryable, but arbitrary nested keys do not consume dataset fields one by one.

Run the setup script for each dataset:

```sh
AXIOM_DATASET=development AXIOM_TOKEN=<token> pnpm logger:axiom:map-fields
AXIOM_DATASET=preview AXIOM_TOKEN=<token> pnpm logger:axiom:map-fields
AXIOM_DATASET=production AXIOM_TOKEN=<token> pnpm logger:axiom:map-fields
```

The script reads optional `AXIOM_EDGE_DOMAIN` and otherwise uses
`api.axiom.co`. To configure manually in Axiom, open the dataset fields list and
create map fields named exactly `attributes`, `context`, `error`, and
`rawPayload`.

Railway scraper jobs emit `scraper.*` events for run lifecycle, source fetches,
queue enqueue/drain, item and image processing, image storage operations, and
database mutations.

## Infisical

Server targets that send directly to Axiom keep their Axiom settings in their
own runtime folders:

- `/apps/web`
- `/apps/scraper`
- `/apps/web`

Each server runtime folder may provide:

- `AXIOM_TOKEN`
- `AXIOM_DATASET`
- `AXIOM_EDGE_DOMAIN`, optional
- `LOG_LEVEL`, optional
- `LOGGER`, optional
- `LOG_DEPLOYMENT_ID`, optional
- `LOG_DEPLOYMENT_TARGET`, optional

`AXIOM_TOKEN` must have ingest access for the configured dataset.
`LOGGER=verbose` makes development terminal logs print the full event. Omit it
for compact terminal logs. `LOG_DEPLOYMENT_ID` identifies the deploy or preview,
for example `pr-40`, `preview`, or `production`. `LOG_DEPLOYMENT_TARGET`
identifies the runtime, for example `cloudflare-worker`, `vercel`, `railway`,
`web-client`, or `expo-client`.

Recommended values:

```dotenv
# Development
AXIOM_DATASET=development
LOG_DEPLOYMENT_ID=development
LOG_DEPLOYMENT_TARGET=local
LOG_LEVEL=debug
# LOGGER=verbose

# Production
AXIOM_DATASET=production
LOG_DEPLOYMENT_ID=production
LOG_DEPLOYMENT_TARGET=<cloudflare-worker|vercel|railway>
LOG_LEVEL=info
```

Omit `AXIOM_EDGE_DOMAIN` unless Axiom has given the project a custom edge
domain.

Browser log forwarding is same-origin through the web server:

- Browser code posts to `POST /api/v0/logs`.
- `LOG_PROXY_CLIENT_KEY` is optional on the server.
- `VITE_LOG_PROXY_CLIENT_KEY` is optional in the browser and is aliased from
  `LOG_PROXY_CLIENT_KEY` during web builds when absent.
- Optional `LOG_DEPLOYMENT_ID` and `LOG_DEPLOYMENT_TARGET` are aliased to their
  `VITE_` counterparts for browser logs.

Local development and production use the same path; no separate API origin is
configured for browser logging.

## Package Build

`@package/logger` exports from `dist`:

```json
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

`pnpm build`, `pnpm test`, and `pnpm typecheck` build workspace dependencies
through Turbo. Local dev commands also include `@package/logger` and run its watch
build, so logger source changes update `packages/logger/dist` while the apps are
running.

Use normal dev commands:

```sh
pnpm dev:web
```

## Development Terminal Logs

Server apps print JSON newline-delimited logs to the terminal in development,
even when Axiom is configured. The default terminal shape is compact:

```json
{
  "app": "api",
  "deploymentId": "development",
  "deploymentTarget": "cloudflare-worker",
  "durationMs": 12,
  "environment": "development",
  "level": "info",
  "message": "db.query.succeeded",
  "operation": "db.query",
  "outcome": "success",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

Set `LOGGER=verbose` to print the full redacted event, including full context,
attributes, errors, and raw payloads that were explicitly logged.

## Logger Messages And Values

Reusable logger messages and protocol values live in `@package/logger`:

```ts
import { loggerMessages, loggerValues } from "@package/logger";
```

Use stable event IDs from `loggerMessages`; put dynamic values in `attributes`.
Use `loggerValues` for logger app identifiers and log proxy protocol values.

CI workflows and helper scripts emit compact JSON log events with `app: "ci"`.
They always remain visible in GitHub Actions logs. Workflows fetch `AXIOM_TOKEN`
and `AXIOM_DATASET` from Infisical `tools/github/secrets` before
`.github/scripts/ci-log.sh` forwards the same redacted event to Axiom. CI Axiom
ingest failures are non-fatal and print a warning in Actions logs.

PR, preview cleanup, and scheduled preview database events read the Infisical
`preview` environment. Production release and main workflow dispatch database
events read the Infisical `prod` environment. `AXIOM_EDGE_DOMAIN` is optional.

Current CI event namespaces include:

- `ci.database.preview.*`: PR database change detection, shared preview branch
  selection, preview branch creation/recreation/deletion, branch-limit blocking,
  preview branch expiration, preview refresh, and preview migration completion.
- `ci.database.production.*`: production database selection and migration
  completion.
- `ci.github.*`: GitHub-side metadata updates such as the `db-change` label.
- `ci.vercel.preview.*`: branch-specific Preview `DATABASE_URL` override set,
  removal, missing cleanup target, and latest preview deployment lookup.

Preview database events include filterable attributes for GitHub workflow
metadata (`workflowName`, `runId`, `jobName`, `pullRequestNumber`, `gitBranch`,
`commitSha`) and database metadata (`branchName`, `branchId`). Migration
failures also include `failureStep`.

Search the `preview` dataset for all CI database events:

```apl
['preview']
| where app == "ci"
| where startswith(message, "ci.database.")
| order by ['_time'] desc
```

Search for failed preview migrations:

```apl
['preview']
| where app == "ci"
| where message == "ci.database.preview.migrations.failed"
| project ['_time'], workflowName=attributes.workflowName, runId=attributes.runId, jobName=attributes.jobName, pullRequestNumber=attributes.pullRequestNumber, gitBranch=attributes.gitBranch, branchName=attributes.branchName, branchId=attributes.branchId, failureStep=attributes.failureStep
| order by ['_time'] desc
```

Search one pull request's preview database lifecycle:

```apl
['preview']
| where app == "ci"
| where startswith(message, "ci.database.preview.")
| where attributes.pullRequestNumber == "63"
| project ['_time'], level, message, gitBranch=attributes.gitBranch, branchName=attributes.branchName, branchId=attributes.branchId, failureStep=attributes.failureStep
| order by ['_time'] asc
```

## Biome Audit

Root `biome.json` enforces the mechanical logger audit rules:

- `console.*` is rejected in `apps/web/src`, `apps/web/src`,
  `apps/web/src`, `packages/services/src`, and `packages/database/src`.
- `@package/logger` imports are rejected in `packages/database/src` so the
  database package stays storage-only. Log database behavior from
  `packages/services`.

The remaining audit is semantic: reuse existing `loggerMessages` and
`loggerValues` where possible, add new constants only when needed, and avoid
logging raw identifiers or sensitive values.

## Live Axiom Test

The live logger test is explicit and is not part of `pnpm test` or
`pnpm test:ci`.

Run it only when intentionally validating the real Axiom integration:

```sh
pnpm test:logger:axiom
```

Local runs load secrets from Infisical environment `dev` path
`/tools/logger-axiom-test` through the Infisical runner. CI loads secrets from
Infisical environment `preview` path `tools/github/secrets`.

Local `/tools/logger-axiom-test` must provide:

- `LOG_LEVEL`, currently `trace`
- `LOG_PROXY_CLIENT_KEY`
- `AXIOM_TOKEN`, with ingest and query access to the configured dataset
- `AXIOM_DATASET=development` for local runs, or `AXIOM_DATASET=preview` for CI
- optional `AXIOM_EDGE_DOMAIN`

CI `tools/github/secrets` must provide `LOG_PROXY_CLIENT_KEY`, `AXIOM_TOKEN`,
`AXIOM_DATASET=preview`, and optional `AXIOM_EDGE_DOMAIN`. The workflow sets
`LOG_LEVEL=trace` directly because it is test configuration, not a secret.

The test hard-fails unless `AXIOM_DATASET` matches the expected dataset and
`LOG_LEVEL` is `trace`. Local runs default to the `development` dataset. CI sets
`LOGGER_AXIOM_EXPECTED_DATASET=preview` so pull request validation writes to the
`preview` dataset. The test emits direct logger events and in-process client
proxy events, then queries Axiom to confirm the events were received, levels were
preserved, deployment metadata was recorded, proxied client rows kept the
original client top-level identity, context and operation metadata were recorded,
and sensitive values were redacted.

The dedicated GitHub Actions workflow is `.github/workflows/logger-live.yml`.
It runs the live check for same-repository pull requests that touch
logger-relevant files and can also be run manually with `workflow_dispatch`.
In CI, the workflow authenticates to Infisical with OIDC, fetches
`tools/github/secrets` from the `preview` environment, then runs the live script
directly. See [GitHub Infisical OIDC](./github-infisical.md) for the bootstrap
secrets and runtime inventory.

See `plans/configure-repo-for-logger.md` for the Infisical identity setup.

## Server Configuration

Each server app configures services locally. The services package is
environment-neutral and does not read `process.env` itself.

API configuration:

```ts
import {
  createAxiomTransport,
  createConsoleTransport,
  loggerValues,
  normalizeConsoleTransportMode,
  normalizeLogLevel,
} from "@package/logger";
import services from "@package/services";

const databaseUrl = process.env.DATABASE_URL;
const axiomToken = process.env.AXIOM_TOKEN;
const axiomDataset = process.env.AXIOM_DATASET;
const environment = process.env.NODE_ENV ?? "development";
const deploymentId = process.env.LOG_DEPLOYMENT_ID ?? environment;
const deploymentTarget = process.env.LOG_DEPLOYMENT_TARGET ?? "cloudflare-worker";
const isDevelopment = environment === "development";
const consoleTransport = createConsoleTransport({
  mode: normalizeConsoleTransportMode(process.env.LOGGER),
});
const transports = [
  ...(axiomToken && axiomDataset
    ? [
        createAxiomTransport({
          dataset: axiomDataset,
          edgeDomain: process.env.AXIOM_EDGE_DOMAIN,
          token: axiomToken,
        }),
      ]
    : []),
  ...(isDevelopment || !(axiomToken && axiomDataset) ? [consoleTransport] : []),
];

const logger = {
  app: loggerValues.apps.api,
  deploymentId,
  deploymentTarget,
  environment,
  level: normalizeLogLevel(process.env.LOG_LEVEL),
  transports,
};

services.configure(databaseUrl ? { db: { databaseUrl }, logger } : { logger });

export { services as s };
```

Server-side web configuration uses the same pattern with
`app: loggerValues.apps.web`.

## API Usage

Use the configured service instance in API code:

```ts
import { s } from "./lib/services.js";
import { loggerMessages } from "@package/logger";

app.get("/api/v0/health", (context) => {
  s.logger.info(loggerMessages.api.healthChecked, {
    attributes: {
      route: "/api/v0/health",
    },
  });

  return context.json({
    ok: true,
    service: "api",
  });
});
```

Wrap timed work with `operation`:

```ts
const settings = await s.logger.operation(
  loggerMessages.database.userSettings.getByClerkId,
  async () => {
    return await s.db.userSettings.getByClerkId(clerkId);
  },
  {
    attributes: {
      clerkId,
    },
  },
);
```

## Server-Side Web Usage

Use the configured web services module only from SSR code, server functions, or
loaders:

```ts
import { createServerFn } from "@tanstack/react-start";
import { loggerMessages } from "@package/logger";
import { s } from "@/lib/services";

export const getAccount = createServerFn().handler(async () => {
  s.logger.info(loggerMessages.web.accountLoaded, {
    attributes: {
      route: "/user/account",
    },
  });

  return await s.logger.operation("db.account.load", async () => {
    return await s.db.userSettings.getByClerkId("clerk-user-id");
  });
});
```

Do not import `@package/services` or `apps/web/src/lib/services.ts` from client
components.

## Browser Client Usage

Browser code imports the app-local logger from `apps/web/src/lib/logger.ts`:

```ts
import { logger } from "@/lib/logger";
import { loggerMessages } from "@package/logger";

logger.warn(loggerMessages.web.fxRatesFetchFailed, {
  attributes: {
    baseCurrency,
  },
});
```

The app-local module owns the browser proxy configuration:

```ts
import { createLogger, createProxyTransport, loggerValues } from "@package/logger";

const apiUrl = import.meta.env.same-origin /api/v0/logs;
const logProxyUrl = apiUrl
  ? `${apiUrl.replace(/\/+$/, "")}/api/v0/logs`
  : undefined;

const transports = logProxyUrl
  ? [
      createProxyTransport({
        clientKey: import.meta.env.VITE_LOG_PROXY_CLIENT_KEY,
        url: logProxyUrl,
      }),
    ]
  : [];

export const logger = createLogger({
  app: loggerValues.apps.web,
  deploymentId: import.meta.env.VITE_LOG_DEPLOYMENT_ID ?? import.meta.env.MODE,
  deploymentTarget:
    import.meta.env.VITE_LOG_DEPLOYMENT_TARGET ?? "web-client",
  environment: import.meta.env.MODE,
  transports,
});
```

## Web Client Usage

Browser code imports the app-local logger from `apps/web/src/lib/logger.ts`:

```ts
import { logger } from "@/lib/logger";

logger.info("web.interaction", {
  attributes: {
    source: "browser",
  },
});
```

The app-local logger posts to the same-origin web ingestion route:

```ts
import { createLogger, createProxyTransport, loggerValues } from "@package/logger";

export const logger = createLogger({
  app: loggerValues.apps.web,
  environment: import.meta.env.MODE,
  transports: [
    createProxyTransport({
      clientKey: import.meta.env.VITE_LOG_PROXY_CLIENT_KEY,
      url: "/api/v0/logs",
    }),
  ],
});
```

## Log Proxy

The API exposes `POST /api/v0/logs`. It accepts a single event, an array of
events, or `{ "events": [...] }`. Batches are capped at 25 events. The API
validates the event shape, enriches the event with proxy metadata in
`attributes`, redacts again server-side, and forwards through `s.logger.forward`.
Forwarding preserves the original client top-level identity fields: `app`,
`environment`, `deploymentTarget`, and `deploymentId`.

If `LOG_PROXY_CLIENT_KEY` is configured, clients must send it with the
`x-log-client-key` header. The proxy transport handles this automatically.

## Redaction And Payloads

The logger redacts sensitive keys such as `authorization`, `cookie`, `password`,
`secret`, and `token` from context, attributes, errors, and explicit raw
payloads.

Prefer summary-first payload logging:

```ts
import { summarizeApiPayload } from "@package/logger";

s.logger.info("api.integration.response", {
  attributes: summarizeApiPayload(responseBody),
});
```

Raw payload logging requires explicit opt-in at the call site:

```ts
s.logger.debug("api.integration.raw", {
  includeRawPayload: true,
  rawPayload: responseBody,
});
```
