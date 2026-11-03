# API contracts

- Cover every `apps/api` endpoint's actual mounted method/path in live OpenAPI, updating parameters, authentication, body and responses. JSDoc is not registration.
- Use `createRoute`/`app.openapi` when automatic validation fits; use `openAPIRegistry.registerPath` for raw signed bodies, binary uploads or custom validation. Metadata must preserve processing.
- Attach middleware to explicit method/path registrations. `.on()`/nested routers use actual methods/prefixes; duplicate operations count once, including `next` middleware.
- Opaque ALL/use/mounts, optional/regex parameters and nonterminal wildcards fail coverage. Terminal catch-alls require matching `x-hono-path`; storage `/storage/{path}` describes the greedy tail. Preserve unknown-path preflight/CORS/logger flushing.
- Implicit HEAD-through-GET needs no operation; explicit HEAD/OPTIONS does. Default 404 adds none.
- Run `pnpm lint:openapi` (also lint, pre-commit, CI, `validate:pr`): it compares registrations with live `/api/v0/openapi.json`, without exemptions/manual inventories. No credentials/database/deployment required. Live Scalar: `/api/v0/docs`; generated Markdown is unnecessary.
