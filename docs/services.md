# Services Package

`@package/services` exposes app-facing service methods. It is the normal way for app code to use the database.

The package is environment-neutral. It does not read `process.env` itself. Each server app configures it once with app-local credentials.

## Public API

Import the configured app-local service instance as `s`, then use the `s.<namespace>.<service>.<method>` shape:

```ts
await s.db.users.ensure({ clerkId });

await s.db.userSettings.getByClerkId(clerkId);

await s.db.userSettings.upsertForClerkId(clerkId, {
  currencyCode: "CAD",
  dimensionUnit: "in",
  theme: "dark",
  weightUnit: "g",
});

s.logger.info("api.health.checked", {
  attributes: {
    route: "/api/v0/health",
  },
});
```

## App Configuration

Configure services once in each server app.

`apps/web/src/lib/services.ts`

```ts
import {
  createAxiomTransport,
  createConsoleTransport,
  loggerValues,
  normalizeConsoleTransportMode,
  normalizeLogLevel,
} from "@package/logger";
import services from "@package/services";
import { apiEnv } from "../env.js";

const environment = process.env.NODE_ENV ?? "development";
const isDevelopment = environment === "development";
const consoleTransport = createConsoleTransport({
  mode: normalizeConsoleTransportMode(apiEnv.LOGGER),
});
const transports = [
  ...(apiEnv.AXIOM_TOKEN && apiEnv.AXIOM_DATASET
    ? [
        createAxiomTransport({
          dataset: apiEnv.AXIOM_DATASET,
          edgeDomain: apiEnv.AXIOM_EDGE_DOMAIN,
          token: apiEnv.AXIOM_TOKEN,
        }),
      ]
    : []),
  ...(isDevelopment || !(apiEnv.AXIOM_TOKEN && apiEnv.AXIOM_DATASET)
    ? [consoleTransport]
    : []),
];

const logger = {
  app: loggerValues.apps.api,
  environment,
  level: normalizeLogLevel(apiEnv.LOG_LEVEL),
  transports,
};

services.configure({
  db: {
    databaseUrl: apiEnv.DATABASE_URL,
  },
  logger,
});
const transports = [
  ...(axiomToken && axiomDataset
    ? [createAxiomTransport({ dataset: axiomDataset, token: axiomToken })]
    : []),
  ...(isDevelopment || !(axiomToken && axiomDataset) ? [consoleTransport] : []),
];

const logger = {
  app: loggerValues.apps.api,
  environment,
  level: normalizeLogLevel(process.env.LOG_LEVEL),
  transports,
};

services.configure(databaseUrl ? { db: { databaseUrl }, logger } : { logger });

export { services as s };
```

`apps/web/src/lib/services.ts`

```ts
import process from "node:process";
import {
  createAxiomTransport,
  createConsoleTransport,
  loggerValues,
  normalizeConsoleTransportMode,
  normalizeLogLevel,
} from "@package/logger";
import services from "@package/services";
import { serverEnv } from "@/env/server";

const environment = process.env.NODE_ENV ?? "development";
const isDevelopment = environment === "development";
const consoleTransport = createConsoleTransport({
  mode: normalizeConsoleTransportMode(serverEnv.LOGGER),
});
const transports = [
  ...(serverEnv.AXIOM_TOKEN && serverEnv.AXIOM_DATASET
    ? [
        createAxiomTransport({
          dataset: serverEnv.AXIOM_DATASET,
          edgeDomain: serverEnv.AXIOM_EDGE_DOMAIN,
          token: serverEnv.AXIOM_TOKEN,
        }),
      ]
    : []),
  ...(isDevelopment || !(serverEnv.AXIOM_TOKEN && serverEnv.AXIOM_DATASET)
    ? [consoleTransport]
    : []),
];

const logger = {
  app: loggerValues.apps.web,
  environment,
  level: normalizeLogLevel(serverEnv.LOG_LEVEL),
  transports,
};

services.configure({
  db: {
    databaseUrl: serverEnv.DATABASE_URL,
  },
  logger,
});
const transports = [
  ...(axiomToken && axiomDataset
    ? [createAxiomTransport({ dataset: axiomDataset, token: axiomToken })]
    : []),
  ...(isDevelopment || !(axiomToken && axiomDataset) ? [consoleTransport] : []),
];

const logger = {
  app: loggerValues.apps.web,
  environment,
  level: normalizeLogLevel(process.env.LOG_LEVEL),
  transports,
};

services.configure(databaseUrl ? { db: { databaseUrl }, logger } : { logger });

export { services as s };
```

## Import Guidance

In `apps/web`, source files are TypeScript but emitted as Node ESM. Relative imports should use the emitted `.js` extension:

```ts
import { s } from "./lib/services.js";
```

In `apps/web`, import the configured module from server-side code:

```ts
import { s } from "@/lib/services";
```

Only import the web services module from SSR code, server functions, loaders, or other server-only modules. Do not import it from client components.

## Boundaries

- `apps/web` can use services directly.
- `apps/scraper` can use services directly from the Railway service. Its
  scraper-specific persistence currently uses `@package/database` directly
  because the schema and queue processor are source-specific.
- `apps/web` can use services from SSR/server-side tasks.
- `apps/web` must not receive `DATABASE_URL` and must not use database services directly. Mobile should call `apps/web` for persisted user or settings behavior.

If code uses `@package/services` before app-local configuration runs, it throws a clear initialization error.
Apps may configure `s.logger` without `DATABASE_URL`; `s.db` will throw only if database services are actually used. If `db` is configured, `logger` must be configured in the same call so database service methods can emit operation logs through `s.logger`.

Database service methods log stable operation names from `loggerMessages.database`. User identifiers are logged as deterministic hashes, not raw IDs.

## Adding Services

Add future database services under `s.db.<service>.<method>`.

For non-database domains, add a new top-level namespace under `s.<namespace>.<method>` only when that domain has its own cohesive service boundary.

## Storage boundary

Apps import storage capabilities only through `@package/services`; ESLint rejects direct `@package/storage` imports in all apps. Browser code imports limits and MIME maps from `@package/services/constants`, which has no Node dependencies.

`services.storage` owns upload sessions, path/version reservations, completion, expiry cleanup and generic file deletion. `services.db.catalog.attachImages` and `selectCollectionCover` own image records, permissions, positions and cover selection. Resource create/version metadata is validated in services, never in the API transport.

Apps configure one `ServicesConfig.storage` slot. With database and logger configuration, it creates `services.storage` (upload sessions and deletion) and `services.resources` (resource metadata) using one storage client. API callers request storage with `createApiServices(bindings, { storage: true })`; webhook callers omit that option and do not need Bunny credentials. Signing credentials are required only when signing URLs. Low-level `createUploadStorage`, object-path builders and byte transport remain internal to the services/storage packages. Bunny config fields are `accessKey`, `endpoint`, `zoneName`, and `cdnBaseUrl`; uploads also need `folderPrefix` and `imageFolderPrefix`. The `signImages` helper applies fresh signatures and Bunny delivery parameters for all uploaded display images. See [Resource Storage](resource-storage.md) for routes and limits.

Run `pnpm --filter @package/services test:storage` with Docker available to test upload reservations, version allocation, completion, deletion guards and cleanup against a disposable PostgreSQL database. The command applies the migration history to its own container and removes the container afterward. It does not use configured application databases.

The API uses `apps/api/src/lib/services.ts` as a per-request factory because Cloudflare Worker bindings arrive per request. Webhook requests configure database services; upload requests also configure storage.
