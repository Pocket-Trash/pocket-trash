# pocket-trash.app


















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
