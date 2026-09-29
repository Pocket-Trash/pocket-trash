# Complete erasure: scope, disposition, and retention

Status: **approved**

Owner and operational approver: **Roy Anger**

Scope version: **ENG-201 / 2026-09-29**

Applies worldwide: **one workflow; no region-specific deletion paths**

This document is the release gate for complete erasure. ENG-198 and every
downstream erasure ticket must implement this matrix exactly. A request is not
complete until all active-system checks pass. A bounded provider copy may remain
only where this document names its expiry and access restrictions.

Approval records acceptance of the shared-catalog dispositions, bounded
retention exceptions, and restore procedure below. It is not legal advice.

## Definitions

- **Delete** removes the record or object and every dependent copy controlled by
  Pocket Trash.
- **Anonymize** removes every stable account identifier and keeps only the
  approved shared content. Use `NULL`; do not replace identifiers with another
  stable user token.
- **Preserve** is allowed only for shared catalog/taxonomy data and anonymous
  aggregate counts. Preserved data must not identify or single out the erased
  account.
- **Active-system complete** means the production database, every live or
  promotable copy, storage origin, caches, and identity provider pass their
  negative checks.
- **Bounded retained copy** is inaccessible to normal application and support
  access, expires automatically at a fixed deadline or observable provider
  lifecycle event, and is represented on the erasure receipt until expiry.

For every row below, Roy is the policy approver. The erasure service is the
deletion owner unless the row names a provider lifecycle or a manual privacy
operator. `Private` means visible only to the subject or operators; `shared`
means catalog or operational data visible to other users; `restricted` means
provider or privacy-operator access only. A row with no exception retains no
fields and has no restore path.

## Data disposition matrix

`:user_id`, `:clerk_id`, and target ID/path sets are transient values captured
at the start of a request. Only the subject HMAC may remain on the receipt.

| Location and linkage | Sensitivity / ownership | Disposition | Mechanism and required negative check | Exception, access, and expiry |
| --- | --- | --- | --- | --- |
| `users` (`id`, `clerk_id`, `username`, Clerk sync time) | Private direct identity; user-owned | Delete last among database rows | Delete by `id` after dependants; verify no row by `id` or `clerk_id` | None |
| `user_settings`; `feature_flag_user_overrides` by `user_id` | Private preferences and account targeting; user-owned | Delete | FK cascade plus explicit zero-count check by the captured `user_id` | None |
| `user_collection`, `collection_item`, `finish_option` and its color/finish joins, `collection_spinner`, `collection_spinner_button` | Private or public collection content, purchase/sale history, and customizations; user-owned | Delete | Delete owned collections/items; cascades remove dependent rows; verify captured collection/item IDs are absent | None |
| Other users' `collection_item.purchased_from_user_id` / `sold_to_user_id` and matching free-text names | Private counterparty identity in another user's record | Anonymize | Set both matching FK and corresponding free-text field to `NULL`; verify neither FK equals `:user_id` and no captured identifying value remains | None |
| `collection_image`, `collection_item_image` whose parent collection/item is owned by the subject, and their Bunny objects | Private or public user-owned uploads | Delete | Snapshot paths before DB deletion, delete origin objects, purge exact CDN URLs, then delete rows; verify DB zero and origin/CDN unavailable | Bunny bounds below |
| `resources` where `uploader_clerk_id = :clerk_id`, including soft-deleted rows; child `resource_images`, `resource_versions`, `resource_files`, category joins, downloads, and notifications | Shared user-uploaded content and activity | Delete | Snapshot all child IDs/paths, delete every object, delete resource roots, and verify all snapshot IDs/paths are absent | Bunny bounds below |
| Surviving collections, items, collection/item images, products, product images, resources, and flags where only an uploader/moderation/deletion actor field matches | Shared or another user's content with restricted operator attribution | Preserve content/decision; anonymize actor | Preserve the recipient-owned image even when the subject uploaded it. Make actor/uploader columns nullable and relax all-or-none checks so `private_reason`/`privated_at` or `deleted_at`/`deleted_by_role` remain while the matching Clerk-ID field becomes `NULL`; verify no identifier match | None |
| Surviving `resource_notifications` linked by `uploader_clerk_id` or `read_by_clerk_id` | Restricted user-linked activity on shared data | Delete events created by the subject; clear `read_at` and `read_by_clerk_id` when only the reader matches | Explicit delete/update and direct identifier scan | None |
| `upload_session`, `upload_file`, reserved resource/version IDs, payloads, and staged objects | Private user-owned transient uploads; payload may contain personal text | Delete | Delete all sessions by `uploader_clerk_id`, delete every staged path, and verify session/file/path absence | None; do not wait for normal expiry |
| `storage_object_deletion` entries for captured paths | Internal deletion work queue | Process, then delete | A request cannot complete while any captured path remains queued; verify origin `404` before removing queue row | None |
| `product`, product finish/material/spinner data, and shared scraper/catalog rows | Public shared catalog data; community-owned after submission | Preserve content; anonymize `owner_clerk_id` and moderation attribution | Make every matching attribution column nullable, set it to `NULL`, and verify no identifier match | None. A narrow manual removal path may delete a product record or image only after an operator verifies a personal-information, copyright, or other rights claim |
| `product_image` and Bunny object | Public shared catalog media | Preserve object/content; anonymize uploader/deleter attribution | Make `uploaded_by_clerk_id` nullable, apply the moderation migration above, set matches to `NULL`, and verify the object still resolves | None |
| `resource_categories` and other shared taxonomies | Public shared taxonomy | Preserve; anonymize creator/moderator attribution | Make `created_by_clerk_id` nullable, set matching fields to `NULL`, and verify taxonomy still exists and identifiers do not | None |
| `feedback` submitted by the subject, its notifications, and votes on it | Private pending or public accepted user-authored request text and activity | Delete | Delete submissions by `submitter_clerk_id`; cascade dependent rows; verify submission IDs absent | None |
| `feedback_votes` by the subject; surviving notification `read_by_clerk_id` | Restricted user-linked activity on another user's feedback | Delete vote; clear read attribution and `read_at` | Direct delete/update and identifier scan | None |
| `feature_flags` and surviving overrides created, updated, or archived by the subject | Restricted shared operational configuration | Preserve configuration; anonymize attribution | Make non-null actor columns nullable, set matching fields to `NULL`, and verify no identifier match | None |
| `resource_downloads.user_clerk_id` for surviving resources | Restricted account-linked activity | Delete the subject's rows | Delete by `user_clerk_id`; verify no matching identifier remains | None |
| `resource_versions.anonymous_download_count` and other aggregate metrics | Anonymous aggregate with no account identifier | Preserve | Confirm the aggregate cannot identify or single out an account | None; adding an identifier changes this matrix first |
| `scraper_runs`, scraper queue jobs, temporary scraper tables, makers, materials, mechanisms, and product types | Shared catalog/operations data; no account link in current schema | Preserve | Schema and queued-payload scan must find no subject field | None |
| Clerk user, email/phone, external accounts, sessions, MFA, metadata, and profile image | Private identity-provider account data | Delete | Revoke sessions, delete the Clerk user last, and verify the Backend API returns not found/already absent | Clerk log bound below |
| Erasure request/receipt | Restricted privacy operations record | Preserve the minimum receipt temporarily | Store request ID, verification result, decision, timestamps, step results/error categories, subject HMAC, and exception expiries; never store raw ID, email, name, content, or object path after active deletion | Privacy-ops access only; delete 30 days after active-system completion and after every exception expires |
| Support/privacy request source message | May contain direct identity and free text | Delete or redact to the minimum receipt | Delete the source message/attachment after verification; verify by provider search and operator attestation | No general support-record exception is approved |
| Manual exports, local downloads, ad-hoc SQL/CSV files, and copied secrets containing account data | Unmanaged direct or derived account data | Delete | Named operator searches approved export locations, deletes matches, and attests completion on the receipt | None; an undiscovered or undeletable export blocks completion |

Any new table, queue, provider, log field, export path, storage namespace, or
user-level analytic event must update this matrix and its verification fixture
before shipping.

### Explicit inventory exclusions

These are exclusions only because the current implementation creates no durable
account-linked copy:

- There is no external search/index provider; search reads Postgres. A future
  index is an active copy and must be erased before completion.
- Bunny signed URLs are generated on render, are not stored separately, and
  expire after 120 seconds. Their object paths remain covered by origin deletion,
  CDN purge, and request-log expiry.
- Clerk webhook bodies are verified and processed in memory. Production events
  are not stored in Cloudflare KV; development KV contains only 24-hour relay
  target URLs. Payload logging is prohibited.
- No support, email, or incident-management system is configured by the app.
  The intake provider must be named on each request, and its source record is
  covered by the support/manual-artifact rows above.
- Railway Redis contains shared scraper jobs only. It is not a user cache.

The exact production Bunny namespaces are
`images/products/{id}/{sha256}.{ext}`,
`images/collections/{id}/{sha256}.{ext}`,
`images/collection-items/{id}/{sha256}.{ext}`,
`images/resources/{id}/{sha256}.{ext}`, and
`resources/files/{resourceId}/v{version}/{sha256}.{ext}`. Development and
preview prefixes are separate active copies if they were populated from
production and must be scanned by captured path, not assumed empty.

## Provider and infrastructure matrix

These values were checked against live configuration on 2026-09-29. A provider
configuration that is less strict than this table is a release blocker.

| Provider/location | Current finding | Required handling and verification | Approved bound |
| --- | --- | --- | --- |
| Neon production branch | Source of record | Run the database transaction, then execute the identifier and target-ID scans below | No retained active copy |
| Neon history | Project history window is 21,600 seconds | Treat point-in-time history as inaccessible recovery data; keep the receipt available for replay | 6 hours from deletion |
| Neon branches/snapshots | No scheduled snapshots. `preview`, `dev_branch_roy`, and `preview-pr-127` are production-derived; the first two have no expiry | Erase the subject from every production-derived branch or delete/recreate the branch, then verify it independently. Never promote an unchecked branch | No exception. The two non-expiring branches are current release blockers |
| Bunny Storage | One storage zone with Singapore, Los Angeles, and Stockholm replication | Delete every captured object; `DELETE` success/already-absent plus subsequent authorized origin `GET` returning not found is the customer-visible completion event. ENG-200 must obtain a contractual bound or provider confirmation for internal replicas | Active object: until the observable deletion event. Internal-replica expiry is unknown and is a current release blocker; do not claim physical deletion |
| Bunny CDN/Optimizer | Perma-Cache disabled; cache max-age override is 2,592,000 seconds | Purge each exact URL after origin deletion and verify an uncached request is unavailable. Do not claim provider-internal physical deletion timing | Inaccessible immediately after verified purge; automatic cache ceiling 30 days |
| Bunny request logs | Logging enabled, IP anonymization enabled, no permanent log storage/forwarding | Keep IP anonymization on; never put raw IDs in paths/query strings; provider expiry is automatic | 3 days |
| Axiom `production` dataset | `useRetentionPeriod=false`, `retentionDays=0`; current events include stable SHA-256 Clerk-ID hashes | Configure 30-day retention before release. Stop emitting any raw or hashed subject identifier once erasure starts; verify the dataset setting and let existing matching events expire | Restricted observability access; 30 days. Unlimited retention is a current release blocker |
| Cloudflare Worker logs/traces | Invocation logs and traces persist; URLs and metadata may be recorded | Never put identity/content/object paths in URLs, query strings, logs, or trace attributes; verify the request path is opaque | Provider plan retention, never more than 7 days |
| Cloudflare KV | Only the development webhook relay binding is configured; it stores relay targets, not end-user data | Preserve only while payloads remain account-free; a future production/user payload changes this matrix first | None in current scope; deletions may take 60 seconds to propagate |
| Vercel runtime logs | Hobby retention is 1 hour; no log drain is configured | Keep application payloads out of stdout/request URLs and verify no drain duplicates them | 1 hour |
| Vercel build logs/deployments | Build logs can outlive runtime logs; deployments are retained for rollback | Account data is prohibited from builds and generated artifacts. If an incident puts it there, delete the affected deployment before completing the request | No account-data exception |
| Railway scraper deploy/build logs | The deployed workload is the catalog scraper; Railway captures stdout/stderr | Keep account data out of scraper jobs and logs. If a future workload contains it, apply the workspace plan's log window and update this matrix | No current account data; maximum supported log window is 90 days |
| Railway `scraper-queue` Redis volume and backups | Persistent 5 GB volume; current queue is catalog-only | Verify queued payloads contain no account data. If account data is introduced, remove keys and every volume backup before completion | No current account data; no exception approved |
| Clerk application logs | Clerk events can include user-resource payloads; the live production plan/window is not yet recorded | Provider-only operational access; do not export. ENG-203 must record and verify a configured window no longer than 30 days | Maximum approved bound is 30 days. An unknown or longer Enterprise value is a current release blocker |
| Clerk CSV exports | Dashboard exports can contain full profiles and credential material | Search export history and approved download locations; delete files and record operator attestation | None |

### Processing regions and recovery copies

| Processor | Region / delivery | Recovery-copy behavior |
| --- | --- | --- |
| Neon | `aws-us-east-1` | 6-hour point-in-time history; no scheduled snapshots; production-derived branches are active copies, not backups |
| Bunny | Origin replicated to Singapore, Los Angeles, and Stockholm; CDN is global | No customer-visible backup schedule. The origin check covers only customer-visible access, not physical replica deletion. ENG-200 must document the provider's contractual replica lifecycle; CDN cache is covered by exact purge and TTL |
| Axiom | Dataset location is not exposed by the checked dataset API | Provider-managed replication only; no customer restore workflow is approved. Region/DPA confirmation is an ENG-203 release blocker |
| Cloudflare | Worker and CDN processing are global | Logs/traces are provider-managed and expire; KV is development-only and contains no user payload |
| Vercel | Global edge; no application region override is checked in | Deployments/build artifacts must contain no account data; no account-data recovery copy is approved |
| Railway | Production scraper and Redis run in `us-east4-eqdc4a` | Redis is catalog-only. The live volume backup schedule is not exposed by the checked CLI output; introducing account data is blocked until every backup is inventoried |
| Clerk | Provider-managed identity service; production residency/backup details are not exposed by the checked Platform API | ENG-203 must record the production residency, plan log window, and contractual backup-deletion behavior before release; unknown behavior is not an approved exception |

Provider references: [Neon history](https://neon.com/docs/postgres/backup-restore/history-window),
[Neon restore behavior](https://neon.com/docs/introduction/branch-restore),
[Bunny cache purge](https://bunny.net/docs/cdn/purge-cache.md),
[Bunny logging](https://bunny.net/docs/cdn/logging/index.md),
[Axiom retention](https://axiom.co/docs/reference/datasets),
[Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/),
[Vercel runtime logs](https://vercel.com/docs/logs/runtime),
[Vercel deployment retention](https://vercel.com/docs/deployment-retention),
[Railway logs](https://docs.railway.com/observability/logs),
[Railway volume backups](https://docs.railway.com/volumes/backups), and
[Clerk logs](https://clerk.com/docs/guides/dashboard/logs/overview).

### Retention exception register

Only these exceptions are approved. Roy is the approver for every row.
Provider administrators and the automated erasure worker are the only permitted
readers unless a row narrows access further.

| Copy | Purpose and minimum retained fields | Deletion owner / expiry mechanism | Restore behavior |
| --- | --- | --- | --- |
| Erasure receipt | Prove verification and safely replay deletion: request ID, verification/decision, timestamps, step status/error category, subject HMAC, and exception expiries only | Privacy operator; automated hard delete 30 days after active-system completion and after all other exceptions expire | Replayed after restore; never restores user data |
| Neon history | Disaster recovery; encrypted full database pages are provider-managed and cannot be field-minimized | Neon lifecycle; 6 hours after each changed page leaves the active branch | Must follow the reconciliation gate below before traffic |
| Bunny CDN/Optimizer cache | Deliver uploaded bytes; cached response body, object path, delivery parameters, and expiry | Erasure service performs exact purge; provider eviction no later than the configured 30-day TTL | Never restored; origin absence and a failed CDN fetch are required |
| Bunny request logs | Abuse/debugging; timestamp, anonymized IP, path, status, user agent, and referrer | Bunny lifecycle; 3 days | Never restored or replayed |
| Axiom events already emitted | Reliability/security; event time, severity, message, request metadata, and legacy subject hash | Platform owner configures dataset lifecycle; Axiom deletes at 30 days | Never restored. Queries are read-only and restricted to operators |
| Cloudflare logs/traces | Reliability/security; provider request and invocation metadata with opaque routes only | Cloudflare lifecycle; plan value, capped at 7 days | Never restored |
| Vercel runtime logs | Reliability/security; request/runtime metadata with opaque routes only | Vercel lifecycle; 1 hour on the current Hobby plan | Never restored |
| Clerk application logs | Identity security/audit; provider event metadata and provider-controlled user payload | Clerk lifecycle; production setting must be verified at no more than 30 days | Never restored into Pocket Trash; do not export |

Neon branches, snapshots, Bunny origin objects, Vercel build artifacts,
Railway volumes/backups, support records, incident artifacts, exports, and local
downloads are deliberately absent: they are active copies or prohibited copies,
not retention exceptions.

## Requester-visible policy and deadline

- Use one worldwide workflow. The internal completion deadline is 30 calendar
  days after identity verification, or sooner where law requires it; no region
  gets a less complete erasure.
- Once confirmed, a request cannot be cancelled and the account is read-only
  except for a status view.
- The status view exposes state and non-identifying error categories only. It
  never exposes internal object paths, provider responses, or receipt secrets.
- Completion revokes all sessions, deletes Clerk last, signs the requester out,
  and redirects to a public completion screen.
- Do not email a completion notice and do not issue an anonymous status token.
  The authenticated status view is available only until Clerk deletion; the
  public completion screen contains no per-request state.

## Policy alignment gate

No Privacy Policy or Terms draft exists in this repository as of 2026-09-29,
so agreement cannot yet be demonstrated. The legal-page work must adopt this
same worldwide scope, 30-day operational deadline, shared-catalog
anonymization, exception register, no-cancellation rule, and requester result.
Any conflict must change and re-approve this matrix before either the legal
pages or erasure feature ships. Missing drafts are a current release blocker.

## Database negative verification

ENG-199 must keep this check aligned with the schema and run it after the
transaction on production and every production-derived Neon branch. Every
count must be zero. Target-ID checks are also required because a cascade can
hide the original account link.

```sql
select 'users.clerk_id' as location, count(*) as remaining
from users where clerk_id = :clerk_id
union all select 'users.id', count(*) from users where id = :user_id
union all select 'user_settings.user_id', count(*) from user_settings where user_id = :user_id
union all select 'user_collection.owner_id', count(*) from user_collection where owner_id = :user_id
union all select 'collection_item.owner_id', count(*) from collection_item where owner_id = :user_id
union all select 'collection_item.purchased_from_user_id', count(*) from collection_item where purchased_from_user_id = :user_id
union all select 'collection_item.sold_to_user_id', count(*) from collection_item where sold_to_user_id = :user_id
union all select 'product.owner_clerk_id', count(*) from product where owner_clerk_id = :clerk_id
union all select 'product.privated_by_clerk_id', count(*) from product where privated_by_clerk_id = :clerk_id
union all select 'product_image.uploaded_by_clerk_id', count(*) from product_image where uploaded_by_clerk_id = :clerk_id
union all select 'product_image.deleted_by_clerk_id', count(*) from product_image where deleted_by_clerk_id = :clerk_id
union all select 'user_collection.privated_by_clerk_id', count(*) from user_collection where privated_by_clerk_id = :clerk_id
union all select 'collection_item.privated_by_clerk_id', count(*) from collection_item where privated_by_clerk_id = :clerk_id
union all select 'collection_image.uploaded_by_clerk_id', count(*) from collection_image where uploaded_by_clerk_id = :clerk_id
union all select 'collection_item_image.uploaded_by_clerk_id', count(*) from collection_item_image where uploaded_by_clerk_id = :clerk_id
union all select 'collection_item_image.deleted_by_clerk_id', count(*) from collection_item_image where deleted_by_clerk_id = :clerk_id
union all select 'resources.uploader_clerk_id', count(*) from resources where uploader_clerk_id = :clerk_id
union all select 'resources.privated_by_clerk_id', count(*) from resources where privated_by_clerk_id = :clerk_id
union all select 'resources.deleted_by_clerk_id', count(*) from resources where deleted_by_clerk_id = :clerk_id
union all select 'resource_categories.created_by_clerk_id', count(*) from resource_categories where created_by_clerk_id = :clerk_id
union all select 'resource_notifications.uploader_clerk_id', count(*) from resource_notifications where uploader_clerk_id = :clerk_id
union all select 'resource_notifications.read_by_clerk_id', count(*) from resource_notifications where read_by_clerk_id = :clerk_id
union all select 'resource_downloads.user_clerk_id', count(*) from resource_downloads where user_clerk_id = :clerk_id
union all select 'upload_session.uploader_clerk_id', count(*) from upload_session where uploader_clerk_id = :clerk_id
union all select 'feedback.submitter_clerk_id', count(*) from feedback where submitter_clerk_id = :clerk_id
union all select 'feedback_votes.voter_clerk_id', count(*) from feedback_votes where voter_clerk_id = :clerk_id
union all select 'feedback_notifications.read_by_clerk_id', count(*) from feedback_notifications where read_by_clerk_id = :clerk_id
union all select 'feature_flags.archived_by_clerk_id', count(*) from feature_flags where archived_by_clerk_id = :clerk_id
union all select 'feature_flags.created_by_clerk_id', count(*) from feature_flags where created_by_clerk_id = :clerk_id
union all select 'feature_flags.updated_by_clerk_id', count(*) from feature_flags where updated_by_clerk_id = :clerk_id
union all select 'feature_flag_user_overrides.user_id', count(*) from feature_flag_user_overrides where user_id = :user_id
union all select 'feature_flag_user_overrides.created_by_clerk_id', count(*) from feature_flag_user_overrides where created_by_clerk_id = :clerk_id
union all select 'feature_flag_user_overrides.updated_by_clerk_id', count(*) from feature_flag_user_overrides where updated_by_clerk_id = :clerk_id;
```

The workflow must additionally assert zero rows for every captured collection,
item, image, resource, version, file, upload-session, upload-file, and deletion-
queue target. It must scan all text/JSON columns introduced after this document
for raw identifiers before a schema change can pass ENG-204.

## Restore and branch reconciliation

No production-derived branch, backup, or restored database may receive traffic
until this sequence succeeds:

1. Keep traffic blocked and preserve the pre-restore branch Neon creates.
2. Replay every unexpired erasure receipt against the restored database,
   storage, caches, and Clerk. Receipts match rows through the subject HMAC;
   raw identity is not restored into the receipt.
3. Compare restored `users.clerk_id` values with Clerk. A database user missing
   from Clerk is quarantined for manual privacy-operator review; never erase it
   automatically from a provider mismatch alone.
4. Resolve every mismatch and run the complete database, object, cache, branch,
   and provider negative checks.
5. Record approval on the restore operation, then reopen traffic.

Permanent development/preview branches copied from production must be scrubbed
on every completed request or replaced from an already-scrubbed source. An old
branch is never an acceptable restore source merely because it is convenient.

## Approval

Approval accepts this document as the implementation baseline. Every current
release blocker above must still be resolved before the erasure feature ships.

- Decision: **approved**
- Approved by: **Roy Anger**
- Approved at: **2026-09-29**
- Notes: **Approved in the implementation thread; blockers are not waived**
