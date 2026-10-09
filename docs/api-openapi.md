# API OpenAPI coverage

Every HTTP endpoint in `apps/api` must have a matching method and full mounted
path in the live OpenAPI document. Update its parameters, authentication, body,
and responses whenever the endpoint changes. JSDoc does not register operations.

Run `pnpm lint:openapi` from the repository root. It builds cached API dependencies
and runs the coverage tests without credentials, a database, or a deployed API.
`pnpm lint`, the pre-commit hook, CI, and `pnpm validate:pr` include the same gate.
The check compares actual application registrations with `/api/v0/openapi.json`;
there is no manually maintained endpoint list or endpoint exemption list.

Use `createRoute`/`app.openapi` when automatic validation matches the handler's
contract. Use `openAPIRegistry.registerPath` when the handler must preserve raw
signed bodies, binary uploads, or existing custom validation. Documentation
metadata must not alter request processing.

Attach middleware to explicit method/path registrations. Duplicate registrations
for one operation are checked once, including middleware with a `next` parameter.
Opaque `ALL` entries (`.all()`, `.use()`, opaque mounts), optional/regex parameters,
and non-terminal wildcards fail with instructions to use representable routes;
they are never silently ignored. `.on()` and nested routers are inventoried with
their actual methods and mounted prefixes.

Hono implicitly serves HEAD through GET; that framework fallback needs no
separate operation. An explicitly registered HEAD or OPTIONS handler does.
Storage's unauthenticated OPTIONS catch-all preserves preflight for unknown
storage paths. Its OpenAPI `/storage/{path}` operation describes a greedy tail
and records the exact mounted wildcard in `x-hono-path`. Terminal catch-alls must
use that extension; it is checked against the registered pattern.
The default 404 fallback retains storage CORS headers and logger flushing for
unknown paths and unsupported methods; it does not expose an additional endpoint.

Generated Markdown API documentation is not used or required. The live JSON and
Scalar reference remain at `/api/v0/openapi.json` and `/api/v0/docs`.
