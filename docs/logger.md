# Logger Operations

The logger API, event contract, redaction behavior, and transport configuration
are documented at their source:

- [Shared logger API](../packages/logger/src/index.ts)
- [Stable event names and protocol values](../packages/logger/src/constants/logger.ts)
- [API logger configuration](../apps/api/src/lib/services.ts)
- [Web server logger configuration](../apps/web/src/lib/services.ts)
- [Web browser logger configuration](../apps/web/src/lib/logger.ts)
- [Scraper logger configuration](../apps/scraper/src/lib/logger.ts)

Do not copy those contracts into this runbook.

## Axiom Datasets

Use one dataset per environment:

| Environment | Dataset |
| --- | --- |
| Development | `development` |
| Preview | `preview` |
| Production | `production` |

Keep routing and deployment dimensions as ordinary top-level fields:
`app`, `environment`, `deploymentTarget`, `deploymentId`, `level`,
`message`, `timestamp`, `operation`, `outcome`, and `durationMs`.

Configure `attributes`, `context`, `error`, and `rawPayload` as Axiom map
fields. This keeps arbitrary nested keys queryable without consuming a dataset
field for each key.

Run the setup once for each dataset:

```sh
AXIOM_DATASET=development AXIOM_TOKEN=<token> pnpm logger:axiom:map-fields
AXIOM_DATASET=preview AXIOM_TOKEN=<token> pnpm logger:axiom:map-fields
AXIOM_DATASET=production AXIOM_TOKEN=<token> pnpm logger:axiom:map-fields
```

The command uses `AXIOM_EDGE_DOMAIN` when set and otherwise uses
`api.axiom.co`. To configure Axiom manually, create map fields with those four
exact names in each dataset's field settings.

## Infisical Placement

The environment-variable inventory and runtime behavior live in
[Environment Variables](./environment-variables.md). Store runtime logger
settings in the matching Infisical application path:

- Web server: `/apps/web`
- API worker: `/apps/api`
- Scraper: `/apps/scraper`

The Axiom token in each path needs ingest access to that environment's dataset.
Only give query access to the dedicated live-test token.

Additional operational paths:

- Local live test: environment `dev`, path `/tools/logger-axiom-test`
- CI live test: environment `preview`, path `/tools/github/secrets`

GitHub Actions authenticates to Infisical through OIDC. See
[GitHub Infisical OIDC](./github-infisical.md) for that bootstrap configuration.

## Redaction And Observability

- Use stable names from `loggerMessages`; place changing values in
  `attributes`.
- Never log raw Clerk IDs, user IDs, credentials, tokens, cookies, database
  URLs, or request authorization data. Service code should use the existing
  hashed-identifier helpers.
- Sensitive key names are redacted recursively before transport delivery.
  Client events are validated and redacted again by the server ingestion
  endpoint.
- Raw payloads require explicit call-site opt-in. Prefer the API and database
  payload summarizers.
- `LOGGER=verbose` exposes the complete redacted event in development
  terminals. Leave it unset for compact output.
- Keep `app`, deployment fields, and environment accurate so an event can be
  traced to its runtime.

To inspect recent failures across an environment:

```apl
['preview']
| where level in ("error", "fatal")
| project ['_time'], app, environment, deploymentTarget, deploymentId, message, attributes, error
| order by ['_time'] desc
```

CI events use `app == "ci"` and stable `ci.*` message namespaces. Axiom
ingest failure does not hide a CI event from the GitHub Actions log.

## Live Axiom Test

The live test is intentionally excluded from `pnpm test` and `pnpm test:ci`.
Run it only when validating the real Axiom integration:

```sh
pnpm test:logger:axiom
```

For a local run, `/tools/logger-axiom-test` must provide the logger variables
listed in [Environment Variables](./environment-variables.md), including:

- `AXIOM_DATASET=development`
- `LOG_LEVEL=trace`
- an Axiom token with ingest and query access
- the log-proxy client key

The test fails if its expected dataset or trace level is not configured. It
emits direct and proxied events, queries Axiom, and verifies severity,
deployment metadata, client identity preservation, structured context,
operation metadata, and redaction.

[Logger Live](../.github/workflows/logger-live.yml) runs the same check for
same-repository pull requests that touch logger-relevant files and by manual
workflow dispatch. CI expects the `preview` dataset and reads its secrets from
`tools/github/secrets`.
