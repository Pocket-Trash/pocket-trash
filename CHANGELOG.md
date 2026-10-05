# pocket-trash.app


























## 0.6.0

### Minor Changes

* Record transactional audit events for collection, item, cover, and image mutations, including required reasons for staff actions on another owner's collection. (@app/api, @app/web, @package/services)
* Record transactional audit events for product, product-image, catalog lookup, and maker URL-validity mutations, including required reasons for cross-owner staff actions. (@app/web, @package/services)
* Delete Clerk accounts last, resume erasure from deletion webhooks, and report provider orphans without exposing user identifiers. (@app/api, @app/web, @package/logger, @package/services)
* Add collection image galleries, batch uploads, cover management, and automatic cover replacement. (@app/web, @package/services)
* Add authenticated feedback submission, personal request tracking, and admin moderation. (@app/web, @package/database, @package/logger, @package/services)
* Connect admin Linear accounts and plan approved feedback as retry-safe issues or projects. (@app/web, @package/logger, @package/services)
* Add the durable complete-erasure request service and account guard. (@app/api, @app/web, @package/database, @package/logger, @package/services)
* Add grouped admin navigation, notification hubs, and feedback administration. (@app/web, @package/logger, @package/services)
* Add the permission-gated, filtered, keyset-paginated admin audit log. (@app/web, @package/services)
* Add atomic collection archive, move-and-delete, and permanent deletion choices with authorization and storage cleanup. (@app/web, @package/logger, @package/services)
* Add permission-gated user ban management with resumable Clerk reconciliation. (@app/web, @package/database, @package/services)
* Add verified self-service and admin account-erasure actions and status pages. (@app/web, @package/database, @package/services)
* Erase account-owned upload objects from Bunny Storage and its CDN with durable exact-key retries. (@app/api, @package/database, @package/services, @package/storage)
* Add product source details and collection item description and bearing overrides. (@app/web, @package/database, @package/logger, @package/services)
* Publish the English Terms of Service at the public route. (@app/web)
* Add bounded audit-log exports. (@package/database, @package/services, @app/web)
* Add global route error recovery with safe diagnostics. (@app/web, @package/logger)
* Publish the English Privacy Policy at the public privacy route. (@app/web)
* Add protected deletion for completed audit-log exports. (@package/database, @package/services, @app/web)
* Add feedback request, active, and archive administration. (@app/web, @package/database, @package/logger, @package/services)
* Erase account-linked database records while preserving shared data without attribution. (@package/database, @package/services)
* Add the reusable visual and Source Markdown editor and shared code-block downgrade helper. (@app/web, @package/markdown)
* Support AVIF image uploads across catalog and resource workflows. (@app/api, @app/scraper, @app/web, @package/services, @package/storage)
* Add code-owned staff roles and exact capability checks across API, web, and service authorization. (@app/api, @app/web, @package/services)
* Add the append-only audit event schema, shared audit writer, and account-erasure redaction support. (@package/database, @package/logger, @package/services)
* Synchronize feedback lifecycle states with Linear. (@app/api, @app/web, @package/database, @package/logger, @package/services)
* Unify uploads and safe cleanup through shared storage sessions, preserve originals up to 25 MiB, and optimize image delivery with Bunny Dynamic Images.
  Require an explicit valid scraper image folder prefix at startup and remove the production namespace fallback.
  Log storage mutations and cleanup retries, queue physical deletion after database commit, and consolidate storage configuration and app import boundaries.
  Use localizations v0.9.0 for upload size labels and shared upload errors, and correct resource image help to 25 MiB.
  Include storage target and file types, file and cleanup counts, and hashed file identifiers in operation logs. (@app/api, @app/web, @app/scraper, @package/database, @package/services, @package/storage, @package/logger, @package/eslint)
* Forward Linear webhooks to preview and local environments. (@app/api)
* Add feedback discovery, voting, duplicate suggestions, and complete request history. (@app/web, @package/logger, @package/services)

### Patch Changes

* Audit feedback and feature-flag administration. (@app/web, @package/services)
* Add a localized site-wide footer and public contact, privacy, and terms placeholders. (@app/web)
* Download complete resource versions and count downloads per version. (@app/web, @package/database, @package/storage, @package/services)
* Centralize Biome formatting and ESLint rules in the shared lint package. (@app/web)
* Remove legacy Pocket Trash skill version checks and install the current skills on demand. (@app/web)
* Document database tooling, seed data, runtime contracts, and migration-test fixtures. (@package/database)
* Prevent collection buttons from being installed on multiple spinners. (@package/database, @package/services)
* Deploy and validate the secrets required for complete account erasure. (@app/api)
* Run database migrations through direct Neon connections while keeping deployed application traffic pooled. (@package/database)
* Load the approved v1.1 Privacy Policy and Terms of Service (@app/web)
* Cover spinner-only form fields and fix API preview deployments. (@app/api, @app/web)
* Enforce complete JSDoc on changed declarations. (@package/eslint)
* Audit resource mutations with staff reasons and erasure-safe state snapshots. (@package/services, @app/web)
* Document scraper database and queue contracts. (@app/scraper)
* Document Autmog and Grimsmo source integration contracts. (@app/scraper)
* Classify new resource categories without PostgreSQL system columns. (@package/services)
* Block account-linked writes after complete erasure begins and verify every retryable workflow step converges. (@package/database, @package/services)
* Ignore the local `.linear.toml` linear-cli config. (pocket-trash.app)
* Keep Neon preview databases isolated from production user data and avoid printing masked secrets outside GitHub Actions. (@app/api)
* Add guarded Playwright E2E foundations and isolated PR preview fixtures. (@package/infisical-runner, @app/web)
* Document scraper shell, scheduling, Shopify, and utility contracts. (@app/scraper)
* Reject non-positive spinner measurements in PostgreSQL. (@package/database)
* Document GitHub Discord notifier contracts. (@package/github-discord-notifier)
* Prevent concurrent active scraper runs per source and job type. (@package/database, @app/scraper)
* Update Pocket Trash skills to v0.4.0. (@app/web)
* Audit account-erasure requests and terminal transitions. (@app/web, @package/services)
* Document the owner collection-item index evaluation. (@package/database)
* Record the verified non-production lineage of every Neon development and preview branch. (@app/api)
* Record verified provider deletion guarantees in erasure receipts and operational guidance. (@app/api)
* Inject personal database secrets when running database seeds. (@package/infisical-runner)
* Refresh the shared preview database after schema-changing development deployments. (@app/api)
* Render user Markdown through a restricted safe subset and enable sanitized Markdown code highlighting only for trusted help content. (@app/web, @package/markdown)
* Document service foundation contracts. (@package/services)
* Enforce valid verification provenance for account erasure requests. (@package/database)
* Document feature-flag contracts. (@package/feature-flags)
* Prevent case-only duplicate catalog names. (@package/database, @package/services)
* Reject unknown feedback values in PostgreSQL. (@package/database)
* Document database schema tables, relations, enums, and normalized scraper contracts. (@package/database)
* Document Infisical runner contracts. (@package/infisical-runner)
* Keep pull request release labels synchronized with their Changesets. (@package/eslint)
* Updated agent skills (@app/web)
* Document storage contracts. (@package/storage)
* Document logger contracts and live-test behavior. (@package/logger)
* Apply design-system typography to catalog detail descriptions. (@app/web)
* Uploaded static image URLs (@app/web)
* Seed shared non-production databases after migrations. (@package/database, @app/api)
* Document the shared erasure HMAC secret configuration for web and API environments. (@app/api, @app/web)
* Document Markdown conversion contracts. (@package/markdown)

## 0.5.1

### Patch Changes

* Serve responsive navigation covers and site favicons directly from Bunny CDN. (@app/web)
* Load help documents from the shared localization package.
  Only flag preview database changes introduced by the PR in schema, migration,
  or Drizzle configuration files. (@app/web)

## 0.5.0

### Minor Changes

* Add product catalogs, composable finishes, image galleries, filtering, and multiple collections. (@app/web, @app/api, @app/scraper, @package/database, @package/infisical-runner, @package/logger, @package/resources, @package/services)

## 0.4.2

### Patch Changes

* Wait for production deployment and GitHub release before the release command completes. (@app/api, @app/scraper, @app/web)

## 0.4.1

### Patch Changes

* Set Railway production metadata in one request. (@app/scraper)
* Remove stale Expo dependencies from the workspace. (@app/api, @app/scraper, @app/web, @package/database, @package/services)

## 0.4.0

### Minor Changes

* Add an Advent of Code-inspired theme and composable account panels. (@app/web)

### Patch Changes

* Prevent successful Railway releases from failing during deployment verification. (@app/scraper)

## 0.3.1

### Patch Changes

* Validate deploy artifacts before release and publish releases after production succeeds. (@app/api, @app/scraper, @app/web)
* Fix repo lint warnings. (@app/scraper, @app/web, @package/infisical-runner)

## 0.3.0

### Minor Changes

- **pocket-trash.app**: Move web UI text to shared localizations.
- **@pocket-trash/repo**: Allow administrators to permanently delete soft-deleted resources and their stored files.
- **@pocket-trash/repo**: Add the resource directory, management workflows, and streamed uploads.
- **@pocket-trash/repo**: Add resource galleries, organized Bunny storage, and reversible deletion.
- **@pocket-trash/repo**: Add secure multi-file resource uploads, management, and delivery.
- **@pocket-trash/repo**: Sync Clerk usernames for resource attribution.

### Patch Changes

- **@package/services**: Preserve concurrent partial user settings updates.
- **@app/web**: Installed pocket-trash skills v0.1.1
- **@app/scraper**: Filter unchanged scraper items before queueing and run source scrapes hourly.
- **@pocket-trash/repo**: Fix Railway release deployment verification.
- **@pocket-trash/repo**: Add `@pocket-trash/repo` as a repo-level Changesets option and include selected packages in changelog entries.
- **pocket-trash.app**: Add Storybook component stories, coverage support, and a dedicated CI check.
- **pocket-trash.app**: Update Pocket Trash skills to v0.1.2.
- **pocket-trash.app**: Update Pocket Trash skills to v0.2.0.
- **pocket-trash.app**: Update Pocket Trash skills to v0.3.1.
- **@pocket-trash/repo**: Move repo agent skills to the shared skills repo.
- **@pocket-trash/repo**: Use the shared Pocket Trash skill router.
- **@pocket-trash/repo**: Pin shared Pocket Trash skills by version, scope installed skills, and add install/update checks.
- **@pocket-trash/repo**: Added i-have-adhd and ponytail skills

## 0.2.8

### Patch Changes

- Remove temporary branch release testing hooks.

## 0.2.7

### Patch Changes

- Force Vercel Nitro output for release builds.

## 0.2.6

### Patch Changes

- Continue Vercel release output fixes.

## 0.2.5

### Patch Changes

- Fix Vercel release output handling.

## 0.2.4

### Patch Changes

- Fix Vercel release build output.

## 0.2.3

### Patch Changes

- Move repo agent skills to the shared skills repo.

## 0.2.2

### Patch Changes

- Removed mutation output directory in release workflow

## 0.2.1

### Patch Changes

- Use Vercel org IDs in release automation.

## 0.2.0

### Minor Changes

- Sync user settings across web, mobile, and the API.
- Remove the mobile and API runtimes from the repository.
- Rename repo-owned references to Pocket Trash.

### Patch Changes

- Add typecheck to pull request CI.
- Send CI database logs to Axiom.
- ENG-69: add expiring Neon preview branches and document preview cleanup.
  ENG-70: record Neon compute cap targets, restart risk, monitoring, and rollback.
  ENG-71: skip unchanged scraper maker, Grimsmo product, variation, and image writes.
  ENG-72: skip empty queue processor run rows and prune scraper run history.
- Point GitHub notification secrets at the shared GitHub Actions Infisical path.

## 0.1.7

### Patch Changes

- Added GitHub Token to mobile release workflow


## 0.1.6

### Patch Changes

- Fix Vercel release workflow


## 0.1.5

### Patch Changes

- Fix Vercel release builds from the web app root.


## 0.1.4

### Patch Changes

- Fix Vercel production build output detection.


## 0.1.3

### Patch Changes

- Fix Vercel production build output detection.


## 0.1.2

### Patch Changes

- Harden production API health checks.


## 0.1.1

### Patch Changes

- Fix scraper Axiom environment labels.
- Fix release validation for clean GitHub runners.


## 0.1.0

### Minor Changes

- Replace ImageKit with Bunny image storage.
- Limit non-production scraper runs and include all sources.
- Add feature flag management and beta opt-ins.
- Improve logger field metadata.
- Add Clerk authentication to the mobile app.
- Add OpenAPI documentation routes.
- - Add a scheduled Autmog scraper service with producer, queue processor, and dead-letter processing commands.
  - Persist scraper runs, item snapshots, and image processing state through the shared database package.
  - Upload, update, and delete scraper images through shared services-backed ImageKit storage.
  - Add `@package/images` as the shared ImageKit integration package using `@imagekit/nodejs`.
  - Expose image operations from `@package/services` with centralized logger instrumentation.
  - Add `@package/markdown` for shared Markdown conversion of scraped descriptions.
  - Normalize scraped materials, mechanisms, and product types into relational tables.
  - Replace obsolete Autmog scraper columns with canonical maker and product metadata relationships.
  - Add Grimsmo Saga, Rask, Fjell, and Norseman scraping with product variation records.
  - Store scraper images through shared product and optional variation image ownership.
  - Bound Shopify fetch waits and fail interrupted scraper runs so local retries do not stay locked.
  - Add Railway, environment variable, and database documentation for the scraper workflow.

### Patch Changes

- Add a Bunny services audit script.
- Add regenerable infrastructure diagrams.
- Convert the mobile app to shared NativeWind styling.
- Update PR template AI sections.
- Align non-production environments around preview.
- Add Railway scraper production deploys to the release flow.
- Remove legacy Field Log Expo and Autmog static app workspaces.
- Add a pull request template for generated and human-authored sections.


## 0.0.1

### Minor Changes

- Add release automation and API versioning.
