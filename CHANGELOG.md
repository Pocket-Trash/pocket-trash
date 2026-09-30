# pocket-trash.app

























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
