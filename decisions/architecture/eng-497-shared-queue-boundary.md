# Establish a transport-independent queue boundary

Status: Accepted

Sources:

- [Create @package/queue and migrate the scraper](https://linear.app/pocket-trash/issue/ENG-497/create-packagequeue-and-migrate-the-scraper)
- [Pocket Trash Discord bot: plan](https://linear.app/pocket-trash/document/pocket-trash-discord-bot-plan-139a2e56ccf6)

## Decision

Applications define typed queues through `@package/queue`. A definition owns the
payload schema, worker mode, retry and retention settings, and completed-job
deduplication policy. Applications enqueue stable identifiers and receive a
transport-independent accepted/already-exists result.

The package owns BullMQ and ioredis in production. Application code receives
portable jobs, counts, processing results, lifecycle events, and close handles;
it does not receive transport objects or option bags. A deterministic in-memory
adapter implements the same contract for tests, while a shared contract suite
runs against both adapters and a real Redis process.

Payloads are validated before persistence and again before delivery. Queue
handlers remain idempotent because delivery is at least once. Physical scraper
queue names and retained jobs stay compatible during migration.

## Consequences

- Scraper and bot code can share queue policy and lifecycle behavior without
  importing BullMQ.
- Transport-specific maintenance stays inside the production adapter.
- Adding another transport requires passing the same public adapter contract.
- Redis resource naming and persistence configuration remain separate platform
  decisions.
