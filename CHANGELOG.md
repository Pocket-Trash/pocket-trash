# pocket-trash.app





























## 0.8.0

### Minor Changes

* Add alloy and grade pages with scoped material discovery and public images. (@app/web, @package/services)
* Add material alloys and grades, durable product assignments, retained collection selections, and scoped image administration. (@app/web, @package/database, @package/services, @package/storage, @package/logger)
* Upgrade to Drizzle RC4 with timestamp-folder migrations and a fresh baseline requiring all existing databases to be rebuilt. (@package/database, @package/services, @app/api, @app/web, @app/scraper)

### Patch Changes

* Document the refill compatibility evidence and exception model. (@package/database)
* Document refill-offering provenance and market lifecycle representation. (@package/database)
* Rename catalog and collection subtype tables with rollout compatibility views. (@package/database, @package/services)
* Document reusable catalog terminology and product alias behavior for the Pens schema. (@package/database)
* Document the canonical Pens and refill domain baseline. (@package/database)
* Fix intermittent theme persistence E2E failures. (@app/web)
* Run development and CI on Node 24 and Ubuntu 26.04. (@app/api, @app/scraper, @app/web)
* Document Monteverde PP43 membership in the Parker G2 compatibility group. (@package/database)
* Remove the retired catalog and collection subtype compatibility views. (@package/database)
* Migrate scraper deployment settings to Railway Infrastructure as Code. (@app/scraper)
* Preserve full SSL verification for Neon database URLs (@package/infisical-runner)
* Document the authoritative Autmog source inventory and the missing preserved Saga dataset gate. (@package/database)
* Enforce complete OpenAPI coverage for API endpoints.
  Fix theme persistence test timing and cover disabled theme controls. (@app/api, @app/web)
* Stabilize Markdown table keyboard interaction tests. (@app/web)
* Document the decision to group all Floatune refills with EnerGel. (@package/database)
* Allow baseline migration tests more setup time. (@package/database)
* update skills to 0.5.4 (@package/database)

## 0.7.1

### Patch Changes

* Fix Railway uploads missing required install and build inputs. (@app/scraper)

## 0.7.0

### Minor Changes

* Model sliders with direct included inserts and remove unreleased insert offer metadata. (@package/database, @package/services, @app/web)
* Add maker terminology aliases and shared catalog search. (@package/database, @package/services, @app/web, @package/logger)
* Audit user ban decisions and retry failed post-provider audit delivery. (@app/api, @app/web, @package/database, @package/services)
* Add installed plate and insert management for owned slider assemblies. (@app/web, @package/database, @package/services)
* Add pattern, compatibility family, exact plate, and spinner-button filters across the catalog and collections. (@package/services, @app/web)
* Store catalog measurements with their original metric or imperial units and display converted values from one measurement-system preference. (@app/web, @package/database, @package/services)
* Add persistent collapsible sidebars and place user collection filters above their card grids. (@app/web)
* Add permanent deletion for owned collection items. (@app/web, @package/services, @package/logger)
* Add the public makers directory with popularity, catalog counts, and alphabetical navigation. (@app/web, @package/services)
* Add administered maker images with shared upload, archive, audit, and erasure lifecycles. (@app/web, @package/database, @package/services, @package/storage)
* Seed deterministic slider, plate, and insert fixtures in development and preview databases. (@package/database)
* Add slider, plate, and insert catalog support. (@package/database, @package/services, @app/web, @package/logger)
* Split catalog, collection, and collection-item forms into responsive columns on large screens and keep long media names inside their columns. (@app/web)
* Add public maker detail pages, URL-backed related catalog pagination, and internal maker links. (@app/web, @package/services)
* Add stable maker profiles and administration. (@app/scraper, @app/web, @package/database, @package/logger, @package/services)
* Model slider inserts as fixed layouts and add reusable magnet configuration snapshots and presets. (@package/database, @package/services, @app/web, @package/logger)
* Enforce inherited privacy for installed slider and spinner components, preserve saved preferences, and redact unavailable assembly details. (@package/services, @app/web)
* Add exact body-hosted slider magnet setups. (@package/database, @package/services, @app/web)
* Add staff collection-item approval, rejection, and reversal with required decision reasons. (@app/web, @package/database, @package/services)
* Audit product and collection-item approval decisions atomically. (@package/services)
* Add confirmed collection and item deletion with complete transactional audit history. (@package/services, @app/web)
* Show Clerk profile pictures on public collections and owner attributions. (@app/web, @app/api, @package/services, @package/database)
* Add public material directory and detail pages. (@package/services, @app/web)
* Add durable catalog manifest import safety, application history, and ownership tracking. (@package/database, @package/services)
* Make catalog appearances optional and add reusable patterns. (@package/database, @package/services, @package/logger, @app/web)
* Standardize responsive content widths and add shared user sidebars. (@app/web)
* Add durable owned insert setups and host-safe slider setup resolution. (@app/web, @package/database, @package/services)
* Add collection summaries and expand Markdown descriptions to 5,000 characters. (@package/database, @package/services, @app/web)
* Add material content, images, and product-administrator management. (@app/web, @package/database, @package/services, @package/storage, @package/logger)
* Add standalone owned sliders, plate sets, and insert sets with complete collection lifecycle support and live body-hosted setup details. (@package/database, @package/services, @app/web, @package/logger)
* Add the product approval workflow. (@app/web, @package/database, @package/services)
* Add exact insert-hosted slider configurations and advertised defaults (@package/database, @package/services, @app/web, @package/logger)
* Sort catalog products by meaningful recent updates. (@package/services, @package/database)
* Paginate product and collection cards responsively and optimize their images. (@app/web)
* Add confirmed product deletion with transactional audit and image cleanup, and preserve destructive button hover contrast. (@package/services, @app/web, @package/logger)

### Patch Changes

* Document web platform infrastructure contracts. (@app/web)
* Document collection and gallery component contracts. (@app/web)
* Document account, authorization, feature-flag, feedback, and user-settings contracts. (@app/web)
* Document catalog and product component contracts. (@app/web)
* Update source-map-js to the patched 1.2.2 release. (@app/api, @app/scraper, @app/web)
* Document resource service contracts. (@package/services)
* Document shared web component contracts. (@app/web)
* Make change classification explicit and report unknown paths. (@app/web)
* Block vulnerable and newly published packages before builds and deployments. (@package/services, @package/storage, @package/lint, @app/scraper, @app/api, @app/web)
* Document service audit contracts. (@package/services)
* Reuse immutable preview seed images without sharing deletion ownership. (@package/database, @package/services)
* Document web UI primitive contracts. (@app/web)
* Document resource component contracts. (@app/web)
* Repair databases that applied the slider migration stack before its merge-time rebase. (@package/database)
* Document resource and upload library contracts. (@app/web)
* Document web infrastructure library contracts. (@app/web)
* Restore production web deployments by running the repository lint command. (@app/web)
* Dispatch hourly scraper producers by UTC calendar slot and process the queue every five minutes. (@app/scraper, @package/logger)
* Restore builds blocked by the unpatched braces advisory. (@app/api, @app/scraper, @app/web)
* Document where agents store research and engineering decisions. (@app/web)
* Complete audit, Linear, and upload contract documentation. (@app/web)
* Cover public collection browsing and effective privacy with browser tests. (@app/web)
* Add CJK input composition coverage for the Markdown editor rollout. (@app/web)
* Remove the vulnerable Solana/Jayson dependency chain from the Clerk UI bundle. (@app/web)
* Gate preview E2E by changed files and support full isolated override runs. (@app/web)
* Replace redundant service, storage, and erasure docs with source-adjacent JSDoc and a focused Bunny operations runbook. (@package/services, @package/storage, @app/scraper, @app/api, @app/web)
* Recreate stale preview databases before deployment. (@package/database)
* Add expandable product selection with search and paginated image cards. (@app/web)
* Document web resource page contracts. (@app/web)
* Add secure Markdown link, table, and clipboard interactions. (@package/markdown, @app/web)
* Model slider clicks from physical magnet layouts. (@package/database, @package/services, @app/web)
* Keep long product names inside collection product selection buttons. (@app/web)
* Document catalog service contracts. (@package/services)
* Add the Markdown editor to catalog forms. (@app/web)
* Add conditional agent validation guidance and a root command for safe preview E2E tests. (@app/web)
* Validate repository migration chains in disposable PGlite and compare personal Neon history without writes. (@package/infisical-runner, @package/database)
* Reduce Railway documentation to deployment operations and keep scraper runtime contracts beside source. (@app/scraper)
* Promote included slider plates to an exact top-level product relationship. (@package/database, @package/services, @app/web)
* Enforce complete JSDoc across tracked source. (@package/lint, @app/web, @package/database)
* Add an interactive diagram generated from the checked-out Drizzle schema. (@package/database)
* Simplify and document the root developer command surface. (@package/logger, @package/infisical-runner, @app/scraper, @app/api, @app/web)
* Repair feedback lifecycle columns skipped by older migration histories. (@package/database)
* Launch the public localized product changelog. (@app/web)
* Document web catalog and archive page contracts. (@app/web)
* Keep design policy beside web source and stabilize deletion confirmation tests. (@app/web)
* Treat recorded slider weight as the complete assembled product. (@package/database, @package/services, @app/web)
* Add the Markdown editor to collection forms. (@app/web)
* Narrow manifest and tooling preview isolation and label required preview databases. (@app/api, @app/scraper, @app/web)
* Fix loading headings and switching Markdown back to the visual editor. (@app/web)
* Document API application contracts. (@app/api)
* Restrict isolated Neon preview branches to database-changing pull requests. (@app/web)
* Replace generated schema docs with focused inline JSDoc. (@package/database)
* Regenerate the web route tree with the pinned TanStack router. (@app/web)
* Add end-to-end coverage for collection selection, duplicate warnings, and linked-item moves. (@app/web)
* Trim database documentation to durable operations. (@package/database)
* Document catalog and pen library contracts. (@app/web)
* Make generated and read-only form fields visibly non-editable. (@app/web)
* Document web route contracts. (@app/web)
* Document web admin page contracts. (@app/web)
* Cover collection lifecycle and deletion choices with isolated browser tests, stabilize protected preview runs, remove empty preview storage folders, pin the patched TanStack Start release, and keep Storybook compatible with its router API. (@app/web, @app/api, @package/storage)
* Run metadata-only validation for PR edits and block unclassified paths. (@app/web)
* Let audit-log action and target columns fill the available table width. (@app/web)
* Patch command parsing and image processing dependencies with security fixes. (@app/api, @app/web, @package/storage)
* Publish the highlighted Markdown help guide. (@app/web)
* Keep the shared site header visible on route error pages. (@app/web)
* Move environment contracts to source documentation. (@app/api, @app/web)
* Reduce logger documentation to an operational runbook. (@package/logger)
* Add committed pull-request validation orchestration. (@app/web)
* Retry transient Bunny failures during idempotent catalog image seeding. (@package/database)
* Document web account and general page contracts. (@app/web)
* Target mutation E2E coverage to changed product areas. (@app/web)
* Reuse exact-byte image uploads and cover collection image history, privacy, failure recovery, and deletion with browser tests. (@app/web)
* Run non-mutating browser regressions against the current worktree. (@app/web)
* Remove slider compatibility families and allow any available matching component. (@package/database, @package/services, @package/logger, @app/web)
* Document storage workflow contracts. (@package/services)
* Fix public collection test fixture typing. (@app/web)
* Reduce collection cover E2E upload fixture sizes. (@app/web)
* Skip irrelevant pull request validation with conservative change-aware CI and Storybook gates. (@app/web)
* Seed KAP EDC products and complete image galleries in non-production databases. (@package/database)
* Document account and feedback service contracts. (@package/services)
* Link blocked database preview comments to the exact Deploy run and branch-filtered history. (@app/web)
* Restore the missing historical migration snapshot. (@package/database)
* Keep hidden upload inputs from inheriting visible input dimensions. (@app/web)
* Remove obsolete plugin-specific lint configuration. (@package/lint)

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
