# Logging

- Use `@package/logger`; reuse `loggerMessages`/`loggerValues`, broadening existing constants before adding new ones. Keep event names stable; put dynamic values and operation metadata in structured `attributes`, errors in the logger data object. Use `logger.operation` for timed service work.
- Services use the configured app-local service logger (usually `s.logger`); browsers use `@/lib/logger`. Keep database code storage-only: log database behavior from services. No `console.*` in web, services or database source; [ESLint](../../packages/lint/eslint/index.mjs) enforces this.
- Never log raw Clerk/user IDs, credentials, tokens, cookies, database URLs or authorization data; use existing hashed-identifier helpers. Preserve recursive redaction and server validation/redaction of browser events. Raw payloads need explicit opt-in; prefer summarizers.
- Generate `eventId` once and preserve it across proxies/transports/queues. Keep app/environment/deployment metadata accurate.
- Follow [logger operations](../logger.md) for transport, notification, Axiom and environment configuration.
