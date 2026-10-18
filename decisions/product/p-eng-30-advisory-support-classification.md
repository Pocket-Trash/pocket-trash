# Advisory classification for Discord support

Status: accepted by the owner on 18 October 2026.

## Decision

Use Cheaper Inference `jev-1.13` through `/v1/decisions` with `zdr: true`
for advisory classification of support requests. Keep `gpt-6-luna` for ticket
titles and structured summaries; Jev does not replace that model.

Jev may suggest:

- Request type: bug, feature, question, or other.
- Whether the supplied text contains enough detail for an actionable ticket.
- Bug priority: none, low, normal, high, or urgent.

Both ticket buttons remain visible and usable regardless of the suggestion.
Only authorized staff can create a ticket, select its type, and choose its
priority. Features retain no priority. Readiness is a hint, never a prerequisite
for staff action. Suggestions must not change a staff selection after a modal
opens or replace values submitted by staff.

## Runtime requirements

Implement the advisory integration with the forum controls in ENG-506, after
the recoverable persistence work in ENG-505. This decision and the evaluation
PR do not themselves implement or activate runtime classification.

Use bounded human-authored thread text only. Treat it as untrusted data. Do not
send attachment binaries, signed download URLs, or private staff notes for this
classification path. Image/PDF classification and summary-grounding checks are
not adopted by this decision.

Do not wait for inference before acknowledging Discord interactions. Precompute
suggestions asynchronously; a cached priority may prefill a bug modal before it
opens, otherwise keep the normal no-priority default. Cache by transcript
revision to avoid duplicate calls; never mass-classify history on startup.

An unavailable model, timeout, malformed answer, refusal, or missing ZDR
confirmation produces no suggestion and must not block manual ticket creation.
Validate typed answers and their probability distributions. Require settled ZDR
receipts, and use the ZDR catalog scope when checking availability or pricing.
Never retry with non-ZDR routing or another provider. Do not present uncalibrated
confidence as a guaranteed accuracy or use it to authorize automatic actions.

Reuse the reviewed provider boundary and erasure safeguards. Owner approval of
Jev does not authorize secret/settings changes or production deployment.
Routine development tests use mocks; additional paid evaluation is not needed.

## Evidence

The [ENG-504 evaluation](https://linear.app/pocket-trash/document/eng-504-synthetic-ticket-model-evaluation-2026-10-18-d23c16d6d776)
records the synthetic corpus, fixed rubric, latency, billing, routing checks, and
limitations. It supports advisory use, not a production accuracy guarantee.
